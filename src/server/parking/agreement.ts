/**
 * KURUM ANLAŞMALARI (11.10.2026)
 *
 * ============================================================================
 * İŞLETME KARARI: otoparkın kurumlarla SABİT FİYAT anlaşması var (başlangıçta
 * Üniversite öğrencisi, AYJET, Diğer — her biri 200 ₺). Müşteri çıkışta
 * kartını gösterir, personel anlaşmayı seçer; anlaşmanın fiyatı KALIŞ
 * SÜRESİNDEN BAĞIMSIZ alınır. Adı ve fiyatı patron değiştirir.
 *
 * Kurallar:
 *   · Fiyat SÜRÜMLÜDÜR (mimari kural 3): değişince eski sürüm kapatılır,
 *     yeni sürüm açılır. Çıkışta kullanılan sürüm ve ad park kaydına KOPYA
 *     olarak yazılır; sonradan değişiklik geçmişi etkilemez.
 *   · Fiyat her zaman > 0 (DB CHECK); fiyatı olmayan anlaşma çıkışta
 *     SEÇİLEMEZ — "0 ₺" asla tahsil edilmez (mimari kural 10).
 *   · Anlaşma SİLİNMEZ, pasife alınır: geçmiş park kayıtları ona bağlı.
 *   · Her yazma denetim kaydı üretir (mimari kural 8).
 * ============================================================================
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { IslemHatasi } from "@/server/shift";
import type { SessionUser } from "@/server/auth/session";

type Tx = Prisma.TransactionClient;

export interface AnlasmaOzeti {
  id: string;
  ad: string;
  aktif: boolean;
  siraNo: number;
  /** Şu an geçerli fiyat (kuruş); fiyat sürümü yoksa null. */
  fiyatKurus: number | null;
  fiyatSurumId: string | null;
}

/** Bir anlaşmanın verilen andaki geçerli fiyat sürümü. */
export async function gecerliAnlasmaFiyati(
  agreementId: string,
  an: Date = new Date(),
  db: Tx | typeof prisma = prisma,
) {
  return db.parkingAgreementPriceVersion.findFirst({
    where: {
      agreementId,
      effectiveFrom: { lte: an },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: an } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
}

/** Patron ekranı: TÜM anlaşmalar (pasifler dahil) ve güncel fiyatları. */
export async function anlasmaListesi(): Promise<AnlasmaOzeti[]> {
  const simdi = new Date();
  const kayitlar = await prisma.parkingAgreement.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      priceVersions: {
        where: {
          effectiveFrom: { lte: simdi },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: simdi } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });
  return kayitlar.map((a) => ({
    id: a.id,
    ad: a.name,
    aktif: a.isActive,
    siraNo: a.sortOrder,
    fiyatKurus: a.priceVersions[0] ? toKurus(a.priceVersions[0].price) : null,
    fiyatSurumId: a.priceVersions[0]?.id ?? null,
  }));
}

/**
 * Çıkış ekranı: yalnızca AKTİF ve FİYATI OLAN anlaşmalar. Fiyatsız anlaşma
 * personele hiç gösterilmez (yanlışlıkla 0 ₺ seçilemesin).
 */
export async function cikistaSecilebilirAnlasmalar(): Promise<AnlasmaOzeti[]> {
  return (await anlasmaListesi()).filter((a) => a.aktif && a.fiyatKurus !== null);
}

/** Ad: boş olamaz, 60 karakteri geçemez, Türkçe büyük/küçük harf duyarsız tekil. */
async function adiDogrula(ad: string, haricId?: string): Promise<string> {
  const temiz = ad.trim().replace(/\s+/g, " ");
  if (temiz.length < 2) {
    throw new IslemHatasi("AD_GECERSIZ", "Anlaşma adı en az 2 karakter olmalıdır.");
  }
  if (temiz.length > 60) {
    throw new IslemHatasi("AD_GECERSIZ", "Anlaşma adı en fazla 60 karakter olabilir.");
  }
  // PostgreSQL'in insensitive karşılaştırması I/ı ve İ/i için doğru çalışmaz
  // (CLAUDE.md test tuzakları); tekillik uygulamada tr-TR ile denetlenir.
  const anahtar = temiz.toLocaleLowerCase("tr-TR");
  const hepsi = await prisma.parkingAgreement.findMany({ select: { id: true, name: true } });
  if (hepsi.some((a) => a.id !== haricId && a.name.toLocaleLowerCase("tr-TR") === anahtar)) {
    throw new IslemHatasi("AD_KULLANIMDA", `"${temiz}" adında bir anlaşma zaten var.`);
  }
  return temiz;
}

function fiyatiDogrula(fiyatKurus: number) {
  if (!Number.isInteger(fiyatKurus) || fiyatKurus <= 0) {
    throw new IslemHatasi("UCRET_GECERSIZ", "Anlaşma fiyatı 0 ₺'den büyük olmalıdır.");
  }
  if (fiyatKurus > 100_000_000) {
    throw new IslemHatasi("UCRET_GECERSIZ", "Anlaşma fiyatı çok yüksek.");
  }
}

/** Yeni anlaşma: ad + ilk fiyat sürümü tek işlemde. */
export async function anlasmaOlustur(
  actor: SessionUser,
  girdi: { ad: string; fiyatKurus: number; siraNo?: number },
) {
  const ad = await adiDogrula(girdi.ad);
  fiyatiDogrula(girdi.fiyatKurus);

  return prisma.$transaction(async (tx) => {
    const anlasma = await tx.parkingAgreement.create({
      data: { name: ad, sortOrder: girdi.siraNo ?? 0, createdById: actor.id },
    });
    const surum = await tx.parkingAgreementPriceVersion.create({
      data: {
        agreementId: anlasma.id,
        price: kurusToDecimalString(girdi.fiyatKurus),
        changeNote: "İlk fiyat",
        createdById: actor.id,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.AGREEMENT_CREATE,
        entityType: "ParkingAgreement",
        entityId: anlasma.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: { ad, fiyatKurus: girdi.fiyatKurus, fiyatSurumId: surum.id },
      },
      tx,
    );
    return anlasma;
  });
}

/** Ad, sıra ve aktiflik. Fiyat AYRI işlemle (sürüm) değişir. */
export async function anlasmaGuncelle(
  actor: SessionUser,
  id: string,
  girdi: { ad?: string; aktif?: boolean; siraNo?: number },
) {
  const oncesi = await prisma.parkingAgreement.findUnique({ where: { id } });
  if (!oncesi) throw new IslemHatasi("ANLASMA_YOK", "Anlaşma bulunamadı.");
  const ad = girdi.ad !== undefined ? await adiDogrula(girdi.ad, id) : oncesi.name;

  return prisma.$transaction(async (tx) => {
    const sonrasi = await tx.parkingAgreement.update({
      where: { id },
      data: {
        name: ad,
        isActive: girdi.aktif ?? oncesi.isActive,
        sortOrder: girdi.siraNo ?? oncesi.sortOrder,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.AGREEMENT_UPDATE,
        entityType: "ParkingAgreement",
        entityId: id,
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

/**
 * Anlaşma fiyatını değiştirir: geçerli sürüm KAPATILIR, yeni sürüm AÇILIR.
 * Eski sürümün fiyatına dokunulmaz. Aynı fiyat tekrar girilirse yeni sürüm
 * üretilmez.
 */
export async function anlasmaFiyatiGuncelle(
  actor: SessionUser,
  id: string,
  girdi: { fiyatKurus: number; not?: string | null },
) {
  fiyatiDogrula(girdi.fiyatKurus);
  const anlasma = await prisma.parkingAgreement.findUnique({ where: { id } });
  if (!anlasma) throw new IslemHatasi("ANLASMA_YOK", "Anlaşma bulunamadı.");

  return prisma.$transaction(async (tx) => {
    const simdi = new Date();
    const mevcut = await gecerliAnlasmaFiyati(id, simdi, tx);
    if (mevcut && toKurus(mevcut.price) === girdi.fiyatKurus) {
      return { degisti: false, surum: mevcut };
    }
    if (mevcut) {
      await tx.parkingAgreementPriceVersion.update({
        where: { id: mevcut.id },
        data: { effectiveTo: simdi },
      });
    }
    const yeni = await tx.parkingAgreementPriceVersion.create({
      data: {
        agreementId: id,
        price: kurusToDecimalString(girdi.fiyatKurus),
        effectiveFrom: simdi,
        changeNote: girdi.not?.trim() || null,
        createdById: actor.id,
      },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.AGREEMENT_PRICE_UPDATE,
        entityType: "ParkingAgreementPriceVersion",
        entityId: yeni.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: mevcut ? { fiyatKurus: toKurus(mevcut.price) } : null,
        after: { anlasma: anlasma.name, fiyatKurus: girdi.fiyatKurus },
        note: girdi.not?.trim() || null,
      },
      tx,
    );
    return { degisti: true, surum: yeni };
  });
}
