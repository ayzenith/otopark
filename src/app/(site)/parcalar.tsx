import Link from "next/link";
/**
 * SİTE TASARIM PARÇALARI
 *
 * Kurumsal sitenin görsel dili burada toplanır: ikonlar, bölüm başlıkları,
 * kartlar. Panel arayüzünden AYRI tutulur — panel bir iş aracıdır (yoğun,
 * hızlı), site ise bir vitrindir (geniş nefes, büyük tipografi).
 *
 * İkonlar satır içi SVG'dir: dışarıdan ikon kütüphanesi eklemek bağımlılık
 * onayı gerektirir (docs/06), ve bu kadar az ikon için gereksizdir. Hepsi
 * `currentColor` kullanır, böylece bulunduğu yerin rengini alır.
 */

type IkonOzellikleri = { className?: string };

export function OtoparkIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <rect x="4" y="6" width="40" height="36" rx="9" stroke="currentColor" strokeWidth="3" />
      <path
        d="M18 34V14h7.5a6.5 6.5 0 0 1 0 13H18"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YikamaIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M24 42c-6.6 0-12-5.1-12-11.4C12 23.4 24 8 24 8s12 15.4 12 22.6C36 36.9 30.6 42 24 42Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M20 30.5c0 2.5 1.9 4.5 4.3 4.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KaravanIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M6 14a6 6 0 0 1 6-6h20a10 10 0 0 1 10 10v12H10a4 4 0 0 1-4-4V14Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M42 30h-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="33" r="5" stroke="currentColor" strokeWidth="3" />
      <rect x="14" y="14" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function SaatIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" />
      <path d="M24 13v11l7 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AbonmanIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <rect x="6" y="10" width="36" height="28" rx="6" stroke="currentColor" strokeWidth="3" />
      <path d="M6 20h36" stroke="currentColor" strokeWidth="3" />
      <path d="M14 29h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function KonumIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M24 43s14-12.1 14-22a14 14 0 1 0-28 0c0 9.9 14 22 14 22Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="20.5" r="5" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function WhatsappIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden className={className}>
      <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8c1.9 1 4 1.6 6.2 1.6 7.2 0 13-5.8 13-13S23.2 3 16 3Zm0 23.6c-2 0-3.9-.5-5.5-1.5l-.4-.2-4 1.1 1.1-3.9-.3-.4a10.5 10.5 0 1 1 9.1 5Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2c-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.7 5.8 5.1.8.4 1.5.6 2 .7.8.3 1.6.2 2.2.1.7-.1 2-.8 2.2-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4Z" />
    </svg>
  );
}

export function TelefonIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M11.4 5.6 13.8 11l-2.6 2.2a14 14 0 0 0 7.6 7.6l2.2-2.6 5.4 2.4-1 4.6a2 2 0 0 1-2.2 1.6C14.6 25.6 6.4 17.4 5.4 7.8a2 2 0 0 1 1.6-2.2l4.4-1Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export function KalkanIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M24 5 9 11v12c0 10 6.4 17.6 15 20 8.6-2.4 15-10 15-20V11L24 5Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m18 23.5 4.3 4.3L31 19"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KameraIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M6 16.5 34 9l3 10.5L9 27 6 16.5Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M13 25.5 15 33" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 21 42 17v12l-9-3" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="19" cy="38" r="5" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function EtiketIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path
        d="M24.8 6H40a2 2 0 0 1 2 2v15.2a4 4 0 0 1-1.2 2.8L24.6 42.2a2 2 0 0 1-2.8 0L5.8 26.2a2 2 0 0 1 0-2.8L22 7.2A4 4 0 0 1 24.8 6Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="33" cy="15" r="3.4" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function YuruyusIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <circle cx="26" cy="9" r="4.5" stroke="currentColor" strokeWidth="3" />
      <path
        d="M25 18c-3 .6-4.6 2.4-5.4 4.8L17 31l-5 11M25 18c3 0 5 1.6 6 4l2.4 5.6L39 31M25 18l-.6 11.4L30 42"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BinaIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path d="M8 42V12l12-6v36" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 42V18l20-6v30" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M4 42h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M27 24h6M27 31h6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Vitrin bölümü.
 *
 * Numaralı etiket (01, 02…) bölümlere ritim verir ve sayfanın uzunluğunu
 * okunur kılar: ziyaretçi nerede olduğunu kaydırma çubuğundan değil,
 * sayfadan anlar. Etiket tek renkli büyük harf, geniş harf aralığıyla
 * yazılır; başlık ise sıkı harf aralığıyla (büyük yazıda harfler
 * birbirinden uzak görünür — apple-design §15).
 */
export function Bolum({
  numara,
  etiket,
  baslik,
  children,
  className = "",
}: {
  numara?: string;
  etiket?: string;
  baslik?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-6 sm:px-8 ${className}`}>
      {etiket ? (
        <p className="site-etiket flex items-center gap-3 text-sinyal-600">
          {numara ? <span className="text-murekkep-700/40">{numara}</span> : null}
          {etiket}
        </p>
      ) : null}
      {baslik ? (
        <h2 className="site-baslik mt-4 text-balance text-murekkep-900">{baslik}</h2>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Hizmet bloğu.
 *
 * Kutu içinde kutu yerine İNCE ÇİZGİ ile ayrılır: kart kenarlıkları
 * sayfayı parçalar, hairline ise ritmi bozmadan ayırır. Üstte ikon,
 * altında başlık ve metin; `yol` verilirse bloğun tamamı bağlantıdır.
 *
 * Üzerine gelince ikon kutusu sinyal rengine döner ve blok 2px yükselir —
 * tıklanabilir olduğu, imleç değişmeden önce anlaşılır.
 */
export function HizmetKarti({
  ikon,
  baslik,
  aciklama,
  yol,
}: {
  ikon: React.ReactNode;
  baslik: string;
  aciklama: string;
  yol?: string;
}) {
  const icerik = (
    <>
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-murekkep-900 text-kagit-50 transition-colors duration-200 group-hover:bg-sinyal-500 group-hover:text-murekkep-950">
        {ikon}
      </div>
      <h3 className="mt-6 text-xl font-bold tracking-tight text-murekkep-900">{baslik}</h3>
      <p className="mt-3 leading-relaxed text-murekkep-700/80">{aciklama}</p>
      {yol ? (
        <p className="site-etiket mt-6 text-sinyal-600">
          Detaylı bilgi <span aria-hidden>→</span>
        </p>
      ) : null}
    </>
  );

  const sinif =
    "group block border-t border-murekkep-900/12 pt-8 transition-transform duration-200 " +
    (yol ? "hover:-translate-y-0.5" : "");

  if (yol) {
    return (
      <Link href={yol} className={`${sinif} site-basilabilir`}>
        {icerik}
      </Link>
    );
  }
  return <div className={sinif}>{icerik}</div>;
}

/**
 * Kısa güven bilgisi (koyu zeminde): ikon, başlık, tek satır açıklama.
 * Kutu yok; üstte ince bir çizgi var. Birden fazlası yan yana dizilince
 * bu çizgiler bir cetvel gibi okunur.
 */
export function OzellikSatiri({
  ikon,
  baslik,
  aciklama,
}: {
  ikon: React.ReactNode;
  baslik: string;
  aciklama: string;
}) {
  return (
    <div className="border-t border-kagit-50/15 pt-5">
      <div className="text-sinyal-400">{ikon}</div>
      <p className="mt-4 font-bold tracking-tight text-kagit-50">{baslik}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-kagit-200/70">{aciklama}</p>
    </div>
  );
}

/**
 * Ulaşım satırı: yakındaki bir nokta ve oraya olan mesafe.
 *
 * Mesafe SAĞDA ve tek renkli (monospace) durur: dört satır alt alta
 * gelince rakamlar aynı hizada okunur, göz tabloyu tarar gibi tarar.
 */
export function UlasimSatiri({
  ikon,
  yer,
  mesafe,
}: {
  ikon: React.ReactNode;
  yer: string;
  mesafe: string;
}) {
  return (
    <li className="flex items-center gap-4 border-t border-kagit-50/15 py-4">
      <span className="text-sinyal-400">{ikon}</span>
      <span className="min-w-0 flex-1 font-semibold leading-tight text-kagit-50">{yer}</span>
      <span className="site-etiket shrink-0 text-kagit-200/60">{mesafe}</span>
    </li>
  );
}

/**
 * Numaralı adım.
 *
 * Numara büyük ve soluk; başlık küçük ve koyu. Tersi de olurdu ama o
 * zaman numara başlıkla yarışır. Burada numara ritmi tutar, başlık konuşur.
 */
export function Adim({
  numara,
  baslik,
  aciklama,
}: {
  numara: number;
  baslik: string;
  aciklama: string;
}) {
  return (
    <li className="border-t border-murekkep-900/12 pt-6">
      <span className="font-mono text-4xl font-bold tabular-nums text-murekkep-900/15">
        {String(numara).padStart(2, "0")}
      </span>
      <p className="mt-3 text-xl font-bold tracking-tight text-murekkep-900">{baslik}</p>
      <p className="mt-2 leading-relaxed text-murekkep-700/80">{aciklama}</p>
    </li>
  );
}

/** Madde listesi satırı: sinyal renkli kısa çizgi + kısa fayda cümlesi. */
export function OnayliMadde({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-4 border-t border-murekkep-900/10 py-3.5">
      <span aria-hidden className="h-px w-5 shrink-0 translate-y-[-0.3em] bg-sinyal-500" />
      <span className="leading-relaxed text-murekkep-700/85">{children}</span>
    </li>
  );
}

/**
 * Sayfa sonu iletişim bloğu.
 *
 * Her hizmet sayfası aynı eylemlerle biter: WhatsApp, arama, yol tarifi.
 * Ziyaretçi sayfayı okuduktan sonra ne yapacağını aramak zorunda kalmaz.
 * Girilmemiş bilgi için buton ÇİZİLMEZ (mimari kural 19).
 *
 * Telefon numarası burada BÜYÜK yazılır: en çok istenen bilgi, en görünür
 * yerde. Butonların hepsi aynı yükseklikte (64px) — birincil işlem ölçüsü.
 */
export function IletisimKutusu({
  mapsUrl,
  whatsappHref: wa,
  telHref: tel,
  telefon,
  baslik = "Yardımcı olalım",
  aciklama = "Aklınıza takılan her şey için arayın ya da WhatsApp'tan yazın.",
}: {
  mapsUrl: string | null;
  whatsappHref: string | null;
  telHref: string | null;
  telefon: string | null;
  baslik?: string;
  aciklama?: string;
}) {
  if (!mapsUrl && !wa && !tel) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-murekkep-900 p-8 text-kagit-50 sm:p-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sinyal-500/15 blur-3xl"
      />
      <div className="relative">
        <h2 className="site-baslik text-balance">{baslik}</h2>
        <p className="mt-4 max-w-md leading-relaxed text-kagit-200/75">{aciklama}</p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {tel ? (
            <a
              href={tel}
              data-test="ara"
              className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl bg-sinyal-400 px-7 text-lg font-extrabold tracking-tight text-murekkep-950"
            >
              <TelefonIkonu className="h-6 w-6" />
              {telefon}
            </a>
          ) : null}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              data-test="whatsapp"
              className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl px-7 text-lg font-bold text-kagit-50 ring-1 ring-inset ring-kagit-50/25 transition-colors duration-200 hover:bg-kagit-50/10"
            >
              <WhatsappIkonu className="h-6 w-6" />
              WhatsApp
            </a>
          ) : null}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-test="yol-tarifi"
              className="site-basilabilir inline-flex h-16 items-center justify-center gap-3 rounded-xl px-7 text-lg font-bold text-kagit-50 ring-1 ring-inset ring-kagit-50/25 transition-colors duration-200 hover:bg-kagit-50/10"
            >
              <KonumIkonu className="h-6 w-6" />
              Yol tarifi
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
