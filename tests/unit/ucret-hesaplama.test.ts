/**
 * UCRET HESAPLAMA MOTORU TESTLERI
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki fiyatlar YALNIZCA ALGORITMAYI TEST ETMEK icin
 * uydurulmus degerlerdir. Londra Camping Otopark'in gercek tarifesi DEGILDIR
 * ve hicbir yere isletme verisi olarak yazilmaz. Gercek fiyatlar patron
 * tarafindan panelden girilecek (docs/07 S1).
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import { geceAraligindaMi, hesaplaUcret, odenecekTutar } from "@/server/pricing/calculate";
import { SNAPSHOT_SURUMU, TarifeSnapshotSemasi, type TarifeSnapshot } from "@/server/pricing/types";

/** Tum fiyatlari 0 olan taban snapshot - patron henuz tarife girmemis hali. */
function bosSnapshot(): TarifeSnapshot {
  return {
    surum: SNAPSHOT_SURUMU,
    planId: "plan-1",
    planAdi: "Test Planı",
    surumId: "surum-1",
    surumNo: 1,
    kuralId: "kural-1",
    aracSinifiId: null,
    aracSinifiAdi: null,
    ucretsizDakika: 0,
    ucretsizDusulur: false,
    ilkBlokDakika: 0,
    ilkBlokUcret: 0,
    saatlikUcret: 0,
    saatYuvarlamaDakika: 60,
    gunlukUcret: 0,
    ekGunBlokUcret: 0,
    gunlukUstLimit: 0,
    geceSabitUcret: null,
    geceBaslangicDakika: null,
    geceBitisDakika: null,
    haftaSonuKatsayisi: null,
    asgariUcret: 0,
  };
}

function snapshot(ek: Partial<TarifeSnapshot>): TarifeSnapshot {
  return { ...bosSnapshot(), ...ek };
}

/** Girisi sabit bir ana, cikisi N dakika sonrasina koyar. */
function hesapla(dakika: number, s: TarifeSnapshot, ek: Record<string, unknown> = {}) {
  const giris = new Date("2026-10-02T08:00:00Z"); // Cuma, 11:00 Istanbul
  const cikis = new Date(giris.getTime() + dakika * 60000);
  return hesaplaUcret({ girisAt: giris, cikisAt: cikis, snapshot: s, ...ek });
}

// ---------------------------------------------------------------------------
// TARIFE TANIMSIZ HALI - en onemli durum: fiyat uydurulmamali
// ---------------------------------------------------------------------------
describe("tarife tanımlı değilken", () => {
  it("ücret 0 çıkar ama tarifeTanimsiz=true ile işaretlenir", () => {
    const sonuc = hesapla(192, bosSnapshot());
    expect(sonuc.tutar).toBe(0);
    expect(sonuc.tarifeTanimsiz).toBe(true);
    expect(sonuc.ucretsizMi).toBe(false);
    expect(sonuc.dokum[0]?.aciklama).toContain("tanımlı değil");
  });

  it("süre doğru hesaplanmaya devam eder", () => {
    // Fiyat yoksa bile sure kaydi tutulur; patron tarife girince geçmiş
    // raporlarda süre bilgisi kaybolmuş olmaz.
    expect(hesapla(192, bosSnapshot()).sureDakika).toBe(192);
    expect(hesapla(1500, bosSnapshot()).sureDakika).toBe(1500);
  });

  it("asgari ücret tek başına tanımlıysa tarife tanımsız sayılmaz", () => {
    const sonuc = hesapla(30, snapshot({ asgariUcret: 4000 }));
    expect(sonuc.tarifeTanimsiz).toBe(false);
    expect(sonuc.tutar).toBe(4000);
  });
});

// ---------------------------------------------------------------------------
// UCRETSIZ SURE
// ---------------------------------------------------------------------------
describe("ücretsiz süre", () => {
  const s = snapshot({ ucretsizDakika: 15, saatlikUcret: 2500, asgariUcret: 4000 });

  it("sınırın altında ücret alınmaz", () => {
    const sonuc = hesapla(14, s);
    expect(sonuc.tutar).toBe(0);
    expect(sonuc.ucretsizMi).toBe(true);
  });

  it("tam sınırda ücret alınmaz", () => {
    expect(hesapla(15, s).tutar).toBe(0);
    expect(hesapla(15, s).ucretsizMi).toBe(true);
  });

  it("sınırın 1 dakika üstünde ücret başlar", () => {
    const sonuc = hesapla(16, s);
    expect(sonuc.ucretsizMi).toBe(false);
    expect(sonuc.tutar).toBeGreaterThan(0);
  });

  it("ücretsiz süre düşülmeyen tarifede tam süre ücretlenir", () => {
    // ucretsizDusulur=false: 45 dk -> baslayan 1 saat
    const sonuc = hesapla(45, snapshot({ ucretsizDakika: 15, saatlikUcret: 2500 }));
    expect(sonuc.tutar).toBe(2500);
  });

  it("ücretsiz süre düşülen tarifede süreden indirilir", () => {
    // 75 dk - 15 dk = 60 dk -> tam 1 saat
    const sonuc = hesapla(
      75,
      snapshot({ ucretsizDakika: 15, ucretsizDusulur: true, saatlikUcret: 2500 }),
    );
    expect(sonuc.tutar).toBe(2500);
    expect(sonuc.uygulananKurallar).toContain("ucretsiz_sure_dusuldu");
  });

  it("ücretsiz süre 0 ise 1 dakikada bile ücret işler", () => {
    const sonuc = hesapla(1, snapshot({ saatlikUcret: 2500 }));
    expect(sonuc.tutar).toBe(2500);
  });
});

// ---------------------------------------------------------------------------
// SAATLIK UCRET VE YUVARLAMA
// ---------------------------------------------------------------------------
describe("saatlik ücret ve yuvarlama", () => {
  it("başlayan saat tam sayılır (60 dk yuvarlama)", () => {
    const s = snapshot({ saatlikUcret: 2500, saatYuvarlamaDakika: 60 });
    expect(hesapla(1, s).tutar).toBe(2500);
    expect(hesapla(60, s).tutar).toBe(2500);
    expect(hesapla(61, s).tutar).toBe(5000);
    expect(hesapla(120, s).tutar).toBe(5000);
    expect(hesapla(121, s).tutar).toBe(7500);
  });

  it("yarım saatlik kademe de desteklenir", () => {
    const s = snapshot({ saatlikUcret: 1500, saatYuvarlamaDakika: 30 });
    expect(hesapla(1, s).tutar).toBe(1500);
    expect(hesapla(30, s).tutar).toBe(1500);
    expect(hesapla(31, s).tutar).toBe(3000);
    expect(hesapla(90, s).tutar).toBe(4500);
  });

  it("dakika başı kademe (1 dk yuvarlama) desteklenir", () => {
    const s = snapshot({ saatlikUcret: 60, saatYuvarlamaDakika: 1 });
    expect(hesapla(10, s).tutar).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// ILK BLOK
// ---------------------------------------------------------------------------
describe("ilk blok ücreti", () => {
  const s = snapshot({ ilkBlokDakika: 60, ilkBlokUcret: 4000, saatlikUcret: 2500 });

  it("ilk blok içinde yalnızca blok ücreti alınır", () => {
    expect(hesapla(45, s).tutar).toBe(4000);
    expect(hesapla(60, s).tutar).toBe(4000);
  });

  it("ilk bloğu aşan süre saatlik ücretlenir", () => {
    // 70 dk: ilk 60 dk = 40 TL + başlayan 1 saat (10 dk) = 25 TL
    expect(hesapla(70, s).tutar).toBe(6500);
  });

  it("DOKÜMAN ÖRNEĞİ: 3 saat 12 dakika = 115 TL", () => {
    // docs/05 tablosundaki örnek: 40 ₺ + ceil(132/60)=3 × 25 ₺
    const sonuc = hesapla(192, s);
    expect(sonuc.tutar).toBe(11500);
    expect(sonuc.dokum.map((d) => d.aciklama)).toEqual([
      "İlk 60 dk",
      "3 saat × 25 ₺",
    ]);
  });

  it("ilk blok ücreti 0 ise blok uygulanmaz", () => {
    const sonuc = hesapla(70, snapshot({ ilkBlokDakika: 60, saatlikUcret: 2500 }));
    expect(sonuc.tutar).toBe(5000); // 2 başlayan saat
  });
});

// ---------------------------------------------------------------------------
// GUNLUK UST LIMIT
// ---------------------------------------------------------------------------
describe("günlük üst limit", () => {
  const s = snapshot({
    ilkBlokDakika: 60,
    ilkBlokUcret: 4000,
    saatlikUcret: 2500,
    gunlukUstLimit: 25000,
  });

  it("limitin altında normal hesap geçerli", () => {
    expect(hesapla(192, s).tutar).toBe(11500);
  });

  it("DOKÜMAN ÖRNEĞİ: 11 saat = 250 TL (üst limit)", () => {
    // 40 ₺ + 10 × 25 ₺ = 290 ₺ -> limit 250 ₺
    const sonuc = hesapla(660, s);
    expect(sonuc.tutar).toBe(25000);
    expect(sonuc.uygulananKurallar).toContain("gunluk_ust_limit");
  });

  it("limit tam sınırda devreye girmez", () => {
    // 40 + 8×25 = 240 ₺ < 250 ₺
    expect(hesapla(540, s).tutar).toBe(24000);
  });

  it("limit 0 ise sınırsız hesaplanır", () => {
    const sinirsiz = snapshot({ ilkBlokDakika: 60, ilkBlokUcret: 4000, saatlikUcret: 2500 });
    expect(hesapla(660, sinirsiz).tutar).toBe(29000);
  });

  it("günlük ücret varsa üst limit olmasa da kısmi gün tam günü aşmaz", () => {
    // Mantik korumasi: 23 saat, 24 saatten pahali olamaz.
    const s2 = snapshot({ saatlikUcret: 2500, gunlukUcret: 20000 });
    const yirmiUcSaat = hesapla(23 * 60, s2);
    const yirmiDortSaat = hesapla(24 * 60, s2);
    expect(yirmiUcSaat.tutar).toBeLessThanOrEqual(yirmiDortSaat.tutar);
    expect(yirmiUcSaat.tutar).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// TAM GUNLER
// ---------------------------------------------------------------------------
describe("tam günler", () => {
  const s = snapshot({
    ilkBlokDakika: 60,
    ilkBlokUcret: 4000,
    saatlikUcret: 2500,
    gunlukUcret: 20000,
    gunlukUstLimit: 25000,
  });

  it("tam 24 saat = 1 tam gün", () => {
    expect(hesapla(1440, s).tutar).toBe(20000);
  });

  it("DOKÜMAN ÖRNEĞİ: 26 saat = 265 TL", () => {
    // 1 tam gün 200 ₺ + artan 2 sa (40 + 25) = 65 ₺
    expect(hesapla(26 * 60, s).tutar).toBe(26500);
  });

  it("24 saat 1 dakika = 1 gün + başlayan ilk blok", () => {
    expect(hesapla(1441, s).tutar).toBe(24000); // 200 + 40
  });

  it("DOKÜMAN ÖRNEĞİ: 3 gün 4 saat = 715 TL", () => {
    // 3 × 200 = 600 ₺ + artan 4 sa (ilk 60 dk 40 ₺ + ceil(180/60)=3 × 25 ₺ = 75 ₺)
    //
    // NOT: docs/05 tablosunda bu satır başlangıçta 740 ₺ yazılmıştı; ilk bloğun
    // 60 dakikası kalan süreden düşülmemişti. Tablonun diğer satırları (3 sa
    // 12 dk = 115 ₺, 26 saat = 265 ₺) ilk bloğu düşerek hesaplanmıştı, yani
    // doküman kendi içinde çelişiyordu. Doğru değer 715 ₺; doküman düzeltildi.
    expect(hesapla(3 * 1440 + 4 * 60, s).tutar).toBe(71500);
  });

  it("ilk blok kalan süreden düşülür (dokümandaki tutarsızlığın kök nedeni)", () => {
    expect(hesapla(70, s).tutar).toBe(6500); // 40 + 1×25
    expect(hesapla(192, s).tutar).toBe(11500); // 40 + 3×25
    expect(hesapla(1440 + 240, s).tutar).toBe(20000 + 11500); // 1 gün + 40 + 3×25
  });

  it("48 saat = 2 tam gün", () => {
    expect(hesapla(2880, s).tutar).toBe(40000);
  });

  it("günlük ücret tanımsızsa tam günler saatlik ücretten hesaplanır", () => {
    // YAPISAL KARAR: patron yalnizca saatlik ucret girdiyse, 26 saatlik park
    // sessizce bedava olmaz.
    const sadeceSaatlik = snapshot({ saatlikUcret: 2500 });
    const sonuc = hesapla(26 * 60, sadeceSaatlik);
    // 1 gün = 24 × 25 ₺ = 600 ₺, artan 2 saat = 50 ₺
    expect(sonuc.tutar).toBe(65000);
    expect(sonuc.uygulananKurallar).toContain("gunluk_ucret_yerine_saatlik");
  });

  it("günlük ücret yoksa ama üst limit varsa tam günler limitten hesaplanır", () => {
    const s2 = snapshot({ saatlikUcret: 2500, gunlukUstLimit: 25000 });
    const sonuc = hesapla(26 * 60, s2);
    expect(sonuc.tutar).toBe(25000 + 5000);
    expect(sonuc.uygulananKurallar).toContain("gunluk_ucret_yerine_ust_limit");
  });
});

// ---------------------------------------------------------------------------
// GECE TARIFESI
// ---------------------------------------------------------------------------
describe("gece tarifesi", () => {
  const s = snapshot({
    saatlikUcret: 2500,
    geceSabitUcret: 15000,
    geceBaslangicDakika: 20 * 60, // 20:00
    geceBitisDakika: 8 * 60, // 08:00
  });

  it("gece aralığında ve avantajlıysa uygulanır", () => {
    // 21:00'de giriş, 05:00'te çıkış = 8 saat -> 200 ₺; gece 150 ₺ daha avantajlı
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-02T18:00:00Z"),
      cikisAt: new Date("2026-10-03T02:00:00Z"),
      snapshot: s,
      girisGunDakikasi: 21 * 60,
      cikisGunDakikasi: 5 * 60,
    });
    expect(sonuc.tutar).toBe(15000);
    expect(sonuc.uygulananKurallar).toContain("gece_tarifesi");
  });

  it("gece ücreti avantajlı değilse normal hesap geçerli", () => {
    // 2 saat = 50 ₺, gece 150 ₺ -> normal hesap daha ucuz
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-02T18:00:00Z"),
      cikisAt: new Date("2026-10-02T20:00:00Z"),
      snapshot: s,
      girisGunDakikasi: 21 * 60,
      cikisGunDakikasi: 23 * 60,
    });
    expect(sonuc.tutar).toBe(5000);
    expect(sonuc.uygulananKurallar).not.toContain("gece_tarifesi");
  });

  it("gündüz girişinde gece tarifesi uygulanmaz", () => {
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-02T08:00:00Z"),
      cikisAt: new Date("2026-10-02T18:00:00Z"),
      snapshot: s,
      girisGunDakikasi: 11 * 60,
      cikisGunDakikasi: 21 * 60,
    });
    expect(sonuc.uygulananKurallar).not.toContain("gece_tarifesi");
  });

  it("gece ücreti tanımlı değilse kural hiç devreye girmez", () => {
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-02T18:00:00Z"),
      cikisAt: new Date("2026-10-03T02:00:00Z"),
      snapshot: snapshot({ saatlikUcret: 2500 }),
      girisGunDakikasi: 21 * 60,
      cikisGunDakikasi: 5 * 60,
    });
    expect(sonuc.tutar).toBe(20000);
  });

  it("24 saati aşan parkta gece tarifesi uygulanmaz", () => {
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-02T18:00:00Z"),
      cikisAt: new Date("2026-10-04T02:00:00Z"),
      snapshot: s,
      girisGunDakikasi: 21 * 60,
      cikisGunDakikasi: 5 * 60,
    });
    expect(sonuc.uygulananKurallar).not.toContain("gece_tarifesi");
  });
});

describe("geceAraligindaMi", () => {
  it("gece yarısını aşan aralığı doğru değerlendirir", () => {
    // 20:00 - 08:00
    expect(geceAraligindaMi(21 * 60, 1200, 480)).toBe(true);
    expect(geceAraligindaMi(2 * 60, 1200, 480)).toBe(true);
    expect(geceAraligindaMi(1200, 1200, 480)).toBe(true); // tam başlangıç
    expect(geceAraligindaMi(479, 1200, 480)).toBe(true);
    expect(geceAraligindaMi(480, 1200, 480)).toBe(false); // tam bitiş
    expect(geceAraligindaMi(12 * 60, 1200, 480)).toBe(false);
  });

  it("gece yarısını aşmayan aralığı doğru değerlendirir", () => {
    // 01:00 - 06:00
    expect(geceAraligindaMi(3 * 60, 60, 360)).toBe(true);
    expect(geceAraligindaMi(7 * 60, 60, 360)).toBe(false);
  });

  it("başlangıç ve bitiş aynıysa aralık yok sayılır", () => {
    expect(geceAraligindaMi(5 * 60, 300, 300)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// HAFTA SONU KATSAYISI
// ---------------------------------------------------------------------------
describe("hafta sonu katsayısı", () => {
  const s = snapshot({ saatlikUcret: 2500, haftaSonuKatsayisi: 1.25 });

  it("hafta sonu girişte katsayı uygulanır", () => {
    const sonuc = hesapla(120, s, { haftaSonuMu: true });
    expect(sonuc.tutar).toBe(6250); // 50 ₺ × 1,25
    expect(sonuc.uygulananKurallar).toContain("hafta_sonu_katsayisi");
  });

  it("hafta içi girişte uygulanmaz", () => {
    expect(hesapla(120, s, { haftaSonuMu: false }).tutar).toBe(5000);
  });

  it("katsayı tanımsızsa uygulanmaz", () => {
    const sonuc = hesapla(120, snapshot({ saatlikUcret: 2500 }), { haftaSonuMu: true });
    expect(sonuc.tutar).toBe(5000);
  });

  it("katsayı 1 ise tutarı değiştirmez", () => {
    const sonuc = hesapla(120, snapshot({ saatlikUcret: 2500, haftaSonuKatsayisi: 1 }), {
      haftaSonuMu: true,
    });
    expect(sonuc.tutar).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// ASGARI UCRET
// ---------------------------------------------------------------------------
describe("asgari ücret", () => {
  it("hesaplanan tutar asgarinin altındaysa asgari uygulanır", () => {
    const s = snapshot({ saatlikUcret: 1000, asgariUcret: 4000 });
    const sonuc = hesapla(30, s);
    expect(sonuc.tutar).toBe(4000);
    expect(sonuc.uygulananKurallar).toContain("asgari_ucret");
  });

  it("asgarinin üstündeyse dokunulmaz", () => {
    const s = snapshot({ saatlikUcret: 2500, asgariUcret: 2000 });
    expect(hesapla(60, s).tutar).toBe(2500);
  });

  it("ÜCRETSİZ SÜRE İÇİNDE asgari ücret uygulanmaz", () => {
    // Ucretsiz sure icinde cikan araca asgari ucret yazilmamali.
    const s = snapshot({ ucretsizDakika: 15, saatlikUcret: 2500, asgariUcret: 4000 });
    expect(hesapla(10, s).tutar).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SINIR DURUMLARI
// ---------------------------------------------------------------------------
describe("sınır durumları", () => {
  const s = snapshot({ saatlikUcret: 2500, asgariUcret: 2500 });

  it("sıfır süre (anında çıkış) ücretsizdir", () => {
    expect(hesapla(0, s).tutar).toBe(0);
    expect(hesapla(0, s).sureDakika).toBe(0);
  });

  it("çıkış girişten önceyse süre 0 kabul edilir", () => {
    const giris = new Date("2026-10-02T12:00:00Z");
    const sonuc = hesaplaUcret({
      girisAt: giris,
      cikisAt: new Date(giris.getTime() - 60000),
      snapshot: s,
    });
    expect(sonuc.sureDakika).toBe(0);
    expect(sonuc.tutar).toBe(0);
  });

  it("saniyeler aşağı yuvarlanır", () => {
    const giris = new Date("2026-10-02T12:00:00Z");
    const sonuc = hesaplaUcret({
      girisAt: giris,
      cikisAt: new Date("2026-10-02T12:00:59Z"),
      snapshot: s,
    });
    expect(sonuc.sureDakika).toBe(0);
  });

  it("çok uzun park (30 gün) hesaplanabilir", () => {
    const uzun = snapshot({ gunlukUcret: 20000 });
    const sonuc = hesapla(30 * 1440, uzun);
    expect(sonuc.tutar).toBe(30 * 20000);
    expect(sonuc.sureDakika).toBe(43200);
  });

  it("tutar her zaman tamsayı kuruştur", () => {
    const s2 = snapshot({ saatlikUcret: 3333, haftaSonuKatsayisi: 1.17 });
    const sonuc = hesapla(200, s2, { haftaSonuMu: true });
    expect(Number.isInteger(sonuc.tutar)).toBe(true);
  });

  it("tutar asla negatif olamaz", () => {
    const s2 = snapshot({ saatlikUcret: 2500, gunlukUstLimit: 1 });
    expect(hesapla(600, s2).tutar).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// HESAP DOKUMU - personel ekraninda seffaflik
// ---------------------------------------------------------------------------
describe("hesap dökümü", () => {
  it("döküm satırlarının toplamı tutara eşittir", () => {
    const s = snapshot({
      ilkBlokDakika: 60,
      ilkBlokUcret: 4000,
      saatlikUcret: 2500,
      gunlukUcret: 20000,
      asgariUcret: 1000,
    });
    for (const dakika of [45, 192, 660, 1441, 3 * 1440 + 240]) {
      const sonuc = hesapla(dakika, s);
      const toplam = sonuc.dokum.reduce((t, d) => t + d.tutar, 0);
      expect(toplam, `${dakika} dk için döküm toplamı tutmuyor`).toBe(sonuc.tutar);
    }
  });

  it("üst limit uygulandığında döküm negatif düzeltme satırı içerir", () => {
    const s = snapshot({ saatlikUcret: 2500, gunlukUstLimit: 10000 });
    const sonuc = hesapla(600, s);
    const duzeltme = sonuc.dokum.find((d) => d.aciklama.includes("üst limit"));
    expect(duzeltme).toBeDefined();
    expect(duzeltme!.tutar).toBeLessThan(0);
    expect(sonuc.dokum.reduce((t, d) => t + d.tutar, 0)).toBe(sonuc.tutar);
  });
});

// ---------------------------------------------------------------------------
// INDIRIM
// ---------------------------------------------------------------------------
describe("ödenecek tutar (indirim sonrası)", () => {
  it("indirim düşülür", () => {
    expect(odenecekTutar(18500, 2000)).toBe(16500);
  });
  it("indirim tutardan büyükse 0 olur, negatife inmez", () => {
    expect(odenecekTutar(5000, 9000)).toBe(0);
  });
  it("negatif indirim tutarı artırmaz", () => {
    expect(odenecekTutar(5000, -3000)).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// SNAPSHOT DOGRULAMA
// ---------------------------------------------------------------------------
describe("snapshot şeması", () => {
  it("geçerli snapshot doğrulanır", () => {
    expect(TarifeSnapshotSemasi.safeParse(bosSnapshot()).success).toBe(true);
  });

  it("bozuk snapshot reddedilir", () => {
    expect(TarifeSnapshotSemasi.safeParse({ surum: 1 }).success).toBe(false);
    expect(
      TarifeSnapshotSemasi.safeParse({ ...bosSnapshot(), saatlikUcret: -100 }).success,
    ).toBe(false);
    expect(
      TarifeSnapshotSemasi.safeParse({ ...bosSnapshot(), saatlikUcret: 12.5 }).success,
    ).toBe(false);
  });

  it("bilinmeyen sürüm reddedilir", () => {
    expect(TarifeSnapshotSemasi.safeParse({ ...bosSnapshot(), surum: 3 }).success).toBe(false);
    expect(TarifeSnapshotSemasi.safeParse({ ...bosSnapshot(), surum: 0 }).success).toBe(false);
  });

  it("sürüm 1 snapshot okunmaya devam eder; ek gün bloğu 0 varsayılır", () => {
    // Asama 2-3'te olusan park kayitlari surum 1 snapshot tasir ve
    // ekGunBlokUcret alani ICERMEZ. Bu kayitlar giriste nasil hesaplandiysa
    // aynen oyle hesaplanmaya devam etmek ZORUNDA (gecmis degismez).
    const { ekGunBlokUcret, ...surum1 } = { ...bosSnapshot(), surum: 1 as const };
    expect(ekGunBlokUcret).toBe(0);

    const okunan = TarifeSnapshotSemasi.parse(surum1);
    expect(okunan.surum).toBe(1);
    expect(okunan.ekGunBlokUcret).toBe(0);
  });

  it("saat yuvarlaması 0 olamaz (sıfıra bölme koruması)", () => {
    expect(
      TarifeSnapshotSemasi.safeParse({ ...bosSnapshot(), saatYuvarlamaDakika: 0 }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SAFLIK - ayni girdi ayni cikti
// ---------------------------------------------------------------------------
describe("fonksiyon saflığı", () => {
  it("aynı girdi her zaman aynı çıktıyı verir", () => {
    const s = snapshot({ ilkBlokDakika: 60, ilkBlokUcret: 4000, saatlikUcret: 2500 });
    const a = hesapla(192, s);
    const b = hesapla(192, s);
    expect(a).toEqual(b);
  });

  it("snapshot'ı değiştirmez", () => {
    const s = snapshot({ saatlikUcret: 2500 });
    const kopya = structuredClone(s);
    hesapla(192, s);
    expect(s).toEqual(kopya);
  });
});
