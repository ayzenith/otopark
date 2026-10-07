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
      <section className="relative overflow-hidden bg-lacivert-700 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full bg-mavi-400/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-10 sm:pb-16 sm:pt-14">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mavi-300">Hizmetimiz</p>
          <h1 className="mt-2 text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Profesyonel oto yıkama
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-lacivert-100 sm:text-xl">
            Aracınızı park ettiğiniz süre boş geçmesin. Deneyimli ekibimiz, profesyonel ekipman ve
            araca zarar vermeyen ürünlerle içten dışa özenle yıkar. Siz işinizi hallederken aracınız
            hazır olur.
          </p>
        </div>
      </section>

      {/* ---- Nasıl işliyor ---- */}
      <Bolum etiket="Nasıl işliyor" baslik="Üç adımda tertemiz" className="pt-14 sm:pt-20">
        <ol className="mt-8 space-y-7">
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
      <Bolum etiket="Yıkama hizmetleri" baslik="Ne yapıyoruz" className="pt-14 sm:pt-20">
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
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

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          <OnayliMadde>Araç tipine uygun ürün ve basınç; boyaya zarar verilmez</OnayliMadde>
          <OnayliMadde>Yıkama sırasında aracınız yine otopark güvenliğinde</OnayliMadde>
          <OnayliMadde>Yıkama fişi ayrı kesilir; ne ödediğiniz kayıt altındadır</OnayliMadde>
          <OnayliMadde>Park ve yıkama ücretleri birbirine karıştırılmaz</OnayliMadde>
        </ul>
      </Bolum>

      {/* ---- Neden burada yıkatmalı ---- */}
      <Bolum etiket="Neden burada" baslik="Zaman kazandırır" className="pt-14 sm:pt-20">
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
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
          baslik="Yıkama fiyatı ve detaylar için"
          aciklama="Aracınızın tipine göre fiyat ve süre bilgisi almak için arayın ya da WhatsApp'tan yazın."
        />
      </Bolum>
    </>
  );
}
