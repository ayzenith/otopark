/**
 * AŞAMA 6 SAF KURALLARI - BİRİM TESTLERİ
 *
 * Veritabanına ERİŞMEZ. Dönem aralığı hesabı, yüzde değişim, vardiya
 * penceresi mantığı ve avans/maaş mahsup aritmetiği burada doğrulanır.
 *
 * Veritabanı davranışı (kilitleme, kısıtlar, tetikleyiciler) entegrasyon
 * testlerinde: tests/integration/personel-avans-rapor.test.ts
 */

import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/datetime";
import {
  DONEMLER,
  DONEM_ETIKETLERI,
  aralikCozumle,
  donemGecerliMi,
  yuzdeDegisim,
} from "@/server/reports/range";
import {
  dakikayiSaate,
  pencereBul,
  pencereIcinde,
  saatiDakikaya,
} from "@/server/settings/shift-windows";
import {
  SECILEBILIR_ROLLER,
  kullaniciAdiNormalize,
  rolSecilebilirMi,
} from "@/server/staff/users";

const TL = 100;

/**
 * Istanbul saatine göre gün.
 *
 * Projenin kendi `formatDate`'i kullanılır (dd.MM.yyyy): böylece test, ekranda
 * görünen biçimin aynısını doğrular. `Intl` `dateStyle: "short"` biçimi
 * "7.10.2026" verir ve başındaki sıfırı atar.
 */
const gun = (d: Date) => formatDate(d);

// ===========================================================================
describe("dönem aralığı çözümleme", () => {
  // 7 Ekim 2026 = Çarşamba
  const carsamba = new Date("2026-10-07T15:00:00+03:00");

  it("bugün: gün başından yarın gün başına", () => {
    const a = aralikCozumle("gun", { simdi: carsamba });
    expect(gun(a.baslangic)).toBe("07.10.2026");
    expect(gun(a.bitis)).toBe("08.10.2026");
  });

  it("hafta PAZARTESİ başlar", () => {
    const a = aralikCozumle("hafta", { simdi: carsamba });
    expect(gun(a.baslangic)).toBe("05.10.2026"); // Pazartesi
  });

  it("PAZAR günü haftanın SON günüdür (TR kullanımı)", () => {
    // 11 Ekim 2026 Pazar: hafta hâlâ 5 Ekim'de başlar.
    const a = aralikCozumle("hafta", { simdi: new Date("2026-10-11T15:00:00+03:00") });
    expect(gun(a.baslangic)).toBe("05.10.2026");
    expect(gun(a.bitis)).toBe("12.10.2026");
  });

  it("PAZARTESİ günü haftanın ilk günüdür (geriye gitmez)", () => {
    const a = aralikCozumle("hafta", { simdi: new Date("2026-10-05T09:00:00+03:00") });
    expect(gun(a.baslangic)).toBe("05.10.2026");
  });

  it("ay: ayın 1'inden yarına", () => {
    const a = aralikCozumle("ay", { simdi: carsamba });
    expect(gun(a.baslangic)).toBe("01.10.2026");
    expect(gun(a.bitis)).toBe("08.10.2026");
  });

  it("yıl: 1 Ocak'tan yarına", () => {
    const a = aralikCozumle("yil", { simdi: carsamba });
    expect(gun(a.baslangic)).toBe("01.01.2026");
  });

  it("özel aralıkta BİTİŞ GÜNÜ DAHİLDİR", () => {
    // Kullanıcı "1–7 Ekim" derken 7 Ekim'i kastediyor; sorgu [1 Ekim, 8 Ekim).
    const a = aralikCozumle("ozel", {
      baslangicMetni: "2026-10-01",
      bitisMetni: "2026-10-07",
      simdi: carsamba,
    });
    expect(gun(a.baslangic)).toBe("01.10.2026");
    expect(gun(a.bitis)).toBe("08.10.2026");
  });

  it("özel aralıkta tek gün seçilebilir", () => {
    const a = aralikCozumle("ozel", {
      baslangicMetni: "2026-10-03",
      bitisMetni: "2026-10-03",
      simdi: carsamba,
    });
    expect(gun(a.baslangic)).toBe("03.10.2026");
    expect(gun(a.bitis)).toBe("04.10.2026");
  });

  it("TERS verilen özel aralık tek güne indirilir, hata vermez", () => {
    const a = aralikCozumle("ozel", {
      baslangicMetni: "2026-10-07",
      bitisMetni: "2026-10-01",
      simdi: carsamba,
    });
    expect(a.bitis.getTime()).toBeGreaterThan(a.baslangic.getTime());
    expect(gun(a.baslangic)).toBe("07.10.2026");
    expect(gun(a.bitis)).toBe("08.10.2026");
  });

  it("özel aralıkta tarih verilmezse BUGÜNE düşer (sessizce yanlış dönem göstermez)", () => {
    const a = aralikCozumle("ozel", { simdi: carsamba });
    expect(gun(a.baslangic)).toBe("07.10.2026");
    expect(gun(a.bitis)).toBe("08.10.2026");
  });

  it("geçersiz tarih biçimi de bugüne düşer", () => {
    const a = aralikCozumle("ozel", {
      baslangicMetni: "07.10.2026",
      bitisMetni: "yok",
      simdi: carsamba,
    });
    expect(gun(a.baslangic)).toBe("07.10.2026");
  });

  it("ÖNCEKİ DÖNEM aynı uzunluktadır ve hemen öncesidir", () => {
    const a = aralikCozumle("gun", { simdi: carsamba });
    expect(gun(a.oncekiBaslangic)).toBe("06.10.2026");
    expect(a.oncekiBitis.getTime()).toBe(a.baslangic.getTime());
    expect(a.oncekiBitis.getTime() - a.oncekiBaslangic.getTime()).toBe(
      a.bitis.getTime() - a.baslangic.getTime(),
    );
  });

  it("aralıklar BİTİŞ HARİÇ olduğu için gün sınırında çift sayım olmaz", () => {
    const bugun = aralikCozumle("gun", { simdi: carsamba });
    // Önceki günün bitişi bugünün başlangıcıyla ÇAKIŞMAZ, eşittir:
    // bir an ya birinde ya diğerinde sayılır.
    expect(bugun.oncekiBitis.getTime()).toBe(bugun.baslangic.getTime());
  });

  it("her dönemin Türkçe etiketi vardır", () => {
    for (const d of DONEMLER) {
      expect(DONEM_ETIKETLERI[d], d).toBeTruthy();
    }
  });

  it("geçersiz dönem adı güvenli varsayılana (gün) düşer", () => {
    expect(donemGecerliMi("ay")).toBe("ay");
    expect(donemGecerliMi("saçma")).toBe("gun");
    expect(donemGecerliMi(null)).toBe("gun");
    expect(donemGecerliMi(undefined)).toBe("gun");
  });
});

// ===========================================================================
describe("yüzde değişim", () => {
  it("artış pozitif, azalış negatif", () => {
    expect(yuzdeDegisim(150, 100)).toBe(50);
    expect(yuzdeDegisim(50, 100)).toBe(-50);
  });

  it("değişim yoksa 0", () => {
    expect(yuzdeDegisim(100, 100)).toBe(0);
  });

  it("ÖNCEKİ DÖNEM 0 ise yüzde TANIMSIZDIR (null)", () => {
    // "%∞ arttı" yanıltıcı olur; arayüz bunun yerine "önceki dönem 0" yazar.
    expect(yuzdeDegisim(500, 0)).toBeNull();
    expect(yuzdeDegisim(0, 0)).toBeNull();
  });

  it("negatif önceki dönemde yüzde MUTLAK değere göre hesaplanır", () => {
    // Net zarardan kâra geçiş: -100 -> +50 => %150 iyileşme.
    expect(yuzdeDegisim(50, -100)).toBe(150);
  });

  it("ondalık bir basamağa yuvarlanır", () => {
    expect(yuzdeDegisim(1234, 1000)).toBe(23.4);
  });
});

// ===========================================================================
describe("vardiya penceresi", () => {
  it("saat metni dakikaya çevrilir", () => {
    expect(saatiDakikaya("08:00")).toBe(480);
    expect(saatiDakikaya("00:00")).toBe(0);
    expect(saatiDakikaya("23:59")).toBe(1439);
    expect(saatiDakikaya("8:30")).toBe(510);
  });

  it("geçersiz saat null döner", () => {
    for (const metin of ["", "24:00", "08:60", "sekiz", "0800"]) {
      expect(saatiDakikaya(metin), metin).toBeNull();
    }
  });

  it("dakika saate çevrilir (iki haneli)", () => {
    expect(dakikayiSaate(480)).toBe("08:00");
    expect(dakikayiSaate(0)).toBe("00:00");
    expect(dakikayiSaate(1439)).toBe("23:59");
  });

  it("normal pencere: başlangıç dahil, bitiş hariç", () => {
    const gunduz = { ad: "Gündüz", baslangicDakika: 480, bitisDakika: 1200 }; // 08:00-20:00
    expect(pencereIcinde(gunduz, 480)).toBe(true); // 08:00
    expect(pencereIcinde(gunduz, 1199)).toBe(true); // 19:59
    expect(pencereIcinde(gunduz, 1200)).toBe(false); // 20:00 — bitiş hariç
    expect(pencereIcinde(gunduz, 479)).toBe(false); // 07:59
  });

  it("GECE YARISINI AŞAN pencere doğru yorumlanır", () => {
    const gece = { ad: "Gece", baslangicDakika: 1200, bitisDakika: 480 }; // 20:00-08:00
    expect(pencereIcinde(gece, 1200)).toBe(true); // 20:00
    expect(pencereIcinde(gece, 1439)).toBe(true); // 23:59
    expect(pencereIcinde(gece, 0)).toBe(true); // 00:00
    expect(pencereIcinde(gece, 479)).toBe(true); // 07:59
    expect(pencereIcinde(gece, 480)).toBe(false); // 08:00
    expect(pencereIcinde(gece, 700)).toBe(false); // 11:40
  });

  it("başlangıç = bitiş ise pencere 24 saati kapsar", () => {
    const tam = { ad: "Tam gün", baslangicDakika: 0, bitisDakika: 0 };
    for (const dakika of [0, 300, 720, 1439]) {
      expect(pencereIcinde(tam, dakika), String(dakika)).toBe(true);
    }
  });

  it("pencereBul ilk eşleşeni verir, yoksa null", () => {
    const pencereler = [
      { ad: "Gündüz", baslangicDakika: 480, bitisDakika: 1200 },
      { ad: "Gece", baslangicDakika: 1200, bitisDakika: 480 },
    ];
    // 10:00 Istanbul
    expect(pencereBul(pencereler, new Date("2026-10-07T10:00:00+03:00"))?.ad).toBe("Gündüz");
    // 22:00 Istanbul
    expect(pencereBul(pencereler, new Date("2026-10-07T22:00:00+03:00"))?.ad).toBe("Gece");
    // Pencere tanımlı değilse null: etiket gösterilmez.
    expect(pencereBul([], new Date())).toBeNull();
  });

  it("boşluk bırakan pencerelerde eşleşme olmayabilir (engel değil, etiket yok)", () => {
    // 08:00-12:00 tanımlı, 13:00'te pencere yok: vardiya açmak YİNE serbest.
    const pencereler = [{ ad: "Sabah", baslangicDakika: 480, bitisDakika: 720 }];
    expect(pencereBul(pencereler, new Date("2026-10-07T13:00:00+03:00"))).toBeNull();
  });
});

// ===========================================================================
describe("roller — yalnızca patron + personel", () => {
  it("atanabilir roller OWNER ve STAFF'tır", () => {
    expect(SECILEBILIR_ROLLER).toEqual(["OWNER", "STAFF"]);
  });

  it("MANAGER rolü ATANAMAZ (karar 05.10.2026) ama enum'dan silinmedi", () => {
    expect(rolSecilebilirMi("MANAGER")).toBe(false);
    expect(rolSecilebilirMi("OWNER")).toBe(true);
    expect(rolSecilebilirMi("STAFF")).toBe(true);
  });

  it("tanımsız rol adı reddedilir", () => {
    expect(rolSecilebilirMi("PATRON")).toBe(false);
    expect(rolSecilebilirMi("")).toBe(false);
  });
});

// ===========================================================================
describe("kullanıcı adı normalizasyonu", () => {
  it("küçük harfe çevrilir ve boşluk kırpılır", () => {
    expect(kullaniciAdiNormalize("  Ahmet  ")).toBe("ahmet");
  });

  it("TÜRKÇE KARAKTERLER çevrilir (I/ı tuzağı dahil)", () => {
    // "ŞÜKRÜ" -> "sukru": Türkçe küçültme İ/ı çiftini doğru ele alır,
    // sonra ASCII'ye çevrilir.
    expect(kullaniciAdiNormalize("ŞÜKRÜ")).toBe("sukru");
    expect(kullaniciAdiNormalize("Çağrı")).toBe("cagri");
    expect(kullaniciAdiNormalize("IŞIL")).toBe("isil");
    expect(kullaniciAdiNormalize("Öğün")).toBe("ogun");
  });
});

// ===========================================================================
/**
 * AVANS / MAAŞ MAHSUP ARİTMETİĞİ
 *
 * Kararın özü: avans gider DEĞİL. Gider maaşın tamamı, kasadan çıkan para
 * maaş eksi avans. Toplamda ne eksik ne fazla para çıkar.
 */
describe("avans mahsubu aritmetiği", () => {
  /** Kasa dökümündeki nakit gider = amount - advanceOffsetAmount. */
  const nakitGider = (maas: number, mahsup: number) => maas - mahsup;

  it("mahsupsuz maaş: gider = kasadan çıkan", () => {
    expect(nakitGider(10_000 * TL, 0)).toBe(10_000 * TL);
  });

  it("mahsuplu maaş: kasadan çıkan AZ, gider TAM", () => {
    const maas = 10_000 * TL;
    const avans = 500 * TL;
    // Gider raporunda maaşın tamamı görünür.
    expect(maas).toBe(10_000 * TL);
    // Kasadan o an çıkan para avans kadar az.
    expect(nakitGider(maas, avans)).toBe(9_500 * TL);
  });

  it("TOPLAM KASA ÇIKIŞI maaşa eşittir (ne eksik ne fazla)", () => {
    const maas = 10_000 * TL;
    const avans = 500 * TL;
    // Avans anında kasadan çıkan + maaş anında kasadan çıkan
    const toplamKasaCikisi = avans + nakitGider(maas, avans);
    expect(toplamKasaCikisi).toBe(maas);
  });

  it("ÇİFTE SAYIM: avans ayrıca gider yazılırsa gider şişer", () => {
    const maas = 10_000 * TL;
    const avans = 500 * TL;
    const dogruGider = maas;
    const yanlisGider = maas + avans; // avans ayrıca gider kaydedilirse
    expect(yanlisGider).toBe(10_500 * TL);
    expect(yanlisGider).not.toBe(dogruGider);
  });

  it("ÇİFTE DÜŞÜM: mahsup kasa hesabından düşülmezse kasa iki kez azalır", () => {
    const maas = 10_000 * TL;
    const avans = 500 * TL;
    const dogru = avans + nakitGider(maas, avans); // 10.000
    const yanlis = avans + maas; // mahsup düşülmezse 10.500
    expect(dogru).toBe(10_000 * TL);
    expect(yanlis).toBe(10_500 * TL);
  });

  it("mahsup maaşa eşitse kasadan hiç para çıkmaz", () => {
    expect(nakitGider(500 * TL, 500 * TL)).toBe(0);
  });

  it("birden fazla avans toplanarak mahsup edilir", () => {
    const avanslar = [200 * TL, 300 * TL, 150 * TL];
    const mahsup = avanslar.reduce((t, a) => t + a, 0);
    expect(mahsup).toBe(650 * TL);
    expect(nakitGider(5_000 * TL, mahsup)).toBe(4_350 * TL);
  });
});
