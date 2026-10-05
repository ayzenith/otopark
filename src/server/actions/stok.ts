"use server";

/**
 * MALZEME STOGU - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 *
 * Miktar istemciden alinir (fiziki bir olgu: "5 litre koydum"), ama stok
 * BAKIYESI her zaman sunucuda hesaplanir ve negatife dusemez.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import { malzemeDurum, malzemeGuncelle, malzemeOlustur } from "@/server/inventory/items";
import {
  alisiGidereBagla,
  stokHareketiEkle,
  type StokHareketSonucu,
} from "@/server/inventory/movement";

/** "0,250" / "5" -> sayi (en fazla 3 ondalik). */
const MiktarMetni = z
  .string()
  .trim()
  .transform((metin, ctx) => {
    if (metin === "") {
      ctx.addIssue({ code: "custom", message: "Miktar zorunludur." });
      return 0;
    }
    const sayi = Number(metin.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(sayi) || sayi <= 0) {
      ctx.addIssue({ code: "custom", message: "Miktar sıfırdan büyük olmalıdır." });
      return 0;
    }
    // 3 ondaliga yuvarla: veritabani Decimal(12,3).
    return Math.round(sayi * 1000) / 1000;
  });

const UcretMetni = z
  .string()
  .trim()
  .transform((metin, ctx) => {
    if (metin === "") return null;
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi < 0) {
      ctx.addIssue({ code: "custom", message: "Birim maliyet geçerli bir tutar olmalıdır." });
      return null;
    }
    return liraToKurus(sayi);
  });

/**
 * Form gonderimlerini duz nesneye cevirir.
 *
 * Arayuzdeki formlar FormData gonderir; programatik cagrilar duz nesne. Ikisi
 * de ayni Zod semasindan gecsin diye tek yerde normalize edilir.
 */
/**
 * Formdan gelen BOS metni null yapar.
 *
 * `z.string().min(1).optional()` form gonderiminde ise yaramaz: secilmeyen
 * bir <select> veya doldurulmayan bir alan "" gonderir ve dogrulama "en az
 * 1 karakter" diye patlar. Oysa dogru anlam "girilmedi"dir.
 */
const SecimelikMetin = z
  .union([z.string(), z.null()])
  // DIKKAT (Zod 4): birlesime z.undefined() EKLEMEK YETMEZ. Nesne
  // dogrulamasinda EKSIK anahtar yine "nonoptional" hatasi verir; alanin
  // kendisi .optional() olmak zorundadir. (E2E'de yasandi: form "yon"
  // gondermedigi icin tum kasa hareketi "Girdiğiniz bilgiler geçersiz"
  // hatasina dusuyordu.)
  .optional()
  .transform((v) => {
    const metin = (v ?? "").toString().trim();
    return metin === "" ? null : metin;
  });

function nesneye(girdi: unknown): unknown {
  if (typeof FormData !== "undefined" && girdi instanceof FormData) {
    return Object.fromEntries(girdi.entries());
  }
  return girdi;
}

/** Onay kutusu: HTML "on" gonderir, programatik cagri boolean. */
const OnayKutusu = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

function yollariTazele() {
  revalidatePath("/stok");
  revalidatePath("/yonetim/stok");
  revalidatePath("/yonetim/finans");
}

// ---------------------------------------------------------------------------
// MALZEME KARTI
// ---------------------------------------------------------------------------

const MalzemeSemasi = z.object({
  ad: z.string().trim().min(2, "Malzeme adı en az 2 karakter olmalıdır.").max(120),
  birim: z.enum(["ADET", "LITRE", "KG"]),
  asgariStok: z
    .string()
    .trim()
    .transform((metin, ctx) => {
      if (metin === "") return null;
      const sayi = Number(metin.replace(",", "."));
      if (!Number.isFinite(sayi) || sayi < 0) {
        ctx.addIssue({ code: "custom", message: "Asgari stok negatif olamaz." });
        return null;
      }
      return Math.round(sayi * 1000) / 1000;
    })
    .optional()
    .nullable(),
});

export async function malzemeOlusturAction(
  girdi: unknown,
): Promise<ActionResult<{ id: string; ad: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
    const veri = MalzemeSemasi.parse(nesneye(girdi));
    const malzeme = await malzemeOlustur(user, {
      ad: veri.ad,
      birim: veri.birim,
      asgariStok: veri.asgariStok ?? null,
    });
    yollariTazele();
    return { id: malzeme.id, ad: malzeme.name };
  });
}

const MalzemeGuncelleSemasi = z.object({
  id: z.string().min(1),
  ad: z.string().trim().min(2).max(120).optional(),
  asgariStok: MalzemeSemasi.shape.asgariStok,
});

export async function malzemeGuncelleAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
    const veri = MalzemeGuncelleSemasi.parse(nesneye(girdi));
    const malzeme = await malzemeGuncelle(user, {
      id: veri.id,
      ad: veri.ad,
      // undefined = dokunma, null = esigi kaldir.
      asgariStok: veri.asgariStok === undefined ? undefined : veri.asgariStok,
    });
    yollariTazele();
    return { id: malzeme.id, ad: malzeme.name };
  });
}

const MalzemeDurumSemasi = z.object({ id: z.string().min(1), aktif: OnayKutusu });

export async function malzemeDurumAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
    const veri = MalzemeDurumSemasi.parse(nesneye(girdi));
    const malzeme = await malzemeDurum(user, veri);
    yollariTazele();
    return { id: malzeme.id, aktif: malzeme.isActive };
  });
}

// ---------------------------------------------------------------------------
// STOK HAREKETI
// ---------------------------------------------------------------------------

const HareketSemasi = z.object({
  inventoryItemId: z.string().min(1, "Malzeme seçilmelidir."),
  tip: z.enum(["PURCHASE", "CONSUMPTION", "ADJUSTMENT", "WASTE"]),
  miktar: MiktarMetni,
  birimMaliyet: UcretMetni.optional().nullable(),
  expenseId: SecimelikMetin,
  washJobId: SecimelikMetin,
  not: SecimelikMetin,
  idempotencyKey: z.string().min(8).max(100),
});

export async function stokHareketiAction(
  girdi: unknown,
): Promise<ActionResult<StokHareketSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
    const veri = HareketSemasi.parse(nesneye(girdi));

    const sonuc = await stokHareketiEkle(user, {
      inventoryItemId: veri.inventoryItemId,
      tip: veri.tip,
      miktar: veri.miktar,
      birimMaliyetKurus: veri.birimMaliyet ?? null,
      expenseId: veri.expenseId ?? null,
      washJobId: veri.washJobId ?? null,
      not: veri.not ?? null,
      idempotencyKey: veri.idempotencyKey,
    });

    yollariTazele();
    return sonuc;
  });
}

const BaglaSemasi = z.object({
  movementId: z.string().min(1),
  expenseId: z.string().min(1),
});

export async function alisiGidereBaglaAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
    const veri = BaglaSemasi.parse(nesneye(girdi));
    const hareket = await alisiGidereBagla(user, veri);
    yollariTazele();
    return { id: hareket.id };
  });
}
