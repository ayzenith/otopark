/**
 * ABONMAN COZUMLEME: bu plaka abonmanli mi?
 *
 * ============================================================================
 * KARARLAR
 * ----------------------------------------------------------------------------
 * S9  (02.10.2026): Odemesi alinmamis abonman GECERLI sayilir; personele
 *                   uyari gosterilir ve patron paneline bildirim duser.
 * S10 (02.10.2026): Abonman park sirasinda biterse o park UCRETSIZ tamamlanir
 *                   (giris anindaki billingMode korunur), sonraki giris normal
 *                   tarifeden hesaplanir.
 * S11 (04.10.2026): Standart abonman 7/24 gecerlidir ve gunluk giris/cikis
 *                   sayisinda limit yoktur.
 *
 * OTOMATIK NORMAL TARIFEYE DUSME: bu dosya abonmani DAIMA TARIH ARALIGINA
 * gore cozumler (startDate <= an <= endDate). status alanina guvenilmez.
 * Boylece suresi dolan abonman, durum guncelleme sureci hic calismasa bile
 * kapsam vermez ve arac normal tarifeye duser.
 * ============================================================================
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db";
import { daysBetween, formatDate } from "@/lib/datetime";
import { kapsamDegerlendir, type KuralTuru } from "./rules";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type AbonmanDurumu =
  | "YOK"
  | "AKTIF"
  | "AKTIF_BITIYOR"
  | "AKTIF_ODENMEMIS"
  | "KAPSAM_DISI"
  | "SURESI_DOLMUS"
  | "IPTAL_VEYA_ASKIDA";

export type OdemeDurumu = "UNPAID" | "PARTIAL" | "PAID";

export interface AbonmanBilgisi {
  durum: AbonmanDurumu;
  /** Ucretsiz park hakki veriyor mu? */
  ucretsizMi: boolean;
  subscriptionId: string | null;
  abonmanKodu: string | null;
  planEtiketi: string | null;
  musteriAdi: string | null;
  musteriId: string | null;
  musteriTelefonu: string | null;
  baslangicTarihi: Date | null;
  bitisTarihi: Date | null;
  kalanGun: number | null;
  /** Abonmanin odeme durumu (tutar DEGIL - personel ekraninda tutar gosterilmez). */
  odemeDurumu: OdemeDurumu | null;
  /** Uygulanan kuralin adi; su anda daima "7/24 sınırsız giriş-çıkış". */
  kuralAdi: string | null;
  /** Abonmandaki aktif plakalar. */
  plakalar: string[];
  /** Personel ekraninda gosterilecek uyari (varsa). */
  uyari: string | null;
  /** Patron paneline bildirim dusurulmeli mi? */
  yoneticiyeBildir: boolean;
}

export const BITIYOR_ESIGI_GUN = 7;

/**
 * Bos abonman bilgisi.
 *
 * Disa aciktir: tekrar eden istek gibi "abonmani yeniden cozumlemenin
 * anlamsiz oldugu" yerlerde alan alan nesne kurmak yerine bu taban
 * uzerine yazilir; boylece yeni alan eklendiginde derleyici kacirmaz.
 */
export const ABONMAN_BOS: AbonmanBilgisi = {
  durum: "YOK",
  ucretsizMi: false,
  subscriptionId: null,
  abonmanKodu: null,
  planEtiketi: null,
  musteriAdi: null,
  musteriId: null,
  musteriTelefonu: null,
  baslangicTarihi: null,
  bitisTarihi: null,
  kalanGun: null,
  odemeDurumu: null,
  kuralAdi: null,
  plakalar: [],
  uyari: null,
  yoneticiyeBildir: false,
};

/**
 * Plakanin abonman durumunu cozumler.
 *
 * Once kapsam veren abonman aranir. Bulunamazsa, personeli bilgilendirmek
 * icin suresi dolmus / iptal edilmis abonman da aranir - boylece personel
 * musteriye "abonmanınız bitti" diyebilir ve normal tarife surprizi olmaz.
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
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicles: {
        where: { removedAt: null },
        include: { vehicle: { select: { plateDisplay: true } } },
      },
    },
    orderBy: { endDate: "desc" },
  });

  if (aktif) {
    // Kural degerlendirmesi. Standart 7/24 abonmanda daima kapsamda doner;
    // ileride saat araligi / kota gibi kurallar devreye alinirsa ayni kapi
    // kullanilir.
    const kural = kapsamDegerlendir({
      tur: aktif.accessRuleKind as KuralTuru,
      parametre: aktif.accessRule,
      an: anında,
      mevcutGirisSayisi:
        aktif.accessRuleKind === "ENTRY_QUOTA"
          ? await donemGirisSayisi(db, aktif.id, aktif.startDate, anında)
          : undefined,
    });

    const ortak = {
      subscriptionId: aktif.id,
      abonmanKodu: aktif.code,
      planEtiketi: aktif.planLabel,
      musteriAdi: aktif.customer.fullName,
      musteriId: aktif.customer.id,
      musteriTelefonu: aktif.customer.phone,
      baslangicTarihi: aktif.startDate,
      bitisTarihi: aktif.endDate,
      odemeDurumu: aktif.paymentStatus as OdemeDurumu,
      kuralAdi: kural.kuralAdi,
      plakalar: aktif.vehicles.map((v) => v.vehicle.plateDisplay),
    };

    if (!kural.kapsamda) {
      // Kural geregi bu anda kapsam yok: NORMAL TARIFE uygulanir.
      return {
        ...ABONMAN_BOS,
        ...ortak,
        durum: "KAPSAM_DISI",
        ucretsizMi: false,
        kalanGun: daysBetween(anında, aktif.endDate),
        uyari: `${kural.gerekce} Normal tarife uygulanacak.`,
        yoneticiyeBildir: false,
      };
    }

    const kalanGun = daysBetween(anında, aktif.endDate);
    const odenmemis = aktif.paymentStatus === "UNPAID";
    const bitiyor = kalanGun <= BITIYOR_ESIGI_GUN;

    let durum: AbonmanDurumu = "AKTIF";
    let uyari: string | null = null;

    if (odenmemis) {
      // S9: gecerli sayilir, uyari gosterilir, patrona bildirilir.
      durum = "AKTIF_ODENMEMIS";
      uyari = "Abonman ödemesi alınmamış görünüyor. Araç girişi engellenmez.";
    } else if (bitiyor) {
      durum = "AKTIF_BITIYOR";
      uyari =
        kalanGun <= 0
          ? "Abonman bugün doluyor."
          : `Abonman ${kalanGun} gün sonra doluyor (${formatDate(aktif.endDate)}).`;
    }

    return {
      ...ABONMAN_BOS,
      ...ortak,
      durum,
      ucretsizMi: true,
      kalanGun,
      uyari,
      yoneticiyeBildir: odenmemis,
    };
  }

  // Kapsam veren abonman yok: personeli bilgilendirmek icin gecmise bak.
  const gecmis = await db.subscription.findFirst({
    where: { vehicles: { some: { vehicle: { plateNormalized } } } },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicles: {
        where: { removedAt: null },
        include: { vehicle: { select: { plateDisplay: true } } },
      },
    },
    orderBy: { endDate: "desc" },
  });

  if (!gecmis) return ABONMAN_BOS;

  const suresiDolmus = gecmis.endDate < anında;
  const tarih = formatDate(gecmis.endDate);

  return {
    ...ABONMAN_BOS,
    durum: suresiDolmus ? "SURESI_DOLMUS" : "IPTAL_VEYA_ASKIDA",
    ucretsizMi: false,
    subscriptionId: null,
    abonmanKodu: gecmis.code,
    planEtiketi: gecmis.planLabel,
    musteriAdi: gecmis.customer.fullName,
    musteriId: gecmis.customer.id,
    musteriTelefonu: gecmis.customer.phone,
    baslangicTarihi: gecmis.startDate,
    bitisTarihi: gecmis.endDate,
    odemeDurumu: gecmis.paymentStatus as OdemeDurumu,
    plakalar: gecmis.vehicles.map((v) => v.vehicle.plateDisplay),
    uyari: suresiDolmus
      ? `ABONMAN SÜRESİ DOLMUŞ (${tarih}) — NORMAL TARİFE UYGULANACAK`
      : "Abonman iptal/askıda — normal tarife uygulanacak",
    yoneticiyeBildir: false,
  };
}

/** Kota kurali icin donem basi girislerinin sayisi. */
async function donemGirisSayisi(
  db: DbClient,
  subscriptionId: string,
  donemBaslangici: Date,
  anında: Date,
): Promise<number> {
  return db.parkingSession.count({
    where: { subscriptionId, entryAt: { gte: donemBaslangici, lte: anında } },
  });
}
