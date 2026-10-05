/**
 * KASA VE VARDIYA SORGULARI (okuma)
 *
 * Yazma yok; yalnizca ekranlarin ihtiyaci olan ozetler. Tum tutarlar kurus
 * tamsayi olarak doner, bicimleme arayuzde yapilir.
 */

import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";
import { kasaDokumu, type KasaDokumu } from "./drawer";

export interface KasaOzeti {
  id: string;
  acilisAt: Date;
  kapanisAt: Date | null;
  durum: "OPEN" | "CLOSED" | "RECONCILED";
  acanKisi: string;
  kapatanKisi: string | null;
  acilisNakdi: number;
  beklenenNakit: number | null;
  sayilanNakit: number | null;
  nakitFarki: number | null;
  beklenenKart: number | null;
  beyanEdilenKart: number | null;
  kartFarki: number | null;
  farkSebebi: string | null;
  not: string | null;
}

function ozete(o: {
  id: string;
  openedAt: Date;
  closedAt: Date | null;
  status: string;
  openingFloat: unknown;
  expectedCash: unknown;
  countedCash: unknown;
  expectedCard: unknown;
  declaredCard: unknown;
  differenceReason: string | null;
  notes: string | null;
  openedBy?: { username: string; fullName: string } | null;
  closedBy?: { username: string; fullName: string } | null;
}): KasaOzeti {
  const beklenenNakit = o.expectedCash === null ? null : toKurus(o.expectedCash as string);
  const sayilanNakit = o.countedCash === null ? null : toKurus(o.countedCash as string);
  const beklenenKart = o.expectedCard === null ? null : toKurus(o.expectedCard as string);
  const beyanEdilenKart = o.declaredCard === null ? null : toKurus(o.declaredCard as string);

  return {
    id: o.id,
    acilisAt: o.openedAt,
    kapanisAt: o.closedAt,
    durum: o.status as KasaOzeti["durum"],
    acanKisi: o.openedBy?.fullName ?? o.openedBy?.username ?? "—",
    kapatanKisi: o.closedBy?.fullName ?? o.closedBy?.username ?? null,
    acilisNakdi: toKurus(o.openingFloat as string),
    beklenenNakit,
    sayilanNakit,
    nakitFarki:
      beklenenNakit === null || sayilanNakit === null ? null : sayilanNakit - beklenenNakit,
    beklenenKart,
    beyanEdilenKart,
    kartFarki:
      beklenenKart === null || beyanEdilenKart === null ? null : beyanEdilenKart - beklenenKart,
    farkSebebi: o.differenceReason,
    not: o.notes,
  };
}

const KISI_SECIM = { select: { username: true, fullName: true } } as const;

/** Acik kasanin ozeti + canli dokumu (personel kasa ekrani). */
export async function acikKasaDurumu(): Promise<{
  kasa: KasaOzeti;
  dokum: KasaDokumu;
  hareketler: {
    id: string;
    tip: string;
    yon: "IN" | "OUT";
    tutar: number;
    aciklama: string;
    at: Date;
    iptal: boolean;
  }[];
} | null> {
  const oturum = await prisma.cashDrawerSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: { openedBy: KISI_SECIM, closedBy: KISI_SECIM },
  });
  if (!oturum) return null;

  const [dokum, hareketler] = await Promise.all([
    kasaDokumu(oturum.id),
    prisma.cashMovement.findMany({
      where: { cashDrawerSessionId: oturum.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return {
    kasa: ozete(oturum),
    dokum,
    hareketler: hareketler.map((h) => ({
      id: h.id,
      tip: h.type,
      yon: h.direction,
      tutar: toKurus(h.amount),
      aciklama: h.description,
      at: h.createdAt,
      iptal: h.status === "VOIDED",
    })),
  };
}

/**
 * SON KAPANAN KASA OTURUMU.
 *
 * Kasa kapanis onayinin KALICI kaynagi. Kapanis sonrasi ozet istemci
 * durumunda tutulamaz: kapanis Server Action'i revalidatePath cagirdigi icin
 * sayfa kendiliginden tazelenir ve "kasa acik" paneli (dolayisiyla onun
 * icindeki ozet karti) agactan duser - personel kasa farkini goremez
 * (Asama 5 E2E'de yasandi). Bu yuzden ozet SUNUCUDAN okunur.
 */
export async function sonKapananKasa(): Promise<KasaOzeti | null> {
  const oturum = await prisma.cashDrawerSession.findFirst({
    where: { status: { in: ["CLOSED", "RECONCILED"] } },
    orderBy: { closedAt: "desc" },
    include: { openedBy: KISI_SECIM, closedBy: KISI_SECIM },
  });
  return oturum ? ozete(oturum) : null;
}

/** Kasa oturumu gecmisi (patron paneli). */
export async function kasaGecmisi(limit = 30): Promise<KasaOzeti[]> {
  const liste = await prisma.cashDrawerSession.findMany({
    orderBy: { openedAt: "desc" },
    take: limit,
    include: { openedBy: KISI_SECIM, closedBy: KISI_SECIM },
  });
  return liste.map(ozete);
}

export async function kasaDetay(
  id: string,
): Promise<{ kasa: KasaOzeti; dokum: KasaDokumu } | null> {
  const oturum = await prisma.cashDrawerSession.findUnique({
    where: { id },
    include: { openedBy: KISI_SECIM, closedBy: KISI_SECIM },
  });
  if (!oturum) return null;
  return { kasa: ozete(oturum), dokum: await kasaDokumu(oturum.id) };
}

/**
 * KASA DISI TAHSILAT: hicbir kasa oturumuna dusmemis nakit tahsilatlar.
 *
 * Kasa oturumu acilmadan tahsilat yapildiginda olusur. Tahsilat
 * ENGELLENMEDIGI icin (musteri kapida bekletilmez) bu kayip sessiz
 * kalmasin diye patron panelinde ayri sayac olarak gosterilir.
 */
export async function kasaDisiTahsilat(gun = new Date()) {
  const { start, end } = businessDayRange(gun);
  const sonuc = await prisma.payment.aggregate({
    where: {
      cashDrawerSessionId: null,
      method: "CASH",
      direction: "IN",
      status: "CONFIRMED",
      paidAt: { gte: start, lt: end },
    },
    _sum: { amount: true },
    _count: true,
  });
  return { adet: sonuc._count, tutar: toKurus(sonuc._sum.amount) };
}

/** Bir vardiyanin tahsilat ozeti (personel "vardiyam" ekrani). */
export async function vardiyaTahsilatOzeti(shiftId: string) {
  const [gruplar, parkAdet, yikamaAdet] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method", "direction", "sourceType"],
      where: { shiftId, status: "CONFIRMED" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.parkingSession.count({ where: { exitShiftId: shiftId } }),
    prisma.washJob.count({ where: { shiftId } }),
  ]);

  const topla = (filtre: (g: (typeof gruplar)[number]) => boolean) =>
    gruplar.filter(filtre).reduce((t, g) => t + toKurus(g._sum.amount), 0);

  const giren = (yontem: "CASH" | "CARD") =>
    topla((g) => g.direction === "IN" && g.method === yontem) -
    topla((g) => g.direction === "OUT" && g.method === yontem);

  return {
    nakit: giren("CASH"),
    kart: giren("CARD"),
    diger:
      topla((g) => g.direction === "IN" && g.method !== "CASH" && g.method !== "CARD") -
      topla((g) => g.direction === "OUT" && g.method !== "CASH" && g.method !== "CARD"),
    kaynaklar: {
      park: topla((g) => g.direction === "IN" && g.sourceType === "PARKING"),
      yikama: topla((g) => g.direction === "IN" && g.sourceType === "WASH"),
      abonman: topla((g) => g.direction === "IN" && g.sourceType === "SUBSCRIPTION"),
      diger: topla((g) => g.direction === "IN" && g.sourceType === "OTHER_INCOME"),
      iade: topla((g) => g.direction === "OUT"),
    },
    islemSayisi: { cikis: parkAdet, yikama: yikamaAdet },
    get toplam() {
      return this.nakit + this.kart + this.diger;
    },
  };
}
