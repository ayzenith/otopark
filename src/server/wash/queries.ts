/**
 * OTO YIKAMA SORGULARI (okuma)
 *
 * Raporlar OTOPARKTAN AYRI tutulur: yikama cirosu Payment.sourceType = WASH
 * kayitlarindan, park cirosu PARKING kayitlarindan okunur. Iki ciro hicbir
 * sorguda toplanmaz; patron hangisinin ne getirdigini ayri gorur.
 */

import { prisma } from "@/server/db";
import { businessDayRange } from "@/lib/datetime";
import { toKurus } from "@/lib/money";

/** Personel ekranindaki kuyruk: sirada ve yikamada olan isler. */
export async function yikamaKuyrugu() {
  const isler = await prisma.washJob.findMany({
    where: { status: { in: ["QUEUED", "IN_PROGRESS"] } },
    orderBy: [{ status: "asc" }, { queuedAt: "asc" }],
    include: {
      items: { select: { serviceNameSnapshot: true, quantity: true } },
      vehicleClass: { select: { name: true } },
      customer: { select: { id: true, fullName: true } },
      assignedUser: { select: { username: true, fullName: true } },
    },
  });

  return isler.map((i) => ({
    id: i.id,
    kod: i.code,
    plaka: i.plateDisplay,
    aracSinifi: i.vehicleClass.name,
    durum: i.status,
    siradaBeri: i.queuedAt,
    baslangic: i.startedAt,
    hizmetler: i.items.map((s) =>
      s.quantity > 1 ? `${s.serviceNameSnapshot} ×${s.quantity}` : s.serviceNameSnapshot,
    ),
    toplamKurus: toKurus(i.totalAmount),
    odemeDurumu: i.paymentStatus,
    musteriAdi: i.customer?.fullName ?? null,
    atananKisi: i.assignedUser?.fullName || i.assignedUser?.username || null,
    fiyatTanimsizMi: toKurus(i.totalAmount) === 0,
  }));
}

/** Tek is emrinin tam detayi. */
export async function yikamaDetay(washJobId: string) {
  const i = await prisma.washJob.findUnique({
    where: { id: washJobId },
    include: {
      items: { orderBy: { id: "asc" } },
      vehicleClass: { select: { id: true, name: true } },
      vehicle: { select: { id: true, brandModel: true, color: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      createdBy: { select: { username: true, fullName: true } },
      assignedUser: { select: { username: true, fullName: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          code: true,
          amount: true,
          method: true,
          direction: true,
          status: true,
          voidReason: true,
          cardNote: true,
          paidAt: true,
          collectedBy: { select: { username: true, fullName: true } },
        },
      },
    },
  });
  if (!i) return null;

  return {
    id: i.id,
    kod: i.code,
    plaka: i.plateDisplay,
    aracSinifiId: i.vehicleClass.id,
    aracSinifi: i.vehicleClass.name,
    markaModel: i.vehicle.brandModel,
    renk: i.vehicle.color,
    durum: i.status,
    odemeDurumu: i.paymentStatus,
    siradaBeri: i.queuedAt,
    baslangic: i.startedAt,
    bitis: i.completedAt,
    iptalTarihi: i.cancelledAt,
    iptalSebebi: i.cancelReason,
    not: i.notes,
    musteriId: i.customer?.id ?? null,
    musteriAdi: i.customer?.fullName ?? null,
    musteriTelefonu: i.customer?.phone ?? null,
    olusturan: i.createdBy.fullName || i.createdBy.username,
    atananKisi: i.assignedUser?.fullName || i.assignedUser?.username || null,
    toplamKurus: toKurus(i.totalAmount),
    indirimKurus: i.discountAmount ? toKurus(i.discountAmount) : 0,
    odenecekKurus: toKurus(i.payableAmount),
    tahsilEdilenKurus: i.collectedAmount ? toKurus(i.collectedAmount) : 0,
    satirlar: i.items.map((s) => ({
      id: s.id,
      ad: s.serviceNameSnapshot,
      adet: s.quantity,
      birimKurus: toKurus(s.unitPrice),
      toplamKurus: toKurus(s.lineTotal),
      fiyatTanimsizMi: toKurus(s.unitPrice) === 0,
    })),
    tahsilatlar: i.payments.map((o) => ({
      id: o.id,
      kod: o.code,
      tutarKurus: toKurus(o.amount),
      yontem: o.method,
      yon: o.direction,
      durum: o.status,
      iptalSebebi: o.voidReason,
      kartNotu: o.cardNote,
      tarih: o.paidAt,
      tahsilEden: o.collectedBy.fullName || o.collectedBy.username,
    })),
  };
}

/** Plakaya gore yikama gecmisi (personel sorgusu). */
export async function yikamaGecmisiPlaka(plateNormalized: string, limit = 20) {
  const isler = await prisma.washJob.findMany({
    where: { plateNormalized },
    orderBy: { queuedAt: "desc" },
    take: limit,
    include: {
      items: { select: { serviceNameSnapshot: true } },
      vehicleClass: { select: { name: true } },
    },
  });

  return isler.map((i) => ({
    id: i.id,
    kod: i.code,
    plaka: i.plateDisplay,
    aracSinifi: i.vehicleClass.name,
    durum: i.status,
    odemeDurumu: i.paymentStatus,
    tarih: i.queuedAt,
    hizmetler: i.items.map((s) => s.serviceNameSnapshot),
    toplamKurus: toKurus(i.totalAmount),
  }));
}

/** Gun/ay listesi. Tarih araligi verilmezse bugun. */
export async function yikamaListesi(opts: { baslangic?: Date; bitis?: Date; limit?: number } = {}) {
  const { start, end } = businessDayRange();
  const baslangic = opts.baslangic ?? start;
  const bitis = opts.bitis ?? end;

  const isler = await prisma.washJob.findMany({
    where: { queuedAt: { gte: baslangic, lt: bitis } },
    orderBy: { queuedAt: "desc" },
    take: opts.limit ?? 300,
    include: {
      items: { select: { serviceNameSnapshot: true, quantity: true } },
      vehicleClass: { select: { name: true } },
      customer: { select: { fullName: true } },
      assignedUser: { select: { username: true, fullName: true } },
      createdBy: { select: { username: true, fullName: true } },
    },
  });

  return isler.map((i) => ({
    id: i.id,
    kod: i.code,
    plaka: i.plateDisplay,
    aracSinifi: i.vehicleClass.name,
    durum: i.status,
    odemeDurumu: i.paymentStatus,
    tarih: i.queuedAt,
    bitis: i.completedAt,
    hizmetler: i.items.map((s) =>
      s.quantity > 1 ? `${s.serviceNameSnapshot} ×${s.quantity}` : s.serviceNameSnapshot,
    ),
    toplamKurus: toKurus(i.totalAmount),
    indirimKurus: i.discountAmount ? toKurus(i.discountAmount) : 0,
    tahsilEdilenKurus: i.collectedAmount ? toKurus(i.collectedAmount) : 0,
    musteriAdi: i.customer?.fullName ?? null,
    yapan: i.assignedUser?.fullName || i.assignedUser?.username || null,
    kaydeden: i.createdBy.fullName || i.createdBy.username,
  }));
}

/**
 * HIZMET BAZLI CIRO.
 *
 * Yalnizca IPTAL EDILMEMIS is emirlerinin satirlari sayilir. Tutar, satirin
 * KENDI anlik fiyatindan gelir; katalog fiyati sonradan degisse bile gecmis
 * ciro degismez.
 */
export async function hizmetBazliCiro(baslangic: Date, bitis: Date) {
  const satirlar = await prisma.washJobItem.findMany({
    where: {
      washJob: {
        queuedAt: { gte: baslangic, lt: bitis },
        status: { not: "CANCELLED" },
      },
    },
    select: {
      serviceNameSnapshot: true,
      quantity: true,
      lineTotal: true,
      washService: { select: { id: true, name: true } },
    },
  });

  const harita = new Map<string, { ad: string; adet: number; tutarKurus: number }>();
  for (const s of satirlar) {
    const anahtar = s.washService.id;
    const mevcut = harita.get(anahtar) ?? { ad: s.washService.name, adet: 0, tutarKurus: 0 };
    mevcut.adet += s.quantity;
    mevcut.tutarKurus += toKurus(s.lineTotal);
    harita.set(anahtar, mevcut);
  }

  return [...harita.entries()]
    .map(([id, v]) => ({ washServiceId: id, ...v }))
    .sort((a, b) => b.tutarKurus - a.tutarKurus);
}

/** Personel basina yikama islem sayisi (kim kac arac yikadi). */
export async function personelYikamaSayisi(baslangic: Date, bitis: Date) {
  const isler = await prisma.washJob.findMany({
    where: {
      queuedAt: { gte: baslangic, lt: bitis },
      status: { not: "CANCELLED" },
    },
    select: {
      assignedUser: { select: { id: true, username: true, fullName: true } },
      createdBy: { select: { id: true, username: true, fullName: true } },
      totalAmount: true,
    },
  });

  const harita = new Map<string, { ad: string; adet: number; tutarKurus: number }>();
  for (const i of isler) {
    // Isi yapan atanmis kisi; atanmamissa kaydi acan kisi sayilir.
    const kisi = i.assignedUser ?? i.createdBy;
    const mevcut = harita.get(kisi.id) ?? {
      ad: kisi.fullName || kisi.username,
      adet: 0,
      tutarKurus: 0,
    };
    mevcut.adet += 1;
    mevcut.tutarKurus += toKurus(i.totalAmount);
    harita.set(kisi.id, mevcut);
  }

  return [...harita.entries()]
    .map(([id, v]) => ({ userId: id, ...v }))
    .sort((a, b) => b.adet - a.adet);
}

/**
 * Yikama ozeti: sayaclar ve ciro.
 *
 * NOT: Buradaki ciro YALNIZCA YIKAMA tahsilatlarindan gelir
 * (Payment.sourceType = WASH). Park tahsilati bu toplama girmez.
 */
export async function yikamaOzeti(baslangic?: Date, bitis?: Date) {
  const { start, end } = businessDayRange();
  const bas = baslangic ?? start;
  const bit = bitis ?? end;

  const [sirada, yikamada, tamamlanan, iptal, tahsilatlar, tahsilEdilmeyen, fiyatsiz] =
    await Promise.all([
      prisma.washJob.count({ where: { status: "QUEUED" } }),
      prisma.washJob.count({ where: { status: "IN_PROGRESS" } }),
      prisma.washJob.count({
        where: { status: "COMPLETED", completedAt: { gte: bas, lt: bit } },
      }),
      prisma.washJob.count({
        where: { status: "CANCELLED", cancelledAt: { gte: bas, lt: bit } },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: {
          sourceType: "WASH",
          status: "CONFIRMED",
          direction: "IN",
          paidAt: { gte: bas, lt: bit },
        },
        _sum: { amount: true },
      }),
      // Tamamlanmis ama tahsil edilmemis isler: kayip sessiz kalmasin.
      prisma.washJob.count({
        where: {
          status: "COMPLETED",
          paymentStatus: "UNPAID",
          completedAt: { gte: bas, lt: bit },
        },
      }),
      // Fiyati tanimsiz hizmetle kaydedilmis isler.
      prisma.washJob.count({
        where: {
          status: { not: "CANCELLED" },
          queuedAt: { gte: bas, lt: bit },
          items: { some: { unitPrice: 0 } },
        },
      }),
    ]);

  const nakit = toKurus(tahsilatlar.find((t) => t.method === "CASH")?._sum.amount ?? 0);
  const kart = toKurus(tahsilatlar.find((t) => t.method === "CARD")?._sum.amount ?? 0);
  const toplam = tahsilatlar.reduce((t, x) => t + toKurus(x._sum.amount ?? 0), 0);

  return {
    sirada,
    yikamada,
    tamamlanan,
    iptal,
    nakitKurus: nakit,
    kartKurus: kart,
    ciroKurus: toplam,
    tahsilEdilmeyen,
    fiyatsizIsSayisi: fiyatsiz,
  };
}

/** Tahsil edilmemis tamamlanmis yikamalar (patron takip listesi). */
export async function tahsilEdilmeyenYikamalar(limit = 100) {
  const isler = await prisma.washJob.findMany({
    where: { status: "COMPLETED", paymentStatus: "UNPAID" },
    orderBy: { completedAt: "desc" },
    take: limit,
    include: {
      vehicleClass: { select: { name: true } },
      customer: { select: { id: true, fullName: true, phone: true } },
      items: { select: { serviceNameSnapshot: true } },
    },
  });

  return isler.map((i) => ({
    id: i.id,
    kod: i.code,
    plaka: i.plateDisplay,
    aracSinifi: i.vehicleClass.name,
    bitis: i.completedAt,
    toplamKurus: toKurus(i.totalAmount),
    musteriAdi: i.customer?.fullName ?? null,
    telefon: i.customer?.phone ?? null,
    hizmetler: i.items.map((s) => s.serviceNameSnapshot),
    not: i.notes,
  }));
}
