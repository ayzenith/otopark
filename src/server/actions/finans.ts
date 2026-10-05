"use server";

/**
 * GELIR-GIDER - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 *
 * Gider ve diger gelirde tutar ISTEMCIDEN ALINIR - cunku bunlar hesaplanan
 * degil, dis dunyadan gelen olgulardir (fatura tutari, satis bedeli). Bu
 * yuzden ikisi de IZNE baglidir ve her kayit denetime yazilir.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  giderIptal,
  giderKategorisiDurum,
  giderKategorisiOlustur,
  giderKaydet,
  type GiderSonucu,
} from "@/server/finance/expense";
import {
  digerGelirIptal,
  digerGelirKaydet,
  type DigerGelirSonucu,
} from "@/server/finance/income";

const TutarMetni = z
  .string()
  .trim()
  .transform((metin, ctx) => {
    if (metin === "") {
      ctx.addIssue({ code: "custom", message: "Tutar zorunludur." });
      return 0;
    }
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi <= 0) {
      ctx.addIssue({ code: "custom", message: "Tutar sıfırdan büyük bir sayı olmalıdır." });
      return 0;
    }
    return liraToKurus(sayi);
  });

/** "2026-10-04" -> Istanbul gununun baslangici. */
const TarihMetni = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih GG.AA.YYYY biçiminde seçilmelidir.")
  .transform((metin) => new Date(`${metin}T12:00:00+03:00`));

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
  revalidatePath("/kasa");
  revalidatePath("/yonetim/finans");
  revalidatePath("/yonetim/finans/giderler");
  revalidatePath("/yonetim/finans/gelirler");
  revalidatePath("/stok");
}

// ---------------------------------------------------------------------------
// GIDER
// ---------------------------------------------------------------------------

const GiderSemasi = z.object({
  expenseCategoryId: z.string().min(1, "Gider kategorisi seçilmelidir."),
  tutar: TutarMetni,
  giderTarihi: TarihMetni,
  odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  aciklama: z.string().trim().min(3, "Gider açıklaması zorunludur.").max(500),
  tedarikci: SecimelikMetin,
  belgeNo: SecimelikMetin,
  ilgiliKullaniciId: SecimelikMetin,
  kasadanOdendi: OnayKutusu,
  idempotencyKey: z.string().min(8).max(100),
});

export async function giderKaydetAction(girdi: unknown): Promise<ActionResult<GiderSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPENSE_CREATE);
    const veri = GiderSemasi.parse(nesneye(girdi));

    const sonuc = await giderKaydet(user, {
      expenseCategoryId: veri.expenseCategoryId,
      tutarKurus: veri.tutar,
      giderTarihi: veri.giderTarihi,
      odemeYontemi: veri.odemeYontemi,
      aciklama: veri.aciklama,
      tedarikci: veri.tedarikci ?? null,
      belgeNo: veri.belgeNo ?? null,
      ilgiliKullaniciId: veri.ilgiliKullaniciId ?? null,
      kasadanOdendi: veri.kasadanOdendi,
      idempotencyKey: veri.idempotencyKey,
    });

    yollariTazele();
    return sonuc;
  });
}

const GiderIptalSemasi = z.object({
  expenseId: z.string().min(1),
  sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(500),
});

export async function giderIptalAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPENSE_VOID);
    const veri = GiderIptalSemasi.parse(nesneye(girdi));
    const sonuc = await giderIptal(user, veri);
    yollariTazele();
    return sonuc;
  });
}

// ---------------------------------------------------------------------------
// GIDER KATEGORILERI
// ---------------------------------------------------------------------------

const KategoriSemasi = z.object({
  ad: z.string().trim().min(2, "Kategori adı en az 2 karakter olmalıdır.").max(100),
  siraNo: z.union([z.coerce.number().int().min(0).max(9999), z.literal("")]).optional()
    .transform((v) => (v === "" || v === undefined ? undefined : Number(v))),
});

export async function giderKategorisiOlusturAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SETTINGS_BUSINESS_EDIT);
    const veri = KategoriSemasi.parse(nesneye(girdi));
    const kategori = await giderKategorisiOlustur(user, veri);
    yollariTazele();
    return { id: kategori.id, ad: kategori.name };
  });
}

const KategoriDurumSemasi = z.object({
  id: z.string().min(1),
  aktif: OnayKutusu,
});

export async function giderKategorisiDurumAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SETTINGS_BUSINESS_EDIT);
    const veri = KategoriDurumSemasi.parse(nesneye(girdi));
    const kategori = await giderKategorisiDurum(user, veri);
    yollariTazele();
    return { id: kategori.id, aktif: kategori.isActive };
  });
}

// ---------------------------------------------------------------------------
// DIGER GELIR
// ---------------------------------------------------------------------------

const DigerGelirSemasi = z.object({
  etiket: z.string().trim().min(3, "Gelirin ne olduğu yazılmalıdır.").max(200),
  tutar: TutarMetni,
  gelirTarihi: TarihMetni,
  odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  aciklama: SecimelikMetin,
  idempotencyKey: z.string().min(8).max(100),
});

export async function digerGelirKaydetAction(
  girdi: unknown,
): Promise<ActionResult<DigerGelirSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.FINANCE_INCOME_CREATE);
    const veri = DigerGelirSemasi.parse(nesneye(girdi));

    const sonuc = await digerGelirKaydet(user, {
      etiket: veri.etiket,
      tutarKurus: veri.tutar,
      gelirTarihi: veri.gelirTarihi,
      odemeYontemi: veri.odemeYontemi,
      aciklama: veri.aciklama ?? null,
      idempotencyKey: veri.idempotencyKey,
    });

    yollariTazele();
    return sonuc;
  });
}

const GelirIptalSemasi = z.object({
  otherIncomeId: z.string().min(1),
  sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(500),
  /** Para fiilen iade edildi mi? Cifte muhasebeyi onleyen karar. */
  iadeEdildi: OnayKutusu,
  idempotencyKey: z.string().min(8).max(100),
});

export async function digerGelirIptalAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.CASH_VOID);
    const veri = GelirIptalSemasi.parse(nesneye(girdi));
    const sonuc = await digerGelirIptal(user, veri);
    yollariTazele();
    return sonuc;
  });
}
