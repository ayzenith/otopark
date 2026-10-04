"use server";

/**
 * ABONMAN ISLEMLERI - SERVER ACTIONS
 *
 * Ince kabuk: yetki + Zod dogrulama + servis cagrisi.
 *
 * YETKI NOTU: Abonman ucreti MUSTERIYE OZELDIR ve isletme sirridir. Bu yuzden
 * ucret yazan her islem subscription.price.set izni ister (varsayilan olarak
 * yalnizca patronda vardir). Fiyat yazmayan islemler (arac ekleme, tahsilat)
 * kendi izinleriyle calisir.
 *
 * TUTAR BIRIMI: istemci LIRA girer, burada KURUSA cevrilir. Kurus tam sayi
 * olarak saklanir; kayan nokta aritmetigi kullanilmaz.
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
import { AuthorizationError } from "@/server/auth/authz";
import { liraToKurus } from "@/lib/money";
import {
  abonmanIptal,
  abonmanOlustur,
  abonmanYenile,
  abonmanaAracEkle,
  abonmandanAracCikar,
  donemFiyatiDuzelt,
} from "@/server/subscription/manage";
import {
  plakaAbonmanSorgu,
  type PlakaAbonmanSonucu,
} from "@/server/subscription/queries";
import {
  abonmanTahsilatIptal,
  abonmanTahsilatiKaydet,
  type TahsilatSonucu,
} from "@/server/subscription/payment";

/** "3.000,50" / "3000.5" / "3000" -> kurus. Bos deger kabul edilmez. */
const UcretSemasi = z
  .string()
  .trim()
  .min(1, "Ücret zorunludur.")
  .transform((s, ctx) => {
    const temiz = s.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (!Number.isFinite(sayi) || sayi < 0) {
      ctx.addIssue({ code: "custom", message: "Ücret geçerli bir tutar olmalıdır." });
      return 0;
    }
    return liraToKurus(sayi);
  });

const TarihSemasi = z
  .string()
  .trim()
  .min(1, "Tarih zorunludur.")
  .transform((s, ctx) => {
    const d = new Date(`${s}T00:00:00+03:00`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Tarih geçersiz." });
      return new Date(0);
    }
    return d;
  });

const AbonmanSemasi = z.object({
  musteriId: z.string().min(1, "Müşteri seçilmelidir."),
  planEtiketi: z.string().trim().min(1, "Plan etiketi zorunludur.").max(60),
  baslangic: TarihSemasi,
  bitis: TarihSemasi,
  ucret: UcretSemasi,
  ucretNotu: z.string().trim().max(300).optional().nullable(),
  aracSayisi: z.coerce.number().int().min(1).max(50).optional(),
  plakalar: z.array(z.string().trim().max(20)).max(50).optional(),
  bicimiZorla: z.boolean().optional(),
  faturaDonemi: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).optional(),
  otomatikYenile: z.boolean().optional(),
  yoneticiNotu: z.string().trim().max(1000).optional().nullable(),
});

/** Ucret yazan islemler icin ek izin kontrolu. */
async function fiyatYetkisiZorunlu(actor: { permissions: Set<string> }) {
  if (!actor.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET)) {
    throw new AuthorizationError(
      "Abonman ücreti belirleme yetkiniz yok. Ücret işletme sahibi tarafından girilmelidir.",
    );
  }
}

export async function abonmanOlusturAction(
  girdi: unknown,
): Promise<ActionResult<{ id: string; kod: string }>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_CREATE);
  await fiyatYetkisiZorunlu(actor);
  const veri = AbonmanSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const abonman = await abonmanOlustur(actor, {
      musteriId: veri.musteriId,
      planEtiketi: veri.planEtiketi,
      baslangic: veri.baslangic,
      bitis: veri.bitis,
      ucretKurus: veri.ucret,
      ucretNotu: veri.ucretNotu ?? null,
      aracSayisi: veri.aracSayisi,
      plakalar: veri.plakalar,
      bicimiZorla: veri.bicimiZorla,
      faturaDonemi: veri.faturaDonemi,
      otomatikYenile: veri.otomatikYenile,
      yoneticiNotu: veri.yoneticiNotu ?? null,
    });
    return { id: abonman.id, kod: abonman.code };
  });

  if (sonuc.ok) {
    revalidatePath("/abonmanlar");
    revalidatePath("/abonmanli-araclar");
    revalidatePath(`/musteriler/${veri.musteriId}`);
  }
  return sonuc;
}

const YenilemeSemasi = z.object({
  subscriptionId: z.string().min(1),
  baslangic: TarihSemasi,
  bitis: TarihSemasi,
  ucret: UcretSemasi,
  not: z.string().trim().max(300).optional().nullable(),
});

export async function abonmanYenileAction(
  girdi: unknown,
): Promise<ActionResult<{ donemNo: number }>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_EDIT);
  await fiyatYetkisiZorunlu(actor);
  const veri = YenilemeSemasi.parse(girdi);

  const sonuc = await runAction(async () => {
    const { donem } = await abonmanYenile(actor, {
      subscriptionId: veri.subscriptionId,
      baslangic: veri.baslangic,
      bitis: veri.bitis,
      ucretKurus: veri.ucret,
      not: veri.not ?? null,
    });
    return { donemNo: donem.periodNo };
  });

  if (sonuc.ok) {
    revalidatePath("/abonmanlar");
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
  }
  return sonuc;
}

export async function donemFiyatiDuzeltAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_PRICE_SET);
  const veri = z
    .object({
      periodId: z.string().min(1),
      subscriptionId: z.string().min(1),
      ucret: UcretSemasi,
      sebep: z.string().trim().min(3, "Gerekçe zorunludur.").max(300),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await donemFiyatiDuzelt(actor, {
      periodId: veri.periodId,
      ucretKurus: veri.ucret,
      sebep: veri.sebep,
    });
    return undefined;
  });
  if (sonuc.ok) revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
  return sonuc;
}

export async function abonmanIptalAction(girdi: unknown): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_CANCEL);
  const veri = z
    .object({
      subscriptionId: z.string().min(1),
      sebep: z.string().trim().min(3, "İptal gerekçesi zorunludur.").max(300),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await abonmanIptal(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    revalidatePath("/abonmanlar");
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
    revalidatePath("/abonmanli-araclar");
  }
  return sonuc;
}

export async function abonmanaAracEkleAction(
  girdi: unknown,
): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_EDIT);
  const veri = z
    .object({
      subscriptionId: z.string().min(1),
      plaka: z.string().trim().min(1, "Plaka zorunludur.").max(20),
      bicimiZorla: z.boolean().optional(),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await abonmanaAracEkle(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
    revalidatePath("/abonmanli-araclar");
  }
  return sonuc;
}

export async function abonmandanAracCikarAction(
  girdi: unknown,
): Promise<ActionResult<undefined>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_EDIT);
  const veri = z
    .object({
      subscriptionId: z.string().min(1),
      vehicleId: z.string().min(1),
      sebep: z.string().trim().max(300).optional(),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await abonmandanAracCikar(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
    revalidatePath("/abonmanli-araclar");
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// TAHSILAT (abonman olusturmaktan AYRI islem - kural 1 ve 2)
// ---------------------------------------------------------------------------

export async function abonmanTahsilatAction(
  girdi: unknown,
): Promise<ActionResult<TahsilatSonucu>> {
  const actor = await requirePermission(PERMISSIONS.SUBSCRIPTION_PAYMENT_COLLECT);
  const veri = z
    .object({
      subscriptionId: z.string().min(1),
      subscriptionPeriodId: z.string().min(1).optional(),
      tutar: UcretSemasi,
      odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
      kartNotu: z.string().trim().max(100).optional().nullable(),
      not: z.string().trim().max(300).optional().nullable(),
      idempotencyKey: z.string().min(8).max(100),
    })
    .parse(girdi);

  const sonuc = await runAction(() =>
    abonmanTahsilatiKaydet(actor, {
      subscriptionId: veri.subscriptionId,
      subscriptionPeriodId: veri.subscriptionPeriodId,
      tutarKurus: veri.tutar,
      odemeYontemi: veri.odemeYontemi,
      kartNotu: veri.kartNotu ?? null,
      not: veri.not ?? null,
      idempotencyKey: veri.idempotencyKey,
    }),
  );

  if (sonuc.ok) {
    revalidatePath("/abonmanlar");
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
    revalidatePath("/yonetim/abonman/odemeler");
  }
  return sonuc;
}

export async function abonmanTahsilatIptalAction(
  girdi: unknown,
): Promise<ActionResult<undefined>> {
  // Finansal kayit iptali: kasa iptali veya abonman iptali yetkisi gerekir.
  const actor = await requireAnyPermission([
    PERMISSIONS.CASH_VOID,
    PERMISSIONS.SUBSCRIPTION_CANCEL,
  ]);
  const veri = z
    .object({
      paymentId: z.string().min(1),
      subscriptionId: z.string().min(1),
      sebep: z.string().trim().min(3, "Gerekçe zorunludur.").max(300),
      /** Para fiilen iade edildi mi? Zorunlu: iki durum farkli muhasebe uretir. */
      iadeEdildi: z.boolean(),
      idempotencyKey: z.string().min(8).max(100),
    })
    .parse(girdi);

  const sonuc = await runAction(async () => {
    await abonmanTahsilatIptal(actor, veri);
    return undefined;
  });
  if (sonuc.ok) {
    revalidatePath(`/abonmanlar/${veri.subscriptionId}`);
    revalidatePath("/yonetim/abonman/odemeler");
  }
  return sonuc;
}

// ---------------------------------------------------------------------------
// PERSONEL: PLAKA ILE ABONMAN SORGUSU (yalnizca okuma)
// ---------------------------------------------------------------------------

/**
 * Plakanin abonman durumunu dondurur. HICBIR SEY YAZMAZ, TUTAR DONDURMEZ.
 *
 * Personel ekraninda tek dokunusla cagrilir; aktif abonman varsa ucret
 * hesaplama akisi hic acilmaz.
 */
export async function abonmanSorgulaAction(
  girdi: unknown,
): Promise<ActionResult<PlakaAbonmanSonucu>> {
  await requirePermission(PERMISSIONS.SUBSCRIPTION_VIEW);
  const { plaka } = z.object({ plaka: z.string().trim().min(1).max(20) }).parse(girdi);
  return runAction(() => plakaAbonmanSorgu(plaka));
}
