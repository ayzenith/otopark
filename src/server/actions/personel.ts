"use server";

/**
 * PERSONEL YÖNETİMİ - SERVER ACTIONS
 *
 * İnce kabuk: yetki + Zod doğrulama + servis çağrısı.
 *
 * YETKİ AYRIMI:
 *   · hesap açma/düzenleme/izin   -> user.manage
 *   · maaş/SGK/yemek              -> personnel.cost.view (yalnızca patron)
 *   · avans ve maaş ödemesi       -> finance.expense.create (para çıkışı)
 *
 * Maaş tutarları `personnel.cost.view` olmadan ne okunur ne yazılır.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  izinAyarla,
  parolaSifirla,
  personelDurum,
  personelGuncelle,
  personelOlustur,
  profilKaydet,
  type PersonelOlusturSonucu,
} from "@/server/staff/users";
import {
  avansIptal,
  avansVer,
  maasOde,
  type AvansSonucu,
  type MaasOdemeSonucu,
} from "@/server/staff/advance";

/**
 * Form gönderimlerini düz nesneye çevirir.
 * (FormData ve programatik çağrı aynı Zod şemasından geçsin.)
 */
function nesneye(girdi: unknown): unknown {
  if (typeof FormData !== "undefined" && girdi instanceof FormData) {
    return Object.fromEntries(girdi.entries());
  }
  return girdi;
}

/**
 * Boş metni null yapar.
 *
 * DİKKAT (Zod 4): alanın kendisi `.optional()` olmalı; birleşime
 * `z.undefined()` eklemek eksik anahtarı kabul etmez (Aşama 5'te yaşandı).
 */
const SecimelikMetin = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const metin = (v ?? "").toString().trim();
    return metin === "" ? null : metin;
  });

/** "1.250,50" -> kuruş. Boş metin null (= girilmedi, 0 DEĞİL). */
const TutarMetni = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    const metin = (v ?? "").toString().trim();
    if (metin === "") return null;
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi < 0) {
      ctx.addIssue({ code: "custom", message: "Tutar geçerli bir sayı olmalıdır." });
      return null;
    }
    return liraToKurus(sayi);
  });

/** Zorunlu tutar: boş metin doğrulama hatası verir (null dönmez). */
const ZorunluTutar = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    const metin = (v ?? "").toString().trim();
    if (metin === "") {
      ctx.addIssue({ code: "custom", message: "Tutar zorunludur." });
      return 0;
    }
    const temiz = metin.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi <= 0) {
      ctx.addIssue({ code: "custom", message: "Tutar sıfırdan büyük olmalıdır." });
      return 0;
    }
    return liraToKurus(sayi);
  });

/** "2026-10-05" -> Istanbul öğle vakti (gün sınırı kaymasın). */
const TarihMetni = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    const metin = (v ?? "").toString().trim();
    if (metin === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metin)) {
      ctx.addIssue({ code: "custom", message: "Tarih GG.AA.YYYY biçiminde seçilmelidir." });
      return null;
    }
    return new Date(`${metin}T12:00:00+03:00`);
  });

function yollariTazele() {
  revalidatePath("/yonetim/personel");
  revalidatePath("/yonetim");
  revalidatePath("/yonetim/finans");
  revalidatePath("/kasa");
}

// ---------------------------------------------------------------------------
// HESAP
// ---------------------------------------------------------------------------

const OlusturSemasi = z.object({
  kullaniciAdi: z.string().trim().min(3, "Kullanıcı adı en az 3 karakter olmalıdır.").max(32),
  adSoyad: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalıdır.").max(120),
  // MANAGER kasıtlı olarak YOK (karar 05.10.2026).
  rol: z.enum(["OWNER", "STAFF"]),
  gorevUnvani: SecimelikMetin,
  telefon: SecimelikMetin,
  baslangicParolasi: SecimelikMetin,
});

export async function personelOlusturAction(
  girdi: unknown,
): Promise<ActionResult<PersonelOlusturSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.USER_MANAGE);
    const veri = OlusturSemasi.parse(nesneye(girdi));
    const sonuc = await personelOlustur(user, veri);
    yollariTazele();
    return sonuc;
  });
}

const GuncelleSemasi = z.object({
  userId: z.string().min(1),
  adSoyad: z.string().trim().min(3).max(120).optional(),
  gorevUnvani: SecimelikMetin,
  telefon: SecimelikMetin,
  rol: z.enum(["OWNER", "STAFF"]).optional(),
});

export async function personelGuncelleAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.USER_MANAGE);
    const veri = GuncelleSemasi.parse(nesneye(girdi));
    const kullanici = await personelGuncelle(user, veri);
    yollariTazele();
    return { id: kullanici.id, adSoyad: kullanici.fullName };
  });
}

const DurumSemasi = z.object({
  userId: z.string().min(1),
  aktif: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true" || v === "1"),
  sebep: SecimelikMetin,
});

export async function personelDurumAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.USER_MANAGE);
    const veri = DurumSemasi.parse(nesneye(girdi));
    const sonuc = await personelDurum(user, veri);
    yollariTazele();
    return {
      id: sonuc.kullanici.id,
      aktif: sonuc.kullanici.isActive,
      iptalEdilenOturum: sonuc.iptalEdilenOturum,
    };
  });
}

const ParolaSemasi = z.object({
  userId: z.string().min(1),
  yeniParola: SecimelikMetin,
});

export async function parolaSifirlaAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.USER_MANAGE);
    const veri = ParolaSemasi.parse(nesneye(girdi));
    const sonuc = await parolaSifirla(user, veri);
    yollariTazele();
    return sonuc;
  });
}

// ---------------------------------------------------------------------------
// İZİNLER
// ---------------------------------------------------------------------------

const IzinSemasi = z.object({
  userId: z.string().min(1),
  izin: z.string().min(3).max(60),
  /** "ver" | "kaldir" | "taban" */
  durum: z.enum(["ver", "kaldir", "taban"]),
});

export async function izinAyarlaAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.USER_MANAGE);
    const veri = IzinSemasi.parse(nesneye(girdi));
    const sonuc = await izinAyarla(user, {
      userId: veri.userId,
      izin: veri.izin,
      durum: veri.durum === "taban" ? null : veri.durum === "ver",
    });
    yollariTazele();
    return sonuc;
  });
}

// ---------------------------------------------------------------------------
// MALİYET PROFİLİ (yalnızca patron)
// ---------------------------------------------------------------------------

const ProfilSemasi = z.object({
  userId: z.string().min(1),
  iseGirisTarihi: TarihMetni,
  ayrilisTarihi: TarihMetni,
  maas: TutarMetni,
  sgk: TutarMetni,
  yemek: TutarMetni,
  not: SecimelikMetin,
});

export async function profilKaydetAction(girdi: unknown) {
  return runAction(async () => {
    // Maaş verisi YALNIZCA bu izinle yazılır (karar 05.10.2026).
    const user = await requirePermission(PERMISSIONS.PERSONNEL_COST_VIEW);
    const veri = ProfilSemasi.parse(nesneye(girdi));
    const profil = await profilKaydet(user, {
      userId: veri.userId,
      iseGirisTarihi: veri.iseGirisTarihi,
      ayrilisTarihi: veri.ayrilisTarihi,
      maasKurus: veri.maas,
      sgkKurus: veri.sgk,
      yemekKurus: veri.yemek,
      not: veri.not,
    });
    yollariTazele();
    return { id: profil.id };
  });
}

// ---------------------------------------------------------------------------
// AVANS VE MAAŞ
// ---------------------------------------------------------------------------

const AvansSemasi = z.object({
  userId: z.string().min(1, "Personel seçilmelidir."),
  tutar: ZorunluTutar,
  not: SecimelikMetin,
  kasadanVerildi: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === undefined || v === true || v === "on" || v === "true" || v === "1"),
  idempotencyKey: z.string().min(8).max(100),
});

export async function avansVerAction(girdi: unknown): Promise<ActionResult<AvansSonucu>> {
  return runAction(async () => {
    // Avans para çıkışıdır: gider girme yetkisi gerekir.
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPENSE_CREATE);
    const veri = AvansSemasi.parse(nesneye(girdi));
    const sonuc = await avansVer(user, {
      userId: veri.userId,
      tutarKurus: veri.tutar,
      not: veri.not,
      kasadanVerildi: veri.kasadanVerildi,
      idempotencyKey: veri.idempotencyKey,
    });
    yollariTazele();
    return sonuc;
  });
}

const AvansIptalSemasi = z.object({
  staffAdvanceId: z.string().min(1),
  sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(500),
});

export async function avansIptalAction(girdi: unknown) {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPENSE_VOID);
    const veri = AvansIptalSemasi.parse(nesneye(girdi));
    const sonuc = await avansIptal(user, veri);
    yollariTazele();
    return sonuc;
  });
}

const MaasSemasi = z.object({
  userId: z.string().min(1, "Personel seçilmelidir."),
  maas: ZorunluTutar,
  odemeTarihi: TarihMetni,
  odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  /** Virgülle ayrılmış avans kimlikleri (formdan) veya dizi. */
  mahsupAvansIdleri: z
    .union([z.string(), z.array(z.string()), z.null()])
    .optional()
    .transform((v) => {
      if (Array.isArray(v)) return v.filter(Boolean);
      const metin = (v ?? "").toString().trim();
      return metin === "" ? [] : metin.split(",").map((x) => x.trim()).filter(Boolean);
    }),
  aciklama: SecimelikMetin,
  kasadanOdendi: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === undefined || v === true || v === "on" || v === "true" || v === "1"),
  idempotencyKey: z.string().min(8).max(100),
});

export async function maasOdeAction(girdi: unknown): Promise<ActionResult<MaasOdemeSonucu>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPENSE_CREATE);
    const veri = MaasSemasi.parse(nesneye(girdi));
    const sonuc = await maasOde(user, {
      userId: veri.userId,
      maasKurus: veri.maas,
      odemeTarihi: veri.odemeTarihi ?? new Date(),
      odemeYontemi: veri.odemeYontemi,
      mahsupAvansIdleri: veri.mahsupAvansIdleri,
      aciklama: veri.aciklama,
      kasadanOdendi: veri.kasadanOdendi,
      idempotencyKey: veri.idempotencyKey,
    });
    yollariTazele();
    return sonuc;
  });
}
