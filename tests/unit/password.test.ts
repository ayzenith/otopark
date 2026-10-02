import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  checkPasswordStrength,
  generateSecurePassword,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";

describe("parola özetleme (Argon2id)", () => {
  it("doğru parolayı doğrular", async () => {
    const hash = await hashPassword("Kavun42Tepsi");
    expect(await verifyPassword(hash, "Kavun42Tepsi")).toBe(true);
  });

  it("yanlış parolayı reddeder", async () => {
    const hash = await hashPassword("Kavun42Tepsi");
    expect(await verifyPassword(hash, "Karpuz99Tabak")).toBe(false);
    expect(await verifyPassword(hash, "")).toBe(false);
  });

  it("aynı parola her seferinde farklı özet üretir (tuz)", async () => {
    const a = await hashPassword("Kavun42Tepsi");
    const b = await hashPassword("Kavun42Tepsi");
    expect(a).not.toBe(b);
    // Yine de ikisi de doğrulanır.
    expect(await verifyPassword(a, "Kavun42Tepsi")).toBe(true);
    expect(await verifyPassword(b, "Kavun42Tepsi")).toBe(true);
  });

  it("özet Argon2id biçimindedir", async () => {
    const hash = await hashPassword("Kavun42Tepsi");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("açık parola özette görünmez", async () => {
    const hash = await hashPassword("Kavun42Tepsi");
    expect(hash).not.toContain("Kavun42Tepsi");
  });

  it("bozuk özet hata fırlatmaz, false döner", async () => {
    expect(await verifyPassword("bu-gecerli-bir-hash-degil", "herhangi")).toBe(false);
  });
});

describe("parola gücü kontrolü", () => {
  it("güçlü parolayı kabul eder", () => {
    expect(checkPasswordStrength("Kavun42Tepsi").ok).toBe(true);
    expect(checkPasswordStrength("Zeytin7Dalga").ok).toBe(true);
  });

  it("\"parola\" kelimesini içeren parolayı reddeder", () => {
    // Turkce "parola" kelimesi de yasakli ifade listesinde: kullanicilarin
    // "Parola123" gibi tahmin edilebilir secimler yapmasini onler.
    expect(checkPasswordStrength("BenimParolam1").ok).toBe(false);
  });

  it("kısa parolayı reddeder", () => {
    const sonuc = checkPasswordStrength("Kisa12");
    expect(sonuc.ok).toBe(false);
    expect(sonuc.errors.join(" ")).toContain(`${MIN_PASSWORD_LENGTH}`);
  });

  it("büyük harf, küçük harf ve rakam zorunlu", () => {
    expect(checkPasswordStrength("sadecekucukharf").ok).toBe(false);
    expect(checkPasswordStrength("SADECEBUYUKHARF1").ok).toBe(false);
    expect(checkPasswordStrength("BuyukKucukAmaRakamYok").ok).toBe(false);
  });

  it("kolay tahmin edilen ifadeleri reddeder", () => {
    expect(checkPasswordStrength("Password123").ok).toBe(false);
    expect(checkPasswordStrength("Otopark123").ok).toBe(false);
    expect(checkPasswordStrength("Parola1234").ok).toBe(false);
    expect(checkPasswordStrength("Admin12345").ok).toBe(false);
  });

  it("Türkçe karakterli parolayı kabul eder", () => {
    expect(checkPasswordStrength("ÇiftliKöşk42").ok).toBe(true);
  });
});

describe("güvenli parola üretimi (ilk patron hesabı)", () => {
  it("istenen uzunlukta üretir", () => {
    expect(generateSecurePassword(16)).toHaveLength(16);
    expect(generateSecurePassword(24)).toHaveLength(24);
  });

  it("ürettiği parola güç kontrolünden geçer", () => {
    for (let i = 0; i < 25; i++) {
      const p = generateSecurePassword(16);
      expect(checkPasswordStrength(p).ok, `zayıf parola üretildi: ${p}`).toBe(true);
    }
  });

  it("her çağrıda farklı parola üretir", () => {
    const uretilenler = new Set(Array.from({ length: 50 }, () => generateSecurePassword(16)));
    expect(uretilenler.size).toBe(50);
  });

  it("karıştırılabilir karakterler kullanılmaz (0/O, 1/l/I)", () => {
    for (let i = 0; i < 25; i++) {
      const p = generateSecurePassword(20);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});
