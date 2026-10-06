import Link from "next/link";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "./metin";
import {
  AbonmanIkonu,
  Bolum,
  HizmetKarti,
  KaravanIkonu,
  KonumIkonu,
  OtoparkIkonu,
  OzellikSatiri,
  SaatIkonu,
  TelefonIkonu,
  WhatsappIkonu,
  YikamaIkonu,
} from "./parcalar";

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
 * İŞLETMENİN KARARLARI (05-06.10.2026):
 *   · "7/24 otopark ve oto yıkama" bilgisi EN ÜSTTE, kesin olarak görünecek
 *   · Ziyaretçi tek dokunuşla yol tarifi alabilecek (ana eylem)
 *   · Sitede FİYAT YAZILMAYACAK
 * ============================================================================
 *
 * Tasarım notu: telefonda ekranın altında SABİT bir eylem çubuğu durur
 * (yol tarifi + WhatsApp). Ziyaretçi sayfanın neresinde olursa olsun
 * aramak ya da yola çıkmak için yukarı kaydırmak zorunda kalmaz.
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
    <>
      {/* ================= VİTRİN ================= */}
      <section className="relative overflow-hidden bg-lacivert-700 text-white">
        {/* Derinlik: koyu zemin üzerinde iki yumuşak ışık. Fotoğraf gelene
            kadar sayfayı taşıyan görsel öğe budur. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-mavi-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-400/15 blur-3xl"
        />

        <div className="relative mx-auto w-full max-w-5xl px-5 pb-14 pt-10 sm:pb-20 sm:pt-16">
          {kunye.calismaSaatleri ? (
            <p
              data-test="calisma-saatleri-rozeti"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              {kunye.calismaSaatleri}
            </p>
          ) : null}

          <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            {kunye.isletmeAdi}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-lacivert-100 sm:text-xl">
            Aracınızı güvenle bırakın, tertemiz teslim alın. Otopark ve oto yıkama tek noktada.
          </p>

          {/* ---- Ana eylemler ---- */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-test="yol-tarifi"
                className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-white px-7 text-lg font-extrabold text-lacivert-700 shadow-lg shadow-black/20 transition-transform active:scale-[0.98] sm:text-xl"
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
                className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-7 text-lg font-bold text-white transition-transform active:scale-[0.98]"
              >
                <WhatsappIkonu className="h-6 w-6" />
                WhatsApp
              </a>
            ) : null}

            {ara ? (
              <a
                href={ara}
                data-test="ara"
                className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl px-7 text-lg font-bold text-white ring-2 ring-inset ring-white/30 transition-colors hover:bg-white/10"
              >
                <TelefonIkonu className="h-6 w-6" />
                {kunye.telefon}
              </a>
            ) : null}
          </div>

          {/* ---- Kısa güven bilgileri: hepsi sistemde tanımlı GERÇEK hizmetler ---- */}
          <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
            <OzellikSatiri
              ikon={<SaatIkonu className="h-6 w-6" />}
              baslik="Kesintisiz hizmet"
              aciklama="Gece gündüz fark etmez, kapımız her saat açık."
            />
            <OzellikSatiri
              ikon={<KaravanIkonu className="h-6 w-6" />}
              baslik="Karavan kabul"
              aciklama="Karavanınız için ayrı ve geniş park alanı."
            />
            <OzellikSatiri
              ikon={<AbonmanIkonu className="h-6 w-6" />}
              baslik="Aylık abonman"
              aciklama="Düzenli park edenler için sınırsız giriş çıkış."
            />
          </div>
        </div>

        {/* Alt kenara yumuşak geçiş */}
        <div aria-hidden className="h-8 bg-gradient-to-b from-transparent to-white/5" />
      </section>

      {/* ================= HİZMETLER ================= */}
      <Bolum etiket="Hizmetlerimiz" baslik="İki iş, tek durak" className="pt-14 sm:pt-20">
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <HizmetKarti
            ikon={<OtoparkIkonu className="h-8 w-8" />}
            baslik={otopark?.baslik ?? "Otopark"}
            aciklama="Saatlik, günlük ve aylık park. Otomobil, SUV, minibüs ve karavan kabul edilir."
          />
          <HizmetKarti
            ikon={<YikamaIkonu className="h-8 w-8" />}
            baslik={yikama?.baslik ?? "Oto yıkama"}
            aciklama="İç dış yıkama ve ek hizmetler. Siz işinizi hallederken aracınız hazır olur."
          />
        </div>
      </Bolum>

      {/* ---- Panelden girilen tanıtım metinleri ---- */}
      {anasayfa || otopark || yikama ? (
        <Bolum className="pt-14 sm:pt-20">
          <div className="space-y-10 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-9">
            {anasayfa ? <SiteMetni govde={anasayfa.govde} /> : null}

            {otopark ? (
              <div>
                <h3 className="text-2xl font-bold text-lacivert-700">{otopark.baslik}</h3>
                <div className="mt-3">
                  <SiteMetni govde={otopark.govde} />
                </div>
              </div>
            ) : null}

            {yikama ? (
              <div>
                <h3 className="text-2xl font-bold text-lacivert-700">{yikama.baslik}</h3>
                <div className="mt-3">
                  <SiteMetni govde={yikama.govde} />
                </div>
              </div>
            ) : null}
          </div>
        </Bolum>
      ) : null}

      {/* ================= FİYATLAR (yalnızca patron yazdıysa) ================= */}
      {fiyatlar.length > 0 ? (
        <Bolum etiket="Fiyatlar" baslik="Ne kadar?" className="pt-14 sm:pt-20">
          <ul className="mt-8 divide-y divide-slate-200 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200">
            {fiyatlar.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 px-6 py-5">
                <span className="font-semibold text-lacivert-700">{f.etiket}</span>
                <span className="text-xl font-extrabold text-lacivert-700">{f.fiyatMetni}</span>
              </li>
            ))}
          </ul>
          {fiyatlar.length > 5 ? (
            <Link
              href="/fiyatlar"
              className="mt-4 inline-block font-semibold text-mavi-700 underline"
            >
              Tüm fiyatlar
            </Link>
          ) : null}
        </Bolum>
      ) : null}

      {/* ================= GALERİ ================= */}
      {galeri.length > 0 ? (
        <Bolum etiket="Galeri" baslik="Buradayız" className="pt-14 sm:pt-20">
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {galeri.map((g) => (
              /* eslint-disable-next-line @next/next/no-img-element --
                 Görseller panelden girilen serbest adreslerdir (yerel dosya ya
                 da dış bağlantı); next/image uzak alan adı için yapılandırma
                 ister ve hangi alan adının kullanılacağı henüz belli değil. */
              <img
                key={g.id}
                src={g.url}
                alt={g.alt}
                loading="lazy"
                className="h-44 w-full rounded-2xl object-cover ring-1 ring-slate-200"
              />
            ))}
          </div>
        </Bolum>
      ) : null}

      {/* ================= KONUM ================= */}
      <Bolum className="pt-14 sm:pt-20">
        <div className="overflow-hidden rounded-3xl bg-lacivert-600 text-white">
          <div className="p-7 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-mavi-300">Konum</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
              Yola çıkın, biz buradayız
            </h2>

            {kunye.adres ? (
              <p className="mt-4 max-w-md text-lg leading-relaxed text-lacivert-100">
                {kunye.adres}
              </p>
            ) : null}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {kunye.mapsUrl ? (
                <a
                  href={kunye.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-white px-7 text-lg font-extrabold text-lacivert-700"
                >
                  <KonumIkonu className="h-6 w-6" />
                  YOL TARİFİ AL
                </a>
              ) : null}
              <Link
                href="/iletisim"
                className="inline-flex h-16 items-center justify-center rounded-2xl px-7 text-lg font-bold text-white ring-2 ring-inset ring-white/30"
              >
                İletişim bilgileri
              </Link>
            </div>
          </div>
        </div>
      </Bolum>

      {/* ================= SABİT EYLEM ÇUBUĞU (telefon) ================= */}
      {kunye.mapsUrl || whatsapp || ara ? (
        <div
          data-test="sabit-eylem-cubugu"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden"
        >
          <div className="flex gap-2">
            {kunye.mapsUrl ? (
              <a
                href={kunye.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-lacivert-600 font-bold text-white"
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
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
              >
                <WhatsappIkonu className="h-5 w-5" />
                WhatsApp
              </a>
            ) : null}
            {ara ? (
              <a
                href={ara}
                aria-label="Telefonla ara"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ring-2 ring-inset ring-lacivert-600 text-lacivert-700"
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
