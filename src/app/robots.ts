import type { MetadataRoute } from "next";
import { siteKokAdresi } from "@/lib/site-url";

/**
 * ARAMA MOTORU KURALLARI.
 *
 * Genel site taranabilir; PANEL kapalıdır. Panel yolları zaten oturum
 * ister ama arama sonuçlarında görünmeleri de istenmez.
 *
 * Alan adı tanımsızken (NEXT_PUBLIC_SITE_URL girilmemiş) site TAMAMEN
 * kapatılır: yanlış/geçici bir adresle indekslenmek sonradan düzeltmesi
 * zor bir iz bırakır.
 */
/**
 * Derleme anında SABİTLENMEZ: adres ortam değişkeninden okunur ve değişken
 * derlemeden sonra da girilebilir. Sabitlenirse "tamamen kapalı" hâli
 * dosyaya gömülür ve değişkeni girmek siteyi açmaya yetmez (12.10.2026'da
 * yaşandı).
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const kok = siteKokAdresi();
  if (!kok) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/giris", "/vardiya", "/yonetim", "/araclar", "/yikama", "/abonmanlar", "/musteriler", "/abonmanli-araclar", "/tarife", "/kasa", "/stok"],
    },
    sitemap: `${kok}/sitemap.xml`,
    host: kok,
  };
}
