import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-xs font-bold uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

/** Sayac karti - ana ekrandaki "otoparkta 47 araç" gibi gostergeler icin. */
export function SayacKarti({
  etiket,
  deger,
  altMetin,
  renk = "lacivert",
}: {
  etiket: string;
  deger: string | number;
  altMetin?: string;
  renk?: "lacivert" | "mavi" | "basari" | "uyari";
}) {
  const renkler = {
    lacivert: "text-lacivert-600",
    mavi: "text-mavi-600",
    basari: "text-basari",
    uyari: "text-uyari",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm">
      <div className={cn("rakam text-3xl font-extrabold leading-none", renkler[renk])}>
        {deger}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">
        {etiket}
      </div>
      {altMetin ? <div className="mt-0.5 text-[11px] text-slate-400">{altMetin}</div> : null}
    </div>
  );
}
