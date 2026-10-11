import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "../metin";
import {
  AbonmanIkonu,
  Bolum,
  HizmetKarti,
  IletisimKutusu,
  KalkanIkonu,
  KameraIkonu,
  KaravanIkonu,
  KonumTablosu,
  OnayliMadde,
  SaatIkonu,
  SayfaKapagi,
} from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Otopark",
  description: "7/24 güvenlikli, kameralı, açık hava otopark.",
};

/**
 * OTOPARK SAYFASI — TEKNİK VERİ (11.10.2026)
 *
 * İÇERİĞİN KAYNAĞI: işletme sahibinin 05-11.10.2026 ifadeleri (güvenlik ve
 * kamera cümleleri, konum, açık hava, kamyonet, abonman müşteriye özel).
 * Park seçenekleri sistemdeki TANIMLI tarifelerden gelir. Ücret "başlayan
 * saat" üzerinden hesaplanır; "dakikası dakikasına" denmez.
 *
 * FİYAT YAZILMAZ (karar S19). YER AYIRTMA hizmeti YOK (11.10.2026).
 */
export default async function OtoparkSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <div className="bg-showroom-50 text-yol-950">
      <SayfaKapagi
        mapsUrl={kunye.mapsUrl}
        baslik="Güvenlikli, kameralı otopark"
        giris="Açık hava otopark; profesyonel güvenlik ekibimiz ve kesintisiz kamera sistemimiz 7 gün 24 saat iş başında. Aracınız hiçbir saat sahipsiz kalmaz."
        gorsel={{
          konum: "12% 45%",
          alt: "Otopark girişindeki beyaz güvenlik kulübesi, kamera direği ve kırmızı Londra Camping pankartları",
        }}
      />

      <Bolum baslik="Aracınız göz önünde" className="site-belir pt-20 md:pt-28">
        <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
          <HizmetKarti
            ikon={<KalkanIkonu className="h-8 w-8" />}
            baslik="7/24 güvenlik ekibi"
            aciklama="Aracınız profesyonel güvenlik ekibimiz tarafından 7/24 korunur."
          />
          <HizmetKarti
            ikon={<KameraIkonu className="h-8 w-8" />}
            baslik="Kesintisiz kamera sistemi"
            aciklama="Otoparkımız kesintisiz kamera sistemi ile sürekli izlenmektedir."
          />
        </div>

        <ul className="mt-10 grid gap-x-12 md:grid-cols-2">
          <OnayliMadde>Her araç giriş ve çıkışı fiş numarasıyla kayıt altına alınır</OnayliMadde>
          <OnayliMadde>Aracınızı teslim ederken plakanız kayda geçer</OnayliMadde>
          <OnayliMadde>Gece, hafta sonu ve bayram fark etmez; aynı güvenlik</OnayliMadde>
          <OnayliMadde>Ücret çıkışta, aracınızı teslim alırken ödenir</OnayliMadde>
        </ul>
      </Bolum>

      <Bolum baslik="Bir saat de olur, bir ay da" className="site-belir pt-20 md:pt-28">
        <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          <HizmetKarti
            ikon={<SaatIkonu className="h-8 w-8" />}
            baslik="Saatlik ve günlük"
            aciklama="Kısa işiniz için bir saat, yolculuk için günlerce. Ücret kalış sürenize göre hesaplanır."
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

        <p className="mt-10 max-w-xl text-lg leading-relaxed text-celik-600">
          Abonman fiyatı size özel belirlenir. Bilgi almak için arayın ya da WhatsApp&apos;tan yazın.
        </p>
      </Bolum>

      <Bolum baslik="Konum" className="site-belir pt-20 md:pt-28">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <div className="pt-6">
            <p className="max-w-[48ch] text-lg leading-relaxed text-celik-600">
              Aracınızı bırakın; metrobüs ve metroya birkaç dakikada ulaşın. Fuar ve ticaret
              merkezlerine çok yakınız.
            </p>
            {kunye.adres ? (
              <p className="mt-4 max-w-[48ch] text-lg leading-relaxed [overflow-wrap:anywhere]">{kunye.adres}</p>
            ) : null}
          </div>
          <KonumTablosu />
        </div>
      </Bolum>

      {sayfa ? (
        <Bolum baslik={sayfa.baslik} className="site-belir pt-20 md:pt-28">
          <div className="mt-6 max-w-[65ch] text-lg">
            <SiteMetni govde={sayfa.govde} />
          </div>
        </Bolum>
      ) : null}

      <Bolum className="site-belir pt-20 md:pt-28">
        <IletisimKutusu
          mapsUrl={kunye.mapsUrl}
          whatsappHref={whatsapp}
          telHref={ara}
          telefon={kunye.telefon}
          baslik="Fiyat ve abonman için"
          aciklama="Abonman, karavan ve uzun süreli park için arayın ya da WhatsApp'tan yazın. 7/24 açığız."
        />
      </Bolum>
    </div>
  );
}
