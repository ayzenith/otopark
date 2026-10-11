import Image from "next/image";
import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "./metin";
import { GaleriGorseli } from "./galeri";
import { CEVRE, ULASIM } from "./konum-bilgisi";
import {
  EtiketIkonu,
  FotoIsareti,
  KalkanIkonu,
  KameraIkonu,
  OkIkonu,
  TelefonIkonu,
  VeriGrubu,
  VeriSatiri,
  WhatsappIkonu,
  YikamaIkonu,
} from "./parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

/**
 * SİTE ANA SAYFASI — TEKNİK VERİ (11.10.2026)
 *
 * Londra Camping yeni bir otomobil modeli gibi tanıtılır: tam genişlik
 * gerçek giriş fotoğrafı (üzerinde kulübe, kamera, giriş işaretleri),
 * fotoğrafın kenarına binen model adı, teknik veriler tablosu. Yön
 * sözleşmesi `.impeccable/surfaces/` altında.
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
  const otoparkAdi = otopark?.baslik ?? "Otopark";
  const yikamaAdi = yikama?.baslik ?? "Oto yıkama";

  return (
    <div className="bg-showroom-50 text-yol-950">
      {/* ======================= KAPAK ======================= */}
      <section aria-labelledby="isletme-adi">
        {/* Fotoğraf kutusunun en-boy oranı her kırılma noktasında SABİT:
            kırpım değişmez, işaretler aynı nesnenin üstünde kalır. */}
        <div className="relative mx-auto aspect-[16/10] max-w-[1600px] overflow-hidden md:aspect-[3/1]">
          <Image
            src="/otopark-giris.webp"
            alt="Londra Camping Otopark girişi: kırmızı Londra Camping Oto Park pankartları, beyaz güvenlik kulübesi, kamera direği ve tel çit"
            fill
            priority
            sizes="(min-width: 1600px) 1600px, 100vw"
            className="object-cover object-[40%_50%] md:object-[50%_45%]"
          />
          {/* Etiketler pankartı ÖRTMEZ: sürücü girişi pankarttan tanır. */}
          <FotoIsareti etiket="Güvenlik" mx="8%" my="40%" x="16%" y="48%" gecikme={250} />
          <FotoIsareti etiket="Kamera" mx="63.9%" my="21%" x="61.5%" y="12%" gecikme={400} />
          <FotoIsareti etiket="Giriş" mx="38.1%" my="61%" x="38.3%" y="68%" gecikme={550} sol />
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
          {/* Model adı sekmesi: fotoğrafın alt kenarına biner. */}
          <div className="relative -mt-10 mr-8 bg-showroom-50 pr-4 pt-5 md:-ml-8 md:-mt-24 md:mr-0 md:w-fit md:max-w-full md:pl-8 md:pr-12 md:pt-8">
            <h1 id="isletme-adi" className="site-model text-balance break-words text-yol-800">
              {kunye.isletmeAdi}
            </h1>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                {kunye.calismaSaatleri ? (
                  <p
                    data-test="calisma-saatleri-rozeti"
                    className="site-veri max-w-full rounded-[4px] bg-yol-800 px-3 pb-1.5 pt-2 text-lg leading-none text-white [overflow-wrap:anywhere]"
                  >
                    {kunye.calismaSaatleri}
                  </p>
                ) : null}
                <p className="site-bro-etiket flex flex-wrap items-center gap-x-3 text-levha-500">
                  <span>Açık hava otopark</span>
                  <span aria-hidden className="h-1 w-1 rounded-full bg-levha-500" />
                  <span>Oto yıkama</span>
                </p>
              </div>

              {kunye.mapsUrl || whatsapp || ara ? (
                <div className="mt-6 flex max-w-xl flex-col gap-3">
                  {kunye.mapsUrl ? (
                    <a
                      href={kunye.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-test="yol-tarifi"
                      className="site-basilabilir flex h-16 items-center justify-center gap-3 whitespace-nowrap rounded-[6px] bg-levha-500 px-8 text-lg font-extrabold tracking-[0.06em] text-white [font-stretch:115%] hover:bg-levha-600"
                    >
                      YOL TARİFİ AL
                      <OkIkonu className="h-5 w-5" />
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
                          className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold text-yol-800 hover:bg-yol-800/5"
                        >
                          <WhatsappIkonu className="h-6 w-6" />
                          WhatsApp
                        </a>
                      ) : null}
                      {ara ? (
                        <a
                          href={ara}
                          data-test="ara"
                          className="site-basilabilir flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold text-yol-800 hover:bg-yol-800/5"
                        >
                          <TelefonIkonu className="h-6 w-6 shrink-0" />
                          {/* Numara yarım genişliğe sığmaz; telefonda eylem adı yazar. */}
                          <span className="lg:hidden">Ara</span>
                          <span className="hidden tabular-nums lg:inline">{kunye.telefon}</span>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* TEKNİK VERİLER: broşürün veri sayfası. Gruplar gerçek bilgi
                taşır (hizmet / ulaşım / çevre); hepsi işletme sahibinden. */}
            <div className="min-w-0">
              <h2 id="teknik-veriler" className="site-bro-etiket border-b-2 border-yol-800 pb-3 text-celik-600">
                Teknik veriler
              </h2>
              <table className="w-full border-collapse" aria-labelledby="teknik-veriler">
                <VeriGrubu ad="Hizmet">
                  <VeriSatiri ad="Güvenlik ve kamera" deger="7/24" />
                  <VeriSatiri ad="Oto yıkama" deger="7/24" />
                </VeriGrubu>
                <VeriGrubu ad="Ulaşım">
                  {ULASIM.map((u) => (
                    <VeriSatiri key={u.yer} ad={u.kisaAd} deger={u.sure} />
                  ))}
                </VeriGrubu>
                <VeriGrubu ad="Çevre">
                  {CEVRE.map((c) => (
                    <VeriSatiri key={c.yer} ad={c.yer} deger={c.konum} metin />
                  ))}
                </VeriGrubu>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= HİZMETLER ======================= */}
      <section aria-labelledby="hizmetler" className="site-belir mx-auto w-full max-w-6xl px-4 pt-24 sm:px-8 md:pt-32">
        <h2 id="hizmetler" className="site-bro-baslik text-yol-800">
          Hizmetlerimiz
        </h2>

        <div className="mt-8 border-t-2 border-yol-800">
          {/* Otopark: fotoğrafın kulübe tarafından kırpım */}
          <article className="grid gap-6 border-b border-yol-800/20 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-12 md:py-12">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[4px]">
              <Image
                src="/otopark-giris.webp"
                alt="Otoparkın girişindeki beyaz güvenlik kulübesi ve kırmızı pankartlar"
                fill
                sizes="(min-width: 768px) 520px, 100vw"
                className="scale-[1.35] object-cover object-[10%_62%]"
              />
            </div>
            <HizmetMetni
              ad={otoparkAdi}
              yol="/otopark"
              aciklama="Saatlik, günlük ve aylık park. Düzenli park edenler için aylık abonman: sınırsız giriş çıkış."
              veriler={[
                ["Süre", "Saatlik · Günlük · Aylık"],
                ["Araç", "Otomobil · SUV · Minibüs · Kamyonet · Karavan"],
                ["Açık", "7/24 · Açık hava"],
              ]}
            />
          </article>

          {/* Oto yıkama: fotoğrafı yok; logonun lacivertiyle dolu alan */}
          <article className="grid gap-6 border-b border-yol-800/20 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-12 md:py-12">
            <div className="flex aspect-[4/3] flex-col justify-between rounded-[4px] bg-yol-800 p-6 text-white md:p-8">
              <YikamaIkonu className="h-14 w-14 md:h-16 md:w-16" />
              <p className="site-bro-baslik max-w-[14ch]">Park ederken yıkanır</p>
            </div>
            <HizmetMetni
              ad={yikamaAdi}
              yol="/oto-yikama"
              aciklama="Profesyonel ekip ve ekipmanla iç dış yıkama. Aracınız park ederken yıkanır; işiniz bittiğinde hazırdır."
              veriler={[
                ["Hizmet", "İç dış yıkama"],
                ["Açık", "7/24"],
                ["Ücret", "Araç tipine göre"],
              ]}
            />
          </article>
        </div>
      </section>

      {/* ======================= GÜVENCE (lacivert bant) ======================= */}
      <section aria-labelledby="guvence" className="site-belir mt-24 bg-yol-800 text-white md:mt-32">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-8 md:py-24">
          <h2 id="guvence" className="site-bro-baslik">
            Aracınız emin ellerde
          </h2>
          <ul className="mt-10 grid gap-0 md:grid-cols-3 md:gap-10">
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
              <li key={m.baslik} className="flex gap-4 border-t border-white/25 py-6 md:flex-col md:gap-4 md:border-t-2 md:border-white">
                <span className="shrink-0">{m.ikon}</span>
                <span>
                  <span className="block text-xl font-extrabold leading-tight [font-stretch:110%]">{m.baslik}</span>
                  <span className="mt-2 block text-lg leading-relaxed text-celik-200">{m.metin}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- Panelden girilen tanıtım metni ---- */}
      {anasayfa ? (
        <section className="site-belir mx-auto w-full max-w-6xl px-4 pt-24 sm:px-8 md:pt-32">
          <div className="max-w-[65ch] text-lg">
            <SiteMetni govde={anasayfa.govde} />
          </div>
        </section>
      ) : null}

      {/* ======================= ÜCRETLER (yalnızca panelden girildiyse) ======================= */}
      {fiyatlar.length > 0 ? (
        <section aria-labelledby="ucretler" className="site-belir mx-auto w-full max-w-6xl px-4 pt-24 sm:px-8 md:pt-32">
          <h2 id="ucretler" className="site-bro-baslik text-yol-800">
            Ücretler
          </h2>
          <ul className="mt-8 border-t-2 border-yol-800">
            {fiyatlar.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-baseline justify-between gap-6 border-b border-yol-800/20 py-4">
                <span className="min-w-0 text-lg [overflow-wrap:anywhere]">{f.etiket}</span>
                <span className="site-veri shrink-0 text-xl text-yol-800">{f.fiyatMetni}</span>
              </li>
            ))}
          </ul>
          {fiyatlar.length > 5 ? (
            <Link href="/fiyatlar" className="site-bag mt-6 inline-flex min-h-12 items-center gap-2 text-lg font-bold text-levha-500">
              Tüm ücretler <OkIkonu className="h-4 w-4" />
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* ======================= FOTOĞRAFLAR (yalnızca panelden girildiyse) ======================= */}
      {galeri.length > 0 ? (
        <section aria-labelledby="fotograflar" className="site-belir mx-auto w-full max-w-6xl px-4 pt-24 sm:px-8 md:pt-32">
          <h2 id="fotograflar" className="site-bro-baslik text-yol-800">
            Fotoğraflar
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
            {galeri.map((g) => (
              <GaleriGorseli
                key={g.id}
                url={g.url}
                alt={g.alt}
                className="aspect-[4/3] w-full rounded-[4px] bg-showroom-100 object-cover"
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ======================= KONUM ======================= */}
      <section aria-labelledby="konum" className="site-belir mx-auto w-full max-w-6xl px-4 pb-8 pt-24 sm:px-8 md:pt-32">
        <div className="grid gap-8 border-t-2 border-yol-800 pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <div>
            <h2 id="konum" className="site-bro-baslik text-yol-800">
              Konum
            </h2>
            <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-celik-600">
              Aracınızı bırakın; metrobüs ve metroya birkaç dakikada ulaşın. Fuar ve ticaret
              merkezlerine çok yakınız.
            </p>
            {kunye.adres ? (
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed [overflow-wrap:anywhere]">{kunye.adres}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 md:items-start md:pt-2">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="site-basilabilir flex h-16 items-center justify-center gap-3 rounded-[6px] bg-levha-500 px-8 text-lg font-extrabold tracking-[0.06em] text-white [font-stretch:115%] hover:bg-levha-600 md:min-w-[20rem]"
              >
                YOL TARİFİ AL
                <OkIkonu className="h-5 w-5" />
              </a>
            ) : null}
            <Link
              href="/iletisim"
              className="site-basilabilir flex h-14 items-center justify-center rounded-[6px] border-2 border-yol-800 px-7 text-lg font-bold text-yol-800 hover:bg-yol-800/5 md:min-w-[20rem]"
            >
              İletişim bilgileri
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HizmetMetni({
  ad,
  yol,
  aciklama,
  veriler,
}: {
  ad: string;
  yol: string;
  aciklama: string;
  veriler: [string, string][];
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <h3 className="text-[clamp(2rem,4.6vw,3.25rem)] font-black uppercase leading-[0.95] text-yol-800 [font-stretch:125%] [overflow-wrap:anywhere]">
        {ad}
      </h3>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-celik-600">{aciklama}</p>
      <dl className="mt-6">
        {veriler.map(([k, v]) => (
          <div key={k} className="flex gap-4 border-t border-yol-800/15 py-2.5">
            <dt className="site-bro-etiket w-20 shrink-0 pt-1 text-celik-600">{k}</dt>
            <dd className="min-w-0 text-lg font-semibold text-yol-800">{v}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={yol}
        aria-label={`${ad}: ayrıntılar`}
        className="site-basilabilir mt-6 inline-flex min-h-12 items-center gap-2 self-start text-lg font-extrabold text-levha-500 [font-stretch:110%] hover:text-levha-600"
      >
        Ayrıntılar
        <OkIkonu className="h-4 w-4" />
      </Link>
    </div>
  );
}
