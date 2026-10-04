/**
 * ABONMAN VE MUSTERI SORGULARI (okuma).
 *
 * Listeler acilmadan once abonmanDurumlariniTazele() cagrilir: suresi dolan
 * abonman EXPIRED, basladigi halde bekleyen ACTIVE olur. Bu tazeleme
 * UCRET HESABI ICIN GEREKLI DEGILDIR (cozumleAbonman daima tarihe bakar);
 * yalnizca listelerin ve uyarilarin dogru gorunmesi icindir.
 *
 * TUTAR GOSTERIMI: abonman ucreti finansal bilgidir. Personel ekranlarinda
 * (plakaAbonmanSorgu) tutar DONDURULMEZ; yalnizca odeme durumu doner.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { daysBetween } from "@/lib/datetime";
import { toKurus } from "@/lib/money";
import { normalizePlate } from "@/lib/plate";
import { abonmanDurumlariniTazele } from "./manage";
import { BITIYOR_ESIGI_GUN, cozumleAbonman, type AbonmanBilgisi } from "./resolve";

export type AbonmanFiltresi =
  | "tumu"
  | "aktif"
  | "yaklasan"
  | "dolmus"
  | "odenmemis"
  | "iptal";

export const FILTRE_ETIKETLERI: Record<AbonmanFiltresi, string> = {
  tumu: "Tümü",
  aktif: "Aktif",
  yaklasan: "Süresi yaklaşan",
  dolmus: "Süresi dolan",
  odenmemis: "Ödenmemiş",
  iptal: "İptal",
};

export const DURUM_ETIKETLERI: Record<string, string> = {
  PENDING: "Başlamadı",
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  CANCELLED: "İptal",
  SUSPENDED: "Askıda",
};

export const ODEME_ETIKETLERI: Record<string, string> = {
  UNPAID: "Ödenmedi",
  PARTIAL: "Kısmi ödeme",
  PAID: "Ödendi",
};

/** Patron panelindeki sayaclar. */
export async function abonmanSayaclari(simdi = new Date()) {
  await abonmanDurumlariniTazele(simdi);
  const esik = new Date(simdi.getTime() + BITIYOR_ESIGI_GUN * 86_400_000);

  const [aktif, yaklasan, dolmus, odenmemis, musteri, abonmanliArac] = await Promise.all([
    prisma.subscription.count({
      where: { status: "ACTIVE", startDate: { lte: simdi }, endDate: { gte: simdi } },
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", endDate: { gte: simdi, lte: esik } },
    }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
    // S9: odenmemis abonman GECERLIDIR; bu sayac yalnizca patron uyarisidir.
    prisma.subscription.count({
      where: { status: "ACTIVE", paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
    }),
    prisma.customer.count({ where: { isActive: true } }),
    prisma.subscriptionVehicle.count({
      where: {
        removedAt: null,
        subscription: { status: "ACTIVE", startDate: { lte: simdi }, endDate: { gte: simdi } },
      },
    }),
  ]);

  return { aktif, yaklasan, dolmus, odenmemis, musteri, abonmanliArac };
}

export interface AbonmanSatiri {
  id: string;
  kod: string;
  musteriId: string;
  musteriAdi: string;
  telefon: string;
  planEtiketi: string;
  baslangic: Date;
  bitis: Date;
  durum: string;
  odemeDurumu: string;
  ucretKurus: number;
  kalanGun: number;
  plakalar: string[];
  donemSayisi: number;
}

export async function abonmanListesi(
  filtre: AbonmanFiltresi = "tumu",
  simdi = new Date(),
): Promise<AbonmanSatiri[]> {
  await abonmanDurumlariniTazele(simdi);
  const esik = new Date(simdi.getTime() + BITIYOR_ESIGI_GUN * 86_400_000);

  const kosullar: Record<AbonmanFiltresi, Prisma.SubscriptionWhereInput> = {
    tumu: {},
    aktif: { status: "ACTIVE", startDate: { lte: simdi }, endDate: { gte: simdi } },
    yaklasan: { status: "ACTIVE", endDate: { gte: simdi, lte: esik } },
    dolmus: { status: "EXPIRED" },
    // S9: odenmemis abonman gecersiz DEGILDIR; bu yalnizca takip listesidir.
    odenmemis: { status: "ACTIVE", paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
    iptal: { status: "CANCELLED" },
  };
  const kosul = kosullar[filtre];

  const kayitlar = await prisma.subscription.findMany({
    where: kosul,
    orderBy: filtre === "yaklasan" ? { endDate: "asc" } : { createdAt: "desc" },
    take: 200,
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicles: {
        where: { removedAt: null },
        include: { vehicle: { select: { plateDisplay: true } } },
      },
      _count: { select: { periods: true } },
    },
  });

  return kayitlar.map((a) => ({
    id: a.id,
    kod: a.code,
    musteriId: a.customer.id,
    musteriAdi: a.customer.fullName,
    telefon: a.customer.phone,
    planEtiketi: a.planLabel,
    baslangic: a.startDate,
    bitis: a.endDate,
    durum: a.status,
    odemeDurumu: a.paymentStatus,
    ucretKurus: toKurus(a.agreedPrice),
    kalanGun: daysBetween(simdi, a.endDate),
    plakalar: a.vehicles.map((v) => v.vehicle.plateDisplay),
    donemSayisi: a._count.periods,
  }));
}

/** ABONMANLI ARACLAR listesi: aktif kapsamdaki her plaka bir satir. */
export async function abonmanliAraclar(simdi = new Date()) {
  await abonmanDurumlariniTazele(simdi);

  const baglar = await prisma.subscriptionVehicle.findMany({
    where: {
      removedAt: null,
      subscription: { status: "ACTIVE", startDate: { lte: simdi }, endDate: { gte: simdi } },
    },
    include: {
      vehicle: {
        select: {
          id: true,
          plateDisplay: true,
          plateNormalized: true,
          brandModel: true,
          color: true,
          vehicleClass: { select: { name: true } },
        },
      },
      subscription: {
        select: {
          id: true,
          code: true,
          endDate: true,
          paymentStatus: true,
          planLabel: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      },
    },
    orderBy: { subscription: { endDate: "asc" } },
    take: 300,
  });

  return baglar.map((b) => ({
    vehicleId: b.vehicle.id,
    plaka: b.vehicle.plateDisplay,
    plakaNormal: b.vehicle.plateNormalized,
    markaModel: b.vehicle.brandModel,
    renk: b.vehicle.color,
    aracSinifi: b.vehicle.vehicleClass.name,
    abonmanId: b.subscription.id,
    abonmanKodu: b.subscription.code,
    planEtiketi: b.subscription.planLabel,
    bitis: b.subscription.endDate,
    kalanGun: daysBetween(simdi, b.subscription.endDate),
    odemeDurumu: b.subscription.paymentStatus,
    musteriId: b.subscription.customer.id,
    musteriAdi: b.subscription.customer.fullName,
    telefon: b.subscription.customer.phone,
  }));
}

/** Abonman detayi: donemler, araclar ve tahsilat gecmisi. */
export async function abonmanDetay(subscriptionId: string) {
  const a = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      customer: true,
      periods: { orderBy: { periodNo: "desc" } },
      vehicles: {
        orderBy: { addedAt: "desc" },
        include: {
          vehicle: {
            select: {
              id: true,
              plateDisplay: true,
              brandModel: true,
              color: true,
              vehicleClass: { select: { name: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          payment: {
            select: {
              id: true,
              code: true,
              amount: true,
              method: true,
              direction: true,
              status: true,
              voidReason: true,
              paidAt: true,
              cardNote: true,
              collectedBy: { select: { username: true, fullName: true } },
            },
          },
          subscriptionPeriod: { select: { periodNo: true } },
        },
      },
    },
  });
  if (!a) return null;

  // Donem basina tahsil edilen tutar: iptal edilenler ve ters kayitlar dusulur.
  const donemTahsilat = new Map<string, number>();
  for (const t of a.payments) {
    if (t.payment.status !== "CONFIRMED") continue;
    const anahtar = t.subscriptionPeriodId ?? "—";
    const tutar = toKurus(t.payment.amount);
    donemTahsilat.set(
      anahtar,
      (donemTahsilat.get(anahtar) ?? 0) + (t.payment.direction === "OUT" ? -tutar : tutar),
    );
  }

  return {
    abonman: a,
    donemler: a.periods.map((d) => {
      const fiyat = toKurus(d.price);
      const tahsil = donemTahsilat.get(d.id) ?? 0;
      return {
        id: d.id,
        donemNo: d.periodNo,
        baslangic: d.startDate,
        bitis: d.endDate,
        fiyatKurus: fiyat,
        tahsilEdilenKurus: tahsil,
        kalanKurus: Math.max(0, fiyat - tahsil),
        fazlaKurus: Math.max(0, tahsil - fiyat),
        not: d.note,
        kuralTuru: d.accessRuleKind,
        sonDonemMu: d.periodNo === (a.periods[0]?.periodNo ?? d.periodNo),
      };
    }),
  };
}

/** ABONMAN ODEME GECMISI - patron ekrani. */
export async function abonmanOdemeGecmisi(opts: { limit?: number; musteriId?: string } = {}) {
  const kayitlar = await prisma.subscriptionPayment.findMany({
    where: opts.musteriId ? { subscription: { customerId: opts.musteriId } } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: {
      subscription: {
        select: { id: true, code: true, customer: { select: { id: true, fullName: true } } },
      },
      subscriptionPeriod: { select: { periodNo: true } },
      payment: {
        select: {
          code: true,
          amount: true,
          method: true,
          direction: true,
          status: true,
          voidReason: true,
          paidAt: true,
          collectedBy: { select: { username: true, fullName: true } },
        },
      },
    },
  });

  return kayitlar.map((k) => ({
    paymentId: k.paymentId,
    tahsilatKodu: k.payment.code,
    abonmanId: k.subscription.id,
    abonmanKodu: k.subscription.code,
    musteriId: k.subscription.customer.id,
    musteriAdi: k.subscription.customer.fullName,
    donemNo: k.subscriptionPeriod?.periodNo ?? null,
    tutarKurus: toKurus(k.payment.amount),
    yontem: k.payment.method,
    yon: k.payment.direction,
    durum: k.payment.status,
    iptalSebebi: k.payment.voidReason,
    tarih: k.payment.paidAt,
    tahsilEden: k.payment.collectedBy.fullName || k.payment.collectedBy.username,
  }));
}

// ---------------------------------------------------------------------------
// PERSONEL: PLAKA ILE HIZLI ABONMAN SORGUSU
// ---------------------------------------------------------------------------

export interface PlakaAbonmanSonucu {
  plakaGosterim: string;
  bulunduMu: boolean;
  aracSinifi: string | null;
  markaModel: string | null;
  renk: string | null;
  /** Aracin kayitli sahibi (abonman olmasa da gorunur). */
  sahipAdi: string | null;
  sahipId: string | null;
  /** Arac su anda otoparkta mi? */
  otoparktaMi: boolean;
  abonman: AbonmanBilgisi;
}

/**
 * Personelin plaka yazip tek dokunusla gordugu abonman karti.
 *
 * HICBIR SEY YAZMAZ. Tutar dondurmez. Aktif abonman varsa ucret hesaplama
 * akisi acilmaz; cagiran arayuz bu bilgiye gore karari verir.
 */
export async function plakaAbonmanSorgu(
  plakaVeyaId: string,
  simdi = new Date(),
): Promise<PlakaAbonmanSonucu> {
  const plateNormalized = normalizePlate(plakaVeyaId);

  const [arac, abonman, aktifPark] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { plateNormalized },
      include: {
        vehicleClass: { select: { name: true } },
        customer: { select: { id: true, fullName: true } },
      },
    }),
    cozumleAbonman(plateNormalized, simdi),
    prisma.parkingSession.count({ where: { plateNormalized, status: "ACTIVE" } }),
  ]);

  return {
    plakaGosterim: arac?.plateDisplay ?? plateNormalized,
    bulunduMu: arac !== null || abonman.durum !== "YOK",
    aracSinifi: arac?.vehicleClass.name ?? null,
    markaModel: arac?.brandModel ?? null,
    renk: arac?.color ?? null,
    sahipAdi: arac?.customer?.fullName ?? abonman.musteriAdi,
    sahipId: arac?.customer?.id ?? abonman.musteriId,
    otoparktaMi: aktifPark > 0,
    abonman,
  };
}
