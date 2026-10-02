/**
 * Oturum yonetimi.
 *
 * ============================================================================
 * MIMARI SAPMA VE GEREKCESI (docs/01-mimari.md'den)
 * ----------------------------------------------------------------------------
 * Tasarim dokumaninda Auth.js (NextAuth v5) + veritabani oturumu planlanmisti.
 * Uygulama sirasinda somut bir engelle karsilasildi: Auth.js'in Credentials
 * (kullanici adi/parola) saglayicisi veritabani oturumu stratejisini
 * DESTEKLEMIYOR; zorunlu olarak JWT'ye donuyor.
 *
 * Bu, projenin acik bir gereksinimini ihlal ederdi: patron bir personelin
 * hesabini devre disi biraktiginda oturum ANINDA dusmelidir. JWT ile jeton
 * suresi bitene kadar erisim surerdi - kasa ve tahsilat yetkisi olan bir
 * sistemde kabul edilemez.
 *
 * Bu nedenle oturum katmani burada dogrudan yazildi (~150 satir). Ihtiyacimiz
 * olan tek akis kullanici adi/parola oldugundan Auth.js'in geri kalan degeri
 * (OAuth saglayicilari, e-posta baglantisi) bu projede kullanilmiyordu.
 * Kazanclar: tam kontrol, beta bagimliligi yok, anlik iptal garantisi.
 * ============================================================================
 */

import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { resolvePermissions, type RoleName } from "@/lib/permissions";

export const SESSION_COOKIE = "otopark_session";

/** Hareketsizlik suresi: 12 saat. Her istekte kayarak yenilenir. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** lastSeenAt'i her istekte yazmamak icin esik (gereksiz DB yazimini onler). */
const TOUCH_THRESHOLD_MS = 5 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: RoleName;
  jobTitle: string | null;
  mustChangePassword: boolean;
  /** Rol taban kumesi + kullaniciya ozel eklemeler/cikarmalar sonucu. */
  permissions: Set<string>;
  sessionId: string;
}

/** Cerezdeki jetonun veritabaninda saklanan ozeti. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Yeni oturum olusturur ve cerezi yazar.
 * Dondurulen jeton yalnizca cereze yazilir; veritabaninda ozeti saklanir.
 */
export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expires,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/**
 * Gecerli oturumu okur. Oturum yoksa, suresi gectiyse veya kullanici devre disi
 * birakildiysa null doner VE oturum kaydi silinir (anlik iptal).
 *
 * Bu fonksiyon her korumali sayfada ve her Server Action'da cagrilir.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
}

/**
 * Jetonu dogrular ve oturum sahibini dondurur.
 *
 * getSession()'dan ayri tutulmasinin nedeni: cerez baglami gerektirmedigi icin
 * entegrasyon testleriyle dogrudan test edilebilir. Anlik iptal garantisi
 * (devre disi hesabin oturumunun hemen dusmesi) burada saglanir ve test edilir.
 */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: { permissions: { select: { permission: true, granted: true } } },
      },
    },
  });

  if (!session) return null;

  // Suresi gecmis oturum: temizle.
  if (session.expires.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // ANLIK IPTAL: hesap devre disi birakildiysa oturum derhal sonlandirilir.
  if (!session.user.isActive) {
    await prisma.session.deleteMany({ where: { userId: session.userId } }).catch(() => {});
    return null;
  }

  // Kayan son kullanma: kullanici aktif oldukca oturum uzar.
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_THRESHOLD_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expires: new Date(Date.now() + SESSION_TTL_MS) },
      })
      .catch(() => {});
  }

  return {
    id: session.user.id,
    username: session.user.username,
    fullName: session.user.fullName,
    role: session.user.role as RoleName,
    jobTitle: session.user.jobTitle,
    mustChangePassword: session.user.mustChangePassword,
    permissions: resolvePermissions(session.user.role as RoleName, session.user.permissions),
    sessionId: session.id,
  };
}

/** Oturumu kapatir: veritabani kaydini siler ve cerezi temizler. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/** Bir kullanicinin TUM oturumlarini dusurur (hesap devre disi, parola degisimi). */
export async function destroyAllSessionsForUser(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

/** Suresi gecmis oturumlari temizler (bakim gorevi). */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expires: { lte: new Date() } } });
  return result.count;
}

/** Sabit zamanli metin karsilastirmasi (zamanlama saldirilarina karsi). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export type { Role };
