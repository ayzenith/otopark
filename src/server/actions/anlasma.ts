"use server";

/**
 * KURUM ANLAŞMALARI - SERVER ACTIONS (patron)
 *
 * İnce kabuk: yetki + Zod doğrulama + servis çağrısı. Anlaşma fiyatı bir
 * otopark fiyatıdır; tarifeleri değiştirme izni (tariff.edit) ister.
 *
 * Bu dosya YALNIZCA async fonksiyon ihraç eder (mimari kural 17).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  anlasmaFiyatiGuncelle,
  anlasmaGuncelle,
  anlasmaOlustur,
} from "@/server/parking/agreement";

/**
 * Fiyat yalnızca RAKAM ve isteğe bağlı VİRGÜLLÜ kuruş: "200" ya da "200,50".
 * Nokta kabul edilmez: "1.250" Türkçede bin iki yüz elli, İngilizce biçimde
 * bir virgül yirmi beş okunabilir — para alanında belirsizlik olmaz.
 */
const FiyatSemasi = z
  .string()
  .trim()
  .min(1, "Fiyat girilmelidir.")
  .regex(/^\d{1,7}(,\d{1,2})?$/, "Fiyat yalnızca rakamla yazılmalıdır (örnek: 200 veya 200,50).");

function fiyatiKurusaCevir(metin: string): number {
  return liraToKurus(metin.replace(",", "."));
}

function yenile() {
  revalidatePath("/yonetim/ayarlar/anlasmalar");
  revalidatePath("/vardiya");
}

const OlusturSemasi = z.object({
  ad: z.string().trim().min(2, "Anlaşma adı en az 2 karakter olmalıdır.").max(60),
  fiyat: FiyatSemasi,
  siraNo: z.coerce.number().int().min(0).max(999).optional(),
});

export async function anlasmaOlusturAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const sonuc = await runAction(async () => {
    const veri = OlusturSemasi.parse(girdi);
    await anlasmaOlustur(actor, {
      ad: veri.ad,
      fiyatKurus: fiyatiKurusaCevir(veri.fiyat),
      siraNo: veri.siraNo,
    });
    return undefined;
  });
  if (sonuc.ok) yenile();
  return sonuc;
}

const GuncelleSemasi = z.object({
  id: z.string().min(1),
  ad: z.string().trim().min(2, "Anlaşma adı en az 2 karakter olmalıdır.").max(60).optional(),
  aktif: z.boolean().optional(),
  siraNo: z.coerce.number().int().min(0).max(999).optional(),
});

export async function anlasmaGuncelleAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const sonuc = await runAction(async () => {
    const veri = GuncelleSemasi.parse(girdi);
    await anlasmaGuncelle(actor, veri.id, { ad: veri.ad, aktif: veri.aktif, siraNo: veri.siraNo });
    return undefined;
  });
  if (sonuc.ok) yenile();
  return sonuc;
}

const FiyatGuncelleSemasi = z.object({
  id: z.string().min(1),
  fiyat: FiyatSemasi,
  not: z.string().trim().max(300).optional(),
});

export async function anlasmaFiyatiGuncelleAction(
  girdi: unknown,
): Promise<ActionResult<{ degisti: boolean }>> {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const sonuc = await runAction(async () => {
    const veri = FiyatGuncelleSemasi.parse(girdi);
    const r = await anlasmaFiyatiGuncelle(actor, veri.id, {
      fiyatKurus: fiyatiKurusaCevir(veri.fiyat),
      not: veri.not,
    });
    return { degisti: r.degisti };
  });
  if (sonuc.ok) yenile();
  return sonuc;
}
