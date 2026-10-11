import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "../metin";
import {
  Adim,
  Bolum,
  HizmetKarti,
  IletisimKutusu,
  OnayliMadde,
  SaatIkonu,
  SayfaKapagi,
  YikamaIkonu,
} from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oto Yıkama",
  description: "Profesyonel iç dış oto yıkama — aracınızı park ederken yıkatın. 7/24.",
};

/**
 * OTO YIKAMA SAYFASI — TEKNİK VERİ (11.10.2026)
 *
 * İÇERİĞİN KAYNAĞI: işletme sahibi — "profesyonel oto yıkama" (06.10.2026),
 * oto yıkama 7/24 (11.10.2026).
 *
 * ANLATILAN HİZMET sistemde AKTİF olandır: İç Dış Yıkama (araç tipine göre
 * fiyatlanır). Motor yıkama ve karavan yıkama 11.10.2026'da PASİFE alındı;
 * sitede anlatılmaz. Yıkama adımlarının ayrıntısı,
 * kullanılan ürün, randevu ve ödeme anı işletmeden teyitli DEĞİL; yazılmaz.
 *
 * FİYAT YAZILMAZ (karar S19).
 * Bu sayfada gerçek yıkama fotoğrafı yok; fotoğraf gelene kadar kapak
 * fotoğrafsızdır (otopark fotoğrafı yıkama diye gösterilmez).
 */
export default async function OtoYikamaSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <div className="bg-showroom-50 text-yol-950">
      <SayfaKapagi
        mapsUrl={kunye.mapsUrl}
        baslik="Profesyonel oto yıkama"
        giris="Aracınızı park ettiğiniz süre boş geçmesin. Deneyimli ekibimiz profesyonel ekipmanla içten dışa özenle yıkar; siz işinizi hallederken aracınız hazır olur. 7/24 açığız."
      />

      <Bolum baslik="Üç adımda tertemiz" className="site-belir pt-20 md:pt-28">
        <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
          <Adim
            numara={1}
            baslik="Aracınızı getirin"
            aciklama="Otoparka girerken yıkama istediğinizi söylemeniz yeterli. 7/24 açığız."
          />
          <Adim
            numara={2}
            baslik="İşinize bakın"
            aciklama="Aracınız yıkanırken siz işinizi halledin. Metrobüs ve metro birkaç dakika uzakta."
          />
          <Adim
            numara={3}
            baslik="Tertemiz teslim alın"
            aciklama="Döndüğünüzde aracınız yıkanmış olarak sizi bekler."
          />
        </ol>
      </Bolum>

      <Bolum baslik="Ne yapıyoruz" className="site-belir pt-20 md:pt-28">
        <div className="mt-8 max-w-2xl">
          <HizmetKarti
            ikon={<YikamaIkonu className="h-8 w-8" />}
            baslik="İç dış yıkama"
            aciklama="Aracınızın içi ve dışı profesyonel ekipmanla yıkanır. Otomobil, SUV ve motosiklet için ayrı fiyatlandırılır."
          />
        </div>

        <ul className="mt-10 grid gap-x-12 md:grid-cols-2">
          <OnayliMadde>Yıkama sırasında aracınız yine otopark güvenliğinde</OnayliMadde>
          <OnayliMadde>Yıkama fişi ayrı kesilir; ne ödediğiniz kayıt altındadır</OnayliMadde>
          <OnayliMadde>Park ve yıkama ücretleri ayrı hesaplanır</OnayliMadde>
          <OnayliMadde>Ücret araç tipine göre belirlenir</OnayliMadde>
        </ul>
      </Bolum>

      <Bolum baslik="Zaman kazandırır" className="site-belir pt-20 md:pt-28">
        <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
          <HizmetKarti
            ikon={<SaatIkonu className="h-8 w-8" />}
            baslik="Ayrı bir yere gitmeyin"
            aciklama="Yıkamacı aramak, sıra beklemek ve aracı orada bırakmak yok. Park ettiğiniz yerde hallolur."
          />
          <HizmetKarti
            ikon={<YikamaIkonu className="h-8 w-8" />}
            baslik="Her saat açık"
            aciklama="Gece yarısı da olsa aracınızı yıkatabilirsiniz. Otoparkımızla birlikte 7/24 hizmetteyiz."
          />
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
          baslik="Yıkama fiyatı için"
          aciklama="Aracınızın tipine göre fiyat bilgisi almak için arayın ya da WhatsApp'tan yazın."
        />
      </Bolum>
    </div>
  );
}
