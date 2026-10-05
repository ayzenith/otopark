import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-lacivert-700">Fiyatlar</h1>

      {fiyatlar.length > 0 ? (
        <>
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {fiyatlar.map((f) => (
              <li key={f.id} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-lacivert-700">{f.etiket}</span>
                  <span className="text-lg font-bold text-lacivert-700">{f.fiyatMetni}</span>
                </div>
                {f.not ? <p className="mt-1 text-sm text-slate-500">{f.not}</p> : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-500">
            Fiyatlar bilgi amaçlıdır; güncel durum için lütfen arayınız.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-lacivert-700">
            Güncel fiyatlar için lütfen bizi arayın.
          </p>
          {kunye.telefon ? (
            <a
              href={`tel:${kunye.telefon.replace(/\s/g, "")}`}
              className="mt-4 flex h-16 items-center justify-center rounded-2xl bg-lacivert-600 px-4 text-lg font-bold text-white"
            >
              ☎ {kunye.telefon}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
