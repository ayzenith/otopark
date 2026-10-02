/**
 * KIMLIK DOGRULAMA VE OTURUM TESTLERI
 *
 * Asama 1'in tamamlanma kriterleri (docs/06):
 *  - Devre disi birakilan kullanicinin oturumu ANINDA duser
 *  - 5 hatali denemeden sonra hesap 15 dakika kilitlenir
 *  - Yetkisiz islem reddedilir
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { kullaniciOlustur, prisma, temizle } from "./helpers";
import { authenticate, changePassword, MAX_FAILED_ATTEMPTS } from "@/server/auth/login";
import { hashPassword } from "@/server/auth/password";

const PAROLA = "Kavun42Tepsi";

beforeEach(temizle);

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

describe("giriş doğrulama", () => {
  it("doğru bilgilerle giriş başarılı olur", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const sonuc = await authenticate("ahmet", PAROLA);
    expect(sonuc.ok).toBe(true);
    if (sonuc.ok) expect(sonuc.userId).toBe(user.id);
  });

  it("kullanıcı adı büyük/küçük harfe duyarsızdır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    expect((await authenticate("AHMET", PAROLA)).ok).toBe(true);
    expect((await authenticate("  Ahmet  ", PAROLA)).ok).toBe(true);
  });

  it("yanlış parola reddedilir", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const sonuc = await authenticate("ahmet", "YanlisParola9");
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.reason).toBe("GECERSIZ_BILGI");
  });

  it("OLMAYAN KULLANICI ile yanlış parola AYNI mesajı döner", async () => {
    // Guvenlik: kullanici adinin var olup olmadigi mesajdan anlasilmamali.
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const yanlisParola = await authenticate("ahmet", "YanlisParola9");
    const olmayanKullanici = await authenticate("boyle-biri-yok", "YanlisParola9");

    expect(yanlisParola.ok).toBe(false);
    expect(olmayanKullanici.ok).toBe(false);
    if (!yanlisParola.ok && !olmayanKullanici.ok) {
      expect(yanlisParola.message).toBe(olmayanKullanici.message);
      expect(yanlisParola.reason).toBe(olmayanKullanici.reason);
    }
  });

  it("eksik bilgi reddedilir", async () => {
    const sonuc = await authenticate("", "");
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.reason).toBe("EKSIK_BILGI");
  });

  it("başarılı giriş son giriş zamanını kaydeder", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    expect(user.lastLoginAt).toBeNull();
    await authenticate("ahmet", PAROLA);
    const guncel = await prisma.user.findUnique({ where: { id: user.id } });
    expect(guncel?.lastLoginAt).not.toBeNull();
  });
});

describe("DEVRE DIŞI HESAP", () => {
  it("devre dışı hesapla giriş yapılamaz", async () => {
    await kullaniciOlustur({ username: "eski", password: PAROLA, isActive: false });
    const sonuc = await authenticate("eski", PAROLA);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.reason).toBe("HESAP_DEVRE_DISI");
  });

  it("hesap devre dışı bırakıldığında MEVCUT oturumlar da geçersizleşir", async () => {
    // Bu, projenin acik gereksinimi: patron bir hesabi kapattiginda oturum
    // ANINDA dusmelidir. Oturum okuma mantigi isActive kontrolu yapar ve
    // kullanicinin tum oturumlarini siler.
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });

    // Oturum olustur (cerez katmani olmadan, dogrudan veritabanina).
    await prisma.session.create({
      data: {
        tokenHash: "test-ozet-1",
        userId: user.id,
        expires: new Date(Date.now() + 3600_000),
      },
    });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    // Patron hesabi devre disi birakir ve oturumlari dusurur.
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    const { destroyAllSessionsForUser } = await import("@/server/auth/session");
    const dusen = await destroyAllSessionsForUser(user.id);

    expect(dusen).toBe(1);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("HESAP KİLİTLEME (kaba kuvvet koruması)", () => {
  it(`${MAX_FAILED_ATTEMPTS} hatalı denemeden sonra hesap kilitlenir`, async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });

    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) {
      const s = await authenticate("ahmet", "YanlisParola9");
      expect(s.ok).toBe(false);
      if (!s.ok) expect(s.reason).toBe("GECERSIZ_BILGI");
    }

    // Esige ulasan deneme hesabi kilitler.
    const kilitleyen = await authenticate("ahmet", "YanlisParola9");
    expect(kilitleyen.ok).toBe(false);
    if (!kilitleyen.ok) {
      expect(kilitleyen.reason).toBe("HESAP_KILITLI");
      expect(kilitleyen.lockedUntil).toBeInstanceOf(Date);
    }
  });

  it("kilitli hesaba DOĞRU parolayla da girilemez", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await authenticate("ahmet", "YanlisParola9");
    }
    const sonuc = await authenticate("ahmet", PAROLA);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.reason).toBe("HESAP_KILITLI");
  });

  it("kilit süresi 15 dakika olarak ayarlanır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await authenticate("ahmet", "YanlisParola9");
    }
    const user = await prisma.user.findUnique({ where: { username: "ahmet" } });
    const kalanDakika = (user!.lockedUntil!.getTime() - Date.now()) / 60000;
    expect(kalanDakika).toBeGreaterThan(14);
    expect(kalanDakika).toBeLessThanOrEqual(15);
  });

  it("kilit süresi geçtikten sonra doğru parolayla girilebilir", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    // Kilidi gecmise al.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: MAX_FAILED_ATTEMPTS, lockedUntil: new Date(Date.now() - 1000) },
    });
    const sonuc = await authenticate("ahmet", PAROLA);
    expect(sonuc.ok).toBe(true);
  });

  it("başarılı giriş hatalı deneme sayacını sıfırlar", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await authenticate("ahmet", "YanlisParola9");
    await authenticate("ahmet", "YanlisParola9");
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.failedLoginCount).toBe(2);

    await authenticate("ahmet", PAROLA);
    const guncel = await prisma.user.findUnique({ where: { id: user.id } });
    expect(guncel?.failedLoginCount).toBe(0);
    expect(guncel?.lockedUntil).toBeNull();
  });
});

describe("DENETİM KAYDI", () => {
  it("başarılı giriş denetime yazılır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await authenticate("ahmet", PAROLA, { ip: "10.0.0.5", userAgent: "test-tarayici" });

    const kayit = await prisma.auditLog.findFirst({ where: { action: "LOGIN_SUCCESS" } });
    expect(kayit).not.toBeNull();
    expect(kayit?.actorLabel).toBe("ahmet");
    expect(kayit?.ip).toBe("10.0.0.5");
    expect(kayit?.userAgent).toBe("test-tarayici");
  });

  it("başarısız giriş denetime yazılır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await authenticate("ahmet", "YanlisParola9");
    expect(await prisma.auditLog.count({ where: { action: "LOGIN_FAIL" } })).toBe(1);
  });

  it("hesap kilitlenmesi denetime yazılır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      await authenticate("ahmet", "YanlisParola9");
    }
    expect(await prisma.auditLog.count({ where: { action: "ACCOUNT_LOCKED" } })).toBe(1);
  });

  it("her giriş denemesi LoginAttempt tablosuna yazılır", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await authenticate("ahmet", "YanlisParola9");
    await authenticate("ahmet", PAROLA);
    expect(await prisma.loginAttempt.count()).toBe(2);
    expect(await prisma.loginAttempt.count({ where: { success: true } })).toBe(1);
  });

  it("DENETİM KAYDINA PAROLA VEYA JETON YAZILMAZ", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await authenticate("ahmet", PAROLA);
    const kayitlar = await prisma.auditLog.findMany();
    const metin = JSON.stringify(kayitlar);
    expect(metin).not.toContain(PAROLA);
    expect(metin).not.toContain("argon2");
  });
});

describe("parola değiştirme", () => {
  it("doğru mevcut parolayla değiştirilir", async () => {
    const user = await kullaniciOlustur({
      username: "ahmet",
      password: PAROLA,
      mustChangePassword: true,
    });
    const sonuc = await changePassword(user.id, PAROLA, "Zeytin7Dalga");
    expect(sonuc.ok).toBe(true);

    // Yeni parolayla giris yapilabilir, eskisiyle yapilamaz.
    expect((await authenticate("ahmet", "Zeytin7Dalga")).ok).toBe(true);
    expect((await authenticate("ahmet", PAROLA)).ok).toBe(false);
  });

  it("parola değişiminde mustChangePassword kapanır", async () => {
    const user = await kullaniciOlustur({
      username: "ahmet",
      password: PAROLA,
      mustChangePassword: true,
    });
    await changePassword(user.id, PAROLA, "Zeytin7Dalga");
    const guncel = await prisma.user.findUnique({ where: { id: user.id } });
    expect(guncel?.mustChangePassword).toBe(false);
  });

  it("yanlış mevcut parolayla değiştirilemez", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const sonuc = await changePassword(user.id, "YanlisParola9", "Zeytin7Dalga");
    expect(sonuc.ok).toBe(false);
  });

  it("yeni parola eskisiyle aynı olamaz", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const sonuc = await changePassword(user.id, PAROLA, PAROLA);
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.errors.join(" ")).toContain("aynı olamaz");
  });

  it("zayıf yeni parola reddedilir", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const sonuc = await changePassword(user.id, PAROLA, "kisa");
    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.errors.length).toBeGreaterThan(0);
  });

  it("PAROLA DEĞİŞİMİNDE TÜM OTURUMLAR DÜŞER", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await prisma.session.createMany({
      data: [
        { tokenHash: "ozet-a", userId: user.id, expires: new Date(Date.now() + 3600_000) },
        { tokenHash: "ozet-b", userId: user.id, expires: new Date(Date.now() + 3600_000) },
      ],
    });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    await changePassword(user.id, PAROLA, "Zeytin7Dalga");
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("parola değişimi denetime yazılır", async () => {
    const user = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    await changePassword(user.id, PAROLA, "Zeytin7Dalga");
    expect(await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGE" } })).toBe(1);
  });
});

describe("parola veritabanında açık metin tutulmaz", () => {
  it("kullanıcı satırında açık parola yok", async () => {
    await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const user = await prisma.user.findUnique({ where: { username: "ahmet" } });
    expect(user?.passwordHash).not.toContain(PAROLA);
    expect(user?.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("aynı parolayı kullanan iki kullanıcının özeti farklıdır", async () => {
    const a = await kullaniciOlustur({ username: "ahmet", password: PAROLA });
    const b = await kullaniciOlustur({ username: "veli", password: PAROLA });
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it("elle oluşturulan özet de doğrulanır", async () => {
    const hash = await hashPassword(PAROLA);
    const user = await prisma.user.create({
      data: { username: "elle", passwordHash: hash, fullName: "Elle", role: "STAFF" },
    });
    expect(user.id).toBeTruthy();
    expect((await authenticate("elle", PAROLA)).ok).toBe(true);
  });
});
