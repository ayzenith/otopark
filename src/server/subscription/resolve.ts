/**
 * Abonman cozumleme: bu plaka abonmanli mi?
 *
 * Kararlar (02.10.2026):
 *   S9: Odemesi alinmamis abonman GECERLI sayilir; personele uyari gosterilir
 *       ve patron panelinin uyari merkezine bildirim duser.
 *   S10: Abonman park sirasinda biterse o park UCRETSIZ tamamlanir
 *        (giris anindaki billingMode korunur).
 *
 * NOT: Abonman modulunun tamami Asama 3'te gelistirilecek. Burada yalnizca
 * giris aninda tanima ve ucretsiz cikis kurali icin gereken cozumleme var.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db";
import { daysBetween } from "@/lib/datetime";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AbonmanDurumu =
  | "YOK"
  | "AKTIF"
  | "AKTIF_BITIYOR"
  | "AKTIF_ODENMEMIS"
  | "SURESI_DOLMUS"
  | "IPTAL_VEYA_ASKIDA";

export interface AbonmanBilgisi {
  durum: AbonmanDurumu;
  /** Ucretsiz park hakki veriyor mu? */
  ucretsizMi: boolean;
  subscriptionId: string | null;
  musteriAdi: string | null;
  musteriId: string | null;
  bitisTarihi: Date | null;
  kalanGun: number | null;
  /** Personel ekraninda gosterilecek uyari (varsa). */
  uyari: string | null;
  /** Patron paneline bildirim dusurulmeli mi? */
  yoneticiyeBildir: boolean;
}

const BITIYOR_ESIGI_GUN = 7;

/**
 * Plakanin abonman durumunu cozumler.
 *
 * Once AKTIF abonman aranir. Bulunamazsa, personeli bilgilendirmek icin
 * suresi dolmus / iptal edilmis abonman da aranir - boylece personel
 * musteriye "abonmaniniz bitti" diyebilir.
 */
export async function cozumleAbonman(
  plateNormalized: string,
  anında: Date,
  db: DbClient = prisma,
): Promise<AbonmanBilgisi> {
  const aktif = await db.subscription.findFirst({
    where: {
      status: "ACTIVE",
      startDate: { lte: anında },
      endDate: { gte: anında },
      vehicles: {
        some: { removedAt: null, vehicle: { plateNormalized } },
      },
    },
    include: { customer: { select: { id: true, fullName: true } } },
    orderBy: { endDate: "desc" },
  });

  if (aktif) {
    const kalanGun = daysBetween(anında, aktif.endDate);
    const odenmemis = aktif.paymentStatus === "UNPAID";
    const bitiyor = kalanGun <= BITIYOR_ESIGI_GUN;

    let durum: AbonmanDurumu = "AKTIF";
    let uyari: string | null = null;

    if (odenmemis) {
      // S9: gecerli sayilir, uyari gosterilir, patrona bildirilir.
      durum = "AKTIF_ODENMEMIS";
      uyari = "Abonman ödemesi alınmamış görünüyor.";
    } else if (bitiyor) {
      durum = "AKTIF_BITIYOR";
      uyari = `Abonman ${kalanGun} gün sonra doluyor.`;
    }

    return {
      durum,
      ucretsizMi: true,
      subscriptionId: aktif.id,
      musteriAdi: aktif.customer.fullName,
      musteriId: aktif.customer.id,
      bitisTarihi: aktif.endDate,
      kalanGun,
      uyari,
      yoneticiyeBildir: odenmemis,
    };
  }

  // Aktif abonman yok: personeli bilgilendirmek icin gecmise bak.
  const gecmis = await db.subscription.findFirst({
    where: {
      vehicles: { some: { vehicle: { plateNormalized } } },
      status: { in: ["EXPIRED", "CANCELLED", "SUSPENDED", "ACTIVE"] },
    },
    include: { customer: { select: { id: true, fullName: true } } },
    orderBy: { endDate: "desc" },
  });

  if (!gecmis) {
    return {
      durum: "YOK",
      ucretsizMi: false,
      subscriptionId: null,
      musteriAdi: null,
      musteriId: null,
      bitisTarihi: null,
      kalanGun: null,
      uyari: null,
      yoneticiyeBildir: false,
    };
  }

  const suresiDolmus = gecmis.endDate < anında;
  const tarih = gecmis.endDate.toLocaleDateString("tr-TR");

  return {
    durum: suresiDolmus ? "SURESI_DOLMUS" : "IPTAL_VEYA_ASKIDA",
    ucretsizMi: false,
    subscriptionId: null,
    musteriAdi: gecmis.customer.fullName,
    musteriId: gecmis.customer.id,
    bitisTarihi: gecmis.endDate,
    kalanGun: null,
    uyari: suresiDolmus
      ? `ABONMAN ${tarih} TARİHİNDE BİTTİ — NORMAL TARİFE UYGULANACAK`
      : "Abonman iptal/askıda — normal tarife uygulanacak",
    yoneticiyeBildir: false,
  };
}
