import type { Metadata } from "next";
import { siteIcerigi } from "@/server/site/queries";
import { telHref } from "@/lib/telefon";
import { SayfaKapagi, TelefonIkonu } from "../parcalar";

/**
 * Site içeriği PANELDEN gelir ve anında yayına girmelidir; ayrıca üretim
 * imajı derlenirken veritabanı YOKTUR (Dockerfile yer tutucu adres verir).
 * Bu yüzden sayfa derleme anında önceden üretilmez, her istekte sunucuda
 * çizilir.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Fiyatlar" };

/**
 * SİTEDEKİ FİYAT LİSTESİ — TEKNİK VERİ (11.10.2026)
 *
 * Burada gösterilen satırlar, patronun panelden "sitede göster" diyerek
 * yazdığı SERBEST METİNLERDİR. Otopark tarifesi ve yıkama fiyat tablosu
 * BURAYA OTOMATİK AKMAZ (mimari kural 11'in site karşılığı; karar S19).
 *
 * Hiç satır yoksa uydurulmuş bir fiyat ya da "0 ₺" GÖSTERİLMEZ — ziyaretçi
 * telefona yönlendirilir. Satır yokken sayfa menüde de görünmez (layout).
 *
 * Doğru bilgi: park ücreti kalış süresine göre değişir (araç tipine göre
 * DEĞİL; yalnızca karavanın ayrı tarifesi var), yıkama ücreti araç tipine
 * göre.
 */
export default async function FiyatlarSayfasi() {
  const { fiyatlar, kunye } = await siteIcerigi();
  const ara = telHref(kunye.telefon);

  return (
    <div className="bg-showroom-50 text-yol-950">
      <SayfaKapagi
        baslik={fiyatlar.length > 0 ? "Güncel fiyatlarımız" : "Fiyat bilgisi"}
        giris={
          fiyatlar.length > 0
            ? "Fiyatlar bilgi amaçlıdır; güncel durum için lütfen arayınız."
            : "Park ücreti kalış sürenize, yıkama ücreti aracınızın tipine göre değişir. En doğru bilgiyi telefonda, tek konuşmada alırsınız."
        }
      />

      <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-8 md:pt-14">
        {fiyatlar.length > 0 ? (
          <ul className="max-w-3xl border-t-2 border-yol-800">
            {fiyatlar.map((f) => (
              <li key={f.id} className="border-b border-yol-800/15 py-5">
                <div className="flex items-baseline justify-between gap-6">
                  <span className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">{f.etiket}</span>
                  <span className="site-veri shrink-0 text-xl text-yol-800">{f.fiyatMetni}</span>
                </div>
                {f.not ? <p className="mt-1.5 text-base text-celik-600">{f.not}</p> : null}
              </li>
            ))}
          </ul>
        ) : ara ? (
          <a
            href={ara}
            data-test="ara"
            className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-[6px] border-2 border-yol-800 px-8 text-lg font-extrabold tabular-nums text-yol-800 hover:bg-yol-800/5"
          >
            <TelefonIkonu className="h-6 w-6" />
            {kunye.telefon}
          </a>
        ) : null}
      </section>
    </div>
  );
}
