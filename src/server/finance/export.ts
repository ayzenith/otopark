/**
 * DISA AKTARMA - CSV (tr-TR)
 *
 * ============================================================================
 * NEDEN NOKTALI VIRGUL VE BOM?
 * ----------------------------------------------------------------------------
 * Turkce Windows/Excel kurulumunda ondalik ayirici VIRGULDUR ("1.234,50").
 * Alan ayirici da virgul olursa Excel her tutari iki hucreye boler. Bu yuzden
 * alan ayirici NOKTALI VIRGUL (;) kullanilir - Excel'in tr-TR yerelinde
 * bekledigi bicim.
 *
 * Dosya basina UTF-8 BOM eklenir; aksi halde Excel "Şampuan" yerine
 * "Ã…Åampuan" gosterir.
 *
 * RAPOR UYARISI: her dosyanin ilk satirinda "yonetim amacli rapordur, resmi
 * muhasebe yerine gecmez" notu yer alir (docs/06 Asama 5).
 * ============================================================================
 */

import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatKurusPlain } from "@/lib/money";
import type { FinansRaporu } from "./queries";
import type { DigerGelirSatiri, GiderSatiri } from "./queries";

/** UTF-8 BOM: Excel'in Turkce karakterleri dogru okumasi icin. */
export const BOM = "﻿";

export const RAPOR_UYARISI =
  "Yönetim amaçlı rapordur; resmî muhasebe/yasal bilanço yerine geçmez.";

const YONTEM_ETIKETLERI: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale/EFT",
  OTHER: "Diğer",
};

/**
 * Bir hucreyi CSV icin kacislar.
 *
 * Noktali virgul, cift tirnak, satir sonu veya basta/sonda bosluk iceren
 * deger tirnak icine alinir; icindeki tirnak ikilenir (RFC 4180).
 */
export function csvHucre(deger: string | number | null | undefined): string {
  const metin = deger === null || deger === undefined ? "" : String(deger);
  if (/[";\n\r]/.test(metin) || metin !== metin.trim()) {
    return `"${metin.replace(/"/g, '""')}"`;
  }
  return metin;
}

export function csvSatir(hucreler: (string | number | null | undefined)[]): string {
  return hucreler.map(csvHucre).join(";");
}

/** Gider listesi CSV'si. Iptal edilen satirlar DA yer alir, isaretli. */
export function giderlerCsv(giderler: GiderSatiri[]): string {
  const satirlar: string[] = [
    csvSatir([RAPOR_UYARISI]),
    csvSatir([`Oluşturma: ${formatDateTime(new Date())}`]),
    "",
    csvSatir([
      "Kod",
      "Tarih",
      "Kategori",
      "Açıklama",
      "Tutar (₺)",
      "Ödeme yöntemi",
      "Tedarikçi",
      "Belge no",
      "Kasadan",
      "Giren kişi",
      "Durum",
      "İptal gerekçesi",
    ]),
  ];

  for (const g of giderler) {
    satirlar.push(
      csvSatir([
        g.kod,
        formatDate(g.tarih),
        g.kategori,
        g.aciklama,
        formatKurusPlain(g.tutar),
        YONTEM_ETIKETLERI[g.yontem] ?? g.yontem,
        g.tedarikci,
        g.belgeNo,
        g.kasaOturumuId ? "Evet" : "Hayır",
        g.girenKisi,
        g.iptal ? "İPTAL" : "Geçerli",
        g.iptalSebebi,
      ]),
    );
  }

  // Toplam YALNIZCA gecerli satirlardan: iptal edilen gider harcanmis para
  // degildir.
  const toplam = giderler.filter((g) => !g.iptal).reduce((t, g) => t + g.tutar, 0);
  satirlar.push("");
  satirlar.push(csvSatir(["Toplam (iptaller hariç)", "", "", "", formatKurusPlain(toplam)]));

  return BOM + satirlar.join("\r\n") + "\r\n";
}

/** Diger gelirler CSV'si. */
export function digerGelirlerCsv(gelirler: DigerGelirSatiri[]): string {
  const satirlar: string[] = [
    csvSatir([RAPOR_UYARISI]),
    csvSatir([`Oluşturma: ${formatDateTime(new Date())}`]),
    "",
    csvSatir([
      "Kod",
      "Tarih",
      "Gelir",
      "Açıklama",
      "Tutar (₺)",
      "Ödeme yöntemi",
      "Giren kişi",
      "Durum",
      "İptal gerekçesi",
    ]),
  ];

  for (const g of gelirler) {
    satirlar.push(
      csvSatir([
        g.kod,
        formatDate(g.tarih),
        g.etiket,
        g.aciklama,
        formatKurusPlain(g.tutar),
        YONTEM_ETIKETLERI[g.yontem] ?? g.yontem,
        g.girenKisi,
        g.iptal ? "İPTAL" : "Geçerli",
        g.iptalSebebi,
      ]),
    );
  }

  const toplam = gelirler.filter((g) => !g.iptal).reduce((t, g) => t + g.tutar, 0);
  satirlar.push("");
  satirlar.push(csvSatir(["Toplam (iptaller hariç)", "", "", "", formatKurusPlain(toplam)]));

  return BOM + satirlar.join("\r\n") + "\r\n";
}

/**
 * Gelir-gider ozeti CSV'si.
 *
 * OTOPARK VE YIKAMA AYRI SATIRDA (mimari kural 11): tek "ciro" satirinda
 * eritilmez.
 */
export function finansRaporuCsv(rapor: FinansRaporu): string {
  const bitisGosterim = new Date(rapor.bitis.getTime() - 1);
  const satirlar: string[] = [
    csvSatir([RAPOR_UYARISI]),
    csvSatir([`Dönem: ${formatDate(rapor.baslangic)} – ${formatDate(bitisGosterim)}`]),
    csvSatir([`Oluşturma: ${formatDateTime(new Date())}`]),
    "",
    csvSatir(["Bölüm", "Kalem", "Adet", "Tutar (₺)"]),
    csvSatir(["Gelir", "Otopark", "", formatKurusPlain(rapor.gelir.park)]),
    csvSatir(["Gelir", "Oto yıkama", "", formatKurusPlain(rapor.gelir.yikama)]),
    csvSatir(["Gelir", "Abonman", "", formatKurusPlain(rapor.gelir.abonman)]),
    csvSatir(["Gelir", "Diğer gelir", "", formatKurusPlain(rapor.gelir.diger)]),
    csvSatir(["Gelir", "İade / ters kayıt", "", formatKurusPlain(-rapor.gelir.iade)]),
    csvSatir(["Gelir", "TOPLAM", "", formatKurusPlain(rapor.gelir.toplam)]),
    "",
  ];

  for (const k of rapor.gider.kalemler) {
    satirlar.push(csvSatir(["Gider", k.kategori, k.adet, formatKurusPlain(k.tutar)]));
  }
  satirlar.push(csvSatir(["Gider", "TOPLAM", "", formatKurusPlain(rapor.gider.toplam)]));
  satirlar.push("");
  satirlar.push(csvSatir(["Sonuç", "NET", "", formatKurusPlain(rapor.net)]));
  satirlar.push("");
  satirlar.push(
    csvSatir(["Not", "Net bir kasa bakiyesi değildir: karta yapılan tahsilat kasada durmaz."]),
  );
  satirlar.push("");
  satirlar.push(csvSatir(["Ödeme yöntemi", "Gelir (₺)", "Gider (₺)"]));
  satirlar.push(
    csvSatir(["Nakit", formatKurusPlain(rapor.gelir.nakit), formatKurusPlain(rapor.gider.nakit)]),
  );
  satirlar.push(
    csvSatir(["Kart", formatKurusPlain(rapor.gelir.kart), formatKurusPlain(rapor.gider.kart)]),
  );
  satirlar.push(
    csvSatir([
      "Diğer",
      formatKurusPlain(rapor.gelir.digerYontem),
      formatKurusPlain(rapor.gider.digerYontem),
    ]),
  );

  return BOM + satirlar.join("\r\n") + "\r\n";
}

/** Indirilen dosyanin adi: gider-20261005.csv */
export function csvDosyaAdi(onEk: string, tarih = new Date()): string {
  return `${onEk}-${formatDate(tarih).split(".").reverse().join("")}.csv`;
}
