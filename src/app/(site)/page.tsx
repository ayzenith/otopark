import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { SiteMetni } from "./metin";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";


/**
 * SİTE ANA SAYFASI
 *
 * İÇERİK HENÜZ GİRİLMEDİ (docs/07 S18-S19). Bu sayfa hiçbir adres, telefon,
 * çalışma saati veya fiyat UYDURMAZ: girilmemiş her bölüm çizilmez. Patron
 * panelden (Yönetim → Web sitesi) bilgileri yazdığı anda bölümler kendiliğinden
 * görünür.
 */
export default async function SiteAnaSayfa() {
  const { kunye, sayfalar, fiyatlar, galeri } = await siteIcerigi();
  const anasayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ANASAYFA];
  const otopark = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];
  const yikama = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-lacivert-700">{kunye.isletmeAdi}</h1>
        {anasayfa ? (
          <div className="mt-4">
            <SiteMetni govde={anasayfa.govde} />
          </div>
        ) : (
          // Tanıtım metni girilmemiş. Ziyaretçiye yer tutucu bir pazarlama
          // cümlesi UYDURULMAZ; sayfa sadece iletişim yollarını gösterir.
          <p className="mt-4 leading-relaxed text-lacivert-700">
            Otopark ve oto yıkama hizmeti veriyoruz.
          </p>
        )}
      </section>

      {/* Telefon/WhatsApp: yalnızca girilmişse. Tek dokunuşla arama. */}
      {kunye.telefon || kunye.whatsapp ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {kunye.telefon ? (
            <a
              href={`tel:${kunye.telefon.replace(/\s/g, "")}`}
              className="flex h-16 items-center justify-center rounded-2xl bg-lacivert-600 px-4 text-lg font-bold text-white"
            >
              ☎ {kunye.telefon}
            </a>
          ) : null}
          {kunye.whatsapp ? (
            <a
              href={`https://wa.me/${kunye.whatsapp.replace(/\D/g, "")}`}
              className="flex h-16 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-lg font-bold text-white"
            >
              WhatsApp
            </a>
          ) : null}
        </section>
      ) : null}

      {otopark ? (
        <section>
          <h2 className="text-xl font-bold text-lacivert-700">{otopark.baslik}</h2>
          <div className="mt-3">
            <SiteMetni govde={otopark.govde} />
          </div>
        </section>
      ) : null}

      {yikama ? (
        <section>
          <h2 className="text-xl font-bold text-lacivert-700">{yikama.baslik}</h2>
          <div className="mt-3">
            <SiteMetni govde={yikama.govde} />
          </div>
        </section>
      ) : null}

      {/* Fiyatlar: SADECE patronun "sitede göster" dediği satırlar.
          Tarife tablosundan otomatik kopyalanmaz (docs/07 S19). */}
      {fiyatlar.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold text-lacivert-700">Fiyatlar</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {fiyatlar.slice(0, 4).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold text-lacivert-700">{f.etiket}</span>
                <span className="text-lg font-bold text-lacivert-700">{f.fiyatMetni}</span>
              </li>
            ))}
          </ul>
          {fiyatlar.length > 4 ? (
            <Link href="/fiyatlar" className="mt-3 block text-mavi-700 underline">
              Tüm fiyatlar
            </Link>
          ) : null}
        </section>
      ) : null}

      {galeri.length > 0 ? (
        <section>
          <h2 className="text-xl font-bold text-lacivert-700">Galeri</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {galeri.map((g) => (
              /* eslint-disable-next-line @next/next/no-img-element --
                 Görseller panelden girilen serbest adreslerdir (yerel dosya ya
                 da dış bağlantı); next/image uzak alan adı için yapılandırma
                 ister ve hangi alan adının kullanılacağı henüz belli değil. */
              <img
                key={g.id}
                src={g.url}
                alt={g.alt}
                className="h-40 w-full rounded-xl object-cover"
                loading="lazy"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <Link
          href="/iletisim"
          className="flex h-14 items-center justify-center rounded-2xl border-2 border-lacivert-600 px-4 font-bold text-lacivert-700"
        >
          İletişim ve konum
        </Link>
      </section>
    </div>
  );
}
