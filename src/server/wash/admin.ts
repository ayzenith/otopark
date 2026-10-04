/**
 * OTO YIKAMA KATALOG VE FIYAT YONETIMI (patron paneli)
 *
 * ============================================================================
 * FIYATLAR KODA SABITLENMEZ
 * ----------------------------------------------------------------------------
 * Bu dosyada hicbir sayisal fiyat yoktur. Patron:
 *   - yeni hizmet ekleyebilir (ornek: motor yikama, pasta cila),
 *   - her hizmetin fiyatini ARAC SINIFI BAZINDA girebilir,
 *   - yeni arac sinifi ekleyince (Ticari, Minibus, Karavan...) o sinif icin
 *     fiyat girebilir,
 *   - hizmeti pasife alabilir (silmek yerine - gecmis is emirleri bozulmasin).
 *
 * TARIHSEL DEGISMEZLIK: fiyat degisikligi mevcut satiri GUNCELLEMEZ; yeni bir
 * WashServicePriceVersion satiri yazar ve oncekinin effectiveTo'sunu kapatir.
 * Boylece gecmis is emirlerinin tutari degismez (is emri satirlari ayrica
 * fiyatin anlik kopyasini da tasir).
 *
 * OTOPARK TARIFESINDEN AYRIDIR: bu dosya tarife tablolarina hic dokunmaz.
 * ============================================================================
 */

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

// ---------------------------------------------------------------------------
// HIZMET KATALOGU
// ---------------------------------------------------------------------------

export const HizmetGirdiSemasi = z.object({
  kod: z
    .string()
    .trim()
    .min(2, "Hizmet kodu en az 2 karakter olmalıdır.")
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Kod yalnızca büyük harf, rakam ve alt çizgi içerebilir."),
  ad: z.string().trim().min(2, "Hizmet adı zorunludur.").max(80),
  aciklama: z.string().trim().max(300).optional().nullable(),
  tahminiDakika: z.coerce.number().int().min(0).max(1440).optional().nullable(),
  siteGorunur: z.coerce.boolean().default(false),
  siraNo: z.coerce.number().int().min(0).max(1000).default(0),
});

export type HizmetGirdi = z.infer<typeof HizmetGirdiSemasi>;

export async function yikamaHizmetiOlustur(actor: SessionUser, girdi: HizmetGirdi) {
  const mevcut = await prisma.washServiceCatalog.findUnique({ where: { code: girdi.kod } });
  if (mevcut) {
    throw new IslemHatasi(
      "KOD_KULLANIMDA",
      `"${girdi.kod}" kodu zaten kullanılıyor (${mevcut.name}).`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const hizmet = await tx.washServiceCatalog.create({
      data: {
        code: girdi.kod,
        name: girdi.ad,
        description: girdi.aciklama?.trim() || null,
        estimatedMinutes: girdi.tahminiDakika ?? null,
        isPublicOnWebsite: girdi.siteGorunur,
        sortOrder: girdi.siraNo,
        createdById: actor.id,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_SERVICE_CREATE,
        entityType: "WashServiceCatalog",
        entityId: hizmet.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: { kod: hizmet.code, ad: hizmet.name },
        note: "Fiyat ayrı işlemle girilir.",
      },
      tx,
    );
    return hizmet;
  });
}

export async function yikamaHizmetiGuncelle(
  actor: SessionUser,
  washServiceId: string,
  girdi: Omit<HizmetGirdi, "kod"> & { aktif?: boolean },
) {
  const oncesi = await prisma.washServiceCatalog.findUnique({ where: { id: washServiceId } });
  if (!oncesi) throw new IslemHatasi("HIZMET_YOK", "Yıkama hizmeti bulunamadı.");

  return prisma.$transaction(async (tx) => {
    const sonrasi = await tx.washServiceCatalog.update({
      where: { id: washServiceId },
      data: {
        name: girdi.ad,
        description: girdi.aciklama?.trim() || null,
        estimatedMinutes: girdi.tahminiDakika ?? null,
        isPublicOnWebsite: girdi.siteGorunur,
        sortOrder: girdi.siraNo,
        isActive: girdi.aktif ?? oncesi.isActive,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_SERVICE_UPDATE,
        entityType: "WashServiceCatalog",
        entityId: washServiceId,
        userId: actor.id,
        actorLabel: actor.username,
        before: { ad: oncesi.name, aktif: oncesi.isActive, siraNo: oncesi.sortOrder },
        after: { ad: sonrasi.name, aktif: sonrasi.isActive, siraNo: sonrasi.sortOrder },
      },
      tx,
    );
    return sonrasi;
  });
}

// ---------------------------------------------------------------------------
// FIYAT SURUMLERI
// ---------------------------------------------------------------------------

export interface FiyatGirdisi {
  washServiceId: string;
  /** null = TUM arac siniflari icin genel fiyat. */
  vehicleClassId: string | null;
  ucretKurus: number;
  gecerlilikBaslangici?: Date;
  not?: string | null;
}

/**
 * Bir hizmetin bir arac sinifi icin fiyatini gunceller.
 *
 * Mevcut gecerli surum KAPATILIR (effectiveTo), yeni surum YAZILIR. Eski
 * surumun fiyatina DOKUNULMAZ: gecmis is emirleri etkilenmez.
 *
 * Ayni fiyat tekrar girilirse yeni surum uretilmez (gereksiz tarihce
 * kirliligi olmasin).
 */
export async function yikamaFiyatiGuncelle(actor: SessionUser, girdi: FiyatGirdisi) {
  if (!Number.isInteger(girdi.ucretKurus) || girdi.ucretKurus < 0) {
    throw new IslemHatasi("UCRET_GECERSIZ", "Ücret geçerli bir tutar olmalıdır.");
  }

  const hizmet = await prisma.washServiceCatalog.findUnique({
    where: { id: girdi.washServiceId },
  });
  if (!hizmet) throw new IslemHatasi("HIZMET_YOK", "Yıkama hizmeti bulunamadı.");

  if (girdi.vehicleClassId) {
    const sinif = await prisma.vehicleClass.findUnique({ where: { id: girdi.vehicleClassId } });
    if (!sinif) throw new IslemHatasi("SINIF_YOK", "Araç sınıfı bulunamadı.");
  }

  const simdi = girdi.gecerlilikBaslangici ?? new Date();
  if (simdi.getTime() < Date.now() - 60_000) {
    throw new IslemHatasi(
      "GECMIS_TARIH",
      "Fiyat geçmiş bir tarihten başlatılamaz; geçmiş işlemler değişmemelidir.",
    );
  }

  const mevcut = await prisma.washServicePriceVersion.findFirst({
    where: {
      washServiceId: girdi.washServiceId,
      vehicleClassId: girdi.vehicleClassId,
      effectiveFrom: { lte: simdi },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: simdi } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (mevcut && toKurus(mevcut.price) === girdi.ucretKurus) {
    return { degisti: false, surum: mevcut };
  }

  const sonuc = await prisma.$transaction(async (tx) => {
    if (mevcut) {
      // Onceki surum KAPATILIR; fiyatina dokunulmaz.
      await tx.washServicePriceVersion.update({
        where: { id: mevcut.id },
        data: { effectiveTo: simdi },
      });
    }

    const yeni = await tx.washServicePriceVersion.create({
      data: {
        washServiceId: girdi.washServiceId,
        vehicleClassId: girdi.vehicleClassId,
        price: kurusToDecimalString(girdi.ucretKurus),
        effectiveFrom: simdi,
        changeNote: girdi.not?.trim() || null,
        createdById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASHPRICE_UPDATE,
        entityType: "WashServicePriceVersion",
        entityId: yeni.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: mevcut ? { ucretKurus: toKurus(mevcut.price) } : null,
        after: {
          hizmet: hizmet.name,
          aracSinifiId: girdi.vehicleClassId,
          ucretKurus: girdi.ucretKurus,
          gecerlilikBaslangici: simdi,
        },
        note: girdi.not?.trim() || null,
      },
      tx,
    );

    return yeni;
  });

  return { degisti: true, surum: sonuc };
}

/**
 * Fiyat tablosunu tek islemde gunceller (patron panelindeki izgara kaydet).
 *
 * Yalnizca DEGISEN hucreler icin yeni surum uretilir. Bos birakilan hucre
 * "fiyat tanimsiz" demektir ve dokunulmaz - 0 TL olarak kaydedilmez.
 */
export async function yikamaFiyatlariniGuncelle(
  actor: SessionUser,
  girdiler: FiyatGirdisi[],
): Promise<{ guncellenen: number; atlanan: number }> {
  let guncellenen = 0;
  let atlanan = 0;

  for (const g of girdiler) {
    const sonuc = await yikamaFiyatiGuncelle(actor, g);
    if (sonuc.degisti) guncellenen += 1;
    else atlanan += 1;
  }

  return { guncellenen, atlanan };
}

/** Bir hizmetin fiyat gecmisi (patron ekraninda salt okunur gosterilir). */
export async function yikamaFiyatGecmisi(washServiceId: string) {
  const surumler = await prisma.washServicePriceVersion.findMany({
    where: { washServiceId },
    orderBy: [{ effectiveFrom: "desc" }],
    include: { vehicleClass: { select: { name: true } } },
  });

  return surumler.map((v) => ({
    id: v.id,
    aracSinifiAdi: v.vehicleClass?.name ?? "Tüm sınıflar",
    fiyatKurus: toKurus(v.price),
    baslangic: v.effectiveFrom,
    bitis: v.effectiveTo,
    not: v.changeNote,
  }));
}

/** Araclarin sinif listesi - fiyat izgarasinin kolonlari. */
export async function aracSiniflari() {
  return prisma.vehicleClass.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, excludeFromStandardTariff: true },
  });
}

/** Yeni arac sinifi ekleme (ornek: Ticari, Minibus). */
export const SinifGirdiSemasi = z.object({
  kod: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Kod yalnızca büyük harf, rakam ve alt çizgi içerebilir."),
  ad: z.string().trim().min(2).max(60),
  siraNo: z.coerce.number().int().min(0).max(1000).default(0),
  /**
   * Standart otopark tarifesinin disinda mi? (karavan gibi)
   * true ise bu sinif normal otopark tarifesinden ucretlendirilmez.
   */
  standartTarifeDisi: z.coerce.boolean().default(false),
});

export async function aracSinifiOlustur(
  actor: SessionUser,
  girdi: z.infer<typeof SinifGirdiSemasi>,
) {
  const mevcut = await prisma.vehicleClass.findUnique({ where: { code: girdi.kod } });
  if (mevcut) {
    throw new IslemHatasi("KOD_KULLANIMDA", `"${girdi.kod}" kodu zaten kullanılıyor.`);
  }

  return prisma.$transaction(async (tx) => {
    const sinif = await tx.vehicleClass.create({
      data: {
        code: girdi.kod,
        name: girdi.ad,
        sortOrder: girdi.siraNo,
        excludeFromStandardTariff: girdi.standartTarifeDisi,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.SETTINGS_UPDATE,
        entityType: "VehicleClass",
        entityId: sinif.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: sinif.code,
          ad: sinif.name,
          standartTarifeDisi: sinif.excludeFromStandardTariff,
        },
        note: "Yeni araç sınıfı. Yıkama fiyatı ayrı işlemle girilir.",
      },
      tx,
    );
    return sinif;
  });
}

/** Prisma hata tipini sizdirmadan kullanmak icin. */
export type { Prisma };
