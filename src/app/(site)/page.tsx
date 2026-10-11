import Image from "next/image";
import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "./metin";
import { GaleriGorseli } from "./galeri";
import { ULASIM, YAKIN_CEVRE } from "./konum-bilgisi";
import {
  EtiketIkonu,
  HizmetLevhasi,
  KalkanIkonu,
  KameraIkonu,
  Levha,
  OkIkonu,
  OtoparkIkonu,
  TelefonIkonu,
  UlasimPiktogrami,
  VarisSatiri,
  WhatsappIkonu,
  YikamaIkonu,
} from "./parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

/**
 * SİTE ANA SAYFASI — OTOYOL TABELASI (11.10.2026)
 *
 * Sayfa, otoparka götüren üst geçit tabelasıdır: lacivert yer adı levhası,
 * mavi varış levhası (dakikalar), beyaz eylem plakası; ardından varış:
 * girişin gerçek fotoğrafı. Yön sözleşmesi `.impeccable/surfaces/` altında.
 *
 * Değişmeyen kurallar:
 *   · YOL TARİFİ AL ilk ekranda (E2E testi telefonda ölçer)
 *   · Sitede FİYAT YAZILMAZ; panelden fiyat satırı girilirse bölüm çizilir
 *   · Girilmemiş bilgi için yer tutucu yok (mimari kural 20)
 *   · İçerik betik olmadan da görünür (mimari kural 19)
 */
export default async function SiteAnaSayfa() {
  const { kunye, sayfalar, fiyatlar, galeri } = await siteIcerigi();
  const anasayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ANASAYFA];
  const otopark = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];
  const yikama = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <div className="site-gece bg-yol-950 text-white">
      {/* ======================= ÜST GEÇİT ======================= */}
      <section
        aria-labelledby="isletme-adi"
        className="mx-auto w-full max-w-6xl px-4 pb-14 pt-4 sm:px-8 md:pb-20 md:pt-8"
      >
        {/* Levhaların asıldığı çelik kiriş (telefonda yer kaplamasın diye yok). */}
        <div aria-hidden className="hidden h-2.5 rounded-[2px] bg-celik-400 md:block" />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:gap-4">
          <Levha
            ton="ana"
            className="site-yerles md:rounded-t-none"
            icClassName="flex flex-col justify-between gap-7 p-5 sm:p-7 md:min-h-80 md:p-9"
          >
            <div className="flex items-start justify-between gap-4">
              <h1
                id="isletme-adi"
                className="site-tabela-ad min-w-0 text-balance [overflow-wrap:anywhere]"
              >
                {kunye.isletmeAdi}
              </h1>
              <OkIkonu className="site-ok mt-1 h-11 w-11 shrink-0 sm:h-14 sm:w-14 md:h-20 md:w-20" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {kunye.calismaSaatleri ? (
                <p
                  data-test="calisma-saatleri-rozeti"
                  className="max-w-full rounded-[4px] bg-white px-3 pb-1 pt-1.5 text-lg font-black tracking-[0.04em] text-yol-800 [overflow-wrap:anywhere]"
                >
                  {kunye.calismaSaatleri}
                </p>
              ) : null}
              <p className="flex flex-wrap items-center gap-x-3 text-lg font-semibold text-celik-200">
                <span>Açık hava otopark</span>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-celik-200" />
                <span>Oto yıkama</span>
              </p>
            </div>
          </Levha>

          {/* Eylemler: telefonda yer adının hemen altında (ilk ekranda kalsın),
              geniş ekranda iki levhanın altında tek satır. */}
          {kunye.mapsUrl || whatsapp || ara ? (
            <div className="site-yerles site-yerles-2 flex flex-col gap-3 md:order-last md:col-span-2 md:flex-row md:pt-2">
              {kunye.mapsUrl ? (
                <a
                  href={kunye.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-test="yol-tarifi"
                  className="site-basilabilir flex h-16 items-center justify-center gap-3 rounded-[8px] bg-white px-8 text-xl font-black tracking-[0.03em] text-yol-900 md:min-w-[22rem]"
                >
                  YOL TARİFİ AL
                  <OkIkonu className="h-6 w-6" />
                </a>
              ) : null}
              {whatsapp || ara ? (
                <div className="flex gap-3">
                  {whatsapp ? (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-test="whatsapp"
                      className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[8px] border-2 border-white/70 px-5 text-lg font-bold hover:bg-white/10 md:h-16 md:flex-none md:px-7"
                    >
                      <WhatsappIkonu className="h-6 w-6" />
                      WhatsApp
                    </a>
                  ) : null}
                  {ara ? (
                    <a
                      href={ara}
                      data-test="ara"
                      className="site-basilabilir flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[8px] border-2 border-white/70 px-5 text-lg font-bold tabular-nums hover:bg-white/10 md:h-16 md:flex-none md:px-7"
                    >
                      <TelefonIkonu className="h-6 w-6 shrink-0" />
                      {/* Numara yarım genişliğe sığmaz; telefonda eylem adı yazar,
                          numara alt bilgide ve geniş ekranda görünür. */}
                      <span className="md:hidden">Ara</span>
                      <span className="hidden truncate md:inline">{kunye.telefon}</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <Levha
            ton="yon"
            className="site-yerles site-yerles-3 md:rounded-t-none"
            icClassName="flex flex-col justify-center px-4 py-1.5 sm:px-6 md:px-7"
          >
            <h2 className="sr-only">Yakındaki ulaşım ve merkezlere süreler</h2>
            <ul>
              {ULASIM.map((u) => (
                <VarisSatiri
                  key={u.yer}
                  ikon={<UlasimPiktogrami tur={u.tur} className="h-full w-full" />}
                  yer={u.kisaAd}
                  sure={u.sure}
                />
              ))}
            </ul>
          </Levha>
        </div>
      </section>

      {/* ======================= VARIŞ ======================= */}
      <section aria-labelledby="varis" className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
        <figure>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] border-[3px] border-white sm:aspect-[16/8]">
            <Image
              src="/otopark-giris.webp"
              alt="Londra Camping Otopark girişi: kırmızı Londra Camping Oto Park pankartları, beyaz güvenlik kulübesi ve tel çit"
              fill
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="object-cover object-[42%_55%]"
            />
          </div>
          <figcaption className="mt-6 grid gap-3 md:mt-8 md:grid-cols-[1fr_1fr] md:gap-10">
            <h2 id="varis" className="site-tabela-baslik">
              Girişte bu kırmızı pankartları göreceksiniz
            </h2>
            <p className="max-w-[52ch] text-lg leading-relaxed text-celik-200 md:pt-1">
              Açık hava otopark. Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur.
            </p>
          </figcaption>
        </figure>
      </section>

      {/* ======================= HİZMETLER ======================= */}
      <section aria-labelledby="hizmetler" className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
        <h2 id="hizmetler" className="site-tabela-baslik">
          Hizmetlerimiz
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
          <HizmetLevhasi
            yol="/otopark"
            ikon={<OtoparkIkonu className="h-9 w-9" />}
            baslik={otopark?.baslik ?? "Otopark"}
            aciklama="Saatlik, günlük ve aylık park. Otomobil, SUV, minibüs, kamyonet ve karavan kabul edilir. Düzenli park edenler için aylık abonman: sınırsız giriş çıkış."
          />
          <HizmetLevhasi
            yol="/oto-yikama"
            ikon={<YikamaIkonu className="h-9 w-9" />}
            baslik={yikama?.baslik ?? "Oto yıkama"}
            aciklama="Profesyonel ekip ve ekipmanla iç dış yıkama. Aracınız park ederken yıkanır; işiniz bittiğinde hazırdır."
          />
        </div>
      </section>

      {/* ======================= GÜVENCE (beyaz bilgi levhası) ======================= */}
      <section aria-labelledby="guvence" className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
        <Levha ton="bilgi" icClassName="p-5 text-yol-900 sm:p-8 md:p-10">
          <h2 id="guvence" className="site-tabela-baslik">
            Aracınız emin ellerde
          </h2>
          <ul className="mt-6 grid md:mt-8 md:grid-cols-3 md:gap-10">
            {[
              {
                ikon: <KalkanIkonu className="h-8 w-8" />,
                baslik: "7/24 Güvenlik",
                metin: "Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur.",
              },
              {
                ikon: <KameraIkonu className="h-8 w-8" />,
                baslik: "7/24 Kamera Sistemi",
                metin: "Otoparkımız kesintisiz kamera sistemi ile sürekli izlenmektedir.",
              },
              {
                ikon: <EtiketIkonu className="h-8 w-8" />,
                baslik: "Uygun Fiyatlı Park",
                metin: "Merkezi konumda, bütçenizi zorlamayan saatlik ve günlük park.",
              },
            ].map((m) => (
              <li
                key={m.baslik}
                className="flex gap-4 border-t-2 border-yol-800/15 py-5 md:flex-col md:gap-3 md:border-t-[3px] md:border-yol-800 md:pb-0 md:pt-5"
              >
                <span className="shrink-0 text-levha-500">{m.ikon}</span>
                <span>
                  <span className="block text-xl font-extrabold leading-tight">{m.baslik}</span>
                  <span className="mt-1.5 block text-lg leading-relaxed text-yol-800/85">{m.metin}</span>
                </span>
              </li>
            ))}
          </ul>
        </Levha>
      </section>

      {/* ---- Panelden girilen tanıtım metni ---- */}
      {anasayfa ? (
        <section className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
          <div className="max-w-[65ch] border-t-2 border-white/15 pt-8 text-lg">
            <SiteMetni govde={anasayfa.govde} ton="gece" />
          </div>
        </section>
      ) : null}

      {/* ======================= ÜCRETLER (yalnızca panelden girildiyse) ======================= */}
      {fiyatlar.length > 0 ? (
        <section aria-labelledby="ucretler" className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
          <h2 id="ucretler" className="site-tabela-baslik">
            Ücretler
          </h2>
          <Levha ton="yon" className="mt-8" icClassName="px-5 py-1.5 sm:px-7">
            <ul>
              {fiyatlar.slice(0, 5).map((f) => (
                <li
                  key={f.id}
                  className="flex items-baseline justify-between gap-6 border-t-2 border-white/40 py-4 first:border-t-0"
                >
                  <span className="min-w-0 text-lg font-bold [overflow-wrap:anywhere]">{f.etiket}</span>
                  <span className="shrink-0 text-xl font-extrabold tabular-nums">{f.fiyatMetni}</span>
                </li>
              ))}
            </ul>
          </Levha>
          {fiyatlar.length > 5 ? (
            <Link href="/fiyatlar" className="site-bag mt-6 inline-flex min-h-12 items-center gap-2 text-lg font-extrabold">
              Tüm ücretler <OkIkonu className="h-5 w-5" />
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* ======================= FOTOĞRAFLAR (yalnızca panelden girildiyse) ======================= */}
      {galeri.length > 0 ? (
        <section aria-labelledby="fotograflar" className="site-belir mx-auto w-full max-w-6xl px-4 pb-20 sm:px-8 md:pb-28">
          <h2 id="fotograflar" className="site-tabela-baslik">
            Fotoğraflar
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
            {galeri.map((g) => (
              <GaleriGorseli
                key={g.id}
                url={g.url}
                alt={g.alt}
                className="aspect-[4/3] w-full rounded-[10px] border-2 border-white/80 bg-yol-900 object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ======================= KONUM ======================= */}
      <section aria-labelledby="konum" className="site-belir mx-auto w-full max-w-6xl px-4 pb-24 sm:px-8 md:pb-32">
        <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:gap-12">
          <div>
            <h2 id="konum" className="site-tabela-baslik">
              Konum
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-celik-200">
              Aracınızı bırakın; metrobüs ve metroya birkaç dakikada ulaşın. Fuar ve ticaret
              merkezlerine çok yakınız.
            </p>
            {kunye.adres ? (
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed [overflow-wrap:anywhere]">{kunye.adres}</p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {kunye.mapsUrl ? (
                <a
                  href={kunye.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-basilabilir flex h-16 items-center justify-center gap-3 rounded-[8px] bg-white px-8 text-xl font-black tracking-[0.03em] text-yol-900"
                >
                  YOL TARİFİ AL
                  <OkIkonu className="h-6 w-6" />
                </a>
              ) : null}
              <Link
                href="/iletisim"
                className="site-basilabilir flex h-16 items-center justify-center rounded-[8px] border-2 border-white/70 px-7 text-lg font-bold hover:bg-white/10"
              >
                İletişim bilgileri
              </Link>
            </div>
          </div>

          <Levha ton="ana" icClassName="p-5 sm:p-7">
            <h3 className="text-xl font-extrabold">Yakın çevre</h3>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-6">
              {YAKIN_CEVRE.map((yer) => (
                <li key={yer} className="border-t-2 border-white/25 py-3 text-lg font-bold">
                  {yer}
                </li>
              ))}
            </ul>
          </Levha>
        </div>
      </section>
    </div>
  );
}
