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

/** Vitrin bölümü: üstte küçük etiket, altında büyük başlık. */
export function Bolum({
  etiket,
  baslik,
  children,
  className = "",
}: {
  etiket?: string;
  baslik?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-5 ${className}`}>
      {etiket ? (
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-mavi-600">{etiket}</p>
      ) : null}
      {baslik ? (
        <h2 className="mt-2 text-balance text-3xl font-extrabold leading-tight text-lacivert-700 sm:text-4xl">
          {baslik}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Hizmet kartı: ikon, başlık, açıklama. */
export function HizmetKarti({
  ikon,
  baslik,
  aciklama,
}: {
  ikon: React.ReactNode;
  baslik: string;
  aciklama: string;
}) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg sm:p-7">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-lacivert-50 text-lacivert-600">
        {ikon}
      </div>
      <h3 className="mt-5 text-xl font-bold text-lacivert-700">{baslik}</h3>
      <p className="mt-2 leading-relaxed text-slate-600">{aciklama}</p>
    </div>
  );
}

/** Kısa güven bilgisi: ikon + tek satır. */
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
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-mavi-200">
        {ikon}
      </div>
      <div>
        <p className="font-bold text-white">{baslik}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-lacivert-100">{aciklama}</p>
      </div>
    </div>
  );
}

/**
 * Ulaşım satırı: yakındaki bir nokta ve oraya olan mesafe.
 *
 * İşletme sahibinin 06.10.2026'da verdiği konum bilgileri için kullanılır.
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
    <li className="flex items-center gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-inset ring-white/10">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-mavi-200">
        {ikon}
      </div>
      <div className="min-w-0">
        <p className="font-bold leading-tight text-white">{yer}</p>
        <p className="mt-0.5 text-sm text-lacivert-100">{mesafe}</p>
      </div>
    </li>
  );
}
