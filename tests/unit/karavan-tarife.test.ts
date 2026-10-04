/**
 * KARAVAN OTOPARK TARIFESI - MOTOR DOGRULAMA
 *
 * ============================================================================
 * Bu dosyadaki degerler UYDURMA DEGILDIR: isletme sahibinin 04.10.2026'da
 * verdigi karavan fiyatidir.
 *
 *   24 saate kadar                         700 TL
 *   24 saatten sonra baslayan her 24 saat  +700 TL
 *
 * Isletme yalnizca 24 SAATLIK fiyat verdi. Karavan icin saatlik kademe
 * BELIRTILMEDI ve UYDURULMADI; bu yuzden tarife 24 saatlik TEK BLOK olarak
 * girilir (ilk blok 1440 dk / 700 TL, saatlik ucret yok). Sonuc: 1 saatlik
 * karavan parki da 700 TL'dir. Patron saatlik kademe isterse panelden girer.
 *
 * Ek blok ORANTILI BOLUNMEZ - normal tarifedeki kararin aynisi:
 *   24 sa = 700 · 24 sa 1 dk = 1.400 · 48 sa = 1.400 · 48 sa 1 dk = 2.100
 *
 * ONEMLI: Bu degerler KODA SABITLENMEMISTIR. Karavan kurali veritabaninda
 * surumlu tarife kurali olarak tutulur (`npm run fiyatlar:kur` veri olarak
 * yazar) ve panelden degistirilir. Bu dosya "panelden bu degerler girildiginde
 * motor dogru hesapliyor mu?" sorusunu yanitlar.
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import { hesaplaUcret } from "@/server/pricing/calculate";
import { SNAPSHOT_SURUMU, type TarifeSnapshot } from "@/server/pricing/types";

const TL = 100; // 1 TL = 100 kurus

/** Karavan tarifesinin motor karsiligi (scripts/baslangic-fiyatlari.ts ile ayni). */
function karavanTarifesi(): TarifeSnapshot {
  return {
    surum: SNAPSHOT_SURUMU,
    planId: "plan",
    planAdi: "Londra Camping Otopark",
    surumId: "surum",
    surumNo: 2,
    kuralId: "karavan-kurali",
    // Karavan kurali SINIFA OZELDIR: genel kural degil.
    aracSinifiId: "karavan-sinifi",
    aracSinifiAdi: "Karavan",

    ucretsizDakika: 0,
    ucretsizDusulur: false,

    // 24 saatlik tek blok: saatlik kademe YOK.
    ilkBlokDakika: 1440,
    ilkBlokUcret: 700 * TL,

    saatlikUcret: 0,
    saatYuvarlamaDakika: 60,

    gunlukUcret: 0,
    gunlukUstLimit: 700 * TL,
    ekGunBlokUcret: 700 * TL,

    geceSabitUcret: null,
    geceBaslangicDakika: null,
    geceBitisDakika: null,

    haftaSonuKatsayisi: null,
    asgariUcret: 0,
  };
}

function ucret(dakika: number, snapshot = karavanTarifesi()): number {
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

describe("karavan tarifesi — ilk 24 saat", () => {
  it("24 saate kadar her süre 700 TL (saatlik kademe yok)", () => {
    for (const dakika of [1, 30, 60, 61, 180, 540, 720, 1439, 1440]) {
      expect(ucret(dakika), `${dakika} dakika`).toBe(700 * TL);
    }
  });

  it("0 dakikalık park ücretsizdir (yanlış giriş; doğru yol iptaldir)", () => {
    expect(ucret(0)).toBe(0);
  });

  it("ücretsiz süre yoktur: 1 dakikalık karavan parkı da 700 TL", () => {
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-05T08:00:00+03:00"),
      cikisAt: new Date("2026-10-05T08:01:00+03:00"),
      snapshot: karavanTarifesi(),
      haftaSonuMu: false,
    });
    expect(sonuc.tutar).toBe(700 * TL);
    expect(sonuc.ucretsizMi).toBe(false);
  });
});

describe("karavan tarifesi — 24 saat sonrası ek gün blokları", () => {
  it("tam 24 saat hâlâ ilk günün ücretidir: 700 TL", () => {
    expect(ucret(1440)).toBe(700 * TL);
  });

  it("24 saat 1 dakika bir ek blok başlatır: 700 + 700 = 1.400 TL", () => {
    expect(ucret(1441)).toBe(1400 * TL);
  });

  it("25, 30, 36, 47 saat ve tam 48 saat: hepsi tek ek blok (1.400 TL)", () => {
    for (const saat of [25, 30, 36, 40, 47, 48]) {
      expect(ucret(saat * 60), `${saat} saat`).toBe(1400 * TL);
    }
  });

  it("48 saat 1 dakika ikinci bloğu başlatır: 700 + 1.400 = 2.100 TL", () => {
    expect(ucret(2881)).toBe(2100 * TL);
  });

  it("7 gün karavan parkı: 700 + 6 × 700 = 4.900 TL", () => {
    expect(ucret(7 * 1440)).toBe(4900 * TL);
  });

  it("30 gün karavan parkı: 700 + 29 × 700 = 21.000 TL", () => {
    expect(ucret(30 * 1440)).toBe(21_000 * TL);
  });

  it("ek blok sayısı başlayan bloğa göre yukarı yuvarlanır (orantılı bölünmez)", () => {
    for (const gun of [1, 2, 3, 5, 10]) {
      // n tam gun -> 700 + (n-1) × 700 = n × 700
      expect(ucret(gun * 1440), `${gun} tam gün`).toBe(gun * 700 * TL);
      expect(ucret(gun * 1440 + 1), `${gun} gün 1 dk`).toBe((gun + 1) * 700 * TL);
    }
  });

  it("ücret hiç azalmaz (monotonluk)", () => {
    let onceki = 0;
    for (let dakika = 1; dakika <= 3 * 1440; dakika += 7) {
      const simdiki = ucret(dakika);
      expect(simdiki, `${dakika} dakika`).toBeGreaterThanOrEqual(onceki);
      onceki = simdiki;
    }
  });

  it("hesap dökümü personele karavan ek günlerini açıkça yazar", () => {
    const giris = new Date("2026-10-05T08:00:00+03:00");
    const sonuc = hesaplaUcret({
      girisAt: giris,
      cikisAt: new Date(giris.getTime() + 50 * 60 * 60_000), // 50 saat
      snapshot: karavanTarifesi(),
      haftaSonuMu: false,
    });

    expect(sonuc.tutar).toBe(2100 * TL);
    expect(sonuc.uygulananKurallar).toContain("ek_gun_blogu");
    expect(sonuc.dokum.map((d) => d.aciklama).join(" | ")).toMatch(/24 saat sonrası 2 ek gün/);
    // Personele gosterilen dokum, tahsil edilen tutarla tutarsiz olamaz.
    expect(sonuc.dokum.reduce((t, d) => t + d.tutar, 0)).toBe(sonuc.tutar);
  });
});

describe("karavan tarifesi — normal tarifeden tamamen ayrı", () => {
  it("karavan kuralı araç sınıfına ÖZELDİR (genel kural değil)", () => {
    // Karavan `excludeFromStandardTariff` oldugu icin cozumleyici genel
    // kurala dusmez; bu yuzden snapshot'ta sinif kimligi dolu olmalidir.
    expect(karavanTarifesi().aracSinifiId).not.toBeNull();
  });

  it("karavan fiyatı normal tarifeden farklıdır: aynı sürede aynı tutar çıkmaz", () => {
    // 3 saat: normal tarife 200 TL, karavan 700 TL.
    expect(ucret(180)).toBe(700 * TL);
    expect(ucret(180)).not.toBe(200 * TL);
  });

  it("gece tarifesi ve hafta sonu farkı karavanda da yoktur", () => {
    const geceGiris = new Date("2026-10-10T23:00:00+03:00"); // Cumartesi gece
    const sonuc = hesaplaUcret({
      girisAt: geceGiris,
      cikisAt: new Date(geceGiris.getTime() + 180 * 60_000),
      snapshot: karavanTarifesi(),
      girisGunDakikasi: 23 * 60,
      cikisGunDakikasi: 2 * 60,
      haftaSonuMu: true,
    });
    expect(sonuc.tutar).toBe(700 * TL);
    expect(sonuc.uygulananKurallar).not.toContain("gece_tarifesi");
    expect(sonuc.uygulananKurallar).not.toContain("hafta_sonu_katsayisi");
  });

  it("karavan fiyatı tanımlıdır: tarifeTanimsiz uyarısı çıkmaz", () => {
    const sonuc = hesaplaUcret({
      girisAt: new Date("2026-10-05T08:00:00+03:00"),
      cikisAt: new Date("2026-10-06T08:00:00+03:00"),
      snapshot: karavanTarifesi(),
      haftaSonuMu: false,
    });
    expect(sonuc.tarifeTanimsiz).toBe(false);
    expect(sonuc.tutar).toBe(700 * TL);
  });
});
