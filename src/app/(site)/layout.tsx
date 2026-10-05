import Link from "next/link";
import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";

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
 * Mobil öncelikli: tek sütun, büyük dokunma hedefleri, yatay kaydırma yok.
 * Masaüstünde içerik ortalanır ve genişliği sınırlanır.
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
  { yol: "/fiyatlar", ad: "Fiyatlar" },
  { yol: "/iletisim", ad: "İletişim" },
];

export default async function SiteDuzeni({ children }: { children: React.ReactNode }) {
  const { kunye } = await siteIcerigi();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="bg-lacivert-600 text-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <Link href="/" className="block text-lg font-bold leading-tight">
            {kunye.isletmeAdi}
          </Link>
          <nav className="mt-3 flex flex-wrap gap-2">
            {BAGLANTILAR.map((b) => (
              <Link
                key={b.yol}
                href={b.yol}
                className="flex h-12 items-center rounded-xl bg-lacivert-500 px-4 text-sm font-semibold hover:bg-lacivert-400"
              >
                {b.ad}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-6 text-sm text-slate-600">
          {/* Girilmemiş künye alanı YAZILMAZ: yanlış adres/telefon göstermektense
              hiç göstermemek doğrudur (docs/07 S18 hâlâ açık). */}
          <p className="font-semibold text-lacivert-700">{kunye.isletmeAdi}</p>
          {kunye.adres ? <p>{kunye.adres}</p> : null}
          {kunye.calismaSaatleri ? <p>{kunye.calismaSaatleri}</p> : null}
          {kunye.telefon ? (
            <p>
              <a className="font-semibold text-mavi-700" href={`tel:${kunye.telefon.replace(/\s/g, "")}`}>
                {kunye.telefon}
              </a>
            </p>
          ) : null}

          <p className="pt-2">
            <Link href="/giris" className="text-slate-500 underline">
              Personel girişi
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
