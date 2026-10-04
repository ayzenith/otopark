/**
 * ISLETMENIN GERCEK OTOPARK TARIFESI - BANT BANT DOGRULAMA
 *
 * ============================================================================
 * Bu dosyadaki degerler UYDURMA DEGILDIR: isletme sahibinin 04.10.2026'da
 * yazili olarak verdigi tarifedir.
 *
 *   0–1 saat      100 TL
 *   1–2 saat      150 TL
 *   2–3 saat      200 TL
 *   3–4 saat      250 TL
 *   4–5 saat      300 TL
 *   5–6 saat      350 TL
 *   6–7 saat      400 TL
 *   7–8 saat      450 TL
 *   8–9 saat      500 TL
 *   9–24 saat     500 TL
 *   24 saat sonrasi her ek 24 saat  +600 TL
 *
 * Gece tarifesi YOK. Normal otoparkta arac sinifina gore fiyat farki YOK.
 *
 * ONEMLI: Bu degerler KODA SABITLENMEMISTIR. Tarife veritabaninda surumlu
 * kayit olarak tutulur ve patron panelinden degistirilir. Bu dosya yalnizca
 * "panelden bu degerler girildiginde motor dogru hesapliyor mu?" sorusunu
 * yanitlar. Patron fiyati degistirdiginde bu test degismez - cunku test
 * MOTORU dogrular, veritabanindaki fiyati degil.
 *
 * Tarifenin motor parametrelerine donusumu:
 *   ilk blok      : 60 dk / 100 TL
 *   saatlik       : 50 TL, baslayan saat tam sayilir (yuvarlama 60 dk)
 *   gunluk limit  : 500 TL  -> 9. saatten 24. saate kadar sabit
 *   ek gun blogu  : 600 TL  -> 24 saatten sonra baslayan her 24 saat
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import { hesaplaUcret } from "@/server/pricing/calculate";
import { SNAPSHOT_SURUMU, type TarifeSnapshot } from "@/server/pricing/types";

const TL = 100; // 1 TL = 100 kurus

/** Isletmenin gercek tarifesinin motor karsiligi. */
function gercekTarife(): TarifeSnapshot {
  return {
    surum: SNAPSHOT_SURUMU,
    planId: "plan",
    planAdi: "Londra Camping Otopark",
    surumId: "surum",
    surumNo: 1,
    kuralId: "kural",
    // Arac sinifina gore fiyat farki YOK: kural genel (null).
    aracSinifiId: null,
    aracSinifiAdi: null,

    ucretsizDakika: 0,
    ucretsizDusulur: false,

    ilkBlokDakika: 60,
    ilkBlokUcret: 100 * TL,

    saatlikUcret: 50 * TL,
    saatYuvarlamaDakika: 60,

    gunlukUcret: 0,
    gunlukUstLimit: 500 * TL,
    ekGunBlokUcret: 600 * TL,

    // Gece tarifesi YOK.
    geceSabitUcret: null,
    geceBaslangicDakika: null,
    geceBitisDakika: null,

    haftaSonuKatsayisi: null,
    asgariUcret: 0,
  };
}

function ucret(dakika: number, snapshot = gercekTarife()): number {
  const giris = new Date("2026-10-05T08:00:00+03:00"); // Pazartesi
  return hesaplaUcret({
    girisAt: giris,
    cikisAt: new Date(giris.getTime() + dakika * 60_000),
    snapshot,
    girisGunDakikasi: 8 * 60,
    cikisGunDakikasi: (8 * 60 + dakika) % 1440,
    haftaSonuMu: false,
  }).tutar;
}

describe("gerçek tarife — saatlik bantlar", () => {
  // Patronun verdigi tablonun HER SATIRI. Bant icindeki en kucuk, orta ve
  // en buyuk degerler ayri ayri denenir: bant sinirlari en kolay yanlis
  // hesaplanan yerdir.
  const bantlar: { ad: string; dakikalar: number[]; beklenen: number }[] = [
    { ad: "0–1 saat", dakikalar: [1, 30, 59, 60], beklenen: 100 },
    { ad: "1–2 saat", dakikalar: [61, 90, 120], beklenen: 150 },
    { ad: "2–3 saat", dakikalar: [121, 150, 180], beklenen: 200 },
    { ad: "3–4 saat", dakikalar: [181, 210, 240], beklenen: 250 },
    { ad: "4–5 saat", dakikalar: [241, 270, 300], beklenen: 300 },
    { ad: "5–6 saat", dakikalar: [301, 330, 360], beklenen: 350 },
    { ad: "6–7 saat", dakikalar: [361, 390, 420], beklenen: 400 },
    { ad: "7–8 saat", dakikalar: [421, 450, 480], beklenen: 450 },
    { ad: "8–9 saat", dakikalar: [481, 510, 540], beklenen: 500 },
  ];

  for (const bant of bantlar) {
    it(`${bant.ad} → ${bant.beklenen} TL`, () => {
      for (const dakika of bant.dakikalar) {
        expect(ucret(dakika), `${dakika} dakika`).toBe(bant.beklenen * TL);
      }
    });
  }

  it("9–24 saat arası 500 TL'de sabit kalır (günlük üst limit)", () => {
    // 10, 12, 18, 23 saat ve tam 24 saat: hepsi 500 TL.
    for (const saat of [9, 10, 12, 15, 18, 20, 23, 24]) {
      expect(ucret(saat * 60), `${saat} saat`).toBe(500 * TL);
    }
    // Bant icindeki ara dakikalar da ayni.
    expect(ucret(13 * 60 + 37)).toBe(500 * TL);
    expect(ucret(1439)).toBe(500 * TL); // 23 sa 59 dk
  });

  it("ücret bantlar boyunca hiç azalmaz (monotonluk)", () => {
    // Daha uzun park HICBIR ZAMAN daha ucuz olmamali. Bu, tarife
    // parametrelerinin birbiriyle celismedigini kanitlar.
    let onceki = 0;
    for (let dakika = 1; dakika <= 3 * 1440; dakika += 7) {
      const simdiki = ucret(dakika);
      expect(simdiki, `${dakika} dakika`).toBeGreaterThanOrEqual(onceki);
      onceki = simdiki;
    }
  });
});

describe("gerçek tarife — 24 saat sonrası ek gün blokları", () => {
  it("tam 24 saat hâlâ ilk günün ücretidir (500 TL)", () => {
    expect(ucret(1440)).toBe(500 * TL);
  });

  it("24 saat 1 dakika bir ek blok başlatır: 500 + 600 = 1.100 TL", () => {
    // Bu, kararin en kritik sinir noktasi: 24 saati 1 dakika gecen park
    // BASLAYAN ek 24 saatlik blogun tamamini oder (orantili bolunmez).
    expect(ucret(1441)).toBe(1100 * TL);
  });

  it("25, 30, 36, 47 saat ve tam 48 saat: hepsi tek ek blok (1.100 TL)", () => {
    for (const saat of [25, 30, 36, 40, 47, 48]) {
      expect(ucret(saat * 60), `${saat} saat`).toBe(1100 * TL);
    }
  });

  it("48 saat 1 dakika ikinci bloğu başlatır: 500 + 1.200 = 1.700 TL", () => {
    expect(ucret(2881)).toBe(1700 * TL);
  });

  it("72 saat iki ek blok: 1.700 TL", () => {
    expect(ucret(72 * 60)).toBe(1700 * TL);
  });

  it("7 gün park: 500 + 6 × 600 = 4.100 TL", () => {
    expect(ucret(7 * 1440)).toBe(4100 * TL);
  });

  it("30 gün park: 500 + 29 × 600 = 17.900 TL", () => {
    expect(ucret(30 * 1440)).toBe(17_900 * TL);
  });

  it("ek blok sayısı başlayan bloğa göre yukarı yuvarlanır", () => {
    // n tam gun -> (n-1) ek blok; n tam gun + 1 dk -> n ek blok.
    for (const gun of [1, 2, 3, 5, 10]) {
      expect(ucret(gun * 1440), `${gun} tam gün`).toBe((500 + (gun - 1) * 600) * TL);
      expect(ucret(gun * 1440 + 1), `${gun} gün 1 dk`).toBe((500 + gun * 600) * TL);
    }
  });

  it("hesap dökümü personele ek günleri açıkça yazar", () => {
    const giris = new Date("2026-10-05T08:00:00+03:00");
    const sonuc = hesaplaUcret({
      girisAt: giris,
      cikisAt: new Date(giris.getTime() + 50 * 60 * 60_000), // 50 saat
      snapshot: gercekTarife(),
      haftaSonuMu: false,
    });

    expect(sonuc.tutar).toBe(1700 * TL);
    expect(sonuc.uygulananKurallar).toContain("ek_gun_blogu");
    expect(sonuc.uygulananKurallar).toContain("gunluk_ust_limit");
    const metin = sonuc.dokum.map((d) => d.aciklama).join(" | ");
    expect(metin).toMatch(/24 saat sonrası 2 ek gün/);
    // Dokum satirlarinin toplami tutara esit olmalidir: personele gosterilen
    // hesap, tahsil edilen tutarla tutarsiz olamaz.
    expect(sonuc.dokum.reduce((t, d) => t + d.tutar, 0)).toBe(sonuc.tutar);
  });
});

describe("gerçek tarife — olmayan kurallar", () => {
  it("gece tarifesi yoktur: gece giren araç gündüzle aynı ücreti öder", () => {
    const geceGiris = new Date("2026-10-05T23:00:00+03:00");
    const gece = hesaplaUcret({
      girisAt: geceGiris,
      cikisAt: new Date(geceGiris.getTime() + 180 * 60_000),
      snapshot: gercekTarife(),
      girisGunDakikasi: 23 * 60,
      cikisGunDakikasi: 2 * 60,
      haftaSonuMu: false,
    });
    expect(gece.tutar).toBe(200 * TL); // 3 saat = gunduzle ayni
    expect(gece.uygulananKurallar).not.toContain("gece_tarifesi");
  });

  it("hafta sonu katsayısı yoktur: cumartesi ile pazartesi aynı", () => {
    const cumartesi = new Date("2026-10-10T10:00:00+03:00");
    const sonuc = hesaplaUcret({
      girisAt: cumartesi,
      cikisAt: new Date(cumartesi.getTime() + 300 * 60_000),
      snapshot: gercekTarife(),
      haftaSonuMu: true,
    });
    expect(sonuc.tutar).toBe(ucret(300));
    expect(sonuc.uygulananKurallar).not.toContain("hafta_sonu_katsayisi");
  });

  it("ücretsiz süre yoktur: 1 dakikalık park da 100 TL", () => {
    expect(ucret(1)).toBe(100 * TL);
  });

  it("0 dakikalık park ücretsizdir (yanlış giriş; doğru yol iptaldir)", () => {
    expect(ucret(0)).toBe(0);
  });

  it("araç sınıfına göre fiyat farkı yoktur: kural geneldir", () => {
    const t = gercekTarife();
    expect(t.aracSinifiId).toBeNull();
  });
});
