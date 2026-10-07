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
 * Panelin aksine burası HERKESE AÇIKTIR: oturum sorulmaz, müşteri/işlem
 * verisine dokunulmaz. Yalnızca `BusinessSetting` + `Site*` tabloları okunur.
 *
 * Başlık koyu zeminlidir ve ana sayfanın vitrin bölümüyle BİRLEŞİR; bu
 * yüzden sayfa genişliğini burası DEĞİL, her sayfa kendisi belirler.
 * Mobil öncelikli: tek sütun, büyük dokunma hedefleri, yatay kaydırma yok.
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
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="bg-lacivert-700 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="text-lg font-extrabold tracking-tight sm:text-xl">
            {kunye.isletmeAdi}
          </Link>

          <nav aria-label="Site" className="hidden items-center gap-1 sm:flex">
            {BAGLANTILAR.map((b) => (
              <Link
                key={b.yol}
                href={b.yol}
                className="flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-lacivert-100 transition-colors hover:bg-white/10 hover:text-white"
              >
                {b.ad}
              </Link>
            ))}
          </nav>

          {/* Telefonda başlıkta yalnızca iki ikon; menü aşağıdaki satırda. */}
          <div className="flex items-center gap-2 sm:hidden">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp ile yazın"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white"
              >
                <WhatsappIkonu className="h-5 w-5" />
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla arayın"
                className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ring-white/30"
              >
                <TelefonIkonu className="h-5 w-5" />
              </a>
            ) : null}
          </div>
        </div>

        {/* TELEFON MENÜSÜ
            Beş bağlantı başlık satırına sığmaz. Açılır menü yerine SARAN bir
            etiket satırı kullanılır: tek dokunuşla gidilir, gizli bir adım
            yoktur ve yatay kaydırma oluşmaz (mobil öncelikli kural). */}
        <nav
          aria-label="Site (telefon)"
          data-test="telefon-menu"
          className="mx-auto flex w-full max-w-5xl flex-wrap gap-2 px-5 pb-4 sm:hidden"
        >
          {BAGLANTILAR.map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              className="flex h-11 items-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-white"
            >
              {b.ad}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-slate-200 bg-slate-50">
        {/* Telefonda alttaki SABİT eylem çubuğu (ana sayfa) alt bilgiyi
            örtmesin diye fazladan boşluk bırakılır. Örtünce "Personel girişi"
            bağlantısına dokunulamıyordu — E2E testi yakaladı. */}
        <div className="mx-auto w-full max-w-5xl px-5 pb-32 pt-10 sm:pb-10">
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              {/* Girilmemiş künye alanı YAZILMAZ: yanlış adres/telefon
                  göstermektense hiç göstermemek doğrudur (mimari kural 19). */}
              <p className="text-lg font-extrabold text-lacivert-700">{kunye.isletmeAdi}</p>
              {kunye.calismaSaatleri ? (
                <p className="mt-1 font-semibold text-emerald-700">{kunye.calismaSaatleri}</p>
              ) : null}
              {kunye.adres ? <p className="mt-3 text-slate-600">{kunye.adres}</p> : null}
            </div>

            <div className="space-y-2">
              {ara ? (
                <p>
                  <a className="text-lg font-bold text-lacivert-700" href={ara}>
                    {kunye.telefon}
                  </a>
                </p>
              ) : null}
              {kunye.instagram ? (
                <p>
                  <a
                    className="font-semibold text-mavi-700 underline"
                    href={kunye.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Instagram
                  </a>
                </p>
              ) : null}
              <nav aria-label="Alt bilgi" className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                {BAGLANTILAR.map((b) => (
                  <Link key={b.yol} href={b.yol} className="text-slate-600 underline">
                    {b.ad}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <p className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-400">
            <Link href="/giris" className="underline">
              Personel girişi
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
