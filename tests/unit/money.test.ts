import { describe, expect, it } from "vitest";
import {
  clampNonNegative,
  formatKurus,
  formatKurusPlain,
  kurusToDecimalString,
  kurusToLira,
  liraToKurus,
  roundToLira,
  toKurus,
} from "@/lib/money";

describe("kuruş dönüşümleri", () => {
  it("lirayı kuruşa çevirir", () => {
    expect(liraToKurus(185.5)).toBe(18550);
    expect(liraToKurus(0)).toBe(0);
    expect(liraToKurus(0.01)).toBe(1);
    expect(liraToKurus(1234.56)).toBe(123456);
  });

  it("virgüllü metni de kabul eder", () => {
    expect(liraToKurus("185,50")).toBe(18550);
    expect(liraToKurus("185.50")).toBe(18550);
  });

  it("geçersiz tutarda hata verir", () => {
    expect(() => liraToKurus("abc")).toThrow();
  });

  it("kuruşu liraya çevirir", () => {
    expect(kurusToLira(18550)).toBe(185.5);
    expect(kurusToLira(1)).toBe(0.01);
  });

  it("FLOAT HATASI OLUŞMAZ: 0.1 + 0.2 toplamı tam 0.30 olur", () => {
    // Para float ile tutulsaydı 0.30000000000000004 çıkardı.
    const toplam = liraToKurus(0.1) + liraToKurus(0.2);
    expect(toplam).toBe(30);
    expect(kurusToDecimalString(toplam)).toBe("0.30");
  });

  it("çok sayıda küçük tutarın toplamı kayma yapmaz", () => {
    // 1000 kez 0.07 TL = tam 70.00 TL olmalı.
    let toplam = 0;
    for (let i = 0; i < 1000; i++) toplam += liraToKurus(0.07);
    expect(kurusToDecimalString(toplam)).toBe("70.00");
  });
});

describe("kurusToDecimalString (veritabanına yazım)", () => {
  it("iki ondalık basamakla yazar", () => {
    expect(kurusToDecimalString(18550)).toBe("185.50");
    expect(kurusToDecimalString(100)).toBe("1.00");
    expect(kurusToDecimalString(5)).toBe("0.05");
    expect(kurusToDecimalString(0)).toBe("0.00");
  });

  it("negatif tutarı doğru yazar (iade/ters kayıt)", () => {
    expect(kurusToDecimalString(-18550)).toBe("-185.50");
    expect(kurusToDecimalString(-5)).toBe("-0.05");
  });
});

describe("toKurus (Prisma Decimal uyumu)", () => {
  it("metin, sayı ve Decimal benzeri nesneleri çevirir", () => {
    expect(toKurus("185.50")).toBe(18550);
    expect(toKurus(185.5)).toBe(18550);
    expect(toKurus({ toString: () => "185.50" })).toBe(18550);
  });
  it("null/undefined için 0 döner", () => {
    expect(toKurus(null)).toBe(0);
    expect(toKurus(undefined)).toBe(0);
  });
});

describe("Türkçe para biçimleme", () => {
  it("tr-TR biçiminde yazar", () => {
    // Türkçe biçim: binlik ayırıcı nokta, ondalık virgül.
    const bicim = formatKurus(123456);
    expect(bicim).toContain("1.234,56");
    expect(bicim).toContain("₺");
  });

  it("simgesiz biçim", () => {
    expect(formatKurusPlain(18550)).toBe("185,50");
    expect(formatKurusPlain(0)).toBe("0,00");
  });
});

describe("yardımcılar", () => {
  it("tam liraya yuvarlar", () => {
    expect(roundToLira(18550)).toBe(18600);
    expect(roundToLira(18540)).toBe(18500);
  });
  it("negatife düşmeyi engeller", () => {
    // İndirim tutardan büyük olsa bile ödenecek tutar 0'ın altına inmez.
    expect(clampNonNegative(-500)).toBe(0);
    expect(clampNonNegative(500)).toBe(500);
  });
});
