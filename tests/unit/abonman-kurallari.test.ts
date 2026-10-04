/**
 * ABONMAN KURAL MOTORU - BIRIM TESTLERI
 *
 * ============================================================================
 * BU TESTLERDE TICARI DEGER YOKTUR
 * ----------------------------------------------------------------------------
 * Abonman kurallari fiyat icermez; yalnizca "bu anda kapsam var mi?"
 * sorusunu yanitlar. Testler saat araligi, hafta ici/sonu ve kota
 * mantigini dogrular. Isletmenin gercek abonman tipi 7/24 sinirsizdir
 * (S11, 04.10.2026) ve diger kurallar arayuzden SECILEMEZ.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import {
  KURAL_ETIKETLERI,
  SECILEBILIR_KURALLAR,
  VARSAYILAN_KURAL,
  dogrulaKuralParametresi,
  kapsamDegerlendir,
  saatAraligindaMi,
} from "@/server/subscription/rules";
import { normalizeTelefon } from "@/server/subscription/customer";

/** Europe/Istanbul (UTC+3) saatine gore tarih uretir. */
function an(tarih: string, saat: string): Date {
  return new Date(`${tarih}T${saat}:00+03:00`);
}

describe("7/24 sınırsız abonman (işletmenin standart kuralı)", () => {
  it("varsayılan kural 7/24 sınırsızdır", () => {
    expect(VARSAYILAN_KURAL).toBe("UNLIMITED_7_24");
  });

  it("arayüzden yalnızca 7/24 sınırsız seçilebilir", () => {
    // Diger kural turleri semada hazir ama patron onayi olmadan devreye
    // alinmaz. Bu test o kapiyi korur.
    expect([...SECILEBILIR_KURALLAR]).toEqual(["UNLIMITED_7_24"]);
  });

  it("gece yarısı da kapsamdadır", () => {
    const s = kapsamDegerlendir({
      tur: "UNLIMITED_7_24",
      parametre: null,
      an: an("2026-10-15", "03:17"),
    });
    expect(s.kapsamda).toBe(true);
    expect(s.gerekce).toBeNull();
  });

  it("hafta sonu da kapsamdadır", () => {
    // 2026-10-17 cumartesi
    const s = kapsamDegerlendir({
      tur: "UNLIMITED_7_24",
      parametre: null,
      an: an("2026-10-17", "14:00"),
    });
    expect(s.kapsamda).toBe(true);
  });

  it("giriş sayısı ne olursa olsun kapsamdadır (limit yok)", () => {
    const s = kapsamDegerlendir({
      tur: "UNLIMITED_7_24",
      parametre: null,
      an: an("2026-10-15", "12:00"),
      mevcutGirisSayisi: 9999,
    });
    expect(s.kapsamda).toBe(true);
  });

  it("kural adı personele gösterilebilir metindir", () => {
    const s = kapsamDegerlendir({
      tur: "UNLIMITED_7_24",
      parametre: null,
      an: an("2026-10-15", "12:00"),
    });
    expect(s.kuralAdi).toBe(KURAL_ETIKETLERI.UNLIMITED_7_24);
    expect(s.kuralAdi).toMatch(/7\/24/);
  });
});

describe("saat aralığı hesabı (ileride kullanılacak)", () => {
  it("normal aralık: başlangıç dahil, bitiş hariç", () => {
    const aralik = { baslangicDakika: 8 * 60, bitisDakika: 20 * 60 };
    expect(saatAraligindaMi(8 * 60, aralik)).toBe(true);
    expect(saatAraligindaMi(19 * 60 + 59, aralik)).toBe(true);
    expect(saatAraligindaMi(20 * 60, aralik)).toBe(false);
    expect(saatAraligindaMi(7 * 60 + 59, aralik)).toBe(false);
  });

  it("gece yarısını aşan aralık doğru çalışır", () => {
    const aralik = { baslangicDakika: 22 * 60, bitisDakika: 6 * 60 };
    expect(saatAraligindaMi(23 * 60, aralik)).toBe(true);
    expect(saatAraligindaMi(2 * 60, aralik)).toBe(true);
    expect(saatAraligindaMi(12 * 60, aralik)).toBe(false);
  });

  it("başlangıç ve bitiş eşitse tüm gün kapsamdadır", () => {
    const aralik = { baslangicDakika: 0, bitisDakika: 0 };
    expect(saatAraligindaMi(0, aralik)).toBe(true);
    expect(saatAraligindaMi(13 * 60 + 37, aralik)).toBe(true);
  });

  it("TIME_WINDOW kuralı aralık dışında kapsam vermez ve gerekçe döner", () => {
    const s = kapsamDegerlendir({
      tur: "TIME_WINDOW",
      parametre: { baslangicDakika: 8 * 60, bitisDakika: 20 * 60 },
      an: an("2026-10-15", "21:30"),
    });
    expect(s.kapsamda).toBe(false);
    expect(s.gerekce).toMatch(/08:00/);
    expect(s.gerekce).toMatch(/20:00/);
  });
});

describe("hafta içi / hafta sonu kuralları (ileride kullanılacak)", () => {
  it("WEEKDAY_ONLY hafta sonunda kapsam vermez", () => {
    // 2026-10-18 pazar
    const s = kapsamDegerlendir({
      tur: "WEEKDAY_ONLY",
      parametre: null,
      an: an("2026-10-18", "10:00"),
    });
    expect(s.kapsamda).toBe(false);
    expect(s.gerekce).toMatch(/hafta içi/);
  });

  it("WEEKDAY_ONLY hafta içinde kapsam verir", () => {
    // 2026-10-15 persembe
    const s = kapsamDegerlendir({
      tur: "WEEKDAY_ONLY",
      parametre: null,
      an: an("2026-10-15", "10:00"),
    });
    expect(s.kapsamda).toBe(true);
  });

  it("WEEKEND_ONLY tam tersini yapar", () => {
    expect(
      kapsamDegerlendir({ tur: "WEEKEND_ONLY", parametre: null, an: an("2026-10-17", "10:00") })
        .kapsamda,
    ).toBe(true);
    expect(
      kapsamDegerlendir({ tur: "WEEKEND_ONLY", parametre: null, an: an("2026-10-15", "10:00") })
        .kapsamda,
    ).toBe(false);
  });
});

describe("giriş kotası kuralı (ileride kullanılacak)", () => {
  it("kota dolmadıysa kapsam verir", () => {
    const s = kapsamDegerlendir({
      tur: "ENTRY_QUOTA",
      parametre: { adet: 30, kapsam: "DONEM" },
      an: an("2026-10-15", "10:00"),
      mevcutGirisSayisi: 29,
    });
    expect(s.kapsamda).toBe(true);
  });

  it("kota dolduysa kapsam vermez", () => {
    const s = kapsamDegerlendir({
      tur: "ENTRY_QUOTA",
      parametre: { adet: 30, kapsam: "DONEM" },
      an: an("2026-10-15", "10:00"),
      mevcutGirisSayisi: 30,
    });
    expect(s.kapsamda).toBe(false);
    expect(s.gerekce).toMatch(/30 giriş/);
  });

  it("giriş sayısı bilinmiyorsa 0 kabul edilir ve kapsam verir", () => {
    const s = kapsamDegerlendir({
      tur: "ENTRY_QUOTA",
      parametre: { adet: 1, kapsam: "GUN" },
      an: an("2026-10-15", "10:00"),
    });
    expect(s.kapsamda).toBe(true);
  });
});

describe("kural parametresi doğrulama", () => {
  it("parametre gerektirmeyen kurallarda null döner", () => {
    expect(dogrulaKuralParametresi("UNLIMITED_7_24", { sacma: true })).toBeNull();
    expect(dogrulaKuralParametresi("WEEKDAY_ONLY", undefined)).toBeNull();
  });

  it("bozuk saat aralığı sessizce geçmez", () => {
    expect(() => dogrulaKuralParametresi("TIME_WINDOW", { baslangicDakika: -5 })).toThrow();
    expect(() =>
      dogrulaKuralParametresi("TIME_WINDOW", { baslangicDakika: 0, bitisDakika: 2000 }),
    ).toThrow();
  });

  it("geçerli saat aralığı kabul edilir", () => {
    expect(
      dogrulaKuralParametresi("TIME_WINDOW", { baslangicDakika: 480, bitisDakika: 1200 }),
    ).toEqual({ baslangicDakika: 480, bitisDakika: 1200 });
  });

  it("sıfır veya negatif kota reddedilir", () => {
    expect(() => dogrulaKuralParametresi("ENTRY_QUOTA", { adet: 0, kapsam: "GUN" })).toThrow();
    expect(() => dogrulaKuralParametresi("ENTRY_QUOTA", { adet: -3, kapsam: "GUN" })).toThrow();
  });

  it("bozuk kural parametresi kapsam değerlendirmesinde de hata verir", () => {
    // "Belki kapsamda" diye bir cevap olamaz: musteriye ya ucretsiz denir
    // ya denmez. Bozuk parametre sessizce "kapsamda" sayilmaz.
    expect(() =>
      kapsamDegerlendir({ tur: "TIME_WINDOW", parametre: null, an: new Date() }),
    ).toThrow();
  });
});

describe("telefon normalizasyonu (müşteri arama)", () => {
  it("boşluk ve noktalama temizlenir", () => {
    expect(normalizeTelefon("0532 111 22 33")).toBe("5321112233");
    expect(normalizeTelefon("532-111-2233")).toBe("5321112233");
  });

  it("ülke kodu düşürülür", () => {
    expect(normalizeTelefon("+90 532 111 22 33")).toBe("5321112233");
    expect(normalizeTelefon("905321112233")).toBe("5321112233");
  });

  it("baştaki sıfır düşürülür", () => {
    expect(normalizeTelefon("05321112233")).toBe("5321112233");
  });

  it("aynı numaranın farklı yazımları aynı sonucu verir", () => {
    const yazimlar = ["0532 111 22 33", "+90 532 111 2233", "5321112233", "0 532 111 22 33"];
    const sonuclar = new Set(yazimlar.map(normalizeTelefon));
    expect(sonuclar.size).toBe(1);
  });
});
