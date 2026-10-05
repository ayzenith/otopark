/**
 * Yetki kontrolu - SUNUCU TARAFI ASIL KORUMA.
 *
 * MIMARI KURAL: Her Server Action'in ilk satiri bu modulden bir cagridir.
 * Arayuzdeki izin kontrolu yalnizca butonu gizlemek icindir; guvenlik burada
 * saglanir. Veri okuma sorgulari da izne gore ALAN BAZINDA kisitlanir
 * (ornegin personnel.cost.view olmayan kullaniciya maas alani hic select
 * edilmez - null dondurmek yerine sorgulanmaz, boylece kazara sizma olmaz).
 */

import { getSession, type SessionUser } from "./session";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import type { Permission } from "@/lib/permissions";
import { IslemHatasi } from "@/server/errors";

/** Yetkisiz erisim hatasi. Server Action'lar bunu yakalayip 403 dondurur. */
export class AuthorizationError extends Error {
  readonly code = "YETKISIZ";
  constructor(message = "Bu işlem için yetkiniz yok.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Oturum yoksa hata. */
export class AuthenticationError extends Error {
  readonly code = "OTURUM_YOK";
  constructor(message = "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Oturum acik kullaniciyi dondurur; yoksa hata firlatir. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AuthenticationError();
  return user;
}

/**
 * Belirtilen izni zorunlu kilar.
 * Yetkisiz girisim denetim kaydina yazilir - kim neyi denedi gorulebilsin.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) {
    await writeAudit({
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      entityType: "Permission",
      entityId: permission,
      userId: user.id,
      actorLabel: user.username,
      note: `Yetkisiz işlem denemesi: ${permission}`,
    });
    throw new AuthorizationError();
  }
  return user;
}

/** Verilen izinlerden en az biri yeterlidir. */
export async function requireAnyPermission(permissions: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!permissions.some((p) => user.permissions.has(p))) {
    await writeAudit({
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      entityType: "Permission",
      entityId: permissions.join(","),
      userId: user.id,
      actorLabel: user.username,
      note: `Yetkisiz işlem denemesi (herhangi biri): ${permissions.join(", ")}`,
    });
    throw new AuthorizationError();
  }
  return user;
}

/** Yalnizca patron. Yonetim bolumu layout'unda kullanilir. */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "OWNER") {
    await writeAudit({
      action: AUDIT_ACTIONS.PERMISSION_DENIED,
      entityType: "Role",
      entityId: "OWNER",
      userId: user.id,
      actorLabel: user.username,
      note: "Patron bölümüne yetkisiz erişim denemesi",
    });
    throw new AuthorizationError("Bu bölüm yalnızca işletme sahibine açıktır.");
  }
  return user;
}

/** Hata firlatmadan kontrol (arayuzde buton gizlemek icin). */
export async function can(permission: Permission): Promise<boolean> {
  const user = await getSession();
  return user?.permissions.has(permission) ?? false;
}

/** Server Action'lardan donen standart sonuc tipi. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/**
 * Server Action sarmalayicisi: yetki ve dogrulama hatalarini kullaniciya
 * gosterilebilir mesaja cevirir, beklenmeyen hatalari sizdirmaz.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AuthorizationError || err instanceof AuthenticationError) {
      return { ok: false, error: err.message, code: err.code };
    }
    // Is hatalari KULLANICIYA AYNEN GOSTERILIR: "bu araç zaten otoparkta",
    // "plaka biçimine uymuyor" gibi mesajlar personelin ne yapacagini bilmesi
    // icin gereklidir. Genel bir hataya cevrilmeleri kullanilamaz bir arayuz
    // uretir.
    if (err instanceof IslemHatasi) {
      return { ok: false, error: err.message, code: err.code };
    }
    if (err instanceof Error && err.name === "ZodError") {
      // DOGRULAMA MESAJLARI KULLANICIYA GOSTERILIR (mimari kural 12).
      //
      // Eskiden burada tek bir "Girdiğiniz bilgiler geçersiz." mesaji
      // donuyordu; personel hangi alanin yanlis oldugunu goremedigi icin
      // arayuz kullanilamaz hale geliyordu (Asama 5'te yasandi: eksik bir
      // form alani yuzunden tum kasa hareketi bu mesajla reddedildi ve
      // sebebi ekranda hic gorunmedi).
      //
      // Semalardaki mesajlar Turkce ve personele yoneliktir; alan adlari
      // da birlikte yazilir ki "hangi alan?" sorusu yanitsiz kalmasin.
      const issues = (err as { issues?: { path?: (string | number)[]; message: string }[] }).issues;
      const metin = (issues ?? [])
        .map((i) => {
          const alan = (i.path ?? []).join(".");
          return alan ? `${alan}: ${i.message}` : i.message;
        })
        .join(" · ");
      return {
        ok: false,
        error: metin || "Girdiğiniz bilgiler geçersiz.",
        code: "GECERSIZ_VERI",
      };
    }
    // Beklenmeyen hata: ayrintisi kullaniciya gosterilmez, sunucuya yazilir.
    console.error("[action] beklenmeyen hata:", err);
    return {
      ok: false,
      error: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
      code: "SUNUCU_HATASI",
    };
  }
}
