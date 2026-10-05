"use server";

/**
 * KURUMSAL SİTE İÇERİĞİ - SERVER ACTIONS
 *
 * İnce kabuk: yetki → doğrulama → servis çağrısı → sayfa tazeleme.
 *
 * DİKKAT (mimari kural 17): bu dosya YALNIZCA async fonksiyon ihraç eder.
 * Şemalar `src/server/site/admin.ts` içinde durur; buradan şema veya sabit
 * ihraç etmek derlemede yakalanmaz ama çalışma anında sayfayı çökertir.
 */

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import {
  siteSayfasiKaydet,
  siteFiyatiKaydet,
  siteFiyatiSil,
  siteGorseliKaydet,
  siteGorseliSil,
} from "@/server/site/admin";

/** FormData'yı düz nesneye çevirir; doğrudan nesne gelirse olduğu gibi bırakır. */
function nesneye(girdi: unknown): Record<string, string> {
  if (typeof FormData !== "undefined" && girdi instanceof FormData) {
    return Object.fromEntries(
      [...girdi.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
    );
  }
  return (girdi ?? {}) as Record<string, string>;
}

/** HTML onay kutusu: işaretliyse "on"/"true" gelir, işaretli değilse hiç gelmez. */
function isaretli(deger: string | undefined): boolean {
  return deger === "on" || deger === "true" || deger === "1";
}

function sayi(deger: string | undefined, varsayilan = 0): number {
  const n = Number((deger ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : varsayilan;
}

/** Site içeriği değişince hem public site hem yönetim ekranı tazelenir. */
function siteyiTazele() {
  revalidatePath("/", "layout");
  revalidatePath("/yonetim/site");
}

export async function siteSayfasiKaydetAction(girdi: unknown): Promise<ActionResult<{ anahtar: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SITE_CONTENT_EDIT);
    const veri = nesneye(girdi);

    const kayit = await siteSayfasiKaydet(user, {
      anahtar: (veri.anahtar ?? "").trim(),
      baslik: (veri.baslik ?? "").trim(),
      govde: veri.govde ?? "",
      yayinda: isaretli(veri.yayinda),
    });

    siteyiTazele();
    return { anahtar: kayit.key };
  });
}

export async function siteFiyatiKaydetAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SITE_PRICE_EDIT);
    const veri = nesneye(girdi);

    const kayit = await siteFiyatiKaydet(user, {
      id: (veri.id ?? "").trim() || undefined,
      etiket: (veri.etiket ?? "").trim(),
      fiyatMetni: (veri.fiyatMetni ?? "").trim(),
      sira: sayi(veri.sira),
      yayinda: isaretli(veri.yayinda),
      not: (veri.not ?? "").trim() || undefined,
    });

    siteyiTazele();
    return { id: kayit.id };
  });
}

export async function siteFiyatiSilAction(girdi: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SITE_PRICE_EDIT);
    const veri = nesneye(girdi);
    await siteFiyatiSil(user, (veri.id ?? "").trim());
    siteyiTazele();
    return undefined;
  });
}

export async function siteGorseliKaydetAction(girdi: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SITE_CONTENT_EDIT);
    const veri = nesneye(girdi);

    const kayit = await siteGorseliKaydet(user, {
      id: (veri.id ?? "").trim() || undefined,
      url: (veri.url ?? "").trim(),
      alt: (veri.alt ?? "").trim(),
      sira: sayi(veri.sira),
      yayinda: isaretli(veri.yayinda),
    });

    siteyiTazele();
    return { id: kayit.id };
  });
}

export async function siteGorseliSilAction(girdi: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SITE_CONTENT_EDIT);
    const veri = nesneye(girdi);
    await siteGorseliSil(user, (veri.id ?? "").trim());
    siteyiTazele();
    return undefined;
  });
}
