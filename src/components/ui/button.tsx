import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "birincil" | "ikincil" | "basari" | "uyari" | "tehlike" | "sade" | "cerceve";
type Size = "islem" | "ikincil" | "normal" | "kucuk";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Tam genislik - mobilde birincil islemler icin varsayilan. */
  tamGenislik?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  birincil: "bg-lacivert-600 text-white hover:bg-lacivert-500 active:bg-lacivert-700",
  ikincil: "bg-mavi-500 text-white hover:bg-mavi-600 active:bg-mavi-700",
  basari: "bg-basari text-white hover:brightness-110 active:brightness-95",
  uyari: "bg-uyari text-white hover:brightness-110 active:brightness-95",
  tehlike: "bg-hata text-white hover:brightness-110 active:brightness-95",
  sade: "bg-white text-lacivert-700 border border-slate-300 hover:bg-slate-50",
  cerceve: "bg-transparent text-lacivert-600 hover:bg-lacivert-50",
};

/** Dokunma hedefi: hicbir boyut 48px'in altina inmez. */
const SIZES: Record<Size, string> = {
  islem: "h-16 text-lg font-bold px-5", // 64px - araç giriş/çıkış gibi birincil işlemler
  ikincil: "h-14 text-base font-semibold px-4", // 56px
  normal: "h-12 text-base font-semibold px-4", // 48px - minimum
  kucuk: "h-12 text-sm font-medium px-3", // yüksekliği düşürmüyoruz, yalnızca yazıyı
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "birincil", size = "normal", tamGenislik, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "gecis inline-flex items-center justify-center gap-2 rounded-xl",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        tamGenislik && "w-full",
        className,
      )}
      {...props}
    />
  );
});
