/**
 * SİTE METNİ ÇÖZÜMLEYİCİ (saf fonksiyon)
 *
 * Panelden girilen serbest metni, çizilebilir bloklara ayırır. SAF'tır:
 * veritabanı, tarih veya rastgelelik kullanmaz — bu yüzden birim testiyle
 * tamamen kapsanır (tarife motoruyla aynı yaklaşım).
 *
 * Desteklenen tek biçimlendirme, patronun elle yazabileceği kadar sadedir:
 *   · boş satırla ayrılmış blok  → paragraf
 *   · "## " ile başlayan satır   → ara başlık
 *   · tamamı "- " ile başlayan blok → madde listesi
 *
 * HTML KABUL EDİLMEZ: çıktı yalnızca metin taşır, React onu kaçırarak basar.
 * Yapıştırılan bir <script> ekranda yazı olarak görünür, çalışmaz.
 */

export type SiteBlogu =
  | { tur: "baslik"; metin: string }
  | { tur: "paragraf"; metin: string }
  | { tur: "liste"; maddeler: string[] };

export function metniBloklaraAyir(govde: string): SiteBlogu[] {
  if (typeof govde !== "string") return [];

  return govde
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b !== "")
    .map((blok): SiteBlogu => {
      if (blok.startsWith("## ")) {
        return { tur: "baslik", metin: blok.slice(3).trim() };
      }

      const satirlar = blok.split("\n");
      if (satirlar.every((s) => s.trimStart().startsWith("- "))) {
        return {
          tur: "liste",
          maddeler: satirlar.map((s) => s.trimStart().slice(2).trim()).filter((s) => s !== ""),
        };
      }

      return { tur: "paragraf", metin: blok };
    });
}
