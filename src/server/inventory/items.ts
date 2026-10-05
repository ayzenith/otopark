/**
 * MALZEME KARTLARI (oto yikama sarf malzemesi, temizlik malzemesi…)
 *
 * ============================================================================
 * HICBIR MALZEME VEYA BIRIM FIYATI UYDURULMAZ. Isletme hangi malzemeleri
 * kullandigini bildirmedi; kart listesi BOS baslar ve patron/yonetici
 * panelden ekler. Birim fiyat da yoktur: alis hareketi girilirken o alisin
 * birim maliyeti yazilir (zaman icinde degisir).
 *
 * MALZEME SILINMEZ: kullanimdan cikan malzeme PASIF yapilir. Silmek, gecmis
 * tuketim hareketlerini ve onlara bagli gider kayitlarini anlamsiz kilar.
 * ============================================================================
 */

import type { InventoryUnit } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import type { SessionUser } from "@/server/auth/session";

export const BIRIM_ETIKETLERI: Record<InventoryUnit, string> = {
  ADET: "adet",
  LITRE: "litre",
  KG: "kg",
};

/** Miktarlar 3 ondalikli saklanir (0,250 litre gibi). */
export function miktarMetni(miktar: { toString(): string }): string {
  const sayi = Number(miktar.toString());
  return sayi.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

/**
 * Malzeme adinin karsilastirma anahtari.
 *
 * Turkce kucultme + fazla bosluklarin sadelestirilmesi. "Oto Şampuanı" ile
 * "oto şampuanı" ve "OTO ŞAMPUANI" ayni malzemedir.
 */
export function adAnahtari(ad: string): string {
  return ad.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export interface MalzemeGirdisi {
  ad: string;
  birim: InventoryUnit;
  /** Kritik stok esigi. null = uyari verilmez. */
  asgariStok?: number | null;
}

export async function malzemeOlustur(actor: SessionUser, girdi: MalzemeGirdisi) {
  const ad = girdi.ad.trim();
  if (ad.length < 2) {
    throw new IslemHatasi("GECERSIZ_AD", "Malzeme adı en az 2 karakter olmalıdır.");
  }
  if (girdi.asgariStok !== null && girdi.asgariStok !== undefined && girdi.asgariStok < 0) {
    throw new IslemHatasi("GECERSIZ_ESIK", "Asgari stok negatif olamaz.");
  }

  // Ayni adla ikinci kart, stok takibini anlamsiz kilar.
  //
  // TURKCE BUYUK/KUCUK HARF TUZAGI (yasandi): PostgreSQL'in `mode:
  // "insensitive"` karsilastirmasi Turkce I/ı ve İ/i cifti icin dogru
  // sonuc VERMEZ - "Deterjanı" ile "DETERJANI" farkli sayilir ve ayni
  // malzeme iki kez acilir. Bu yuzden karsilastirma Turkce yerel kuraliyla
  // UYGULAMADA yapilir. Malzeme sayisi onlarla olculur; maliyeti onemsiz.
  const anahtarAd = adAnahtari(ad);
  const tumu = await prisma.inventoryItem.findMany({ select: { id: true, name: true, isActive: true } });
  const mevcut = tumu.find((m) => adAnahtari(m.name) === anahtarAd);
  if (mevcut) {
    throw new IslemHatasi(
      "MALZEME_VAR",
      `"${mevcut.name}" adlı malzeme zaten kayıtlı.${mevcut.isActive ? "" : " (Kullanım dışı — geri açabilirsiniz.)"}`,
    );
  }

  const malzeme = await prisma.inventoryItem.create({
    data: {
      name: ad,
      unit: girdi.birim,
      // Stok SIFIRDAN baslar: baslangic stogu varsa ALIS hareketi girilir,
      // boylece "stok nereden geldi?" sorusu defterde yanitli kalir.
      currentStock: "0",
      minStock: girdi.asgariStok === null || girdi.asgariStok === undefined ? null : String(girdi.asgariStok),
      isActive: true,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "InventoryItem",
    entityId: malzeme.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: { ad: malzeme.name, birim: malzeme.unit, asgariStok: girdi.asgariStok ?? null },
    note: "Malzeme kartı eklendi",
  });

  return malzeme;
}

export async function malzemeGuncelle(
  actor: SessionUser,
  girdi: { id: string; ad?: string; asgariStok?: number | null },
) {
  const onceki = await prisma.inventoryItem.findUnique({ where: { id: girdi.id } });
  if (!onceki) throw new IslemHatasi("MALZEME_YOK", "Malzeme bulunamadı.");

  const ad = girdi.ad?.trim();
  if (ad !== undefined && ad.length < 2) {
    throw new IslemHatasi("GECERSIZ_AD", "Malzeme adı en az 2 karakter olmalıdır.");
  }
  if (girdi.asgariStok !== null && girdi.asgariStok !== undefined && girdi.asgariStok < 0) {
    throw new IslemHatasi("GECERSIZ_ESIK", "Asgari stok negatif olamaz.");
  }

  // Ad degisiyorsa yine tekillik kontrolu (Turkce kuralla).
  if (ad !== undefined && adAnahtari(ad) !== adAnahtari(onceki.name)) {
    const tumu = await prisma.inventoryItem.findMany({ select: { id: true, name: true } });
    const cakisan = tumu.find((m) => m.id !== girdi.id && adAnahtari(m.name) === adAnahtari(ad));
    if (cakisan) {
      throw new IslemHatasi("MALZEME_VAR", `"${cakisan.name}" adlı malzeme zaten kayıtlı.`);
    }
  }

  // BIRIM DEGISTIRILEMEZ: gecmis hareketler o birimle yazildi; litreyi adete
  // cevirmek gecmis tuketim miktarlarini yanlis gosterir.
  const malzeme = await prisma.inventoryItem.update({
    where: { id: girdi.id },
    data: {
      ...(ad !== undefined ? { name: ad } : {}),
      ...(girdi.asgariStok !== undefined
        ? { minStock: girdi.asgariStok === null ? null : String(girdi.asgariStok) }
        : {}),
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "InventoryItem",
    entityId: malzeme.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { ad: onceki.name, asgariStok: onceki.minStock?.toString() ?? null },
    after: { ad: malzeme.name, asgariStok: malzeme.minStock?.toString() ?? null },
    note: "Malzeme kartı güncellendi",
  });

  return malzeme;
}

/** Malzemeyi kullanim dışına alir / geri acar. SILMEZ. */
export async function malzemeDurum(
  actor: SessionUser,
  girdi: { id: string; aktif: boolean },
) {
  const onceki = await prisma.inventoryItem.findUnique({ where: { id: girdi.id } });
  if (!onceki) throw new IslemHatasi("MALZEME_YOK", "Malzeme bulunamadı.");

  const malzeme = await prisma.inventoryItem.update({
    where: { id: girdi.id },
    data: { isActive: girdi.aktif },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "InventoryItem",
    entityId: malzeme.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { aktif: onceki.isActive },
    after: { aktif: malzeme.isActive },
    note: girdi.aktif ? "Malzeme geri açıldı" : "Malzeme kullanım dışına alındı",
  });

  return malzeme;
}
