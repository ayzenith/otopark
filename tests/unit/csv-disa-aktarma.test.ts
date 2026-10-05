/**
 * CSV DISA AKTARMA - BIRIM TESTLERI
 *
 * Dogrulananlar (docs/06 Asama 5 tamamlanma kriteri):
 *   · tutar ve tarih bicimleri tr-TR
 *   · alan ayirici NOKTALI VIRGUL (Excel tr-TR ondalik virgulu kullanir)
 *   · UTF-8 BOM (Turkce karakterler Excel'de bozulmaz)
 *   · rapor uyarisi her dosyanin basinda
 *   · noktali virgul/tirnak iceren metinler dogru kacislanir
 *   · otopark ve yikama AYRI satirlarda (mimari kural 11)
 *   · iptal edilen satirlar listede kalir ama TOPLAMA girmez
 */

import { describe, expect, it } from "vitest";
import {
  BOM,
  RAPOR_UYARISI,
  csvHucre,
  csvSatir,
  csvDosyaAdi,
  digerGelirlerCsv,
  finansRaporuCsv,
  giderlerCsv,
} from "@/server/finance/export";
import type { DigerGelirSatiri, FinansRaporu, GiderSatiri } from "@/server/finance/queries";

const TL = 100;
const TARIH = new Date("2026-10-04T12:00:00+03:00");

function gider(ek: Partial<GiderSatiri> = {}): GiderSatiri {
  return {
    id: "g1",
    kod: "G-261004-0001",
    kategori: "Elektrik",
    tutar: 1234 * TL + 50,
    tarih: TARIH,
    yontem: "CASH",
    aciklama: "Ekim ayı elektrik faturası",
    tedarikci: "Dağıtım A.Ş.",
    belgeNo: "FTR-9981",
    iptal: false,
    iptalSebebi: null,
    girenKisi: "Patron",
    kasaOturumuId: "kasa1",
    ...ek,
  };
}

function rapor(): FinansRaporu {
  return {
    baslangic: new Date("2026-10-01T00:00:00+03:00"),
    bitis: new Date("2026-11-01T00:00:00+03:00"),
    gelir: {
      park: 10_000 * TL,
      yikama: 3_000 * TL,
      abonman: 5_000 * TL,
      diger: 250 * TL,
      iade: 150 * TL,
      toplam: 18_100 * TL,
      nakit: 12_000 * TL,
      kart: 6_100 * TL,
      digerYontem: 0,
    },
    gider: {
      kalemler: [
        { kategoriId: "k1", kategori: "Kira", tutar: 8_000 * TL, adet: 1 },
        { kategoriId: "k2", kategori: "Elektrik", tutar: 1_234 * TL, adet: 2 },
      ],
      nakit: 1_234 * TL,
      kart: 8_000 * TL,
      digerYontem: 0,
      toplam: 9_234 * TL,
    },
    net: 8_866 * TL,
  };
}

describe("csv hücre kaçışlama", () => {
  it("sade metin tırnaklanmaz", () => {
    expect(csvHucre("Elektrik")).toBe("Elektrik");
  });

  it("noktalı virgül içeren metin tırnaklanır", () => {
    // Kacislanmazsa Excel metni iki hucreye boler.
    expect(csvHucre("Kira; peşin")).toBe('"Kira; peşin"');
  });

  it("çift tırnak ikilenir", () => {
    expect(csvHucre('Ödeme "nakit" yapıldı')).toBe('"Ödeme ""nakit"" yapıldı"');
  });

  it("satır sonu içeren metin tırnaklanır", () => {
    expect(csvHucre("bir\niki")).toBe('"bir\niki"');
  });

  it("null ve undefined boş hücre olur", () => {
    expect(csvHucre(null)).toBe("");
    expect(csvHucre(undefined)).toBe("");
  });

  it("satır alanları NOKTALI VİRGÜLLE birleşir", () => {
    expect(csvSatir(["a", "b", 1])).toBe("a;b;1");
  });
});

describe("gider CSV'si", () => {
  it("BOM ile başlar ve rapor uyarısını taşır", () => {
    const csv = giderlerCsv([gider()]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain(RAPOR_UYARISI);
  });

  it("tutar tr-TR biçiminde yazılır (virgül ondalık, nokta binlik)", () => {
    const csv = giderlerCsv([gider({ tutar: 1234 * TL + 50 })]);
    expect(csv).toContain("1.234,50");
    // Ingilizce bicim ASLA cikmaz.
    expect(csv).not.toContain("1234.50");
  });

  it("tarih GG.AA.YYYY biçiminde yazılır", () => {
    expect(giderlerCsv([gider()])).toContain("04.10.2026");
  });

  it("ödeme yöntemi Türkçe etiketlenir", () => {
    expect(giderlerCsv([gider({ yontem: "CASH" })])).toContain("Nakit");
    expect(giderlerCsv([gider({ yontem: "TRANSFER" })])).toContain("Havale/EFT");
  });

  it("İPTAL edilen satır listede KALIR ama toplama GİRMEZ", () => {
    const csv = giderlerCsv([
      gider({ id: "a", tutar: 100 * TL }),
      gider({ id: "b", tutar: 900 * TL, iptal: true, iptalSebebi: "Yanlış kategori" }),
    ]);

    expect(csv).toContain("İPTAL");
    expect(csv).toContain("Yanlış kategori");
    // Toplam yalnizca gecerli 100 TL.
    expect(csv).toContain("Toplam (iptaller hariç);;;;100,00");
  });

  it("satırlar CRLF ile ayrılır (Excel uyumu)", () => {
    expect(giderlerCsv([gider()])).toContain("\r\n");
  });

  it("boş liste de geçerli bir dosya üretir", () => {
    const csv = giderlerCsv([]);
    expect(csv).toContain(RAPOR_UYARISI);
    expect(csv).toContain("Toplam (iptaller hariç)");
  });
});

describe("diğer gelir CSV'si", () => {
  function gelir(ek: Partial<DigerGelirSatiri> = {}): DigerGelirSatiri {
    return {
      id: "d1",
      kod: "D-261004-0001",
      etiket: "Otomat geliri",
      tutar: 250 * TL,
      tarih: TARIH,
      yontem: "CASH",
      aciklama: null,
      iptal: false,
      iptalSebebi: null,
      girenKisi: "Patron",
      ...ek,
    };
  }

  it("etiket, tutar ve tarih yazılır", () => {
    const csv = digerGelirlerCsv([gelir()]);
    expect(csv).toContain("Otomat geliri");
    expect(csv).toContain("250,00");
    expect(csv).toContain("04.10.2026");
  });

  it("iptal edilen gelir toplama girmez", () => {
    const csv = digerGelirlerCsv([
      gelir({ id: "a", tutar: 100 * TL }),
      gelir({ id: "b", tutar: 400 * TL, iptal: true }),
    ]);
    expect(csv).toContain("Toplam (iptaller hariç);;;;100,00");
  });
});

describe("gelir-gider özeti CSV'si", () => {
  it("OTOPARK VE YIKAMA AYRI SATIRLARDA (mimari kural 11)", () => {
    const csv = finansRaporuCsv(rapor());
    expect(csv).toContain("Gelir;Otopark;;10.000,00");
    expect(csv).toContain("Gelir;Oto yıkama;;3.000,00");
    expect(csv).toContain("Gelir;Abonman;;5.000,00");
  });

  it("iade satırı NEGATİF yazılır", () => {
    expect(finansRaporuCsv(rapor())).toContain("Gelir;İade / ters kayıt;;-150,00");
  });

  it("gider kalemleri adediyle birlikte yazılır", () => {
    const csv = finansRaporuCsv(rapor());
    expect(csv).toContain("Gider;Kira;1;8.000,00");
    expect(csv).toContain("Gider;Elektrik;2;1.234,00");
  });

  it("net sonuç ve 'kasa bakiyesi değildir' notu yer alır", () => {
    const csv = finansRaporuCsv(rapor());
    expect(csv).toContain("Sonuç;NET;;8.866,00");
    expect(csv).toContain("Net bir kasa bakiyesi değildir");
  });

  it("dönem aralığı tr-TR tarihle yazılır (bitiş HARİÇ olduğu için bir gün geri)", () => {
    const csv = finansRaporuCsv(rapor());
    expect(csv).toContain("Dönem: 01.10.2026 – 31.10.2026");
  });

  it("ödeme yöntemi dağılımı gelir ve gideri ayrı kolonlarda verir", () => {
    const csv = finansRaporuCsv(rapor());
    expect(csv).toContain("Nakit;12.000,00;1.234,00");
    expect(csv).toContain("Kart;6.100,00;8.000,00");
  });

  it("rapor uyarısı ilk satırdadır (içinde ';' olduğu için TIRNAKLI)", () => {
    const csv = finansRaporuCsv(rapor());
    // Uyari metni noktali virgul icerir; kacislanmazsa Excel onu iki
    // hucreye bolerdi. Dolayisiyla tirnakli olmasi DOGRU davranistir.
    expect(csv.replace(BOM, "").split("\r\n")[0]).toBe(`"${RAPOR_UYARISI}"`);
  });
});

describe("dosya adı", () => {
  it("tarih YYYYAAGG sırasıyla yazılır", () => {
    expect(csvDosyaAdi("gider", TARIH)).toBe("gider-20261004.csv");
  });
});
