import Image from "next/image";
import Link from "next/link";
import { CEVRE, ULASIM } from "./konum-bilgisi";
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

/* ==========================================================================
   TEKNİK VERİ PARÇALARI (11.10.2026)
   ========================================================================== */

/**
 * Ok: logodaki okun yönü (sağa), kalın gövde + dolu üçgen uç.
 * Unicode "→" değil, çizilmiş: her yazı tipinde aynı ağırlıkta durur.
 */
export function OkIkonu({ className }: IkonOzellikleri) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <path d="M6 24h24" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      <path d="M26 10 42 24 26 38V10Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fotoğraf işareti: nokta + çizgi + etiket (broşürdeki açıklama çizgisi).
 * Konum, fotoğraf kutusunun yüzdesi olarak verilir; kutunun en-boy oranı
 * her kırılma noktasında sabit olduğu için işaret aynı nesnenin üstünde
 * kalır. `--mx/--my` telefon, `--x/--y` geniş ekran konumudur.
 */
export function FotoIsareti({
  etiket,
  mx,
  my,
  x,
  y,
  gecikme,
  sol = false,
}: {
  etiket: string;
  mx: string;
  my: string;
  x: string;
  y: string;
  gecikme: number;
  /** Etiket noktanın SOLUNA açılır (sağda örtmemesi gereken bir şey varsa). */
  sol?: boolean;
}) {
  return (
    <div
      aria-hidden
      data-sol={sol || undefined}
      className={`site-isaret absolute left-[var(--mx)] top-[var(--my)] flex -translate-y-1/2 items-center md:left-[var(--x)] md:top-[var(--y)] ${
        sol ? "-translate-x-full flex-row-reverse" : ""
      }`}
      style={
        {
          "--mx": mx,
          "--my": my,
          "--x": x,
          "--y": y,
          "--gecikme": `${gecikme}ms`,
        } as React.CSSProperties
      }
    >
      <i
        className={`block h-3 w-3 shrink-0 rounded-full bg-white ring-[3px] ring-levha-500 ${sol ? "-mr-1.5" : "-ml-1.5"}`}
      />
      <b className="block h-0.5 w-5 bg-white md:w-7" />
      <span className="site-bro-etiket whitespace-nowrap bg-yol-900 px-1.5 py-1 text-[10px] text-white md:px-2.5 md:text-xs">
        {etiket}
      </span>
    </div>
  );
}

/**
 * İç sayfa kapağı: isteğe bağlı fotoğraf bandı + fotoğrafın kenarına binen
 * başlık sekmesi + giriş paragrafı. Fotoğraf yoksa sekme binmez.
 * Kırpım `konum` (object-position) ile seçilir; tek gerçek fotoğrafın
 * farklı bölgeleri farklı sayfalarda kullanılır.
 */
export function SayfaKapagi({
  baslik,
  giris,
  gorsel,
  mapsUrl,
}: {
  baslik: string;
  giris: string;
  gorsel?: { konum: string; alt: string };
  /** Verilirse kapakta YOL TARİFİ AL çizilir (ana eylem ilk ekranda). */
  mapsUrl?: string | null;
}) {
  return (
    <section>
      {gorsel ? (
        <div className="relative mx-auto aspect-[16/10] max-w-[1600px] overflow-hidden md:aspect-[3/1]">
          <Image
            src="/otopark-giris.webp"
            alt={gorsel.alt}
            fill
            priority
            sizes="(min-width: 1600px) 1600px, 100vw"
            className="object-cover"
            style={{ objectPosition: gorsel.konum }}
          />
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <div
          className={
            gorsel
              ? "relative -mt-10 mr-8 bg-showroom-50 pr-4 pt-5 md:-ml-8 md:-mt-24 md:mr-0 md:w-fit md:max-w-full md:pl-8 md:pr-12 md:pt-8"
              : "pt-12 md:pt-20"
          }
        >
          <h1 className="site-model text-balance break-words text-yol-800">{baslik}</h1>
        </div>
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-celik-600 md:text-xl">{giris}</p>
        {mapsUrl ? <YolTarifiButonu href={mapsUrl} className="mt-8 sm:w-fit" /> : null}
      </div>
    </section>
  );
}

/**
 * Bölüm: lacivert çizgiyle açılan, büyük harfli geniş başlıklı blok.
 * Numara ve başlık üstü etiket YOK (impeccable: kicker ve süs numarası
 * bilgi taşımıyorsa yasak).
 */
export function Bolum({
  baslik,
  children,
  className = "",
}: {
  baslik?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-4 sm:px-8 ${className}`}>
      {baslik ? (
        <h2 className="site-bro-baslik border-t-2 border-yol-800 pt-6 text-yol-800">{baslik}</h2>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Özellik satırı: ikon başlığın SOLUNDA (kutu içinde değil), altında metin.
 * Üstte ince çizgi; yan yana dizilince broşürün özellik listesi gibi okunur.
 */
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
    <div className="border-t border-yol-800/20 pt-6">
      <div className="flex items-center gap-3 text-levha-500">
        <span className="shrink-0">{ikon}</span>
        <h3 className="text-xl font-extrabold leading-tight text-yol-800 [font-stretch:110%]">{baslik}</h3>
      </div>
      <p className="mt-3 text-lg leading-relaxed text-celik-600">{aciklama}</p>
    </div>
  );
}

/**
 * Numaralı adım. Numara GERÇEK bir sırayı taşır (önce getir, sonra işine
 * bak, sonra teslim al); süs değildir.
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
    <li className="border-t-2 border-yol-800 pt-5">
      <span className="site-veri text-4xl text-levha-500">{numara}</span>
      <p className="mt-3 text-xl font-extrabold leading-tight text-yol-800 [font-stretch:110%]">{baslik}</p>
      <p className="mt-2 text-lg leading-relaxed text-celik-600">{aciklama}</p>
    </li>
  );
}

/** Madde: mavi kısa çizgi + kısa cümle. */
export function OnayliMadde({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-4 border-t border-yol-800/15 py-3.5">
      <span aria-hidden className="h-0.5 w-5 shrink-0 translate-y-[-0.3em] bg-levha-500" />
      <span className="text-lg leading-relaxed text-yol-950">{children}</span>
    </li>
  );
}

/**
 * Konum tablosu: ulaşım süreleri ve çevre noktaları, tek kaynaktan
 * (konum-bilgisi.ts). Ana sayfadaki teknik veriler tablosuyla aynı dil.
 */
export function KonumTablosu() {
  return (
    <table className="w-full border-collapse">
      <VeriGrubu ad="Ulaşım">
        {ULASIM.map((u) => (
          <VeriSatiri key={u.yer} ad={u.kisaAd} deger={u.sure} />
        ))}
      </VeriGrubu>
      <VeriGrubu ad="Çevre">
        {CEVRE.map((c) => (
          <VeriSatiri key={c.yer} ad={c.yer} deger={c.konum} metin />
        ))}
      </VeriGrubu>
    </table>
  );
}

export function VeriGrubu({ ad, children }: { ad: string; children: React.ReactNode }) {
  return (
    <tbody>
      <tr>
        <th colSpan={2} scope="colgroup" className="site-bro-etiket pb-1 pt-6 text-left text-levha-500">
          {ad}
        </th>
      </tr>
      {children}
    </tbody>
  );
}

/** Teknik veri satırı. `metin`: değer sayı değil sözcük (daha küçük dizilir). */
export function VeriSatiri({ ad, deger, metin = false }: { ad: string; deger: string; metin?: boolean }) {
  return (
    <tr className="border-b border-yol-800/15">
      <th scope="row" className="py-3 pr-4 text-left text-lg font-normal text-celik-600">
        {ad}
      </th>
      <td
        className={`site-veri whitespace-nowrap py-3 text-right text-yol-800 ${
          metin ? "text-lg" : "text-2xl md:text-[1.75rem]"
        }`}
      >
        {deger}
      </td>
    </tr>
  );
}

/** Mavi YOL TARİFİ AL butonu (renk anlamı: mavi = yol tarifi, her yerde). */
export function YolTarifiButonu({
  href,
  testli = false,
  className = "",
}: {
  href: string;
  testli?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-test={testli ? "yol-tarifi" : undefined}
      className={`site-basilabilir flex h-16 items-center justify-center gap-3 whitespace-nowrap rounded-[6px] bg-levha-500 px-8 text-lg font-extrabold tracking-[0.06em] text-white [font-stretch:115%] hover:bg-levha-600 ${className}`}
    >
      YOL TARİFİ AL
      <OkIkonu className="h-5 w-5" />
    </a>
  );
}

/**
 * Sayfa sonu iletişim bloğu: yol tarifi (mavi), WhatsApp ve arama
 * (lacivert çerçeveli). Girilmemiş bilgi için buton ÇİZİLMEZ (kural 20).
 * Butonlar 64/56px — birincil ve ikincil ölçüler.
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 border-t-2 border-yol-800 pt-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
      <div>
        <h2 className="site-bro-baslik text-yol-800">{baslik}</h2>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-celik-600">{aciklama}</p>
      </div>
      <div className="flex max-w-xl flex-col gap-3">
        {mapsUrl ? <YolTarifiButonu href={mapsUrl} testli /> : null}
        {wa || tel ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                data-test="whatsapp"
                className="site-basilabilir flex h-14 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold text-yol-800 hover:bg-yol-800/5"
              >
                <WhatsappIkonu className="h-6 w-6" />
                WhatsApp
              </a>
            ) : null}
            {tel ? (
              <a
                href={tel}
                data-test="ara"
                className="site-basilabilir flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-[6px] border-2 border-yol-800 px-5 text-lg font-bold tabular-nums text-yol-800 hover:bg-yol-800/5"
              >
                <TelefonIkonu className="h-6 w-6 shrink-0" />
                <span className="min-w-0 truncate">{telefon}</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
