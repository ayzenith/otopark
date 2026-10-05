/**
 * SITE METNI COZUMLEYICI BIRIM TESTLERI (Asama 7)
 *
 * Buradaki metinler yalnizca orneklemedir; isletmenin gercek tanitim
 * metni degildir (henuz yazilmadi - docs/07 S18).
 */

import { describe, expect, it } from "vitest";
import { metniBloklaraAyir } from "@/lib/site-metin";

describe("site metni çözümleyici", () => {
  it("boş metin hiç blok üretmez", () => {
    expect(metniBloklaraAyir("")).toEqual([]);
    expect(metniBloklaraAyir("   \n\n  ")).toEqual([]);
  });

  it("boş satırla ayrılmış bloklar ayrı paragraf olur", () => {
    const bloklar = metniBloklaraAyir("Birinci satır.\n\nİkinci satır.");
    expect(bloklar).toEqual([
      { tur: "paragraf", metin: "Birinci satır." },
      { tur: "paragraf", metin: "İkinci satır." },
    ]);
  });

  it("tek satır sonu paragrafı bölmez", () => {
    const bloklar = metniBloklaraAyir("Birinci\nikinci");
    expect(bloklar).toHaveLength(1);
    expect(bloklar[0]).toEqual({ tur: "paragraf", metin: "Birinci\nikinci" });
  });

  it("## ile başlayan satır ara başlık olur", () => {
    expect(metniBloklaraAyir("## Otopark")).toEqual([{ tur: "baslik", metin: "Otopark" }]);
  });

  it("## işareti yalnızca blok başında geçerlidir", () => {
    const bloklar = metniBloklaraAyir("Fiyat ## işareti içeren metin");
    expect(bloklar[0]!.tur).toBe("paragraf");
  });

  it("tamamı - ile başlayan blok madde listesi olur", () => {
    expect(metniBloklaraAyir("- birinci\n- ikinci")).toEqual([
      { tur: "liste", maddeler: ["birinci", "ikinci"] },
    ]);
  });

  it("karışık blok liste sayılmaz", () => {
    const bloklar = metniBloklaraAyir("Giriş cümlesi\n- madde");
    expect(bloklar[0]!.tur).toBe("paragraf");
  });

  it("yalnız tire içeren satır liste sayılmaz", () => {
    // Blok kirpildigi icin son satirin ardindaki bosluk kaybolur ve satir
    // "- " onekini tasimaz; bu yuzden madde degil, duz paragraftir.
    expect(metniBloklaraAyir("- \n-  ")).toEqual([{ tur: "paragraf", metin: "- \n-" }]);
  });

  it("listedeki boş madde atlanır", () => {
    expect(metniBloklaraAyir("- birinci\n-  \n- ikinci")).toEqual([
      { tur: "liste", maddeler: ["birinci", "ikinci"] },
    ]);
  });

  it("Windows satır sonları da doğru bölünür", () => {
    const bloklar = metniBloklaraAyir("Birinci.\r\n\r\nİkinci.");
    expect(bloklar).toHaveLength(2);
  });

  it("HTML metni etiket olarak değil DÜZ METİN olarak taşınır", () => {
    // Cozumleyici HTML uretmez; cikti metindir ve React onu kacirarak basar.
    const bloklar = metniBloklaraAyir("<script>alert(1)</script>");
    expect(bloklar).toEqual([{ tur: "paragraf", metin: "<script>alert(1)</script>" }]);
  });

  it("metin türü dışında bir değer gelirse boş döner", () => {
    expect(metniBloklaraAyir(undefined as unknown as string)).toEqual([]);
    expect(metniBloklaraAyir(null as unknown as string)).toEqual([]);
  });
});
