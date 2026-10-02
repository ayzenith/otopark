"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Alt gezinme cubugu - EN FAZLA 4 SEKME (docs/01.4).
 * 56px yukseklik + guvenli alan dolgusu. Basparmak erisimi icin altta.
 *
 * Patron ek bolumlere "Diger" sekmesinden ulasir; alt cubuga daha fazla
 * sekme eklenmez, cunku dokunma hedefleri kuculur.
 */
const SEKMELER = [
  { href: "/vardiya", etiket: "Ana", ikon: "🏠" },
  { href: "/araclar", etiket: "Araçlar", ikon: "🚗" },
  { href: "/yikama", etiket: "Yıkama", ikon: "🧼" },
  { href: "/diger", etiket: "Diğer", ikon: "☰" },
] as const;

export function AltGezinme() {
  const yol = usePathname();

  return (
    <nav
      aria-label="Ana gezinme"
      className="guvenli-alt fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white"
    >
      <ul className="mx-auto flex w-full max-w-3xl">
        {SEKMELER.map((s) => {
          const aktif = yol === s.href || yol.startsWith(`${s.href}/`);
          return (
            <li key={s.href} className="flex-1">
              <Link
                href={s.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "gecis flex h-14 flex-col items-center justify-center gap-0.5",
                  aktif ? "text-lacivert-600" : "text-slate-400",
                )}
              >
                <span aria-hidden className="text-xl leading-none">
                  {s.ikon}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide">{s.etiket}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
