/**
 * TELEFON BAGLANTILARI BIRIM TESTLERI (Asama 7)
 *
 * Isletme sahibinin verdigi WhatsApp numarasi 0555 056 79 79'dur
 * (05.10.2026). WhatsApp ULKE KODSUZ numara kabul etmedigi icin bagin
 * 905550567979 uretmesi gerekir - yanlis uretirse buton sessizce
 * calismayan bir sohbet acar.
 */

import { describe, expect, it } from "vitest";
import { telHref, whatsappHref } from "@/lib/telefon";

describe("tel: bağlantısı", () => {
  it("girilmemiş numara için null döner (buton çizilmez)", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
    expect(telHref("   ")).toBeNull();
  });

  it("çok kısa numara kabul edilmez", () => {
    expect(telHref("123")).toBeNull();
  });

  it("boşluk ve ayraçlar temizlenir", () => {
    expect(telHref("0555 056 79 79")).toBe("tel:05550567979");
    expect(telHref("(0212) 123-45-67")).toBe("tel:02121234567");
  });

  it("ülke kodu yazılmışsa + işareti korunur", () => {
    expect(telHref("+90 555 056 79 79")).toBe("tel:+905550567979");
  });
});

describe("WhatsApp bağlantısı", () => {
  it("girilmemiş numara için null döner", () => {
    expect(whatsappHref(null)).toBeNull();
    expect(whatsappHref("")).toBeNull();
  });

  it("işletmenin verdiği numarayı ülke koduyla tamamlar", () => {
    // 05.10.2026'da verilen gercek numara.
    expect(whatsappHref("0555 056 79 79")).toBe("https://wa.me/905550567979");
  });

  it("baştaki sıfır ülke koduyla değişir, eklenmez", () => {
    expect(whatsappHref("05550567979")).toBe("https://wa.me/905550567979");
    // 905550567979 olmali; "900555..." gibi bir numara WhatsApp'ta yoktur.
    expect(whatsappHref("05550567979")).not.toContain("900");
  });

  it("sıfırsız 10 hane doğrudan tamamlanır", () => {
    expect(whatsappHref("5550567979")).toBe("https://wa.me/905550567979");
  });

  it("zaten 90 ile başlayan numaraya ikinci kez eklenmez", () => {
    expect(whatsappHref("905550567979")).toBe("https://wa.me/905550567979");
    expect(whatsappHref("+90 555 056 79 79")).toBe("https://wa.me/905550567979");
  });

  it("yabancı ülke kodu korunur", () => {
    expect(whatsappHref("+49 170 1234567")).toBe("https://wa.me/491701234567");
  });

  it("beklenmedik uzunlukta numara bozulmadan geçer", () => {
    // Yanlis bir ulke kodu eklemektense kullanicinin yazdigini korumak dogru.
    expect(whatsappHref("12345678")).toBe("https://wa.me/12345678");
  });
});

/**
 * BİRDEN FAZLA NUMARA (break-ui ile bulundu, 08.10.2026)
 *
 * İşletmeler tek alana iki numara yazar. Tüm rakamlar birleştirilince
 * `tel:+90212555000005550567979` gibi var olmayan bir numara üretiliyordu;
 * müşteri butona basınca hiçbir yere ulaşamazdı.
 */
describe("tek alana yazılmış birden fazla numara", () => {
  it("eğik çizgiyle ayrılmış iki numaradan İLKİNİ alır", () => {
    expect(telHref("+90 (212) 555 00 00 / 0555 056 79 79")).toBe("tel:+902125550000");
  });

  it("virgül, noktalı virgül ve dikey çizgi de ayraçtır", () => {
    expect(telHref("0212 555 00 00, 0555 056 79 79")).toBe("tel:02125550000");
    expect(telHref("0212 555 00 00; 0555 056 79 79")).toBe("tel:02125550000");
    expect(telHref("0212 555 00 00 | 0555 056 79 79")).toBe("tel:02125550000");
  });

  it("'ve' bağlacı ayraçtır", () => {
    expect(telHref("0212 555 00 00 ve 0555 056 79 79")).toBe("tel:02125550000");
  });

  it("numaranın kendi içindeki parantez ve tire ayraç SAYILMAZ", () => {
    expect(telHref("(0212) 555-00-00")).toBe("tel:02125550000");
  });

  it("WhatsApp bağlantısı da ilk numarayı kullanır", () => {
    expect(whatsappHref("0555 056 79 79 / 0555 111 22 33")).toBe("https://wa.me/905550567979");
  });

  it("15 haneyi aşan değer için bağlantı üretilmez", () => {
    // Sessizce yanlış yere aramaktansa buton hiç çizilmesin.
    expect(telHref("0212555000005550567979")).toBeNull();
    expect(whatsappHref("0212555000005550567979")).toBeNull();
  });
});
