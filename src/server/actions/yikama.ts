"use server";

/**
 * OTO YIKAMA - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 *
 * ONEMLI: Hicbir action TUTAR KABUL ETMEZ. Istemci yalnizca "hangi arac",
 * "hangi hizmetler" ve "hangi odeme yontemi" gonderir; fiyat sunucuda
 * cozumlenir. Tek istisna indirimdir; o da IZNE baglidir ve gerekce zorunludur.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import {
  requireAnyPermission,
  requirePermission,
  runAction,
  type ActionResult,
} from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  yikamaDurumDegistir,
  yikamaOlustur,
  yikamaSatirCikar,
  yikamaSatirEkle,
  type YikamaSonucu,
} from "@/server/wash/job";
import {
  yikamaIptal,
  yikamaTahsilat,
  yikamaTahsilatsizTamamla,
  type YikamaTahsilatSonucu,
} from "@/server/wash/payment";
import {
  aracSinifiOlustur,
  SinifGirdiSemasi,
  yikamaFiyatiGuncelle,
  yikamaHizmetiGuncelle,
  yikamaHizmetiOlustur,
  HizmetGirdiSemasi,
} from "@/server/wash/admin";

/** "600" / "600,50" / "1.250" -> kurus. */
const UcretMetni = z
  .string()
  .trim()
  .transform((metin, ctx) => {
    if (metin === "") return null;
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi < 0) {
      ctx.addIssue({ code: "custom", message: "Ücret geçerli bir tutar olmalıdır." });
      return null;
    }
    return liraToKurus(sayi);
  });

function yolculariTazele() {
  revalidatePath("/yikama");
  revalidatePath("/vardiya");
  revalidatePath("/yonetim/yikama");
}

// ---------------------------------------------------------------------------
// IS EMRI
// ---------------------------------------------------------------------------

const YikamaSemasi = z.object({
  plaka: z.string().trim().min(1, "Plaka zorunludur.").max(20),
  aracSinifiId: z.string().min(1).optional(),
  musteriId: z.string().min(1).optional().nullable(),
  hizmetler: z
    .array(z.object({ washServiceId: z.string().min(1), adet: z.coerce.number().int().min(1).max(20).optional() }))
    .min(1, "En az bir hizmet seçilmelidir.")
    .max(20),
  not: z.string().trim().max(500).optional().nullable(),
  bicimiZorla: z.boolean().optional(),
  fiyatsizDevam: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export async function yikamaOlusturAction(girdi: unknown): Promise<ActionResult<YikamaSonucu>> {
  const actor = await requirePermission(PERMISSIONS.WASH_CREATE);
  const veri = YikamaSemasi.parse(girdi);

  const sonuc = await runAction(() =>
    yikamaOlustur(actor, {
      plaka: veri.plaka,
      aracSinifiId: veri.aracSinifiId,
      musteriId: veri.musteriId ?? null,
      hizmetler: veri.hizmetler,
      not: veri.not ?? null,
      bicimiZorla: veri.bicimiZorla,
      fiyatsizDevam: veri.fiyatsizDevam,
      idempotencyKey: veri.idempotencyKey,
    }),
  );
  if (sonuc.ok) yolculariTazele();
  return sonuc;
}

export async function yikamaDurumAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASH_UPDATE_STATUS);
  const veri = z
    .object({
      washJobId: z.string().min(1),
      yeniDurum: z.enum(["QUEUED", "IN_PROGRESS", "COMPLETED"]),
      sebep: z.string().trim().max(300).optional(),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaDurumDegistir(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

export async function yikamaSatirEkleAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASH_CREATE);
  const veri = z
    .object({
      washJobId: z.string().min(1),
      washServiceId: z.string().min(1),
      adet: z.coerce.number().int().min(1).max(20).optional(),
      fiyatsizDevam: z.boolean().optional(),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaSatirEkle(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

export async function yikamaSatirCikarAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASH_CREATE);
  const veri = z
    .object({ washJobId: z.string().min(1), washJobItemId: z.string().min(1) })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaSatirCikar(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// TAHSILAT
// ---------------------------------------------------------------------------

export async function yikamaTahsilatAction(
  girdi: unknown,
): Promise<ActionResult<YikamaTahsilatSonucu>> {
  const actor = await requirePermission(PERMISSIONS.WASH_COLLECT);
  const veri = z
    .object({
      washJobId: z.string().min(1),
      odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
      kartNotu: z.string().trim().max(100).optional().nullable(),
      // Indirim servis katmaninda ayrica IZIN kontrolunden gecer.
      indirim: UcretMetni.optional().nullable(),
      indirimSebebi: z.string().trim().max(300).optional().nullable(),
      tamamla: z.boolean().optional(),
      idempotencyKey: z.string().min(8).max(100),
    })
    .parse(girdi);

  const sonuc = await runAction(() =>
    yikamaTahsilat(actor, {
      washJobId: veri.washJobId,
      odemeYontemi: veri.odemeYontemi,
      kartNotu: veri.kartNotu ?? null,
      indirimKurus: veri.indirim ?? 0,
      indirimSebebi: veri.indirimSebebi ?? null,
      tamamla: veri.tamamla,
      idempotencyKey: veri.idempotencyKey,
    }),
  );
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

export async function yikamaTahsilatsizTamamlaAction(
  girdi: unknown,
): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASH_COLLECT);
  const veri = z
    .object({
      washJobId: z.string().min(1),
      sebep: z.string().trim().min(3, "Gerekçe zorunludur.").max(300),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaTahsilatsizTamamla(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

export async function yikamaIptalAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASH_VOID);
  const veri = z
    .object({
      washJobId: z.string().min(1),
      sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(300),
      iadeEdildi: z.boolean().optional(),
      idempotencyKey: z.string().min(8).max(100),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaIptal(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    yolculariTazele();
    revalidatePath(`/yikama/${veri.washJobId}`);
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// KATALOG VE FIYAT (patron)
// ---------------------------------------------------------------------------

export async function yikamaHizmetiOlusturAction(
  girdi: unknown,
): Promise<ActionResult<{ id: string }>> {
  const actor = await requirePermission(PERMISSIONS.WASHPRICE_EDIT);
  const veri = HizmetGirdiSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const hizmet = await yikamaHizmetiOlustur(actor, veri);
    return { id: hizmet.id };
  });
  if (sonuc.ok) {
    revalidatePath("/yonetim/ayarlar/yikama");
    revalidatePath("/tarife");
  }
  return sonuc;
}

export async function yikamaHizmetiGuncelleAction(
  girdi: unknown,
): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.WASHPRICE_EDIT);
  const veri = HizmetGirdiSemasi.omit({ kod: true })
    .extend({ washServiceId: z.string().min(1), aktif: z.coerce.boolean().optional() })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await yikamaHizmetiGuncelle(actor, veri.washServiceId, veri);
    return undefined;
  });
  if (sonuc.ok) {
    revalidatePath("/yonetim/ayarlar/yikama");
    revalidatePath("/tarife");
  }
  return sonuc;
}

/**
 * Fiyat izgarasini kaydeder.
 *
 * Bos birakilan hucre "fiyat tanimsiz" demektir ve ATLANIR - 0 TL olarak
 * kaydedilmez. Degismeyen hucreler icin yeni surum uretilmez.
 */
export async function yikamaFiyatlariKaydetAction(
  formData: FormData,
): Promise<ActionResult<{ guncellenen: number }>> {
  const actor = await requirePermission(PERMISSIONS.WASHPRICE_EDIT);

  // Alan adi bicimi: fiyat__<washServiceId>__<vehicleClassId|GENEL>
  const girdiler: { washServiceId: string; vehicleClassId: string | null; ucretKurus: number }[] =
    [];

  for (const [ad, deger] of formData.entries()) {
    if (!ad.startsWith("fiyat__")) continue;
    const parcalar = ad.split("__");
    if (parcalar.length !== 3) continue;
    const [, washServiceId, sinifAnahtari] = parcalar as [string, string, string];

    const ayrist = UcretMetni.safeParse(String(deger));
    if (!ayrist.success) {
      return { ok: false, error: "Girdiğiniz tutarlardan biri geçersiz.", code: "GECERSIZ_VERI" };
    }
    // BOS = tanimsiz: dokunulmaz.
    if (ayrist.data === null) continue;

    girdiler.push({
      washServiceId,
      vehicleClassId: sinifAnahtari === "GENEL" ? null : sinifAnahtari,
      ucretKurus: ayrist.data,
    });
  }

  if (girdiler.length === 0) {
    return { ok: false, error: "Kaydedilecek fiyat girilmedi.", code: "BOS_FORM" };
  }

  const not = String(formData.get("not") ?? "").trim() || null;

  const sonuc = await runAction(async () => {
    let guncellenen = 0;
    for (const g of girdiler) {
      const s = await yikamaFiyatiGuncelle(actor, { ...g, not });
      if (s.degisti) guncellenen += 1;
    }
    return { guncellenen };
  });

  if (sonuc.ok) {
    revalidatePath("/yonetim/ayarlar/yikama");
    revalidatePath("/tarife");
    revalidatePath("/yikama");
  }
  return sonuc;
}

export async function aracSinifiOlusturAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  // Arac sinifi hem otoparki hem yikamayi etkiler: isletme ayari iznidir.
  const actor = await requireAnyPermission([
    PERMISSIONS.SETTINGS_BUSINESS_EDIT,
    PERMISSIONS.WASHPRICE_EDIT,
  ]);
  const veri = SinifGirdiSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const sinif = await aracSinifiOlustur(actor, veri);
    return { id: sinif.id };
  });
  if (sonuc.ok) {
    revalidatePath("/yonetim/ayarlar/yikama");
    revalidatePath("/yonetim/ayarlar/tarifeler");
  }
  return sonuc;
}
