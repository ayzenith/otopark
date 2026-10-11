import type { Metadata } from "next";
import { siteIcerigi, SITE_SAYFA_ANAHTARLARI } from "@/server/site/queries";
import { telHref, whatsappHref } from "@/lib/telefon";
import { SiteMetni } from "../metin";
import { Bolum, KonumTablosu, SayfaKapagi, TelefonIkonu, WhatsappIkonu, YolTarifiButonu } from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İletişim" };

/**
 * İLETİŞİM SAYFASI — TEKNİK VERİ (11.10.2026)
 *
 * Adres, telefon, çalışma saati ve harita bağlantısı işletme ayarından
 * (Yönetim → İşletme bilgileri) gelir. GİRİLMEMİŞ ALAN GÖSTERİLMEZ ve
 * UYDURULMAZ. Kapaktaki fotoğraf girişin pankartlı bölümüdür: ziyaretçi
 * geldiğinde ne göreceğini önceden bilir.
 */
export default async function IletisimSayfasi() {
  const { kunye, sayfalar } = await siteIcerigi();
  const sayfa = sayfalar[SITE_SAYFA_ANAHTARLARI.ILETISIM];

  const ara = telHref(kunye.telefon);
  const whatsapp = whatsappHref(kunye.whatsapp);

  /**
   * Instagram adresinin TAMAMI yazılmaz: 88 karakterlik gerçek bir adres
   * 320px ekranda 296px taşma ve yatay kaydırma üretiyordu (break-ui,
   * 08.10.2026). Bunun yerine kullanıcı adı gösterilir; bağlantı aynı.
   */
  const instagramAdi = kunye.instagram
    ? (kunye.instagram.replace(/\/+$/, "").split("?")[0]!.split("/").pop() ?? "").trim()
    : "";

  const hicBilgiYok =
    !kunye.adres && !kunye.telefon && !kunye.whatsapp && !kunye.calismaSaatleri && !kunye.mapsUrl;

  return (
    <div className="bg-showroom-50 text-yol-950">
      <SayfaKapagi
        baslik="Bize ulaşın"
        giris="Girişte bu kırmızı pankartları göreceksiniz. Yol tarifi için haritayı açın; sorularınız için arayın ya da WhatsApp'tan yazın."
        gorsel={{
          konum: "72% 55%",
          alt: "Otopark girişindeki kırmızı Londra Camping Oto Park pankartları",
        }}
      />

      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-8 md:pt-12">
        <div className="flex max-w-xl flex-col gap-3">
          {kunye.mapsUrl ? <YolTarifiButonu href={kunye.mapsUrl} testli /> : null}
          {whatsapp || ara ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-test="whatsapp"
                  className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold text-yol-800 hover:bg-yol-800/5"
                >
                  <WhatsappIkonu className="h-6 w-6" />
                  WhatsApp ile yazın
                </a>
              ) : null}
              {ara ? (
                <a
                  href={ara}
                  data-test="ara"
                  className="site-basilabilir flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold tabular-nums text-yol-800 hover:bg-yol-800/5"
                >
                  <TelefonIkonu className="h-6 w-6 shrink-0" />
                  <span className="min-w-0 truncate">{kunye.telefon}</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <Bolum className="site-belir pt-16 md:pt-24">
        <div className="grid gap-10 border-t-2 border-yol-800 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
          <dl>
            {kunye.calismaSaatleri ? (
              <div className="border-b border-yol-800/15 py-5">
                <dt className="site-bro-etiket text-celik-600">Çalışma saatleri</dt>
                <dd className="site-veri mt-2 text-2xl text-yol-800 [overflow-wrap:anywhere]">{kunye.calismaSaatleri}</dd>
              </div>
            ) : null}
            {kunye.telefon ? (
              <div className="border-b border-yol-800/15 py-5">
                <dt className="site-bro-etiket text-celik-600">Telefon</dt>
                <dd className="site-veri mt-2 text-2xl text-yol-800 [overflow-wrap:anywhere]">{kunye.telefon}</dd>
              </div>
            ) : null}
            {kunye.adres ? (
              <div className="border-b border-yol-800/15 py-5">
                <dt className="site-bro-etiket text-celik-600">Adres</dt>
                <dd className="mt-2 text-lg leading-relaxed [overflow-wrap:anywhere]">{kunye.adres}</dd>
              </div>
            ) : null}
            {kunye.instagram ? (
              <div className="border-b border-yol-800/15 py-5">
                <dt className="site-bro-etiket text-celik-600">Instagram</dt>
                <dd className="mt-2">
                  <a
                    className="site-bag break-words text-lg font-semibold text-levha-500"
                    href={kunye.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {instagramAdi ? `@${instagramAdi}` : "Instagram"}
                  </a>
                </dd>
              </div>
            ) : null}
            {hicBilgiYok ? (
              <p className="py-5 text-lg text-celik-600">İletişim bilgileri henüz yayınlanmadı.</p>
            ) : null}
          </dl>

          <div>
            <KonumTablosu />
          </div>
        </div>
      </Bolum>

      {sayfa ? (
        <Bolum baslik={sayfa.baslik} className="site-belir pt-20 md:pt-28">
          <div className="mt-6 max-w-[65ch] text-lg">
            <SiteMetni govde={sayfa.govde} />
          </div>
        </Bolum>
      ) : null}
    </div>
  );
}
