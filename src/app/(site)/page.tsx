import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
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
 * ============================================================================
 * İŞLETMENİN 05.10.2026'DA VERDİĞİ KARAR: ziyaretçinin ilk gördüğü şey
 * "7/24 açık" bilgisi ve TEK DOKUNUŞLA YOL TARİFİ olmalı. Fiyat yazılmayacak.
 *
 * Bu yüzden sayfanın en üstünde, kaydırmaya gerek kalmadan:
 *   1. işletme adı,
 *   2. çalışma saati rozeti (panelden gelir; "7/24 açık" yazılır),
 *   3. verilen hizmetler,
 *   4. BÜYÜK "YOL TARİFİ AL" butonu (telefonda Google Maps uygulamasını açar),
 *   5. WhatsApp ve arama butonları
 * bulunur.
 * ============================================================================
 *
 * Girilmemiş hiçbir bilgi UYDURULMAZ (mimari kural 19): harita bağlantısı
 * yoksa yol tarifi butonu, telefon yoksa arama butonu hiç çizilmez.
 */
export default async function SiteAnaSayfa() {
  const { kunye, sayfalar, fiyatlar, galeri } = await siteIcerigi();
  const anasayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ANASAYFA];
  const otopark = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];
  const yikama = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <div className="space-y-8">
      {/* ---- VİTRİN: ilk ekranda görünmesi gereken her şey ---- */}
      <section className="space-y-4">
        <h1 className="text-3xl font-extrabold leading-tight text-lacivert-700">
          {kunye.isletmeAdi}
        </h1>

        {kunye.calismaSaatleri ? (
          <p
            data-test="calisma-saatleri-rozeti"
            className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-base font-bold text-white"
          >
            {kunye.calismaSaatleri}
          </p>
        ) : null}

        {anasayfa ? (
          <SiteMetni govde={anasayfa.govde} />
        ) : (
          // Tanitim metni girilmemis. Yer tutucu bir pazarlama cumlesi
          // UYDURULMAZ; isletmenin kesin olarak verdigi iki hizmet yazilir.
          <p className="text-lg leading-relaxed text-lacivert-700">
            Otopark ve oto yıkama hizmeti veriyoruz.
          </p>
        )}

        {/* ANA EYLEM: yol tarifi. Telefonda Google Maps uygulamasını açar. */}
        {kunye.mapsUrl ? (
          <a
            href={kunye.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-test="yol-tarifi"
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-lacivert-600 px-4 text-xl font-extrabold text-white"
          >
            <span aria-hidden>📍</span> YOL TARİFİ AL
          </a>
        ) : null}

        {whatsapp || ara ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                data-test="whatsapp"
                className="flex h-16 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-lg font-bold text-white"
              >
                WhatsApp ile yaz
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                data-test="ara"
                className="flex h-16 items-center justify-center rounded-2xl border-2 border-lacivert-600 px-4 text-lg font-bold text-lacivert-700"
              >
                ☎ {kunye.telefon}
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

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
          İşletme 05.10.2026'da "fiyat yazmaya gerek yok" dedi; satır
          girilmediği sürece bu bölüm hiç çizilmez. */}
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
