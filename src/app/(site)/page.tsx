import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "./metin";
import { Belir } from "./belir";
import {
  BinaIkonu,
  Bolum,
  EtiketIkonu,
  HizmetKarti,
  KalkanIkonu,
  KameraIkonu,
  KonumIkonu,
  OtoparkIkonu,
  OzellikSatiri,
  TelefonIkonu,
  UlasimSatiri,
  WhatsappIkonu,
  YikamaIkonu,
  YuruyusIkonu,
} from "./parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

/**
 * SİTE ANA SAYFASI
 *
 * ============================================================================
 * İŞLETMENİN KARARLARI (05-07.10.2026) — içerik bunlardan ibarettir:
 *   · "7/24 otopark ve oto yıkama" bilgisi en üstte, kesin olarak görünür
 *   · Ziyaretçi tek dokunuşla yol tarifi alabilir (ana eylem)
 *   · Sitede FİYAT YAZILMAZ
 *   · 7/24 güvenlik · kamera sistemi · uygun fiyat · merkezi konum
 *
 * TASARIM: mürekkep zeminli tam ekran vitrin, kâğıt gövde, tek sinyal rengi.
 * Vitrindeki öğeler sırayla (stagger) yükselerek girer; aşağıdaki bölümler
 * görünür alana girdikçe belirir. Hareketin tamamı 300–620ms arasında ve
 * ease-out: giren öğede ease-in arayüzü ağır hissettirir.
 *
 * Girilmemiş hiçbir bilgi UYDURULMAZ (mimari kural 19).
 * ============================================================================
 */
export default async function SiteAnaSayfa() {
  const { kunye, sayfalar, fiyatlar, galeri } = await siteIcerigi();
  const anasayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ANASAYFA];
  const otopark = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];
  const yikama = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <>
      {/* ======================= VİTRİN ======================= */}
      <section className="relative overflow-hidden bg-murekkep-950 text-kagit-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-sinyal-500/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-48 -left-24 h-96 w-96 rounded-full bg-mavi-500/10 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20">
          {kunye.calismaSaatleri ? (
            <p
              data-test="calisma-saatleri-rozeti"
              className="site-gir site-etiket inline-flex items-center gap-2.5 text-sinyal-400"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sinyal-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sinyal-400" />
              </span>
              {kunye.calismaSaatleri}
            </p>
          ) : null}

          <h1 className="site-gir site-gir-1 site-dev mt-7 text-balance">{kunye.isletmeAdi}</h1>

          {/* İşletme sahibinin verdiği bilgilerle kurulmuş tek cümle:
              önce konum, sonra güvenlik, sonra yıkama. */}
          <p className="site-gir site-gir-2 site-govde mt-7 max-w-xl text-kagit-200/80">
            Metrobüse 2, metroya 3 dakika. 7/24 güvenlik ve kamera sistemiyle korunan otopark;
            yanında profesyonel oto yıkama. Aracınız emin ellerde.
          </p>

          <div className="site-gir site-gir-3 mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-test="yol-tarifi"
                className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-sinyal-400 px-8 text-lg font-extrabold tracking-tight text-murekkep-950 sm:text-xl"
              >
                <KonumIkonu className="h-6 w-6" />
                YOL TARİFİ AL
              </a>
            ) : null}

            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                data-test="whatsapp"
                className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl px-8 text-lg font-bold ring-1 ring-inset ring-kagit-50/25 transition-colors duration-200 hover:bg-kagit-50/10"
              >
                <WhatsappIkonu className="h-6 w-6" />
                WhatsApp
              </a>
            ) : null}

            {ara ? (
              <a
                href={ara}
                data-test="ara"
                className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl px-8 text-lg font-bold ring-1 ring-inset ring-kagit-50/25 transition-colors duration-200 hover:bg-kagit-50/10"
              >
                <TelefonIkonu className="h-6 w-6" />
                {kunye.telefon}
              </a>
            ) : null}
          </div>

          {/* Üç güven bilgisi: hepsi işletmenin kendi ifadeleri. */}
          <div className="site-gir site-gir-4 mt-16 grid gap-8 sm:grid-cols-3 sm:gap-10">
            <OzellikSatiri
              ikon={<KalkanIkonu className="h-7 w-7" />}
              baslik="7/24 Güvenlik"
              aciklama="Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur."
            />
            <OzellikSatiri
              ikon={<KameraIkonu className="h-7 w-7" />}
              baslik="7/24 Kamera Sistemi"
              aciklama="Otoparkımız kesintisiz kamera sistemi ile sürekli izlenmektedir."
            />
            <OzellikSatiri
              ikon={<EtiketIkonu className="h-7 w-7" />}
              baslik="Uygun Fiyatlı Park"
              aciklama="Merkezi konumda, bütçenizi zorlamayan saatlik ve günlük park."
            />
          </div>
        </div>
      </section>

      {/* ======================= HİZMETLER ======================= */}
      <Belir>
        <Bolum
          numara="01"
          etiket="Hizmetlerimiz"
          baslik="Güvenli park, profesyonel yıkama"
          className="pt-20 sm:pt-28"
        >
          <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-12">
            <HizmetKarti
              yol="/otopark"
              ikon={<OtoparkIkonu className="h-8 w-8" />}
              baslik={otopark?.baslik ?? "Otopark"}
              aciklama="Saatlik, günlük ve aylık park. Otomobil, SUV, minibüs ve karavan kabul edilir. Düzenli park edenler için aylık abonman: sınırsız giriş çıkış."
            />
            <HizmetKarti
              yol="/oto-yikama"
              ikon={<YikamaIkonu className="h-8 w-8" />}
              baslik={yikama?.baslik ?? "Oto yıkama"}
              aciklama="Profesyonel ekip ve ekipmanla iç dış yıkama. Park süresi boyunca aracınız bakımlı hale gelir; siz işinizi hallederken hazır olur."
            />
          </div>
        </Bolum>
      </Belir>

      {/* ---- Panelden girilen tanıtım metni ---- */}
      {anasayfa ? (
        <Belir>
          <Bolum className="pt-20 sm:pt-28">
            <div className="max-w-2xl border-t border-murekkep-900/12 pt-10 text-murekkep-700/85">
              <SiteMetni govde={anasayfa.govde} />
            </div>
          </Bolum>
        </Belir>
      ) : null}

      {/* ======================= FİYATLAR ======================= */}
      {fiyatlar.length > 0 ? (
        <Belir>
          <Bolum numara="02" etiket="Fiyatlar" baslik="Ne kadar?" className="pt-20 sm:pt-28">
            <ul className="mt-10">
              {fiyatlar.slice(0, 5).map((f) => (
                <li
                  key={f.id}
                  className="flex items-baseline justify-between gap-6 border-t border-murekkep-900/12 py-5"
                >
                  <span className="font-semibold text-murekkep-900">{f.etiket}</span>
                  <span className="text-xl font-extrabold tracking-tight text-murekkep-900">
                    {f.fiyatMetni}
                  </span>
                </li>
              ))}
            </ul>
            {fiyatlar.length > 5 ? (
              <Link href="/fiyatlar" className="site-bag mt-6 inline-block font-bold text-sinyal-600">
                Tüm fiyatlar →
              </Link>
            ) : null}
          </Bolum>
        </Belir>
      ) : null}

      {/* ======================= GALERİ ======================= */}
      {galeri.length > 0 ? (
        <Belir>
          <Bolum numara="03" etiket="Galeri" baslik="Buradayız" className="pt-20 sm:pt-28">
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {galeri.map((g) => (
                /* eslint-disable-next-line @next/next/no-img-element --
                   Görseller panelden girilen serbest adreslerdir; next/image
                   uzak alan adı yapılandırması ister ve hangi alan adının
                   kullanılacağı henüz belli değil. */
                <img
                  key={g.id}
                  src={g.url}
                  alt={g.alt}
                  loading="lazy"
                  className="h-48 w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </Bolum>
        </Belir>
      ) : null}

      {/* ======================= KONUM ======================= */}
      <Belir>
        <Bolum className="pt-20 sm:pt-28">
          <div className="relative overflow-hidden rounded-2xl bg-murekkep-900 p-8 text-kagit-50 sm:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sinyal-500/12 blur-3xl"
            />
            <div className="relative">
              <p className="site-etiket flex items-center gap-3 text-sinyal-400">
                <span className="text-kagit-50/30">04</span> Konum
              </p>
              <h2 className="site-baslik mt-4 text-balance">Şehrin tam merkezinde</h2>
              <p className="site-govde mt-5 max-w-xl text-kagit-200/75">
                Aracınızı bırakıp toplu taşımaya yürüyerek geçin. Merkeze inmek için otoparkta yer
                aramakla uğraşmayın.
              </p>

              {kunye.adres ? (
                <p className="mt-5 max-w-xl text-kagit-200/70">{kunye.adres}</p>
              ) : null}

              {/* Ulaşım bilgileri — işletme sahibi, 06.10.2026. */}
              <ul className="mt-10">
                <UlasimSatiri
                  ikon={<YuruyusIkonu className="h-6 w-6" />}
                  yer="Metrobüs"
                  mesafe="2 dakika"
                />
                <UlasimSatiri
                  ikon={<YuruyusIkonu className="h-6 w-6" />}
                  yer="Metro"
                  mesafe="3 dakika"
                />
                <UlasimSatiri
                  ikon={<BinaIkonu className="h-6 w-6" />}
                  yer="Nef Selenium Ataköy Towers"
                  mesafe="Hemen arkası"
                />
                <UlasimSatiri
                  ikon={<BinaIkonu className="h-6 w-6" />}
                  yer="Kültür Üniversitesi · Airport AVM"
                  mesafe="Hemen arkası"
                />
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                {kunye.mapsUrl ? (
                  <a
                    href={kunye.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-sinyal-400 px-8 text-lg font-extrabold tracking-tight text-murekkep-950"
                  >
                    <KonumIkonu className="h-6 w-6" />
                    YOL TARİFİ AL
                  </a>
                ) : null}
                <Link
                  href="/iletisim"
                  className="site-basilabilir inline-flex h-16 items-center justify-center rounded-xl px-8 text-lg font-bold ring-1 ring-inset ring-kagit-50/25 transition-colors duration-200 hover:bg-kagit-50/10"
                >
                  İletişim bilgileri
                </Link>
              </div>
            </div>
          </div>
        </Bolum>
      </Belir>

      {/* ============ SABİT EYLEM ÇUBUĞU (telefon) ============
          Sayfa açılır açılmaz değil, 700ms sonra aşağıdan kayarak gelir:
          önce içerik görünür, sonra eylem sunulur. */}
      {kunye.mapsUrl || whatsapp || ara ? (
        <div
          data-test="sabit-eylem-cubugu"
          className="site-alt-cubuk fixed inset-x-0 bottom-0 z-40 border-t border-murekkep-900/10 bg-kagit-50/95 p-3 backdrop-blur sm:hidden"
        >
          <div className="flex gap-2">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2 rounded-lg bg-murekkep-950 font-bold text-kagit-50"
              >
                <KonumIkonu className="h-5 w-5" />
                Yol tarifi
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2 rounded-lg ring-1 ring-inset ring-murekkep-900/20 font-bold text-murekkep-900"
              >
                <WhatsappIkonu className="h-5 w-5" />
                WhatsApp
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla ara"
                className="site-basilabilir flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-sinyal-400 text-murekkep-950"
              >
                <TelefonIkonu className="h-6 w-6" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
