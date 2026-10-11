import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { OkIkonu, TelefonIkonu, WhatsappIkonu } from "./parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";

/**
 * KURUMSAL SİTE KABUĞU — OTOYOL TABELASI (11.10.2026)
 *
 * Başlık ve alt bilgi gece asfaltı laciverti; yazı Overpass (tabela harfi).
 * Başlık SABİT DEĞİLDİR: telefonda ekranın üstünü yemez. Eylemler alttaki
 * sabit çubukta; çubuk her sayfada vardır ve ilk ekran kaydırılınca
 * yükselir (ilk ekranda aynı eylemler zaten görünür).
 *
 * "Fiyatlar" menüde YALNIZCA panelden fiyat satırı girildiyse görünür
 * (işletme kararı 11.10.2026). Sayfanın adresi her durumda çalışır.
 */

export async function generateMetadata(): Promise<Metadata> {
  const { kunye } = await siteIcerigi();
  return {
    title: { default: kunye.isletmeAdi, template: `%s · ${kunye.isletmeAdi}` },
    description: `${kunye.isletmeAdi} — otopark ve oto yıkama.`,
    // Site, işletme bilgileri girilene kadar arama motorlarına açılmaz:
    // yarım bir sayfanın indekslenmesi sonradan düzeltmesi zor bir izlenim
    // bırakır. Bilgiler girildikten sonra bu satır kaldırılacak (Aşama 8).
    robots: { index: false, follow: false },
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
    <div className="site-tabela flex min-h-dvh flex-col bg-kagit-50">
      <header className="border-b-2 border-white/10 bg-yol-950 text-white">
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
            <span className="line-clamp-2 text-base font-extrabold leading-tight tracking-[0.04em] md:text-lg">
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

      {/* Gece zeminli sayfalar (ana sayfa) alt bilgiye kesintisiz bağlanır;
          kâğıt zeminli sayfalar alt bilgiden önce nefes alır. */}
      <main className="flex-1 pb-24 has-[.site-gece]:pb-0">{children}</main>

      <footer className="border-t-2 border-white/10 bg-yol-950 text-white">
        {/* Telefonda alttaki SABİT eylem çubuğu alt bilgiyi örtmesin diye
            fazladan boşluk (Personel girişi bağlantısına dokunulabilmeli). */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-14 sm:px-8 md:pb-14">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr]">
            <div className="min-w-0">
              <Link href="/" className="site-basilabilir inline-flex min-h-12 items-center gap-3">
                <Image src="/logo-beyaz.png" alt={kunye.isletmeAdi} height={36} width={43} className="h-9 w-auto" />
              </Link>
              <p className="mt-3 text-xl font-extrabold leading-tight tracking-[0.03em] [overflow-wrap:anywhere]">
                {kunye.isletmeAdi}
              </p>
              {kunye.calismaSaatleri ? (
                <p className="mt-4 inline-block max-w-full rounded-[4px] bg-white px-3 pb-1 pt-1.5 font-black tracking-[0.04em] text-yol-800 [overflow-wrap:anywhere]">
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
          Renk anlamı her yerde aynı: BEYAZ plaka = yol tarifi, MAVİ kare =
          WhatsApp / arama. Girilmemiş bilgi için buton çizilmez. */}
      {kunye.mapsUrl || whatsapp || ara ? (
        <div
          data-test="sabit-eylem-cubugu"
          className="site-alt-cubuk fixed inset-x-0 bottom-0 z-40 border-t-2 border-white/15 bg-yol-950/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden"
        >
          <div className="flex gap-2">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="site-basilabilir flex h-16 flex-1 items-center justify-center gap-2.5 rounded-[8px] bg-white text-lg font-black tracking-[0.03em] text-yol-900"
              >
                YOL TARİFİ AL
                <OkIkonu className="h-5 w-5" />
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile yazın"
                className="site-basilabilir flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] bg-levha-500 text-white"
              >
                <WhatsappIkonu className="h-7 w-7" />
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla arayın"
                className="site-basilabilir flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px] bg-levha-500 text-white"
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
