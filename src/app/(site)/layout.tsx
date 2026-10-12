import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { OkIkonu, TelefonIkonu, WhatsappIkonu } from "./parcalar";
import { siteKokAdresi } from "@/lib/site-url";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";

/**
 * KURUMSAL SİTE KABUĞU — TEKNİK VERİ (11.10.2026)
 *
 * Başlık logonun laciverti, alt bilgi bir ton koyusu; yazı Archivo (tek
 * aile, üç genişlik). Renklerin hepsi logodan gelir (işletme kararı).
 * Başlık SABİT DEĞİLDİR: telefonda ekranın üstünü yemez. Eylemler alttaki
 * sabit çubukta; çubuk her sayfada vardır ve ilk ekran kaydırılınca
 * yükselir (ilk ekranda aynı eylemler zaten görünür).
 *
 * "Fiyatlar" menüde YALNIZCA panelden fiyat satırı girildiyse görünür
 * (işletme kararı 11.10.2026). Sayfanın adresi her durumda çalışır.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { kunye } = await siteIcerigi();
  const kok = siteKokAdresi();
  const aciklama = `${kunye.isletmeAdi} — otopark ve oto yıkama.`;

  return {
    title: { default: kunye.isletmeAdi, template: `%s · ${kunye.isletmeAdi}` },
    description: aciklama,
    // Alan adı tanımlı DEĞİLSE site arama motorlarına kapalı kalır: geçici
    // bir adresle indekslenmek sonradan düzeltmesi zor bir iz bırakır
    // (12.10.2026). Tanımlıysa açılır; kanonik adres ve paylaşım kartı da
    // o adresten üretilir.
    robots: kok ? { index: true, follow: true } : { index: false, follow: false },
    ...(kok
      ? {
          metadataBase: new URL(kok),
          alternates: { canonical: "/" },
          openGraph: {
            type: "website",
            siteName: kunye.isletmeAdi,
            title: kunye.isletmeAdi,
            description: aciklama,
            url: kok,
            locale: "tr_TR",
            images: [{ url: "/logo.png", width: 1278, height: 1076, alt: kunye.isletmeAdi }],
          },
        }
      : {}),
  };
}

export default async function SiteDuzeni({ children }: { children: React.ReactNode }) {
  const { kunye, fiyatlar } = await siteIcerigi();
  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  const baglantilar = [
    { yol: "/otopark", ad: "Otopark" },
    { yol: "/oto-yikama", ad: "Oto Yıkama" },
    ...(fiyatlar.length > 0 ? [{ yol: "/fiyatlar", ad: "Fiyatlar" }] : []),
    { yol: "/iletisim", ad: "İletişim" },
  ];

  return (
    <div className="site-bro flex min-h-dvh flex-col bg-showroom-50">
      <header className="bg-yol-800 text-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8 md:py-4">
          <Link href="/" className="site-basilabilir flex min-h-12 min-w-0 items-center gap-3" aria-label={kunye.isletmeAdi}>
            <Image
              src="/logo-beyaz.png"
              alt={kunye.isletmeAdi}
              height={40}
              width={48}
              className="h-9 w-auto shrink-0 md:h-10"
              priority
            />
            <span className="line-clamp-2 text-[15px] font-extrabold uppercase leading-tight tracking-[0.08em] [font-stretch:120%] md:text-base">
              {kunye.isletmeAdi}
            </span>
          </Link>

          <nav aria-label="Site" className="hidden items-center gap-7 md:flex">
            {baglantilar.map((b) => (
              <Link
                key={b.yol}
                href={b.yol}
                className="site-bag flex h-12 items-center text-[15px] font-bold text-celik-200 hover:text-white"
              >
                {b.ad}
              </Link>
            ))}
            {ara ? (
              <a
                href={ara}
                className="site-basilabilir flex h-12 items-center gap-2 rounded-[8px] border-2 border-white/60 px-4 text-[15px] font-extrabold tabular-nums hover:bg-white/10"
              >
                <TelefonIkonu className="h-5 w-5" />
                {kunye.telefon}
              </a>
            ) : null}
          </nav>
        </div>

        {/* TELEFON MENÜSÜ: açılır menü yerine saran satır; tek dokunuş, gizli
            adım yok, yatay kaydırma yok. Her bağlantı 48px yüksekliğinde.
            "Ana sayfa" yok: başlıktaki işletme adı oraya götürür. */}
        <nav
          aria-label="Site (telefon)"
          data-test="telefon-menu"
          className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 border-t border-white/10 px-4 md:hidden"
        >
          {baglantilar.map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              className="flex h-12 items-center text-[15px] font-bold text-celik-200 hover:text-white"
            >
              {b.ad}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <footer className="bg-yol-900 text-white">
        {/* Telefonda alttaki SABİT eylem çubuğu alt bilgiyi örtmesin diye
            fazladan boşluk (Personel girişi bağlantısına dokunulabilmeli). */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-14 sm:px-8 md:pb-14">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
            <div className="min-w-0">
              <Link href="/" className="site-basilabilir inline-flex min-h-12 items-center gap-3">
                <Image src="/logo-beyaz.png" alt={kunye.isletmeAdi} height={36} width={43} className="h-9 w-auto" />
              </Link>
              <p className="mt-3 text-xl font-black uppercase leading-tight tracking-[0.02em] [font-stretch:120%] [overflow-wrap:anywhere]">
                {kunye.isletmeAdi}
              </p>
              {kunye.calismaSaatleri ? (
                <p className="site-veri mt-4 inline-block max-w-full rounded-[4px] bg-white px-3 pb-1 pt-1.5 text-yol-800 [overflow-wrap:anywhere]">
                  {kunye.calismaSaatleri}
                </p>
              ) : null}
              {kunye.adres ? (
                <p className="mt-4 max-w-sm leading-relaxed text-celik-200 [overflow-wrap:anywhere]">{kunye.adres}</p>
              ) : null}
            </div>

            <div className="min-w-0">
              {ara ? (
                <a className="text-2xl font-extrabold tabular-nums [overflow-wrap:anywhere]" href={ara}>
                  {kunye.telefon}
                </a>
              ) : null}
              {kunye.instagram ? (
                <p className="mt-3">
                  <a
                    className="site-bag font-bold text-celik-200 hover:text-white"
                    href={kunye.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                </p>
              ) : null}
              <nav aria-label="Alt bilgi" className="mt-5 flex flex-col">
                {[{ yol: "/", ad: "Ana sayfa" }, ...baglantilar].map((b) => (
                  <Link
                    key={b.yol}
                    href={b.yol}
                    className="flex min-h-11 items-center self-start font-bold text-celik-200 hover:text-white"
                  >
                    {b.ad}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <p className="mt-12 border-t border-white/10 pt-5">
            <Link href="/giris" className="flex min-h-11 items-center self-start text-sm font-semibold text-celik-200 hover:text-white">
              Personel girişi
            </Link>
          </p>
        </div>
      </footer>

      {/* ============ SABİT EYLEM ÇUBUĞU (telefon, her sayfada) ============
          Renk anlamı her yerde aynı: MAVİ = yol tarifi, lacivert çerçeveli
          kare = WhatsApp / arama (logolarıyla). Girilmemiş bilgi için buton
          çizilmez. */}
      {kunye.mapsUrl || whatsapp || ara ? (
        <div
          data-test="sabit-eylem-cubugu"
          className="site-alt-cubuk fixed inset-x-0 bottom-0 z-40 border-t border-yol-800/20 bg-white px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 md:hidden"
        >
          <div className="flex gap-2">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="site-basilabilir flex h-16 flex-1 items-center justify-center gap-2.5 rounded-[6px] bg-levha-500 text-lg font-extrabold tracking-[0.06em] text-white [font-stretch:115%]"
              >
                YOL TARİFİ AL
                <OkIkonu className="h-4 w-4" />
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile yazın"
                className="site-basilabilir flex h-16 w-16 shrink-0 items-center justify-center rounded-[6px] border-2 border-yol-800 text-yol-800"
              >
                <WhatsappIkonu className="h-7 w-7" />
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla arayın"
                className="site-basilabilir flex h-16 w-16 shrink-0 items-center justify-center rounded-[6px] border-2 border-yol-800 text-yol-800"
              >
                <TelefonIkonu className="h-7 w-7" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
