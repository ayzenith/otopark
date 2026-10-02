import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind sinif birlestirme yardimcisi. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Islem kodu uretir: P-261002-0143 gibi.
 * prefix: P (park), Y (yikama), A (abonman), T (tahsilat), G (gider)
 */
export function buildCode(prefix: string, date: Date, sequence: number): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${prefix}-${yy}${mm}${dd}-${String(sequence).padStart(4, "0")}`;
}
