import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  etiket?: string;
  hata?: string;
  yardim?: string;
}

/**
 * Metin girisi. Yazi boyutu 16px'in altina inmez: iOS Safari daha kucuk
 * punto gorunce input'a dokunuldugunda sayfayi otomatik yakinlastirir.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, etiket, hata, yardim, id, ...props },
  ref,
) {
  const inputId = id ?? props.name ?? undefined;
  return (
    <div className="w-full">
      {etiket ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
        >
          {etiket}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={hata ? true : undefined}
        aria-describedby={hata && inputId ? `${inputId}-hata` : undefined}
        className={cn(
          "h-12 w-full rounded-xl border-2 bg-white px-3 text-base text-lacivert-800",
          "placeholder:text-slate-400",
          hata ? "border-hata" : "border-slate-300 focus:border-mavi-500",
          "gecis outline-none",
          className,
        )}
        {...props}
      />
      {hata ? (
        <p id={inputId ? `${inputId}-hata` : undefined} className="mt-1 text-sm font-semibold text-hata">
          {hata}
        </p>
      ) : yardim ? (
        <p className="mt-1 text-sm text-slate-500">{yardim}</p>
      ) : null}
    </div>
  );
});

/**
 * Plaka girisi - personel ana ekraninin EN BELIRGIN ogesi.
 *
 * Mobil davranis notlari:
 *  - autoFocus KULLANILMAZ: sayfa acilir acilmaz klavye acilip sayaclari
 *    gizlemesin (docs/04.2). Tek dokunusla odaklanir.
 *  - autoCapitalize/autoCorrect/spellCheck kapali: telefon plakayi "duzeltmesin".
 *  - 64px yukseklik, 28px mono yazi.
 */
export const PlakaInput = React.forwardRef<HTMLInputElement, InputProps>(function PlakaInput(
  { className, etiket = "Plaka", hata, id = "plaka", ...props },
  ref,
) {
  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600"
      >
        {etiket}
      </label>
      <input
        ref={ref}
        id={id}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        placeholder="34 ABC 123"
        aria-invalid={hata ? true : undefined}
        className={cn(
          "plaka-input h-16 w-full rounded-xl border-2 bg-white px-4 text-center",
          hata ? "border-hata" : "border-lacivert-300 focus:border-mavi-500",
          "gecis text-lacivert-800 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 outline-none",
          className,
        )}
        {...props}
      />
      {hata ? <p className="mt-1.5 text-sm font-semibold text-hata">{hata}</p> : null}
    </div>
  );
});
