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
  YikamaIkonu,
} from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oto Yıkama",
  description: "Profesyonel iç dış oto yıkama — aracınızı park ederken yıkatın.",
};

/**
 * OTO YIKAMA SAYFASI
 *
 * ============================================================================
 * İÇERİĞİN KAYNAĞI: işletme sahibi, 06.10.2026 — "profesyonel oto yıkama
 * hizmetini de ekleyelim".
 *
 * ANLATILAN HİZMETLER sistemde TANIMLI olanlardır: İç Dış Yıkama (araç
 * tipine göre fiyatlanır) ve Motor Yıkama. Olmayan hizmet (pasta cila,
 * seramik kaplama, detaylı iç temizlik…) UYDURULMADI — işletme böyle bir
 * hizmet verdiğini söylemedi.
 *
 * FİYAT YAZILMAZ (karar S19). Ayrıca Motor Yıkama'nın ücreti henüz
 * belirlenmedi; sitede fiyat geçmediği için bu bir sorun oluşturmuyor.
 * ============================================================================
 */
export default async function OtoYikamaSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.YIKAMA];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  return (
    <>
      {/* ---- Başlık ---- */}
      <section className="relative overflow-hidden bg-murekkep-950 text-kagit-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-28 -top-36 h-[28rem] w-[28rem] rounded-full bg-mavi-500/12 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-sinyal-500/10 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-5xl px-6 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
          <p className="site-gir site-etiket text-sinyal-400">Hizmetimiz</p>
          <h1 className="site-gir site-gir-1 site-dev mt-6 text-balance">
            Profesyonel oto yıkama
          </h1>
          <p className="site-gir site-gir-2 site-govde mt-7 max-w-2xl text-kagit-200/80">
            Aracınızı park ettiğiniz süre boş geçmesin. Deneyimli ekibimiz, profesyonel ekipman ve
            araca zarar vermeyen ürünlerle içten dışa özenle yıkar. Siz işinizi hallederken
            aracınız hazır olur.
          </p>
        </div>
      </section>

      {/* ---- Nasıl işliyor ---- */}
            <Bolum numara="01" etiket="Nasıl işliyor" baslik="Üç adımda tertemiz" className="site-belir pt-20 sm:pt-28">
        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          <Adim
            numara={1}
            baslik="Aracınızı getirin"
            aciklama="Otoparka girerken yıkama istediğinizi söylemeniz yeterli. Randevu gerekmez; 7/24 açığız."
          />
          <Adim
            numara={2}
            baslik="İşinize bakın"
            aciklama="Aracınız yıkanırken siz işinizi halledin. Metrobüs ve metro yürüme mesafesinde."
          />
          <Adim
            numara={3}
            baslik="Tertemiz teslim alın"
            aciklama="Döndüğünüzde aracınız yıkanmış ve kurulanmış olarak sizi bekler. Ödeme teslimde."
          />
        </ol>
      </Bolum>
      
      {/* ---- Hizmetler ---- */}
            <Bolum numara="02" etiket="Yıkama hizmetleri" baslik="Ne yapıyoruz" className="site-belir pt-20 sm:pt-28">
        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-12">
          <HizmetKarti
            ikon={<YikamaIkonu className="h-8 w-8" />}
            baslik="İç dış yıkama"
            aciklama="Dış yüzey köpükle yıkanır ve kurulanır; iç kısım süpürülür, torpido ve cam içleri silinir. Otomobil, SUV ve motosiklet için ayrı fiyatlandırılır."
          />
          <HizmetKarti
            ikon={<YikamaIkonu className="h-8 w-8" />}
            baslik="Motor yıkama"
            aciklama="Motor bölümünün temizliği ayrı bir hizmettir. Aracınıza uygun olup olmadığını ekibimizle konuşarak kararlaştırın."
          />
        </div>

        <ul className="mt-12 grid gap-x-12 sm:grid-cols-2">
          <OnayliMadde>Araç tipine uygun ürün ve basınç; boyaya zarar verilmez</OnayliMadde>
          <OnayliMadde>Yıkama sırasında aracınız yine otopark güvenliğinde</OnayliMadde>
          <OnayliMadde>Yıkama fişi ayrı kesilir; ne ödediğiniz kayıt altındadır</OnayliMadde>
          <OnayliMadde>Park ve yıkama ücretleri birbirine karıştırılmaz</OnayliMadde>
        </ul>
      </Bolum>
      
      {/* ---- Neden burada yıkatmalı ---- */}
            <Bolum numara="03" etiket="Neden burada" baslik="Zaman kazandırır" className="site-belir pt-20 sm:pt-28">
        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-12">
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
          baslik="Yıkama fiyatı ve detaylar için"
          aciklama="Aracınızın tipine göre fiyat ve süre bilgisi almak için arayın ya da WhatsApp'tan yazın."
        />
      </Bolum>
          </>
  );
}
