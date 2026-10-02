import { describe, expect, it } from "vitest";
import {
  formatPlate,
  getProvinceCode,
  isValidTurkishPlate,
  normalizePlate,
} from "@/lib/plate";

describe("normalizePlate", () => {
  it("boşlukları ve noktalama işaretlerini atar", () => {
    expect(normalizePlate("34 ABC 123")).toBe("34ABC123");
    expect(normalizePlate("34-ABC-123")).toBe("34ABC123");
    expect(normalizePlate("  34 . abc / 123  ")).toBe("34ABC123");
  });

  it("küçük harfleri büyütür", () => {
    expect(normalizePlate("34abc123")).toBe("34ABC123");
  });

  it("Türkçe karakterleri ASCII'ye çevirir", () => {
    // Personel Türkçe klavyeden yazdığında plaka bozulmamalı.
    expect(normalizePlate("34 ABÇ 123")).toBe("34ABC123");
    expect(normalizePlate("06 İBŞ 45")).toBe("06IBS45");
    expect(normalizePlate("35 ğüö 12")).toBe("35GUO12");
    expect(normalizePlate("34 ıYZ 99")).toBe("34IYZ99");
  });

  it("boş girdide boş döner", () => {
    expect(normalizePlate("")).toBe("");
    expect(normalizePlate("   ")).toBe("");
  });

  it("aynı plakanın farklı yazımları aynı sonuca iner", () => {
    const yazimlar = ["34 ABC 123", "34abc123", "34-ABC-123", " 34 aBc 123 "];
    const sonuclar = new Set(yazimlar.map(normalizePlate));
    expect(sonuclar.size).toBe(1);
  });
});

describe("isValidTurkishPlate", () => {
  it("geçerli biçimleri kabul eder", () => {
    expect(isValidTurkishPlate("34 ABC 123")).toBe(true); // 3 harf 3 rakam
    expect(isValidTurkishPlate("34 AB 1234")).toBe(true); // 2 harf 4 rakam
    expect(isValidTurkishPlate("06 A 1234")).toBe(true); // 1 harf 4 rakam
    expect(isValidTurkishPlate("01 A 12345")).toBe(true); // 1 harf 5 rakam
    expect(isValidTurkishPlate("81 ABC 12")).toBe(true); // son il kodu
    expect(isValidTurkishPlate("35 XY 123")).toBe(true);
  });

  it("geçersiz il kodunu reddeder", () => {
    expect(isValidTurkishPlate("00 ABC 123")).toBe(false);
    expect(isValidTurkishPlate("82 ABC 123")).toBe(false);
    expect(isValidTurkishPlate("99 ABC 123")).toBe(false);
  });

  it("bozuk biçimleri reddeder", () => {
    expect(isValidTurkishPlate("")).toBe(false);
    expect(isValidTurkishPlate("ABC")).toBe(false);
    expect(isValidTurkishPlate("34")).toBe(false);
    expect(isValidTurkishPlate("34ABCD123")).toBe(false); // 4 harf
    expect(isValidTurkishPlate("34A1")).toBe(false); // yetersiz rakam
    expect(isValidTurkishPlate("34ABC1234")).toBe(false); // 3 harf + 4 rakam
  });

  it("yabancı plakayı geçersiz sayar ama bu girişi engellemez", () => {
    // Sistem bu durumda personeli UYARIR, girişi engellemez (docs/04).
    expect(isValidTurkishPlate("DE ABC 1234")).toBe(false);
  });
});

describe("formatPlate", () => {
  it("okunabilir biçime çevirir", () => {
    expect(formatPlate("34ABC123")).toBe("34 ABC 123");
    expect(formatPlate("06A1234")).toBe("06 A 1234");
    expect(formatPlate("34 ab 1234")).toBe("34 AB 1234");
  });

  it("desene uymayan girdiyi normalize edip aynen döndürür", () => {
    expect(formatPlate("ABCDEF")).toBe("ABCDEF");
  });
});

describe("getProvinceCode", () => {
  it("il kodunu çıkarır", () => {
    expect(getProvinceCode("34ABC123")).toBe("34");
    expect(getProvinceCode("06 A 1234")).toBe("06");
  });
  it("geçersizde null döner", () => {
    expect(getProvinceCode("99ABC123")).toBeNull();
    expect(getProvinceCode("ABC")).toBeNull();
  });
});
