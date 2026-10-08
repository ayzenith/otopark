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
      <section className="relative overflow-hidden bg-murekkep-950 text-kagit-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-36 h-[28rem] w-[28rem] rounded-full bg-sinyal-500/12 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
          <p className="site-gir site-etiket text-sinyal-400">Hizmetimiz</p>
          <h1 className="site-gir site-gir-1 site-dev mt-6 text-balance">
            Güvenlikli, kameralı otopark
          </h1>
          <p className="site-gir site-gir-2 site-govde mt-7 max-w-2xl text-kagit-200/80">
            Aracınızı rastgele bir boşluğa değil, gece gündüz göz önünde duran bir otoparka
            bırakın. Profesyonel güvenlik ekibimiz ve kesintisiz kamera sistemimiz 7 gün 24 saat
            iş başında.
          </p>
        </div>
      </section>

      {/* ---- Güvenlik ---- */}
            <Bolum numara="01" etiket="Güvenlik" baslik="Aracınız göz önünde" className="site-belir pt-20 sm:pt-28">
        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-12">
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

        <ul className="mt-12 grid gap-x-12 sm:grid-cols-2">
          <OnayliMadde>Her araç giriş ve çıkışı fiş numarasıyla kayıt altına alınır</OnayliMadde>
          <OnayliMadde>Gece, hafta sonu ve bayram fark etmez; aynı güvenlik</OnayliMadde>
          <OnayliMadde>Aracınızı teslim ederken plakanız kayda geçer</OnayliMadde>
          <OnayliMadde>Ücret çıkışta, aracınızı teslim alırken ödenir</OnayliMadde>
        </ul>
      </Bolum>
      
      {/* ---- Park seçenekleri ---- */}
            <Bolum
        numara="02"
        etiket="Park seçenekleri"
        baslik="Bir saat de olur, bir ay da"
        className="site-belir pt-20 sm:pt-28"
      >
        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
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

        <p className="mt-10 max-w-xl leading-relaxed text-murekkep-700/75">
          Abonman fiyatı araç tipine ve kullanımınıza göre belirlenir. Size özel fiyat için arayın
          ya da WhatsApp&apos;tan yazın.
        </p>
      </Bolum>
      
      {/* ---- Konum ---- */}
            <Bolum className="site-belir pt-20 sm:pt-28">
        <div className="relative overflow-hidden rounded-2xl bg-murekkep-900 p-8 text-kagit-50 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-sinyal-500/12 blur-3xl"
          />
          <p className="site-etiket flex items-center gap-3 text-sinyal-400">
            <span className="text-kagit-50/30">03</span> Konum
          </p>
          <h2 className="site-baslik mt-4 text-balance">Merkezi konum, kolay ulaşım</h2>
          <p className="site-govde mt-5 max-w-xl text-kagit-200/75">
            Aracınızı bırakıp toplu taşımaya yürüyerek geçebilirsiniz. Şehir merkezine inmek için
            otoparkta yer aramakla uğraşmayın.
          </p>

          {kunye.adres ? (
            <p className="mt-5 max-w-xl text-kagit-200/70">{kunye.adres}</p>
          ) : null}

          <ul className="relative mt-10">
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
        </div>
      </Bolum>
      
      {/* ---- Panelden girilen metin ---- */}
      {sayfa ? (
                <Bolum className="site-belir pt-20 sm:pt-28">
          <div className="max-w-2xl border-t border-murekkep-900/12 pt-10">
            <h2 className="site-baslik text-murekkep-900">{sayfa.baslik}</h2>
            <div className="mt-6 text-murekkep-700/85">
              <SiteMetni govde={sayfa.govde} />
            </div>
          </div>
        </Bolum>
              ) : null}

      {/* ---- İletişim ---- */}
            <Bolum className="site-belir pt-20 sm:pt-28">
        <IletisimKutusu
          mapsUrl={kunye.mapsUrl}
          whatsappHref={whatsapp}
          telHref={ara}
          telefon={kunye.telefon}
          baslik="Yer ayırtmak ya da fiyat sormak için"
          aciklama="Abonman, karavan ve uzun süreli park için bize ulaşın. 7/24 açığız."
        />
      </Bolum>
      
      {/* Sayfa imzası: mürekkep rengin en açık tonunda, sessiz bir nokta. */}
      <div aria-hidden className="mx-auto mt-20 flex max-w-5xl justify-center px-6 text-murekkep-900/10">
        <OtoparkIkonu className="h-10 w-10" />
      </div>
    </>
  );
}
