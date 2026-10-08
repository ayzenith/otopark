import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { telHref } from "@/lib/telefon";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";


export const metadata: Metadata = { title: "Fiyatlar" };

/**
 * SİTEDEKİ FİYAT LİSTESİ
 *
 * Burada gösterilen satırlar, patronun panelden "sitede göster" diyerek
 * yazdığı SERBEST METİNLERDİR. Otopark tarifesi ve yıkama fiyat tablosu
 * BURAYA OTOMATİK AKMAZ (mimari kural 11'in site karşılığı; karar S19).
 *
 * Hiç satır yoksa uydurulmuş bir fiyat ya da "0 ₺" GÖSTERİLMEZ — ziyaretçi
 * telefona yönlendirilir (mimari kural 10'un site karşılığı).
 */
export default async function FiyatlarSayfasi() {
  const { fiyatlar, kunye } = await siteIcerigi();
  const ara = telHref(kunye.telefon);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
      <p className="site-gir site-etiket text-sinyal-600">Fiyatlar</p>
      <h1 className="site-gir site-gir-1 site-baslik mt-4 text-murekkep-900">
        {fiyatlar.length > 0 ? "Güncel fiyatlarımız" : "Fiyat bilgisi"}
      </h1>

      {fiyatlar.length > 0 ? (
        <>
          <ul className="site-gir site-gir-2 mt-12">
            {fiyatlar.map((f) => (
              <li key={f.id} className="border-t border-murekkep-900/12 py-5">
                <div className="flex items-baseline justify-between gap-6">
                  <span className="font-semibold text-murekkep-900">{f.etiket}</span>
                  <span className="text-xl font-extrabold tracking-tight text-murekkep-900">
                    {f.fiyatMetni}
                  </span>
                </div>
                {f.not ? (
                  <p className="mt-1.5 text-sm text-murekkep-700/60">{f.not}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-8 border-t border-murekkep-900/12 pt-6 text-sm text-murekkep-700/60">
            Fiyatlar bilgi amaçlıdır; güncel durum için lütfen arayınız.
          </p>
        </>
      ) : (
        <div className="site-gir site-gir-2 mt-10">
          <p className="site-govde max-w-lg text-murekkep-700/85">
            Park ve yıkama ücretleri araç tipine ve kalış sürenize göre değişir. En doğru bilgiyi
            telefonda, tek konuşmada alırsınız.
          </p>
          {ara ? (
            <a
              href={ara}
              data-test="ara"
              className="site-basilabilir mt-8 inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-murekkep-950 px-8 text-lg font-extrabold tracking-tight text-kagit-50"
            >
              {kunye.telefon}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
