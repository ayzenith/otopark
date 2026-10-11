/**
 * KONUM BİLGİSİ — TEK KAYNAK
 *
 * Kaynak: işletme sahibi. Ulaşım süreleri 06.10.2026 (metrobüs, metro) ve
 * 11.10.2026 (Dünya Ticaret Merkezi, Fuar Merkezi). Sürelerin yürüyerek mi
 * araçla mı olduğu söylenmedi; sitede belirtilmez (PRODUCT.md).
 *
 * Çevre noktaları için dakika VERİLMEDİ; yalnızca sahibinin ifadesi
 * yazılır: "Nef … hemen arkası", "Kültür Üniversitesi / Airport AVM
 * arkası" (06.10.2026). Teknik veriler tablosunda gösterilecek noktalar
 * 11.10.2026'da seçildi: Nef, Kültür Üniversitesi, Airport AVM.
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

export const CEVRE: readonly { yer: string; konum: string }[] = [
  { yer: "Nef", konum: "Hemen arkasında" },
  { yer: "Kültür Üniversitesi", konum: "Arkasında" },
  { yer: "Airport AVM", konum: "Arkasında" },
];
