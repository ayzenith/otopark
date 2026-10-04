"use server";

/**
 * TARIFE VE KAPASITE AYARLARI - SERVER ACTIONS (yalnizca patron)
 *
 * Fiyatlar YALNIZCA buradan girilir. Sistem hicbir fiyat varsaymaz.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import {
  KuralGirdiSemasi,
  kapasiteGuncelle,
  planDurumDegistir,
  planOlustur,
  surumOlustur,
  tarifeOnizleme,
} from "@/server/pricing/admin";

// NOT: Is hatalari (IslemHatasi) runAction icinde kullaniciya
// gosterilebilir mesaja cevrilir; burada ek sarmalayici gerekmez.

/** Lira cinsinden metin girdisini kurusa cevirir. Bos = 0. */
const LiraMetni = z
  .string()
  .trim()
  .transform((v) => {
    if (v === "") return 0;
    const sayi = Number(v.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(sayi) || sayi < 0) throw new Error("Geçersiz tutar");
    return Math.round(sayi * 100);
  });

const SayiMetni = z
  .string()
  .trim()
  .transform((v) => (v === "" ? 0 : Number(v)))
  .pipe(z.number().int().min(0));

/** Saat:dakika metnini gun dakikasina cevirir. "20:00" -> 1200 */
const SaatMetni = z
  .string()
  .trim()
  .transform((v) => {
    if (v === "") return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (!m) throw new Error("Saat biçimi HH:MM olmalı");
    const saat = Number(m[1]);
    const dakika = Number(m[2]);
    if (saat > 23 || dakika > 59) throw new Error("Geçersiz saat");
    return saat * 60 + dakika;
  });

const PlanSemasi = z.object({
  ad: z.string().trim().min(2).max(80),
  aciklama: z.string().trim().max(300).optional(),
  varsayilan: z.boolean().optional(),
  oncelik: z.number().int().min(0).max(1000).optional(),
});

export async function planOlusturAction(girdi: unknown) {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const veri = PlanSemasi.parse(girdi);
  const sonuc = await runAction(() => planOlustur(actor, veri));
  if (sonuc.ok) revalidatePath("/yonetim/ayarlar/tarifeler");
  return sonuc;
}

/**
 * FormData'dan tarife surumu olusturur.
 *
 * Fiyat alanlari LIRA olarak girilir ve kurusa cevrilir. Bos birakilan her
 * alan 0 kabul edilir - yani "tanimli degil". Sistem bos alana deger uydurmaz.
 */
export async function surumOlusturAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);

  const planId = String(formData.get("planId") ?? "");
  const not = String(formData.get("degisiklikNotu") ?? "");
  const hemen = formData.get("hemenGecerli") === "on";
  const tarihMetni = String(formData.get("gecerlilikBaslangici") ?? "");

  let baslangic: Date;
  if (hemen || !tarihMetni) {
    baslangic = new Date(Date.now() + 1000);
  } else {
    baslangic = new Date(tarihMetni);
    if (Number.isNaN(baslangic.getTime())) {
      return { ok: false as const, error: "Geçerlilik tarihi okunamadı." };
    }
  }

  // Arac sinifi basina kural. "genel" anahtari tum araclar icin kuraldir.
  const sinifAnahtarlari = formData.getAll("kuralSinifi").map(String);

  try {
    const kurallar = sinifAnahtarlari.map((anahtar, i) => {
      const al = (ad: string) => String(formData.get(`${ad}_${i}`) ?? "");
      return KuralGirdiSemasi.parse({
        vehicleClassId: anahtar === "genel" ? null : anahtar,
        ucretsizDakika: SayiMetni.parse(al("ucretsizDakika")),
        ucretsizDusulur: formData.get(`ucretsizDusulur_${i}`) === "on",
        ilkBlokDakika: SayiMetni.parse(al("ilkBlokDakika")),
        ilkBlokUcret: LiraMetni.parse(al("ilkBlokUcret")),
        saatlikUcret: LiraMetni.parse(al("saatlikUcret")),
        saatYuvarlamaDakika: SayiMetni.parse(al("saatYuvarlamaDakika")) || 60,
        gunlukUcret: LiraMetni.parse(al("gunlukUcret")),
        gunlukUstLimit: LiraMetni.parse(al("gunlukUstLimit")),
        geceSabitUcret: al("geceSabitUcret") === "" ? null : LiraMetni.parse(al("geceSabitUcret")),
        geceBaslangicDakika: SaatMetni.parse(al("geceBaslangic")),
        geceBitisDakika: SaatMetni.parse(al("geceBitis")),
        haftaSonuKatsayisi:
          al("haftaSonuKatsayisi") === ""
            ? null
            : Number(al("haftaSonuKatsayisi").replace(",", ".")),
        asgariUcret: LiraMetni.parse(al("asgariUcret")),
      });
    });

    const sonuc = await runAction(() =>
      surumOlustur(actor, {
        planId,
        gecerlilikBaslangici: baslangic,
        degisiklikNotu: not,
        kurallar,
      }),
    );
    if (sonuc.ok) {
      revalidatePath("/yonetim/ayarlar/tarifeler");
      revalidatePath("/tarife");
    }
    return sonuc;
  } catch (err) {
    const mesaj = err instanceof Error ? err.message : "Girilen değerler okunamadı.";
    return { ok: false as const, error: mesaj };
  }
}

export async function planDurumAction(girdi: unknown) {
  const actor = await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const { planId, aktif } = z
    .object({ planId: z.string().min(1), aktif: z.boolean() })
    .parse(girdi);
  const sonuc = await runAction(() => planDurumDegistir(actor, planId, aktif));
  if (sonuc.ok) revalidatePath("/yonetim/ayarlar/tarifeler");
  return sonuc;
}

export async function kapasiteAction(formData: FormData) {
  const actor = await requirePermission(PERMISSIONS.SETTINGS_BUSINESS_EDIT);
  const kapasiteMetni = String(formData.get("kapasite") ?? "");
  const esikMetni = String(formData.get("uyariEsigi") ?? "");

  const kapasite = kapasiteMetni.trim() === "" ? 0 : Number(kapasiteMetni);
  if (!Number.isInteger(kapasite) || kapasite < 0) {
    return { ok: false as const, error: "Kapasite 0 veya pozitif tam sayı olmalı." };
  }
  const esik = esikMetni.trim() === "" ? undefined : Number(esikMetni);

  const sonuc = await runAction(() => kapasiteGuncelle(actor, { kapasite, uyariEsigi: esik }));
  if (sonuc.ok) {
    revalidatePath("/yonetim/ayarlar/isletme");
    revalidatePath("/vardiya");
  }
  return sonuc;
}

/** Onizleme: patron fiyatin etkisini kaydetmeden gorur. */
export async function onizlemeAction(girdi: unknown) {
  await requirePermission(PERMISSIONS.TARIFF_EDIT);
  const kural = KuralGirdiSemasi.parse(girdi);
  return tarifeOnizleme(kural);
}
