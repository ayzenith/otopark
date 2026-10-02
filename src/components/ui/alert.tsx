import * as React from "react";
import { cn } from "@/lib/utils";

type Tur = "bilgi" | "basari" | "uyari" | "hata";

const STILLER: Record<Tur, { kutu: string; ikon: string }> = {
  bilgi: { kutu: "bg-mavi-50 border-mavi-200 text-mavi-700", ikon: "i" },
  basari: { kutu: "bg-basari-acik border-green-300 text-green-900", ikon: "✓" },
  uyari: { kutu: "bg-uyari-acik border-amber-300 text-amber-900", ikon: "!" },
  hata: { kutu: "bg-hata-acik border-red-300 text-red-900", ikon: "⛔" },
};

/**
 * Uyari kutusu. Personel yanlis islem yaptiginda ACIK ve BUYUK gosterilir;
 * kucuk, gozden kacan uyarilar kullanilmaz (docs/04).
 */
export function Alert({
  tur = "bilgi",
  baslik,
  children,
  className,
}: {
  tur?: Tur;
  baslik?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const stil = STILLER[tur];
  return (
    <div
      role={tur === "hata" ? "alert" : "status"}
      // data-uyari: testlerde Next.js'in kendi route announcer'indan ayirt
      // edilebilmesi icin (o da role="alert" tasiyor).
      data-uyari={tur}
      className={cn("flex gap-3 rounded-xl border-2 px-4 py-3", stil.kutu, className)}
    >
      <span aria-hidden className="shrink-0 pt-0.5 text-lg font-bold leading-none">
        {stil.ikon}
      </span>
      <div className="min-w-0 flex-1">
        {baslik ? <div className="text-base font-bold leading-snug">{baslik}</div> : null}
        {children ? <div className="mt-0.5 text-sm leading-snug">{children}</div> : null}
      </div>
    </div>
  );
}

/** Abonman ve durum rozetleri. */
export function Rozet({
  tur = "notr",
  children,
}: {
  tur?: "notr" | "basari" | "uyari" | "hata" | "mavi";
  children: React.ReactNode;
}) {
  const stiller = {
    notr: "bg-slate-100 text-slate-700 border-slate-300",
    basari: "bg-basari-acik text-green-900 border-green-400",
    uyari: "bg-uyari-acik text-amber-900 border-amber-400",
    hata: "bg-hata-acik text-red-900 border-red-400",
    mavi: "bg-mavi-50 text-mavi-700 border-mavi-300",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-1 text-xs font-bold uppercase tracking-wide",
        stiller[tur],
      )}
    >
      {children}
    </span>
  );
}
