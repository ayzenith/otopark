import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "../metin";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";


export const metadata: Metadata = { title: "İletişim" };

/**
 * İLETİŞİM SAYFASI
 *
 * Adres, telefon, çalışma saati ve harita bağlantısı işletme ayarından
 * (Yönetim → İşletme bilgileri) gelir. GİRİLMEMİŞ ALAN GÖSTERİLMEZ ve
 * UYDURULMAZ — docs/07 S18 hâlâ açık.
 */
export default async function IletisimSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ILETISIM];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  const hicBilgiYok =
    !kunye.adres && !kunye.telefon && !kunye.whatsapp && !kunye.calismaSaatleri && !kunye.mapsUrl;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
      <p className="site-gir site-etiket text-sinyal-600">İletişim</p>
      <h1 className="site-gir site-gir-1 site-baslik mt-4 text-murekkep-900">Bize ulaşın</h1>

      {sayfa ? (
        <div className="site-gir site-gir-2 mt-8 text-murekkep-700/85">
          <SiteMetni govde={sayfa.govde} />
        </div>
      ) : null}

      <div className="site-gir site-gir-2 mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {ara ? (
          <a
            href={ara}
            data-test="ara"
            className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-murekkep-950 px-8 text-lg font-extrabold tracking-tight text-kagit-50"
          >
            {kunye.telefon}
          </a>
        ) : null}
        {whatsapp ? (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            data-test="whatsapp"
            className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl px-8 text-lg font-bold text-murekkep-900 ring-1 ring-inset ring-murekkep-900/20 transition-colors duration-200 hover:bg-murekkep-900/5"
          >
            WhatsApp ile yazın
          </a>
        ) : null}
      </div>

      <dl className="site-gir site-gir-3 mt-14">
        {kunye.adres ? (
          <div className="border-t border-murekkep-900/12 py-5">
            <dt className="site-etiket text-murekkep-700/45">Adres</dt>
            <dd className="mt-2 leading-relaxed text-murekkep-900">{kunye.adres}</dd>
          </div>
        ) : null}

        {kunye.calismaSaatleri ? (
          <div className="border-t border-murekkep-900/12 py-5">
            <dt className="site-etiket text-murekkep-700/45">Çalışma saatleri</dt>
            <dd className="mt-2 font-bold text-murekkep-900">{kunye.calismaSaatleri}</dd>
          </div>
        ) : null}

        {kunye.instagram ? (
          <div className="border-t border-murekkep-900/12 py-5">
            <dt className="site-etiket text-murekkep-700/45">Instagram</dt>
            <dd className="mt-2">
              <a
                className="site-bag font-semibold text-murekkep-900"
                href={kunye.instagram}
                target="_blank"
                rel="noopener noreferrer"
              >
                {kunye.instagram}
              </a>
            </dd>
          </div>
        ) : null}

        {hicBilgiYok ? (
          <p className="text-murekkep-700/60">İletişim bilgileri henüz yayınlanmadı.</p>
        ) : null}
      </dl>

      {kunye.mapsUrl ? (
        <a
          href={kunye.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-test="yol-tarifi"
          className="site-basilabilir mt-10 inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-sinyal-400 px-8 text-lg font-extrabold tracking-tight text-murekkep-950"
        >
          YOL TARİFİ AL
        </a>
      ) : null}
    </div>
  );
}
