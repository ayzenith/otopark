/**
 * PATRON PANELİ VERİSİ
 *
 * ============================================================================
 * Yalnızca OKUMA. Tüm tutarlar kuruş tamsayı; biçimleme arayüzde yapılır.
 *
 * MİMARİ KURAL 11: otopark, yıkama ve abonman tek "ciro" sayısında eritilmez;
 * kalem kalem döner.
 *
 * NET, KASA BAKİYESİ DEĞİLDİR: karta yapılan tahsilat kasada para olarak
 * durmaz. Kasa durumu ayrı ekrandadır.
 *
 * KAPASİTE: işletme kararı gereği sınır yok (totalCapacity = 0). Bu yüzden
 * panel doluluk YÜZDESİ ÜRETMEZ — anlamsız bir oran göstermek yanlış bilgidir.
 * Yalnızca "otoparkta kaç araç var" sayısı döner.
 * ============================================================================
 */

import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";
import { finansRaporu, type FinansRaporu } from "@/server/finance/queries";
import { yuzdeDegisim, type Aralik } from "./range";

export interface PanelSayaclari {
  otoparktaki: number;
  girisAdedi: number;
  cikisAdedi: number;
  aktifAbonman: number;
  yikamaAdedi: number;
  /** Kapasite tanımlı değilse null (karar: sınır yok). */
  dolulukYuzdesi: number | null;
}

export interface KarsilastirmaSatiri {
  etiket: string;
  simdi: number;
  onceki: number;
  /** null = önceki dönem 0; yüzde tanımsız. */
  yuzde: number | null;
}

export interface GunlukTrendNoktasi {
  gun: Date;
  park: number;
  yikama: number;
  abonman: number;
  toplam: number;
}

export interface PanelVerisi {
  aralik: Aralik;
  sayaclar: PanelSayaclari;
  rapor: FinansRaporu;
  oncekiRapor: FinansRaporu;
  karsilastirma: KarsilastirmaSatiri[];
  trend: GunlukTrendNoktasi[];
  aktifVardiyalar: {
    shiftId: string;
    personel: string;
    baslangicAt: Date;
    tahsilatKurus: number;
  }[];
  kasaAcikMi: boolean;
}

export async function panelVerisi(aralik: Aralik): Promise<PanelVerisi> {
  const [rapor, oncekiRapor, sayaclar, trend, aktifVardiyalar, acikKasa] = await Promise.all([
    finansRaporu(aralik.baslangic, aralik.bitis),
    finansRaporu(aralik.oncekiBaslangic, aralik.oncekiBitis),
    panelSayaclari(aralik),
    gunlukTrend(30),
    aktifVardiyaOzetleri(),
    prisma.cashDrawerSession.count({ where: { status: "OPEN" } }),
  ]);

  const karsilastirma: KarsilastirmaSatiri[] = [
    { etiket: "Otopark", simdi: rapor.gelir.park, onceki: oncekiRapor.gelir.park },
    { etiket: "Oto yıkama", simdi: rapor.gelir.yikama, onceki: oncekiRapor.gelir.yikama },
    { etiket: "Abonman", simdi: rapor.gelir.abonman, onceki: oncekiRapor.gelir.abonman },
    { etiket: "Gelir toplamı", simdi: rapor.gelir.toplam, onceki: oncekiRapor.gelir.toplam },
    { etiket: "Gider toplamı", simdi: rapor.gider.toplam, onceki: oncekiRapor.gider.toplam },
    { etiket: "Net", simdi: rapor.net, onceki: oncekiRapor.net },
  ].map((s) => ({ ...s, yuzde: yuzdeDegisim(s.simdi, s.onceki) }));

  return {
    aralik,
    sayaclar,
    rapor,
    oncekiRapor,
    karsilastirma,
    trend,
    aktifVardiyalar,
    kasaAcikMi: acikKasa > 0,
  };
}

async function panelSayaclari(aralik: Aralik): Promise<PanelSayaclari> {
  const [otoparktaki, girisAdedi, cikisAdedi, aktifAbonman, yikamaAdedi, kapasite] =
    await Promise.all([
      prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
      prisma.parkingSession.count({
        where: { entryAt: { gte: aralik.baslangic, lt: aralik.bitis } },
      }),
      prisma.parkingSession.count({
        where: { exitAt: { gte: aralik.baslangic, lt: aralik.bitis }, status: "COMPLETED" },
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.washJob.count({ where: { createdAt: { gte: aralik.baslangic, lt: aralik.bitis } } }),
      prisma.parkingCapacitySetting.findUnique({ where: { id: "singleton" } }),
    ]);

  const limit = kapasite?.totalCapacity ?? 0;

  return {
    otoparktaki,
    girisAdedi,
    cikisAdedi,
    aktifAbonman,
    yikamaAdedi,
    // Kapasite tanımlı DEĞİLSE yüzde üretilmez (karar 04.10.2026).
    dolulukYuzdesi: limit > 0 ? Math.round((otoparktaki / limit) * 100) : null,
  };
}

/**
 * Son N günün günlük gelir trendi (otopark / yıkama / abonman).
 *
 * Tek sorguda çekilip bellekte günlere bölünür; gün başına ayrı sorgu atmak
 * 30 ayrı tur demek olurdu.
 */
export async function gunlukTrend(gunSayisi = 30): Promise<GunlukTrendNoktasi[]> {
  const bugun = businessDayRange();
  const baslangic = new Date(bugun.end.getTime() - gunSayisi * 86_400_000);

  const odemeler = await prisma.payment.findMany({
    where: {
      status: "CONFIRMED",
      direction: "IN",
      paidAt: { gte: baslangic, lt: bugun.end },
      sourceType: { in: ["PARKING", "WASH", "SUBSCRIPTION"] },
    },
    select: { paidAt: true, amount: true, sourceType: true },
  });

  // Gün anahtarı: Istanbul takvim günü.
  const gunAnahtari = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const harita = new Map<string, GunlukTrendNoktasi>();
  // Boş günler de görünsün: grafik kopuk olmasın.
  for (let i = gunSayisi - 1; i >= 0; i--) {
    const gun = new Date(bugun.start.getTime() - i * 86_400_000);
    harita.set(gunAnahtari(gun), { gun, park: 0, yikama: 0, abonman: 0, toplam: 0 });
  }

  for (const o of odemeler) {
    const anahtar = gunAnahtari(o.paidAt);
    const nokta = harita.get(anahtar);
    if (!nokta) continue;
    const kurus = toKurus(o.amount);
    if (o.sourceType === "PARKING") nokta.park += kurus;
    else if (o.sourceType === "WASH") nokta.yikama += kurus;
    else if (o.sourceType === "SUBSCRIPTION") nokta.abonman += kurus;
    nokta.toplam += kurus;
  }

  return [...harita.values()];
}

/** Şu anda açık vardiyalar ve her birinin tahsilat toplamı. */
export async function aktifVardiyaOzetleri() {
  const vardiyalar = await prisma.shift.findMany({
    where: { status: "OPEN" },
    orderBy: { startedAt: "asc" },
    include: { user: { select: { fullName: true, username: true } } },
  });
  if (vardiyalar.length === 0) return [];

  const tahsilatlar = await prisma.payment.groupBy({
    by: ["shiftId", "direction"],
    where: { shiftId: { in: vardiyalar.map((v) => v.id) }, status: "CONFIRMED" },
    _sum: { amount: true },
  });

  return vardiyalar.map((v) => {
    const giren = tahsilatlar
      .filter((t) => t.shiftId === v.id && t.direction === "IN")
      .reduce((top, t) => top + toKurus(t._sum.amount), 0);
    const cikan = tahsilatlar
      .filter((t) => t.shiftId === v.id && t.direction === "OUT")
      .reduce((top, t) => top + toKurus(t._sum.amount), 0);
    return {
      shiftId: v.id,
      personel: v.user.fullName || v.user.username,
      baslangicAt: v.startedAt,
      tahsilatKurus: giren - cikan,
    };
  });
}

// ---------------------------------------------------------------------------
// PERSONEL BAZLI TAHSİLAT RAPORU (Aşama 5'ten devir)
// ---------------------------------------------------------------------------

export interface PersonelTahsilatSatiri {
  userId: string;
  personel: string;
  nakit: number;
  kart: number;
  diger: number;
  iade: number;
  toplam: number;
  park: number;
  yikama: number;
  abonman: number;
  islemSayisi: number;
  vardiyaSayisi: number;
}

/**
 * Dönemde her personelin tahsilatı.
 *
 * "Kim ne kadar tahsil etti" sorusunu yanıtlar; kasa farkı araştırmasının ilk
 * adımıdır. İADELER AYRI GÖSTERİLİR ve toplamdan düşülür.
 */
export async function personelTahsilatRaporu(
  aralik: Aralik,
): Promise<PersonelTahsilatSatiri[]> {
  const gruplar = await prisma.payment.groupBy({
    by: ["collectedById", "method", "direction", "sourceType"],
    where: { status: "CONFIRMED", paidAt: { gte: aralik.baslangic, lt: aralik.bitis } },
    _sum: { amount: true },
    _count: true,
  });
  if (gruplar.length === 0) return [];

  const kullaniciIdleri = [...new Set(gruplar.map((g) => g.collectedById))];
  const [kisiler, vardiyalar] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: kullaniciIdleri } },
      select: { id: true, fullName: true, username: true },
    }),
    prisma.shift.groupBy({
      by: ["userId"],
      where: {
        userId: { in: kullaniciIdleri },
        startedAt: { gte: aralik.baslangic, lt: aralik.bitis },
      },
      _count: true,
    }),
  ]);
  const adHarita = new Map(kisiler.map((k) => [k.id, k.fullName || k.username]));
  const vardiyaHarita = new Map(vardiyalar.map((v) => [v.userId, v._count]));

  const satirlar = new Map<string, PersonelTahsilatSatiri>();

  for (const g of gruplar) {
    const mevcut =
      satirlar.get(g.collectedById) ??
      ({
        userId: g.collectedById,
        personel: adHarita.get(g.collectedById) ?? "—",
        nakit: 0,
        kart: 0,
        diger: 0,
        iade: 0,
        toplam: 0,
        park: 0,
        yikama: 0,
        abonman: 0,
        islemSayisi: 0,
        vardiyaSayisi: vardiyaHarita.get(g.collectedById) ?? 0,
      } satisfies PersonelTahsilatSatiri);

    const kurus = toKurus(g._sum.amount);
    mevcut.islemSayisi += g._count;

    if (g.direction === "OUT") {
      mevcut.iade += kurus;
      mevcut.toplam -= kurus;
      if (g.method === "CASH") mevcut.nakit -= kurus;
      else if (g.method === "CARD") mevcut.kart -= kurus;
      else mevcut.diger -= kurus;
    } else {
      mevcut.toplam += kurus;
      if (g.method === "CASH") mevcut.nakit += kurus;
      else if (g.method === "CARD") mevcut.kart += kurus;
      else mevcut.diger += kurus;

      if (g.sourceType === "PARKING") mevcut.park += kurus;
      else if (g.sourceType === "WASH") mevcut.yikama += kurus;
      else if (g.sourceType === "SUBSCRIPTION") mevcut.abonman += kurus;
    }

    satirlar.set(g.collectedById, mevcut);
  }

  return [...satirlar.values()].sort((a, b) => b.toplam - a.toplam);
}
