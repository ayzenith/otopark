import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
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

  const hicBilgiYok =
    !kunye.adres && !kunye.telefon && !kunye.whatsapp && !kunye.calismaSaatleri && !kunye.mapsUrl;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-lacivert-700">İletişim</h1>

      {sayfa ? <SiteMetni govde={sayfa.govde} /> : null}

      {kunye.telefon ? (
        <a
          href={`tel:${kunye.telefon.replace(/\s/g, "")}`}
          className="flex h-16 items-center justify-center rounded-2xl bg-lacivert-600 px-4 text-lg font-bold text-white"
        >
          ☎ {kunye.telefon}
        </a>
      ) : null}

      {kunye.whatsapp ? (
        <a
          href={`https://wa.me/${kunye.whatsapp.replace(/\D/g, "")}`}
          className="flex h-16 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-lg font-bold text-white"
        >
          WhatsApp ile yazın
        </a>
      ) : null}

      <dl className="space-y-4 rounded-2xl border border-slate-200 p-5">
        {kunye.adres ? (
          <div>
            <dt className="text-sm font-semibold uppercase text-slate-500">Adres</dt>
            <dd className="mt-1 text-lacivert-700">{kunye.adres}</dd>
          </div>
        ) : null}

        {kunye.calismaSaatleri ? (
          <div>
            <dt className="text-sm font-semibold uppercase text-slate-500">Çalışma saatleri</dt>
            <dd className="mt-1 text-lacivert-700">{kunye.calismaSaatleri}</dd>
          </div>
        ) : null}

        {kunye.instagram ? (
          <div>
            <dt className="text-sm font-semibold uppercase text-slate-500">Instagram</dt>
            <dd className="mt-1">
              <a className="text-mavi-700 underline" href={kunye.instagram}>
                {kunye.instagram}
              </a>
            </dd>
          </div>
        ) : null}

        {hicBilgiYok ? (
          <p className="text-slate-500">
            İletişim bilgileri henüz yayınlanmadı.
          </p>
        ) : null}
      </dl>

      {kunye.mapsUrl ? (
        <a
          href={kunye.mapsUrl}
          className="flex h-14 items-center justify-center rounded-2xl border-2 border-lacivert-600 px-4 font-bold text-lacivert-700"
        >
          Yol tarifi al
        </a>
      ) : null}
    </div>
  );
}
