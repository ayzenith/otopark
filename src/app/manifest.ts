import type { MetadataRoute } from "next";
import { prisma } from "@/server/db";

/**
 * ANA EKRANA EKLEME (PWA manifesti)
 *
 * Personel paneli telefondan kullanılıyor. Bu dosya sayesinde site/panel
 * telefonun ana ekranına eklendiğinde kendi ikonuyla, tarayıcı adres çubuğu
 * OLMADAN, tam ekran açılır — personel için gerçek bir uygulamadan farkı
 * hissedilmez.
 *
 * Çevrimdışı çalışma (service worker) BİLEREK EKLENMEDİ: kasa ve tahsilat
 * işlemleri sunucuda doğrulanır; çevrimdışı kuyruk, aynı aracın iki kez
 * tahsil edilmesi gibi muhasebe hatalarına kapı açar. İnternet yoksa personel
 * açık bir hata görür, sessizce "kaydedildi" demez.
 *
 * İkon GEÇİCİDİR: işletmenin logosu henüz verilmedi (docs/07 S18). Logo
 * gelince public/ikon-*.png dosyaları değiştirilecek, kod değişmeyecek.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const ayar = await prisma.businessSetting
    .findUnique({ where: { id: "singleton" }, select: { businessName: true } })
    .catch(() => null);

  const ad = ayar?.businessName?.trim() || "Londra Camping";

  return {
    name: `${ad} — İşletme Paneli`,
    short_name: ad.slice(0, 12),
    description: "Otopark, oto yıkama, abonman ve kasa yönetimi.",
    start_url: "/vardiya",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0b2447",
    lang: "tr",
    icons: [
      { src: "/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon-maskeli-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
