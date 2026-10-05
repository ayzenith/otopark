import { metniBloklaraAyir } from "@/lib/site-metin";

/**
 * Panelden girilen sayfa metnini güvenli biçimde çizer.
 *
 * Çözümleme SAF bir fonksiyonda (`src/lib/site-metin.ts`) yapılır ve birim
 * testleriyle kapsanır; burası yalnızca çizim yapar.
 *
 * Neden tam bir Markdown kütüphanesi yok: dışarıdan bağımlılık eklemek
 * işletmenin onayına bağlı (docs/06 "taşınmayan işler") ve bu metinleri yazan
 * tek kişi patron. HTML'e izin verilmez; React metni kaçırdığı için
 * yapıştırılan bir <script> ekranda yazı olarak görünür, ÇALIŞMAZ.
 */
export function SiteMetni({ govde }: { govde: string }) {
  const bloklar = metniBloklaraAyir(govde);

  return (
    <div className="space-y-4">
      {bloklar.map((blok, i) => {
        if (blok.tur === "baslik") {
          return (
            <h2 key={i} className="text-xl font-bold text-lacivert-700">
              {blok.metin}
            </h2>
          );
        }

        if (blok.tur === "liste") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-lacivert-700">
              {blok.maddeler.map((m, j) => (
                <li key={j}>{m}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="leading-relaxed text-lacivert-700">
            {blok.metin}
          </p>
        );
      })}
    </div>
  );
}
