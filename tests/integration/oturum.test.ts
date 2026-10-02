/**
 * OTURUM YASAM DONGUSU TESTLERI
 *
 * En kritik kriter: patron bir personelin hesabini devre disi biraktiginda
 * oturum ANINDA duser. JWT yerine veritabani oturumu seciminin tek gerekcesi
 * budur; bu test o secimi dogrular.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { kullaniciOlustur, prisma, temizle } from "./helpers";
import {
  destroyAllSessionsForUser,
  pruneExpiredSessions,
  validateSessionToken,
} from "@/server/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

/** Test icin oturum olusturur ve ham jetonu dondurur. */
async function oturumOlustur(userId: string, opts: { expiresInMs?: number } = {}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expires: new Date(Date.now() + (opts.expiresInMs ?? 3600_000)),
      // lastSeenAt'i gecmise al ki dokunma esigi testlerde devreye girsin.
      lastSeenAt: new Date(Date.now() - 10 * 60_000),
    },
  });
  return token;
}

beforeEach(temizle);

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

describe("oturum doğrulama", () => {
  it("geçerli jeton kullanıcıyı döner", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", role: "STAFF" });
    const token = await oturumOlustur(user.id);

    const oturum = await validateSessionToken(token);
    expect(oturum).not.toBeNull();
    expect(oturum?.username).toBe("ahmet");
    expect(oturum?.role).toBe("STAFF");
  });

  it("geçersiz jeton null döner", async () => {
    await kullaniciOlustur({ username: "ahmet" });
    expect(await validateSessionToken("uydurma-jeton")).toBeNull();
  });

  it("JETONUN KENDİSİ VERİTABANINDA SAKLANMAZ (yalnızca özeti)", async () => {
    // Veritabani sizsa bile oturumlar ele gecirilemez.
    const user = await kullaniciOlustur({ username: "ahmet" });
    const token = await oturumOlustur(user.id);

    const kayit = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(kayit?.tokenHash).not.toBe(token);
    expect(kayit?.tokenHash).toHaveLength(64); // SHA-256 onaltilik
    // Veritabanindaki ozetle giris yapilamaz.
    expect(await validateSessionToken(kayit!.tokenHash)).toBeNull();
  });

  it("süresi geçmiş oturum geçersizdir ve kaydı silinir", async () => {
    const user = await kullaniciOlustur({ username: "ahmet" });
    const token = await oturumOlustur(user.id, { expiresInMs: -1000 });

    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("ANLIK İPTAL (projenin açık gereksinimi)", () => {
  it("hesap devre dışı bırakıldığı AN oturum düşer", async () => {
    const user = await kullaniciOlustur({ username: "ahmet" });
    const token = await oturumOlustur(user.id);

    // Oturum calisiyor.
    expect(await validateSessionToken(token)).not.toBeNull();

    // Patron hesabi devre disi birakir.
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    // Jeton suresi dolmadi ama oturum DERHAL gecersiz.
    expect(await validateSessionToken(token)).toBeNull();
  });

  it("devre dışı bırakma kullanıcının TÜM oturumlarını siler", async () => {
    // Personel hem telefondan hem tabletten girmis olabilir.
    const user = await kullaniciOlustur({ username: "ahmet" });
    const token1 = await oturumOlustur(user.id);
    await oturumOlustur(user.id);
    await oturumOlustur(user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(3);

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    await validateSessionToken(token1); // tek bir istek yeterli

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("bir kullanıcının oturumları diğerini etkilemez", async () => {
    const ahmet = await kullaniciOlustur({ username: "ahmet" });
    const veli = await kullaniciOlustur({ username: "veli" });
    const ahmetToken = await oturumOlustur(ahmet.id);
    const veliToken = await oturumOlustur(veli.id);

    await destroyAllSessionsForUser(ahmet.id);

    expect(await validateSessionToken(ahmetToken)).toBeNull();
    expect(await validateSessionToken(veliToken)).not.toBeNull();
  });
});

describe("kayan son kullanma süresi", () => {
  it("etkin kullanımda oturum uzar", async () => {
    const user = await kullaniciOlustur({ username: "ahmet" });
    const token = await oturumOlustur(user.id, { expiresInMs: 60_000 });
    const once = await prisma.session.findFirst({ where: { userId: user.id } });

    await validateSessionToken(token);

    const sonra = await prisma.session.findFirst({ where: { userId: user.id } });
    expect(sonra!.expires.getTime()).toBeGreaterThan(once!.expires.getTime());
    expect(sonra!.lastSeenAt.getTime()).toBeGreaterThan(once!.lastSeenAt.getTime());
  });
});

describe("izinlerin oturuma yansıması", () => {
  it("rol taban izinleri oturumda yer alır", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", role: "STAFF" });
    const token = await oturumOlustur(user.id);
    const oturum = await validateSessionToken(token);

    expect(oturum!.permissions.has(PERMISSIONS.PARKING_ENTRY)).toBe(true);
    expect(oturum!.permissions.has(PERMISSIONS.FINANCE_REPORT_VIEW)).toBe(false);
  });

  it("kullanıcıya özel ek izin oturuma yansır", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", role: "STAFF" });
    await prisma.userPermission.create({
      data: { userId: user.id, permission: PERMISSIONS.CASH_DRAWER_CLOSE, granted: true },
    });
    const token = await oturumOlustur(user.id);
    const oturum = await validateSessionToken(token);

    expect(oturum!.permissions.has(PERMISSIONS.CASH_DRAWER_CLOSE)).toBe(true);
    // Diger kisitlar korunur.
    expect(oturum!.permissions.has(PERMISSIONS.FINANCE_REPORT_VIEW)).toBe(false);
  });

  it("kaldırılan izin oturuma yansır", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", role: "STAFF" });
    await prisma.userPermission.create({
      data: { userId: user.id, permission: PERMISSIONS.PARKING_EXIT, granted: false },
    });
    const token = await oturumOlustur(user.id);
    const oturum = await validateSessionToken(token);

    expect(oturum!.permissions.has(PERMISSIONS.PARKING_EXIT)).toBe(false);
    expect(oturum!.permissions.has(PERMISSIONS.PARKING_ENTRY)).toBe(true);
  });

  it("izin değişikliği SONRAKİ istekte etkili olur (önbellek yok)", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", role: "STAFF" });
    const token = await oturumOlustur(user.id);

    expect((await validateSessionToken(token))!.permissions.has(PERMISSIONS.PARKING_VOID)).toBe(
      false,
    );

    await prisma.userPermission.create({
      data: { userId: user.id, permission: PERMISSIONS.PARKING_VOID, granted: true },
    });

    // Oturum yeniden okundugunda yeni izin gecerli; yeniden giris gerekmez.
    expect((await validateSessionToken(token))!.permissions.has(PERMISSIONS.PARKING_VOID)).toBe(
      true,
    );
  });

  it("patron tüm izinlere sahip olarak oturum açar", async () => {
    const user = await kullaniciOlustur({ username: "patron", role: "OWNER" });
    const token = await oturumOlustur(user.id);
    const oturum = await validateSessionToken(token);

    expect(oturum!.permissions.has(PERMISSIONS.FINANCE_REPORT_VIEW)).toBe(true);
    expect(oturum!.permissions.has(PERMISSIONS.TARIFF_EDIT)).toBe(true);
    expect(oturum!.permissions.has(PERMISSIONS.PERSONNEL_COST_VIEW)).toBe(true);
    expect(oturum!.permissions.has(PERMISSIONS.AUDIT_VIEW)).toBe(true);
  });
});

describe("bakım", () => {
  it("süresi geçmiş oturumlar temizlenir", async () => {
    const user = await kullaniciOlustur({ username: "ahmet" });
    await oturumOlustur(user.id, { expiresInMs: -5000 });
    await oturumOlustur(user.id, { expiresInMs: -1000 });
    await oturumOlustur(user.id, { expiresInMs: 3600_000 });

    const silinen = await pruneExpiredSessions();
    expect(silinen).toBe(2);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });
});
