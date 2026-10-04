/**
 * Park sorgulari - personel ana ekrani ve listeler icin.
 * Yalnizca OKUMA yapar.
 */

import { prisma } from "@/server/db";
import { businessDayRange } from "@/lib/datetime";
import { toKurus } from "@/lib/money";

/** Personel ana ekranindaki sayaclar. */
export async function anaEkranSayaclari(userId: string, tahsilatGorebilir: boolean) {
  const { start, end } = businessDayRange();

  const [otoparktaki, bugunGiris, bugunCikis, tahsilat] = await Promise.all([
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
    prisma.parkingSession.count({ where: { entryAt: { gte: start, lt: end } } }),
    prisma.parkingSession.count({
      where: { exitAt: { gte: start, lt: end }, status: "COMPLETED" },
    }),
    tahsilatGorebilir
      ? prisma.payment.groupBy({
          by: ["method"],
          where: {
            collectedById: userId,
            status: "CONFIRMED",
            direction: "IN",
            paidAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const nakit = toKurus(tahsilat.find((t) => t.method === "CASH")?._sum.amount ?? 0);
  const kart = toKurus(tahsilat.find((t) => t.method === "CARD")?._sum.amount ?? 0);
  const diger = tahsilat
    .filter((t) => t.method !== "CASH" && t.method !== "CARD")
    .reduce((toplam, t) => toplam + toKurus(t._sum.amount ?? 0), 0);

  return {
    otoparktaki,
    bugunGiris,
    bugunCikis,
    tahsilat: { nakit, kart, diger, toplam: nakit + kart + diger },
  };
}

/** Aktif araclar - plakaya gore filtrelenebilir. */
export async function aktifAraclar(arama?: string, limit = 100) {
  return prisma.parkingSession.findMany({
    where: {
      status: "ACTIVE",
      ...(arama ? { plateNormalized: { contains: arama } } : {}),
    },
    orderBy: { entryAt: "desc" },
    take: limit,
    select: {
      id: true,
      code: true,
      plateDisplay: true,
      plateNormalized: true,
      entryAt: true,
      billingMode: true,
      vehicle: { select: { vehicleClass: { select: { name: true } } } },
      subscription: { select: { customer: { select: { fullName: true } } } },
    },
  });
}

/** Son islemler listesi (ana ekran). */
export async function sonIslemler(limit = 10) {
  const kayitlar = await prisma.parkingSession.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      code: true,
      plateDisplay: true,
      entryAt: true,
      exitAt: true,
      status: true,
      billingMode: true,
      durationMinutes: true,
      collectedAmount: true,
      payments: {
        where: { status: "CONFIRMED", direction: "IN" },
        select: { method: true },
        take: 1,
      },
    },
  });

  return kayitlar.map((k) => ({
    id: k.id,
    kod: k.code,
    plaka: k.plateDisplay,
    tur: k.exitAt ? ("CIKIS" as const) : ("GIRIS" as const),
    an: k.exitAt ?? k.entryAt,
    sureDakika: k.durationMinutes,
    tutarKurus: k.collectedAmount ? toKurus(k.collectedAmount) : null,
    yontem: k.payments[0]?.method ?? null,
    abonmanli: k.billingMode === "SUBSCRIPTION",
  }));
}

/** Gun/hafta/ay gecmisi. */
export async function parkGecmisi(opts: { baslangic: Date; bitis: Date; plaka?: string }) {
  return prisma.parkingSession.findMany({
    where: {
      entryAt: { gte: opts.baslangic, lt: opts.bitis },
      ...(opts.plaka ? { plateNormalized: { contains: opts.plaka } } : {}),
    },
    orderBy: { entryAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      plateDisplay: true,
      entryAt: true,
      exitAt: true,
      durationMinutes: true,
      calculatedAmount: true,
      collectedAmount: true,
      status: true,
      billingMode: true,
      voidReason: true,
      exitUser: { select: { fullName: true } },
      entryUser: { select: { fullName: true } },
    },
  });
}
