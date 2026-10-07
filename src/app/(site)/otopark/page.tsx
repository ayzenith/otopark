import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "../metin";
import {
  AbonmanIkonu,
  BinaIkonu,
  Bolum,
  HizmetKarti,
  IletisimKutusu,
  KalkanIkonu,
  KameraIkonu,
  KaravanIkonu,
  OnayliMadde,
  OtoparkIkonu,
  SaatIkonu,
  UlasimSatiri,
  YuruyusIkonu,
} from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Otopark",
  description: "7/24 güvenlikli, kameralı ve merkezi konumda otopark.",
};

/**
 * OTOPARK SAYFASI
 *
 * ============================================================================
 * İÇERİĞİN KAYNAĞI: işletme sahibinin 05-06.10.2026 tarihli ifadeleri.
 *   · "Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur"
 *   · "Otoparkımız kesintisiz kamera sistemi ile sürekli izlenmektedir"
 *   · "Uygun fiyatlı park"
 *   · Konum: metrobüse 2 dk, metroya 3 dk, Nef Selenium Ataköy Towers
 *     hemen arkası, Kültür Üniversitesi / Airport AVM arkası
 * Park seçenekleri (saatlik/günlük/aylık, karavan, abonman) sistemdeki
 * TANIMLI tarifelerden gelir — uydurma hizmet yazılmadı.
 *
 * FİYAT YAZILMAZ (karar S19). Patron panelden fiyat satırı eklerse Fiyatlar
 * sayfasında görünür.
 * ============================================================================
 */
export default async function OtoparkSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <>
      {/* ---- Başlık ---- */}
      <section className="relative overflow-hidden bg-lacivert-700 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-mavi-500/25 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-10 sm:pb-16 sm:pt-14">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mavi-300">Hizmetimiz</p>
          <h1 className="mt-2 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Güvenlikli, kameralı otopark
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-lacivert-100 sm:text-xl">
            Aracınızı rastgele bir boşluğa değil, gece gündüz göz önünde duran bir otoparka
            bırakın. Profesyonel güvenlik ekibimiz ve kesintisiz kamera sistemimiz 7 gün 24 saat
            iş başında.
          </p>
        </div>
      </section>

      {/* ---- Güvenlik ---- */}
      <Bolum etiket="Güvenlik" baslik="Aracınız göz önünde" className="pt-14 sm:pt-20">
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <HizmetKarti
            ikon={<KalkanIkonu className="h-8 w-8" />}
            baslik="7/24 güvenlik ekibi"
            aciklama="Aracınız profesyonel güvenlik ekibimiz tarafından 7 gün 24 saat korunur. Otopark hiçbir saat sahipsiz kalmaz."
          />
          <HizmetKarti
            ikon={<KameraIkonu className="h-8 w-8" />}
            baslik="Kesintisiz kamera sistemi"
            aciklama="Otoparkımız kamera sistemiyle sürekli izlenmektedir. Giriş çıkışlar ve park alanı kayıt altındadır."
          />
        </div>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          <OnayliMadde>Her araç giriş ve çıkışı fiş numarasıyla kayıt altına alınır</OnayliMadde>
          <OnayliMadde>Gece, hafta sonu ve bayram fark etmez; aynı güvenlik</OnayliMadde>
          <OnayliMadde>Aracınızı teslim ederken plakanız kayda geçer</OnayliMadde>
          <OnayliMadde>Ücret çıkışta, aracınızı teslim alırken ödenir</OnayliMadde>
        </ul>
      </Bolum>

      {/* ---- Park seçenekleri ---- */}
      <Bolum etiket="Park seçenekleri" baslik="Bir saat de olur, bir ay da" className="pt-14 sm:pt-20">
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <HizmetKarti
            ikon={<SaatIkonu className="h-8 w-8" />}
            baslik="Saatlik ve günlük"
            aciklama="Kısa işiniz için bir saat, yolculuk için günlerce. Süreniz dakikası dakikasına hesaplanır."
          />
          <HizmetKarti
            ikon={<KaravanIkonu className="h-8 w-8" />}
            baslik="Karavan ve büyük araç"
            aciklama="Karavan, minibüs ve kamyonet kabul edilir. Karavanlar için ayrı günlük fiyatlandırma uygulanır."
          />
          <HizmetKarti
            ikon={<AbonmanIkonu className="h-8 w-8" />}
            baslik="Aylık abonman"
            aciklama="Her gün park ediyorsanız abonman avantajlıdır: 7/24 geçerli, sınırsız giriş çıkış."
          />
        </div>

        <p className="mt-6 text-slate-600">
          Abonman fiyatı araç tipine ve kullanımınıza göre belirlenir. Size özel fiyat için arayın
          ya da WhatsApp&apos;tan yazın.
        </p>
      </Bolum>

      {/* ---- Konum ---- */}
      <Bolum className="pt-14 sm:pt-20">
        <div className="overflow-hidden rounded-3xl bg-lacivert-600 p-7 text-white sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mavi-300">Konum</p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
            Merkezi konum, kolay ulaşım
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-lacivert-100">
            Aracınızı bırakıp toplu taşımaya yürüyerek geçebilirsiniz. Şehir merkezine inmek için
            otoparkta yer aramakla uğraşmayın.
          </p>

          {kunye.adres ? (
            <p className="mt-4 max-w-xl text-lacivert-100">{kunye.adres}</p>
          ) : null}

          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            <UlasimSatiri
              ikon={<YuruyusIkonu className="h-6 w-6" />}
              yer="Metrobüs"
              mesafe="Yürüyerek 2 dakika"
            />
            <UlasimSatiri
              ikon={<YuruyusIkonu className="h-6 w-6" />}
              yer="Metro"
              mesafe="Yürüyerek 3 dakika"
            />
            <UlasimSatiri
              ikon={<BinaIkonu className="h-6 w-6" />}
              yer="Nef Selenium Ataköy Towers"
              mesafe="Hemen arkasında"
            />
            <UlasimSatiri
              ikon={<BinaIkonu className="h-6 w-6" />}
              yer="Kültür Üniversitesi · Airport AVM"
              mesafe="Hemen arkasında"
            />
          </ul>
        </div>
      </Bolum>

      {/* ---- Panelden girilen metin ---- */}
      {sayfa ? (
        <Bolum className="pt-14 sm:pt-20">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-9">
            <h2 className="text-2xl font-bold text-lacivert-700">{sayfa.baslik}</h2>
            <div className="mt-4">
              <SiteMetni govde={sayfa.govde} />
            </div>
          </div>
        </Bolum>
      ) : null}

      {/* ---- İletişim ---- */}
      <Bolum className="pb-16 pt-14 sm:pt-20">
        <IletisimKutusu
          mapsUrl={kunye.mapsUrl}
          whatsappHref={whatsapp}
          telHref={ara}
          telefon={kunye.telefon}
          baslik="Yer ayırtmak ya da fiyat sormak için"
          aciklama="Abonman, karavan ve uzun süreli park için bize ulaşın. 7/24 açığız."
        />
      </Bolum>

      {/* Hizmet ikonunun sayfada hiç kullanılmaması tuhaf durmasın diye
          başlıkta değil, burada küçük bir imza olarak durur. */}
      <div aria-hidden className="mx-auto mb-10 flex max-w-5xl justify-center px-5 text-lacivert-100">
        <OtoparkIkonu className="h-10 w-10" />
      </div>
    </>
  );
}
