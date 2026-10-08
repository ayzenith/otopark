import Link from "next/link";
import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { TelefonIkonu, WhatsappIkonu } from "./parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";

/**
 * KURUMSAL SİTE KABUĞU
 *
 * ============================================================================
 * TASARIM DİLİ: mürekkep + kâğıt + tek sinyal rengi.
 *
 * Panelin aksine burası bir VİTRİN. Panel yoğun ve tanıdık olmalı; site
 * geniş nefes almalı. Bu yüzden:
 *   · yüzeyler ya mürekkep (koyu) ya kâğıt (sıcak beyaz) — ara ton yok,
 *   · ayrımlar KUTU ile değil İNCE ÇİZGİ ile yapılır,
 *   · tek vurgu rengi var: yol işaretlerinin sarısı (sinyal),
 *   · başlıklar büyük ve sıkı harf aralıklı, etiketler monospace ve geniş.
 *
 * Başlık çubuğu SABİT DEĞİLDİR: telefonda ekranın üstünü yemek yerine
 * sayfayla birlikte kayar. Eylemler zaten alttaki sabit çubukta.
 * ============================================================================
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

const BAGLANTILAR = [
  { yol: "/", ad: "Ana sayfa" },
  { yol: "/otopark", ad: "Otopark" },
  { yol: "/oto-yikama", ad: "Oto Yıkama" },
  { yol: "/fiyatlar", ad: "Fiyatlar" },
  { yol: "/iletisim", ad: "İletişim" },
];

export default async function SiteDuzeni({ children }: { children: React.ReactNode }) {
  const { kunye } = await siteIcerigi();
  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <div className="flex min-h-dvh flex-col bg-kagit-50">
      <header className="bg-murekkep-950 text-kagit-50">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4 sm:px-8 sm:py-5">
          <Link
            href="/"
            className="site-basilabilir text-base font-extrabold uppercase tracking-[0.12em] sm:text-lg"
          >
            {kunye.isletmeAdi}
          </Link>

          <nav aria-label="Site" className="hidden items-center gap-6 sm:flex">
            {BAGLANTILAR.slice(1).map((b) => (
              <Link
                key={b.yol}
                href={b.yol}
                className="site-bag text-sm font-semibold text-kagit-200/70 transition-colors duration-200 hover:text-kagit-50"
              >
                {b.ad}
              </Link>
            ))}
          </nav>

          {/* Telefonda başlıkta yalnızca iki eylem; menü aşağıdaki satırda. */}
          <div className="flex items-center gap-2 sm:hidden">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile yazın"
                className="site-basilabilir flex h-11 w-11 items-center justify-center rounded-lg ring-1 ring-inset ring-kagit-50/25"
              >
                <WhatsappIkonu className="h-5 w-5" />
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla arayın"
                className="site-basilabilir flex h-11 w-11 items-center justify-center rounded-lg bg-sinyal-400 text-murekkep-950"
              >
                <TelefonIkonu className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>

        {/* TELEFON MENÜSÜ
            Beş bağlantı başlık satırına sığmaz. Açılır menü yerine SARAN bir
            etiket satırı: tek dokunuşla gidilir, gizli bir adım yoktur ve
            yatay kaydırma oluşmaz (mobil öncelikli kural). */}
        <nav
          aria-label="Site (telefon)"
          data-test="telefon-menu"
          className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-4 gap-y-1 border-t border-kagit-50/10 px-6 pb-3 pt-2.5 sm:hidden"
        >
          {/* "Ana sayfa" telefonda listeye KONULMAZ: başlıktaki işletme adı
              zaten ana sayfaya götürür ve beş bağlantı tek satıra sığmayıp
              vitrini aşağı itiyordu. */}
          {BAGLANTILAR.slice(1).map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              className="site-bag flex h-8 items-center text-sm font-semibold text-kagit-200/75"
            >
              {b.ad}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-murekkep-900/12 bg-kagit-100">
        {/* Telefonda alttaki SABİT eylem çubuğu alt bilgiyi örtmesin diye
            fazladan boşluk. Örtünce "Personel girişi" bağlantısına
            dokunulamıyordu — E2E testi yakaladı. */}
        <div className="mx-auto w-full max-w-5xl px-6 pb-32 pt-14 sm:px-8 sm:pb-14">
          <div className="grid gap-10 sm:grid-cols-[1.2fr_1fr]">
            <div>
              {/* Girilmemiş künye alanı YAZILMAZ: yanlış adres/telefon
                  göstermektense hiç göstermemek doğrudur (kural 19). */}
              <p className="text-xl font-extrabold uppercase tracking-[0.12em] text-murekkep-900">
                {kunye.isletmeAdi}
              </p>
              {kunye.calismaSaatleri ? (
                <p className="site-etiket mt-3 text-sinyal-600">{kunye.calismaSaatleri}</p>
              ) : null}
              {kunye.adres ? (
                <p className="mt-4 max-w-sm leading-relaxed text-murekkep-700/75">{kunye.adres}</p>
              ) : null}
            </div>

            <div>
              {ara ? (
                <a
                  className="text-2xl font-extrabold tracking-tight text-murekkep-900"
                  href={ara}
                >
                  {kunye.telefon}
                </a>
              ) : null}
              {kunye.instagram ? (
                <p className="mt-3">
                  <a
                    className="site-bag font-semibold text-murekkep-700"
                    href={kunye.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                </p>
              ) : null}
              <nav aria-label="Alt bilgi" className="mt-6 flex flex-col gap-2">
                {BAGLANTILAR.map((b) => (
                  <Link
                    key={b.yol}
                    href={b.yol}
                    className="site-bag self-start text-murekkep-700/80"
                  >
                    {b.ad}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <p className="mt-14 border-t border-murekkep-900/10 pt-6">
            <Link href="/giris" className="site-bag text-sm text-murekkep-700/45">
              Personel girişi
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
