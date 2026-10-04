"use server";

/**
 * MUSTERI ISLEMLERI - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 * Is mantigi src/server/subscription/customer.ts icindedir.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import {
  musteriGuncelle,
  musteriOlustur,
  musteridenAracCoz,
  musteriyeAracBagla,
} from "@/server/subscription/customer";

const MusteriSemasi = z.object({
  adSoyad: z.string().trim().min(2, "Müşteri adı zorunludur.").max(120),
  telefon: z.string().trim().min(7, "Telefon zorunludur.").max(30),
  ikinciTelefon: z.string().trim().max(30).optional().nullable(),
  eposta: z.string().trim().max(120).optional().nullable(),
  kurumsalMi: z.boolean().optional(),
  firmaAdi: z.string().trim().max(160).optional().nullable(),
  vergiNo: z.string().trim().max(40).optional().nullable(),
  notlar: z.string().trim().max(1000).optional().nullable(),
});

export async function musteriOlusturAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CUSTOMER_CREATE);
  const veri = MusteriSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const musteri = await musteriOlustur(actor, veri);
    return { id: musteri.id };
  });
  if (sonuc.ok) revalidatePath("/musteriler");
  return sonuc;
}

export async function musteriGuncelleAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CUSTOMER_EDIT);
  const veri = MusteriSemasi.extend({
    musteriId: z.string().min(1),
    aktifMi: z.boolean().optional(),
  }).parse(girdi);

  const sonuc = await runAction(async () => {
    const musteri = await musteriGuncelle(actor, veri.musteriId, veri);
    return { id: musteri.id };
  });
  if (sonuc.ok) {
    revalidatePath("/musteriler");
    revalidatePath(`/musteriler/${veri.musteriId}`);
  }
  return sonuc;
}

const AracBaglamaSemasi = z.object({
  musteriId: z.string().min(1),
  plaka: z.string().trim().min(1, "Plaka zorunludur.").max(20),
  aracSinifiId: z.string().min(1).optional(),
  markaModel: z.string().trim().max(80).optional().nullable(),
  renk: z.string().trim().max(40).optional().nullable(),
  bicimiZorla: z.boolean().optional(),
  devralmayiOnayla: z.boolean().optional(),
});

export async function aracBaglaAction(girdi: unknown): Promise<ActionResult<{ plaka: string }>> {
  const actor = await requirePermission(PERMISSIONS.CUSTOMER_EDIT);
  const veri = AracBaglamaSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const arac = await musteriyeAracBagla(actor, veri);
    return { plaka: arac.plateDisplay };
  });
  if (sonuc.ok) {
    revalidatePath(`/musteriler/${veri.musteriId}`);
    revalidatePath("/abonmanli-araclar");
  }
  return sonuc;
}

export async function aracCozAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.CUSTOMER_EDIT);
  const veri = z.object({ vehicleId: z.string().min(1), musteriId: z.string().min(1) }).parse(girdi);

  const sonuc = await runAction(async () => {
    const arac = await musteridenAracCoz(actor, veri.vehicleId);
    return { id: arac.id };
  });
  if (sonuc.ok) revalidatePath(`/musteriler/${veri.musteriId}`);
  return sonuc;
}
