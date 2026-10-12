/**
 * SİTENİN MUTLAK ADRESİ — tek kaynak.
 *
 * Alan adı KODA SABİTLENMEZ (işletme kararı 11.10.2026): sitemap, canonical
 * ve Open Graph mutlak adres ister, o da `NEXT_PUBLIC_SITE_URL` ortam
 * değişkeninden okunur. Değişken girilmemişse arama motoruna açılacak
 * mutlak adres ÜRETİLMEZ (null döner) — yanlış alan adıyla indekslenmek,
 * hiç indekslenmemekten daha zor düzeltilir.
 */

/** Sondaki eğik çizgi atılmış kanonik kök adres; tanımsızsa null. */
export function siteKokAdresi(): string | null {
  const ham = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!ham) return null;
  try {
    const u = new URL(ham);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Kök adres + yol. Kök tanımsızsa null. */
export function siteAdresi(yol: string): string | null {
  const kok = siteKokAdresi();
  if (!kok) return null;
  return yol === "/" ? kok : `${kok}${yol.startsWith("/") ? yol : `/${yol}`}`;
}

/** Sitemap ve menüdeki genel sayfalar (fiyatlar koşullu). */
export const SITE_YOLLARI = ["/", "/otopark", "/oto-yikama", "/iletisim"] as const;
