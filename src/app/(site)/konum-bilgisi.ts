/**
 * KONUM BİLGİSİ — TEK KAYNAK
 *
 * Kaynak: işletme sahibi (06.10.2026 ulaşım süreleri, 11.10.2026 Dünya
 * Ticaret Merkezi, Fuar Merkezi ve Nivo). Sürelerin yürüyerek mi araçla mı
 * olduğu söylenmedi; sitede belirtilmez (PRODUCT.md).
 *
 * Yakın çevre noktaları için uzaklık iddiası YAZILMAZ: sahibi yalnızca
 * "hemen arkası / yakını" dedi, nokta nokta ölçü vermedi.
 */

export type UlasimTuru = "metrobus" | "metro" | "fuar";

export const ULASIM: readonly { yer: string; kisaAd: string; sure: string; tur: UlasimTuru }[] = [
  { yer: "Metrobüs", kisaAd: "Metrobüs", sure: "2 dk", tur: "metrobus" },
  { yer: "Metro", kisaAd: "Metro", sure: "3 dk", tur: "metro" },
  {
    yer: "İstanbul Dünya Ticaret Merkezi",
    kisaAd: "Dünya Ticaret Merkezi",
    sure: "6 dk",
    tur: "fuar",
  },
  { yer: "İstanbul Fuar Merkezi", kisaAd: "Fuar Merkezi", sure: "7 dk", tur: "fuar" },
];

export const YAKIN_CEVRE: readonly string[] = [
  "Nef",
  "Selenium",
  "Ataköy Towers",
  "Nivo",
  "Kültür Üniversitesi",
  "Airport AVM",
];
