"use server";

/**
 * KASA - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 *
 * ONEMLI: Hicbir action BEKLENEN TUTAR KABUL ETMEZ. Personel yalnizca
 * SAYDIGI tutari gonderir; beklenen nakit her zaman sunucuda yeniden
 * hesaplanir (mimari kural 2).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  kasaAc,
  kasaKapat,
  kasaMutabakat,
  type KasaKapanisSonucu,
} from "@/server/cash/drawer";
import { kasaHareketiEkle, kasaHareketiIptal } from "@/server/cash/movement";

/** "1.250,50" / "1250.5" -> kurus. Bos metin null. */
const TutarMetni = z
  .string()
  .trim()
  .transform((metin, ctx) => {
    if (metin === "") return null;
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi < 0) {
      ctx.addIssue({ code: "custom", message: "Tutar geçerli bir sayı olmalıdır." });
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


function yollariTazele() {
  revalidatePath("/kasa");
  revalidatePath("/vardiya");
  revalidatePath("/yonetim/kasa");
  revalidatePath("/yonetim/finans");
}

// ---------------------------------------------------------------------------
// KASA AÇ / KAPAT
// ---------------------------------------------------------------------------

const KasaAcSemasi = z.object({
  acilisNakdi: TutarMetni,
  not: SecimelikMetin,
});

export async function kasaAcAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.CASH_DRAWER_OPEN);
    const veri = KasaAcSemasi.parse(nesneye(girdi));

    const oturum = await kasaAc(user, {
      acilisNakdiKurus: veri.acilisNakdi ?? 0,
      not: veri.not ?? null,
    });

    yollariTazele();
    return { id: oturum.id };
  });
}

const KasaKapatSemasi = z.object({
  cashDrawerSessionId: z.string().min(1),
  sayilanNakit: TutarMetni,
  beyanEdilenKart: TutarMetni.optional().nullable(),
  farkSebebi: SecimelikMetin,
  not: SecimelikMetin,
});

export async function kasaKapatAction(
  girdi: unknown,
): Promise<ActionResult<KasaKapanisSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.CASH_DRAWER_CLOSE);
    const veri = KasaKapatSemasi.parse(nesneye(girdi));

    const sonuc = await kasaKapat(user, {
      cashDrawerSessionId: veri.cashDrawerSessionId,
      sayilanNakitKurus: veri.sayilanNakit ?? 0,
      beyanEdilenKartKurus: veri.beyanEdilenKart ?? null,
      farkSebebi: veri.farkSebebi ?? null,
      not: veri.not ?? null,
    });

    yollariTazele();
    return sonuc;
  });
}

const MutabakatSemasi = z.object({
  cashDrawerSessionId: z.string().min(1),
  not: SecimelikMetin,
});

export async function kasaMutabakatAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    // Mutabakat kasa farkini "incelendi" olarak kapatir: patron/yonetici isi.
    const user = await requirePermission(PERMISSIONS.CASH_REPORT_ALL);
    const veri = MutabakatSemasi.parse(nesneye(girdi));
    const oturum = await kasaMutabakat(user, {
      cashDrawerSessionId: veri.cashDrawerSessionId,
      not: veri.not ?? null,
    });
    yollariTazele();
    return { id: oturum.id };
  });
}

// ---------------------------------------------------------------------------
// KASA HAREKETLERI
// ---------------------------------------------------------------------------

const HareketSemasi = z.object({
  cashDrawerSessionId: z.string().min(1),
  tip: z.enum(["DEPOSIT", "WITHDRAWAL", "BANK_TRANSFER", "ADVANCE", "CORRECTION"]),
  tutar: TutarMetni,
  aciklama: z.string().trim().min(3, "Açıklama zorunludur.").max(500),
  /** Yalnizca CORRECTION icin kullanilir. */
  /** CORRECTION icin yon. Form bos gonderdiyse "belirtilmedi" demektir. */
  yon: z
    .union([z.enum(["IN", "OUT"]), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? undefined : v)),
  ilgiliKullaniciId: SecimelikMetin,
  idempotencyKey: z.string().min(8).max(100),
});

export async function kasaHareketiAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.CASH_MOVEMENT_CREATE);
    const veri = HareketSemasi.parse(nesneye(girdi));

    const hareket = await kasaHareketiEkle(user, {
      cashDrawerSessionId: veri.cashDrawerSessionId,
      tip: veri.tip,
      tutarKurus: veri.tutar ?? 0,
      aciklama: veri.aciklama,
      yon: veri.yon,
      ilgiliKullaniciId: veri.ilgiliKullaniciId ?? null,
      idempotencyKey: veri.idempotencyKey,
    });

    yollariTazele();
    return { id: hareket.id };
  });
}

const HareketIptalSemasi = z.object({
  cashMovementId: z.string().min(1),
  sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(500),
});

export async function kasaHareketiIptalAction(
  girdi: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.CASH_VOID);
    const veri = HareketIptalSemasi.parse(nesneye(girdi));
    const hareket = await kasaHareketiIptal(user, veri);
    yollariTazele();
    return { id: hareket.id };
  });
}
