/**
 * Kimlik dogrulama is mantigi.
 *
 * Cereze ve istek baglamina BAGIMLI DEGILDIR; boylece entegrasyon testleriyle
 * dogrudan test edilebilir. Cerez yazimi Server Action katmaninda yapilir.
 */

import { prisma } from "@/server/db";
import { verifyPassword, hashPassword, checkPasswordStrength } from "./password";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { destroyAllSessionsForUser } from "./session";

/** Hesap kilitleme esigi ve suresi. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export type AuthFailureReason =
  | "GECERSIZ_BILGI"
  | "HESAP_DEVRE_DISI"
  | "HESAP_KILITLI"
  | "EKSIK_BILGI";

export type AuthResult =
  | { ok: true; userId: string; mustChangePassword: boolean }
  | { ok: false; reason: AuthFailureReason; message: string; lockedUntil?: Date };

export interface AuthMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Kullanici adi ve parolayi dogrular.
 *
 * Guvenlik notlari:
 *  - Kullanici bulunamadiginda da parola dogrulama maliyeti odenir (kullanici
 *    adinin var olup olmadigi yanit suresinden anlasilamasin).
 *  - Hatali denemeler sayilir; MAX_FAILED_ATTEMPTS'e ulasinca hesap
 *    LOCK_DURATION_MS boyunca kilitlenir.
 *  - Basarili/basarisiz her deneme LoginAttempt tablosuna yazilir.
 *  - Kullaniciya donen mesaj, hesabin var olup olmadigini ifsa etmez.
 */
export async function authenticate(
  usernameInput: string,
  password: string,
  meta: AuthMeta = {},
): Promise<AuthResult> {
  const username = usernameInput.trim().toLowerCase();

  if (!username || !password) {
    return { ok: false, reason: "EKSIK_BILGI", message: "Kullanıcı adı ve parola zorunludur." };
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Kullanici yoksa yine de bir dogrulama yapilir: yanit suresi, hesabin var
  // olup olmadigini sizdirmasin.
  if (!user) {
    await verifyPassword(DUMMY_HASH, password);
    await recordAttempt(username, meta, false, "KULLANICI_YOK");
    await writeAudit({
      action: AUDIT_ACTIONS.LOGIN_FAIL,
      entityType: "User",
      actorLabel: username,
      note: "Kullanıcı bulunamadı",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { ok: false, reason: "GECERSIZ_BILGI", message: GENERIC_FAIL };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAttempt(username, meta, false, "KILITLI");
    const dakika = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      reason: "HESAP_KILITLI",
      message: `Çok fazla hatalı deneme. Hesap ${dakika} dakika boyunca kilitli.`,
      lockedUntil: user.lockedUntil,
    };
  }

  if (!user.isActive) {
    await recordAttempt(username, meta, false, "DEVRE_DISI");
    await writeAudit({
      action: AUDIT_ACTIONS.LOGIN_FAIL,
      entityType: "User",
      entityId: user.id,
      actorLabel: user.username,
      note: "Hesap devre dışı",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      ok: false,
      reason: "HESAP_DEVRE_DISI",
      message: "Bu hesap devre dışı bırakılmış. Yöneticinizle görüşün.",
    };
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const shouldLock = failed >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: failed, lockedUntil },
    });
    await recordAttempt(username, meta, false, "PAROLA_HATALI");
    await writeAudit({
      action: shouldLock ? AUDIT_ACTIONS.ACCOUNT_LOCKED : AUDIT_ACTIONS.LOGIN_FAIL,
      entityType: "User",
      entityId: user.id,
      actorLabel: user.username,
      note: shouldLock
        ? `${failed} hatalı denemeden sonra hesap kilitlendi`
        : `Hatalı parola (${failed}. deneme)`,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    if (shouldLock) {
      return {
        ok: false,
        reason: "HESAP_KILITLI",
        message: `Çok fazla hatalı deneme. Hesap ${Math.round(LOCK_DURATION_MS / 60000)} dakika boyunca kilitli.`,
        lockedUntil: lockedUntil!,
      };
    }
    return { ok: false, reason: "GECERSIZ_BILGI", message: GENERIC_FAIL };
  }

  // Basarili giris: sayaclari sifirla.
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await recordAttempt(username, meta, true, null);
  await writeAudit({
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
    entityType: "User",
    entityId: user.id,
    userId: user.id,
    actorLabel: user.username,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ok: true, userId: user.id, mustChangePassword: user.mustChangePassword };
}

/**
 * Parola degistirir.
 * Guvenlik: parola degisiminde kullanicinin TUM oturumlari dusurulur.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: AuthMeta = {},
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, errors: ["Kullanıcı bulunamadı."] };

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) return { ok: false, errors: ["Mevcut parola hatalı."] };

  if (await verifyPassword(user.passwordHash, newPassword)) {
    return { ok: false, errors: ["Yeni parola eskisiyle aynı olamaz."] };
  }

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) return { ok: false, errors: strength.errors };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.PASSWORD_CHANGE,
    entityType: "User",
    entityId: userId,
    userId,
    actorLabel: user.username,
    note: "Kullanıcı kendi parolasını değiştirdi; tüm oturumlar düşürüldü",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await destroyAllSessionsForUser(userId);
  return { ok: true };
}

const GENERIC_FAIL = "Kullanıcı adı veya parola hatalı.";

/**
 * Kullanici bulunamadiginda zaman esitlemek icin kullanilan sahte hash.
 * Gercek bir Argon2id hash'idir; dogrulamasi gercek bir dogrulama kadar surer.
 */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9v";

async function recordAttempt(
  username: string,
  meta: AuthMeta,
  success: boolean,
  reason: string | null,
): Promise<void> {
  await prisma.loginAttempt
    .create({ data: { username, ip: meta.ip ?? null, success, reason } })
    .catch(() => {});
}

/** Son N dakikadaki basarisiz deneme sayisi (ek hiz siniri icin). */
export async function recentFailedAttempts(
  username: string,
  windowMs = LOCK_DURATION_MS,
): Promise<number> {
  return prisma.loginAttempt.count({
    where: {
      username: username.trim().toLowerCase(),
      success: false,
      at: { gte: new Date(Date.now() - windowMs) },
    },
  });
}
