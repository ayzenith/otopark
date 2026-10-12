import type { MetadataRoute } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { SITE_YOLLARI, siteKokAdresi } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * SİTE HARİTASI — yalnızca GENEL sayfalar.
 *
 * Panel (`/vardiya`, `/yonetim/**`, `/giris`) buraya ASLA girmez: oturum
 * ister ve aramada görünmesinin anlamı yok. "Fiyatlar" sayfası menüde
 * olduğu kuralla aynı: panelden fiyat satırı girilmediyse haritaya da
 * konmaz (mimari kural 20 — olmayan içerik duyurulmaz).
 *
 * Alan adı tanımsızsa (NEXT_PUBLIC_SITE_URL yok) harita BOŞ döner.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const kok = siteKokAdresi();
  if (!kok) return [];

  const { fiyatlar } = await siteIcerigi();
  const yollar = [...SITE_YOLLARI, ...(fiyatlar.length > 0 ? ["/fiyatlar"] : [])];
  const simdi = new Date();

  return yollar.map((yol) => ({
    url: yol === "/" ? kok : `${kok}${yol}`,
    lastModified: simdi,
    changeFrequency: "monthly" as const,
    priority: yol === "/" ? 1 : 0.7,
  }));
}
