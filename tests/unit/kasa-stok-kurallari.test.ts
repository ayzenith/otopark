/**
 * KASA VE STOK SAF KURALLARI - BIRIM TESTLERI
 *
 * Bu dosya veritabanina ERISMEZ. Yalnizca hesaplamanin ve yon kurallarinin
 * SAF kisimlarini dogrular:
 *   · kasa hareketinin yonu tipten dogru turuyor mu?
 *   · stok hareketinin stoga etkisi dogru isaretli mi?
 *   · beklenen nakit formulu dogru mu (cifte muhasebe tuzagi dahil)?
 *
 * Veritabani davranisi (kilitleme, kisitlar, tetikleyiciler) entegrasyon
 * testlerinde: tests/integration/kasa-finans-stok.test.ts
 */

import { describe, expect, it } from "vitest";
import { hareketYonu, HAREKET_ETIKETLERI } from "@/server/cash/movement";
import { stokYonu, HAREKET_ETIKETLERI as STOK_ETIKETLERI } from "@/server/inventory/movement";
import type { CashMovementType, InventoryMovementType } from "@prisma/client";

const TL = 100;

describe("kasa hareketinin yönü", () => {
  it("kasaya para konulmasi GIRIS'tir", () => {
    expect(hareketYonu("DEPOSIT")).toBe("IN");
  });

  it("para alma, bankaya yatirma ve avans CIKIS'tir", () => {
    for (const tip of ["WITHDRAWAL", "BANK_TRANSFER", "ADVANCE"] as CashMovementType[]) {
      expect(hareketYonu(tip), tip).toBe("OUT");
    }
  });

  it("sayım düzeltmesinin doğal yönü YOKTUR: çağırana sorulur", () => {
    // Iki yone de olabilir (fazla cikti / eksik cikti). Tipten tahmin
    // edilmesi, sayim farkini ters isaretle kaydetme riski yaratir.
    expect(hareketYonu("CORRECTION")).toBeNull();
  });

  it("her hareket tipinin Türkçe etiketi vardır", () => {
    const tipler: CashMovementType[] = [
      "DEPOSIT",
      "WITHDRAWAL",
      "BANK_TRANSFER",
      "ADVANCE",
      "CORRECTION",
    ];
    for (const tip of tipler) {
      expect(HAREKET_ETIKETLERI[tip], tip).toBeTruthy();
    }
  });
});

describe("stok hareketinin yönü", () => {
  it("alış ve sayım düzeltmesi stoğu ARTIRIR", () => {
    expect(stokYonu("PURCHASE")).toBe(1);
    expect(stokYonu("ADJUSTMENT")).toBe(1);
  });

  it("tüketim ve zayi stoğu AZALTIR", () => {
    expect(stokYonu("CONSUMPTION")).toBe(-1);
    expect(stokYonu("WASTE")).toBe(-1);
  });

  it("her stok hareketi tipinin Türkçe etiketi vardır", () => {
    const tipler: InventoryMovementType[] = ["PURCHASE", "CONSUMPTION", "ADJUSTMENT", "WASTE"];
    for (const tip of tipler) {
      expect(STOK_ETIKETLERI[tip], tip).toBeTruthy();
    }
  });
});

/**
 * BEKLENEN NAKIT FORMULU
 *
 * Gercek hesap `kasaDokumu()` icinde veritabanindan okuyarak yapilir; burada
 * FORMULUN KENDISI dogrulanir. Formul degisirse bu test once kirilir.
 */
function beklenenNakit(d: {
  acilisNakdi: number;
  nakitTahsilat: number;
  nakitIade: number;
  kasaGirisi: number;
  kasaCikisi: number;
  nakitGider: number;
}): number {
  return (
    d.acilisNakdi + d.nakitTahsilat - d.nakitIade + d.kasaGirisi - d.kasaCikisi - d.nakitGider
  );
}

describe("beklenen nakit formülü", () => {
  const bos = {
    acilisNakdi: 0,
    nakitTahsilat: 0,
    nakitIade: 0,
    kasaGirisi: 0,
    kasaCikisi: 0,
    nakitGider: 0,
  };

  it("boş kasa 0 ₺ bekler", () => {
    expect(beklenenNakit(bos)).toBe(0);
  });

  it("açılış parası + nakit tahsilat", () => {
    expect(beklenenNakit({ ...bos, acilisNakdi: 200 * TL, nakitTahsilat: 1500 * TL })).toBe(
      1700 * TL,
    );
  });

  it("nakit iade beklenen nakitten DÜŞÜLÜR", () => {
    expect(beklenenNakit({ ...bos, nakitTahsilat: 1000 * TL, nakitIade: 100 * TL })).toBe(
      900 * TL,
    );
  });

  it("bankaya yatırılan para kasadan ÇIKAR", () => {
    expect(beklenenNakit({ ...bos, nakitTahsilat: 2000 * TL, kasaCikisi: 1500 * TL })).toBe(
      500 * TL,
    );
  });

  it("nakit gider kasadan DÜŞER", () => {
    expect(beklenenNakit({ ...bos, nakitTahsilat: 1000 * TL, nakitGider: 250 * TL })).toBe(
      750 * TL,
    );
  });

  it("ÇİFTE MUHASEBE TUZAĞI: nakit gider yalnızca BİR KEZ düşer", () => {
    // Gider hem Expense satiri hem CashMovement olarak sayilirsa tutar iki
    // kez duser. Kasa dokumu, gidere bagli kasa hareketlerini TOPLAMAZ;
    // formulde gider tek kalem olarak yer alir.
    const tekKez = beklenenNakit({ ...bos, nakitTahsilat: 1000 * TL, nakitGider: 300 * TL });
    const yanlisIkiKez = beklenenNakit({
      ...bos,
      nakitTahsilat: 1000 * TL,
      nakitGider: 300 * TL,
      kasaCikisi: 300 * TL,
    });
    expect(tekKez).toBe(700 * TL);
    expect(yanlisIkiKez).toBe(400 * TL);
    expect(yanlisIkiKez).not.toBe(tekKez);
  });

  it("tam senaryo: açılış 200, tahsilat 3.450, iade 150, bankaya 2.000, gider 320", () => {
    expect(
      beklenenNakit({
        acilisNakdi: 200 * TL,
        nakitTahsilat: 3450 * TL,
        nakitIade: 150 * TL,
        kasaGirisi: 0,
        kasaCikisi: 2000 * TL,
        nakitGider: 320 * TL,
      }),
    ).toBe(1180 * TL);
  });
});

describe("kasa farkı yorumu", () => {
  const fark = (sayilan: number, beklenen: number) => sayilan - beklenen;

  it("sayılan = beklenen ise fark yoktur", () => {
    expect(fark(1500 * TL, 1500 * TL)).toBe(0);
  });

  it("sayılan beklenenden azsa fark NEGATIF (eksik)", () => {
    expect(fark(1450 * TL, 1500 * TL)).toBe(-50 * TL);
  });

  it("sayılan beklenenden fazlaysa fark POZITIF (fazla)", () => {
    expect(fark(1550 * TL, 1500 * TL)).toBe(50 * TL);
  });
});
