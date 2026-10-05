/**
 * GELIR-GIDER RAPORLARI (okuma)
 *
 * ============================================================================
 * TEMEL ILKE: gelir ve gider AYNI kaynaklardan okunur, elle toplanmaz.
 *   Gelir  : Payment (CONFIRMED) - kaynagina gore ayrilir (park/yikama/
 *            abonman/diger). Iadeler (direction = OUT) DUSULUR.
 *   Gider  : Expense (CONFIRMED). Iptal edilen (VOIDED) satirlar SAYILMAZ.
 *
 * Net = gelir - gider. Bu bir KASA bakiyesi DEGILDIR (kasa dokumu ayri):
 * karta yapilan tahsilat kasada para olarak durmaz.
 *
 * OTOPARK VE YIKAMA AYRI RAPORLANIR (mimari kural 11): iki modulun tutarlari
 * tek satirda toplanmaz, kalem kalem gosterilir.
 * ============================================================================
 */

import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";

export interface GelirDokumu {
  park: number;
  yikama: number;
  abonman: number;
  diger: number;
  /** Iadeler (ters kayitlar) - gelirden DUSULUR. */
  iade: number;
  toplam: number;
  /** Odeme yontemine gore dagilim (net: giris - cikis). */
  nakit: number;
  kart: number;
  digerYontem: number;
}

export interface GiderDokumu {
  kalemler: { kategoriId: string; kategori: string; tutar: number; adet: number }[];
  nakit: number;
  kart: number;
  digerYontem: number;
  toplam: number;
}

export interface FinansRaporu {
  baslangic: Date;
  bitis: Date;
  gelir: GelirDokumu;
  gider: GiderDokumu;
  /** gelir.toplam - gider.toplam */
  net: number;
}

/** Verilen tarih araligi icin gelir-gider raporu. Bitis HARIC. */
export async function finansRaporu(baslangic: Date, bitis: Date): Promise<FinansRaporu> {
  const [odemeler, giderler] = await Promise.all([
    prisma.payment.groupBy({
      by: ["sourceType", "direction", "method"],
      where: { status: "CONFIRMED", paidAt: { gte: baslangic, lt: bitis } },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["expenseCategoryId", "paymentMethod"],
      where: { status: "CONFIRMED", expenseDate: { gte: baslangic, lt: bitis } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // --- GELIR ---
  const girenToplam = (kaynak: string) =>
    odemeler
      .filter((o) => o.direction === "IN" && o.sourceType === kaynak)
      .reduce((t, o) => t + toKurus(o._sum.amount), 0);

  const yontemNet = (secim: (yontem: string) => boolean) =>
    odemeler
      .filter((o) => secim(o.method))
      .reduce((t, o) => t + (o.direction === "IN" ? 1 : -1) * toKurus(o._sum.amount), 0);

  const iade = odemeler
    .filter((o) => o.direction === "OUT")
    .reduce((t, o) => t + toKurus(o._sum.amount), 0);

  const park = girenToplam("PARKING");
  const yikama = girenToplam("WASH");
  const abonman = girenToplam("SUBSCRIPTION");
  const digerGelir = girenToplam("OTHER_INCOME");

  const gelir: GelirDokumu = {
    park,
    yikama,
    abonman,
    diger: digerGelir,
    iade,
    toplam: park + yikama + abonman + digerGelir - iade,
    nakit: yontemNet((y) => y === "CASH"),
    kart: yontemNet((y) => y === "CARD"),
    digerYontem: yontemNet((y) => y !== "CASH" && y !== "CARD"),
  };

  // --- GIDER ---
  const kategoriIdleri = [...new Set(giderler.map((g) => g.expenseCategoryId))];
  const kategoriler = await prisma.expenseCategory.findMany({
    where: { id: { in: kategoriIdleri } },
    select: { id: true, name: true },
  });
  const kategoriAdi = new Map(kategoriler.map((k) => [k.id, k.name]));

  const kalemHaritasi = new Map<string, { tutar: number; adet: number }>();
  for (const g of giderler) {
    const mevcut = kalemHaritasi.get(g.expenseCategoryId) ?? { tutar: 0, adet: 0 };
    kalemHaritasi.set(g.expenseCategoryId, {
      tutar: mevcut.tutar + toKurus(g._sum.amount),
      adet: mevcut.adet + g._count,
    });
  }

  const giderYontem = (secim: (yontem: string) => boolean) =>
    giderler
      .filter((g) => secim(g.paymentMethod))
      .reduce((t, g) => t + toKurus(g._sum.amount), 0);

  const kalemler = [...kalemHaritasi.entries()]
    .map(([kategoriId, v]) => ({
      kategoriId,
      kategori: kategoriAdi.get(kategoriId) ?? "—",
      tutar: v.tutar,
      adet: v.adet,
    }))
    .sort((a, b) => b.tutar - a.tutar);

  const gider: GiderDokumu = {
    kalemler,
    nakit: giderYontem((y) => y === "CASH"),
    kart: giderYontem((y) => y === "CARD"),
    digerYontem: giderYontem((y) => y !== "CASH" && y !== "CARD"),
    toplam: kalemler.reduce((t, k) => t + k.tutar, 0),
  };

  return {
    baslangic,
    bitis,
    gelir,
    gider,
    net: gelir.toplam - gider.toplam,
  };
}

/** Bugunun raporu (isletme gunu: 00:00 - 00:00 Europe/Istanbul). */
export async function gunlukFinansRaporu(gun = new Date()): Promise<FinansRaporu> {
  const { start, end } = businessDayRange(gun);
  return finansRaporu(start, end);
}

/** Bu ayin raporu (ayin 1'inden bugunun sonuna). */
export async function aylikFinansRaporu(gun = new Date()): Promise<FinansRaporu> {
  const { end } = businessDayRange(gun);
  const ayBasi = businessDayRange(new Date(gun.getFullYear(), gun.getMonth(), 1)).start;
  return finansRaporu(ayBasi, end);
}

export interface GiderSatiri {
  id: string;
  kod: string;
  kategori: string;
  tutar: number;
  tarih: Date;
  yontem: string;
  aciklama: string;
  tedarikci: string | null;
  belgeNo: string | null;
  iptal: boolean;
  iptalSebebi: string | null;
  girenKisi: string | null;
  kasaOturumuId: string | null;
}

/** Gider listesi. Iptal edilenler de GOSTERILIR (silinmiyor, gizlenmiyor). */
export async function giderListesi(
  opts: { baslangic?: Date; bitis?: Date; kategoriId?: string; limit?: number } = {},
): Promise<GiderSatiri[]> {
  const liste = await prisma.expense.findMany({
    where: {
      ...(opts.baslangic || opts.bitis
        ? { expenseDate: { ...(opts.baslangic && { gte: opts.baslangic }), ...(opts.bitis && { lt: opts.bitis }) } }
        : {}),
      ...(opts.kategoriId ? { expenseCategoryId: opts.kategoriId } : {}),
    },
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 100,
    include: {
      expenseCategory: { select: { name: true } },
      createdBy: { select: { fullName: true, username: true } },
    },
  });

  return liste.map((g) => ({
    id: g.id,
    kod: g.code,
    kategori: g.expenseCategory.name,
    tutar: toKurus(g.amount),
    tarih: g.expenseDate,
    yontem: g.paymentMethod,
    aciklama: g.description,
    tedarikci: g.supplierName,
    belgeNo: g.documentNo,
    iptal: g.status === "VOIDED",
    iptalSebebi: g.voidReason,
    girenKisi: g.createdBy?.fullName ?? g.createdBy?.username ?? null,
    kasaOturumuId: g.cashDrawerSessionId,
  }));
}

export interface DigerGelirSatiri {
  id: string;
  kod: string;
  etiket: string;
  tutar: number;
  tarih: Date;
  yontem: string;
  aciklama: string | null;
  iptal: boolean;
  iptalSebebi: string | null;
  girenKisi: string | null;
}

export async function digerGelirListesi(
  opts: { baslangic?: Date; bitis?: Date; limit?: number } = {},
): Promise<DigerGelirSatiri[]> {
  const liste = await prisma.otherIncome.findMany({
    where:
      opts.baslangic || opts.bitis
        ? { incomeDate: { ...(opts.baslangic && { gte: opts.baslangic }), ...(opts.bitis && { lt: opts.bitis }) } }
        : {},
    orderBy: [{ incomeDate: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 100,
    include: { createdBy: { select: { fullName: true, username: true } } },
  });

  return liste.map((g) => ({
    id: g.id,
    kod: g.code,
    etiket: g.label,
    tutar: toKurus(g.amount),
    tarih: g.incomeDate,
    yontem: g.method,
    aciklama: g.description,
    iptal: g.status === "VOIDED",
    iptalSebebi: g.voidReason,
    girenKisi: g.createdBy?.fullName ?? g.createdBy?.username ?? null,
  }));
}
