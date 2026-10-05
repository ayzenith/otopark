/**
 * UYARI MERKEZİ
 *
 * ============================================================================
 * Patronun "neye bakmam gerekiyor?" sorusunun tek yanıtı. Her uyarı:
 *   · bir SAYIYA dayanır (tahmin değil),
 *   · bir EKRANA bağlanır (ne yapacağını bilsin),
 *   · önem derecesi taşır.
 *
 * SESSİZ KAYIP ÜRETMEME İLKESİ: Aşama 2–5'te "engellemek yerine uyar" diye
 * verilen her karar (tarifesiz çıkış, kasa dışı tahsilat, tahsilatsız yıkama,
 * ödenmemiş abonman) burada görünür hale gelir. Aksi halde o kararlar sessiz
 * kayba dönüşürdü.
 *
 * Eşikler İŞ KURALI DEĞİL, görüntüleme tercihidir (kaç gün kala uyarsın gibi);
 * fiyat veya ücret içermezler.
 * ============================================================================
 */

import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";

export type UyariOnemi = "kritik" | "uyari" | "bilgi";

export interface Uyari {
  kod: string;
  onem: UyariOnemi;
  baslik: string;
  ayrinti: string;
  /** İlgili ekran. */
  href: string;
  adet: number;
  tutarKurus?: number;
}

/** Abonman bitişi kaç gün önceden uyarılsın? Görüntüleme tercihi. */
const ABONMAN_UYARI_GUNU = 7;
/** Araç kaç saatten uzun içeride kalırsa uyarılsın? */
const UZUN_PARK_SAATI = 48;

export async function uyarilar(): Promise<Uyari[]> {
  const simdi = new Date();
  const bugun = businessDayRange(simdi);
  const liste: Uyari[] = [];

  const [
    tarifeSurumu,
    bitecekAbonman,
    dolmusAbonman,
    odenmemisAbonman,
    uzunPark,
    tarifesizPark,
    tahsilEdilmemisYikama,
    fiyatsizYikamaSatiri,
    kasaDisi,
    farkliKasa,
    acikKasaSayisi,
    kritikStokSayisi,
    acikAvans,
  ] = await Promise.all([
    prisma.tariffVersion.count({
      where: {
        isActive: true,
        effectiveFrom: { lte: simdi },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: simdi } }],
        tariffPlan: { isActive: true },
      },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        endDate: { gte: simdi, lt: new Date(simdi.getTime() + ABONMAN_UYARI_GUNU * 86_400_000) },
      },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE", endDate: { lt: simdi } } }),
    prisma.subscription.aggregate({
      where: { status: "ACTIVE", paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      _count: true,
      _sum: { agreedPrice: true },
    }),
    prisma.parkingSession.count({
      where: {
        status: "ACTIVE",
        entryAt: { lt: new Date(simdi.getTime() - UZUN_PARK_SAATI * 3600_000) },
      },
    }),
    // Tarifesi çözümlenemeyen aktif park: çıkışta ücret hesaplanamaz.
    prisma.parkingSession.count({
      where: { status: "ACTIVE", tariffRuleId: null, billingMode: "TARIFF" },
    }),
    prisma.washJob.count({ where: { status: "COMPLETED", paymentStatus: "UNPAID" } }),
    // Fiyatı tanımsız satırla kaydedilmiş yıkama kalemi (0 ₺ sanılmasın).
    prisma.washJobItem.count({
      where: { unitPrice: 0, washJob: { status: { not: "CANCELLED" } } },
    }),
    prisma.payment.aggregate({
      where: {
        cashDrawerSessionId: null,
        method: "CASH",
        direction: "IN",
        status: "CONFIRMED",
        paidAt: { gte: bugun.start, lt: bugun.end },
      },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.cashDrawerSession.findMany({
      where: { status: "CLOSED", countedCash: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 30,
      select: { expectedCash: true, countedCash: true },
    }),
    prisma.cashDrawerSession.count({ where: { status: "OPEN" } }),
    prisma.inventoryItem.count({ where: { isActive: true, minStock: { not: null } } }),
    prisma.staffAdvance.aggregate({
      where: { status: "OPEN" },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  // --- TARİFE ---
  if (tarifeSurumu === 0) {
    liste.push({
      kod: "tarife_yok",
      onem: "kritik",
      baslik: "Otopark tarifesi girilmemiş",
      ayrinti:
        "Çıkışlarda ücret hesaplanamaz. Araç girişi engellenmez ama tahsilat 0 ₺ kaydedilir.",
      href: "/yonetim/ayarlar/tarifeler",
      adet: 1,
    });
  }

  if (tarifesizPark > 0) {
    liste.push({
      kod: "tarifesiz_park",
      onem: "kritik",
      baslik: `${tarifesizPark} araç tarifesiz girmiş`,
      ayrinti:
        "Bu araçların çıkışında ücret hesaplanamayacak (ör. karavan kuralı yoksa). " +
        "Tarife girildikten sonra bile GİRİŞ ANINDAKİ tarife geçerli olduğu için " +
        "bu kayıtlar ücretsiz çıkar.",
      href: "/araclar",
      adet: tarifesizPark,
    });
  }

  // --- KASA ---
  if (kasaDisi._count > 0) {
    liste.push({
      kod: "kasa_disi_tahsilat",
      onem: "uyari",
      baslik: `${kasaDisi._count} nakit tahsilat kasa dışında`,
      ayrinti:
        "Kasa oturumu açık değilken yapıldı; hiçbir kasa sayımına girmiyor. " +
        "Personele kasayı açmayı hatırlatın.",
      href: "/yonetim/kasa",
      adet: kasaDisi._count,
      tutarKurus: toKurus(kasaDisi._sum.amount),
    });
  }

  const farkli = farkliKasa.filter((k) => {
    const beklenen = k.expectedCash === null ? 0 : toKurus(k.expectedCash);
    const sayilan = k.countedCash === null ? 0 : toKurus(k.countedCash);
    return beklenen !== sayilan;
  });
  if (farkli.length > 0) {
    const netFark = farkli.reduce(
      (t, k) =>
        t +
        ((k.countedCash === null ? 0 : toKurus(k.countedCash)) -
          (k.expectedCash === null ? 0 : toKurus(k.expectedCash))),
      0,
    );
    liste.push({
      kod: "kasa_farki",
      onem: "uyari",
      baslik: `${farkli.length} kasa kapanışında fark var`,
      ayrinti: "Son 30 kapanış içinde. Gerekçeleri kasa geçmişinde görebilirsiniz.",
      href: "/yonetim/kasa",
      adet: farkli.length,
      tutarKurus: netFark,
    });
  }

  if (acikKasaSayisi === 0) {
    liste.push({
      kod: "kasa_kapali",
      onem: "bilgi",
      baslik: "Kasa oturumu açık değil",
      ayrinti:
        "Şu anda yapılan nakit tahsilatlar hiçbir kasa sayımına girmeyecek.",
      href: "/kasa",
      adet: 1,
    });
  }

  // --- ABONMAN ---
  if (bitecekAbonman > 0) {
    liste.push({
      kod: "abonman_bitiyor",
      onem: "uyari",
      baslik: `${bitecekAbonman} abonman ${ABONMAN_UYARI_GUNU} gün içinde bitiyor`,
      ayrinti: "Yenileme için müşteriyle görüşülmeli.",
      href: "/abonmanlar",
      adet: bitecekAbonman,
    });
  }
  if (dolmusAbonman > 0) {
    liste.push({
      kod: "abonman_dolmus",
      onem: "uyari",
      baslik: `${dolmusAbonman} abonmanın süresi dolmuş ama hâlâ AKTİF`,
      ayrinti:
        "Bu araçlar abonmanlı sanılıp ücretsiz çıkabilir. Yenileyin veya kapatın.",
      href: "/abonmanlar",
      adet: dolmusAbonman,
    });
  }
  if (odenmemisAbonman._count > 0) {
    liste.push({
      kod: "abonman_odenmemis",
      onem: "uyari",
      baslik: `${odenmemisAbonman._count} abonmanın tahsilatı alınmamış`,
      ayrinti:
        "Karar gereği (S9) bu abonmanlar geçerli sayılıyor ve araçlar giriyor; " +
        "tahsilat takibi sizde.",
      href: "/yonetim/abonman/odemeler",
      adet: odenmemisAbonman._count,
      tutarKurus: toKurus(odenmemisAbonman._sum.agreedPrice),
    });
  }

  // --- PARK ---
  if (uzunPark > 0) {
    liste.push({
      kod: "uzun_park",
      onem: "uyari",
      baslik: `${uzunPark} araç ${UZUN_PARK_SAATI} saatten uzun içeride`,
      ayrinti: "Hatalı kayıt veya terk edilmiş araç olabilir; kontrol edin.",
      href: "/araclar",
      adet: uzunPark,
    });
  }

  // --- YIKAMA ---
  if (tahsilEdilmemisYikama > 0) {
    liste.push({
      kod: "yikama_tahsil_edilmemis",
      onem: "uyari",
      baslik: `${tahsilEdilmemisYikama} yıkama tamamlandı ama tahsil edilmedi`,
      ayrinti: "Gerekçeleri yıkama kaydında yazılı; takip sizde.",
      href: "/yonetim/yikama",
      adet: tahsilEdilmemisYikama,
    });
  }
  if (fiyatsizYikamaSatiri > 0) {
    liste.push({
      kod: "yikama_fiyatsiz",
      onem: "uyari",
      baslik: `${fiyatsizYikamaSatiri} yıkama kalemi 0 ₺ kaydedilmiş`,
      ayrinti:
        "Fiyatı girilmemiş hizmetle kaydedilen satırlar. Hizmet fiyatlarını " +
        "girince yeni kayıtlar doğru ücretlenir (geçmiş kayıtlar değişmez).",
      href: "/yonetim/ayarlar/yikama",
      adet: fiyatsizYikamaSatiri,
    });
  }

  // --- STOK ---
  if (kritikStokSayisi > 0) {
    // Eşiği olan malzemeler okunup bellekte kıyaslanır: Prisma alan-alan
    // karşılaştırmayı desteklemiyor, malzeme sayısı onlarla ölçülür.
    const malzemeler = await prisma.inventoryItem.findMany({
      where: { isActive: true, minStock: { not: null } },
      select: { name: true, currentStock: true, minStock: true },
    });
    const kritikler = malzemeler.filter(
      (m) => Number(m.currentStock.toString()) <= Number(m.minStock!.toString()),
    );
    if (kritikler.length > 0) {
      liste.push({
        kod: "kritik_stok",
        onem: "uyari",
        baslik: `${kritikler.length} malzeme asgari stoğun altında`,
        ayrinti: kritikler.map((m) => m.name).join(", "),
        href: "/stok",
        adet: kritikler.length,
      });
    }
  }

  // --- PERSONEL AVANSI (alacak, gider değil) ---
  if (acikAvans._count > 0) {
    liste.push({
      kod: "acik_avans",
      onem: "bilgi",
      baslik: `${acikAvans._count} personel avansı maaştan düşülmeyi bekliyor`,
      ayrinti:
        "Avans gider değil, işletmenin alacağıdır. Maaş ödemesinde mahsup edilir.",
      href: "/yonetim/personel",
      adet: acikAvans._count,
      tutarKurus: toKurus(acikAvans._sum.amount),
    });
  }

  const sira: Record<UyariOnemi, number> = { kritik: 0, uyari: 1, bilgi: 2 };
  return liste.sort((a, b) => sira[a.onem] - sira[b.onem]);
}
