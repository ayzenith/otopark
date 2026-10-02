/**
 * Para islemleri.
 *
 * KURAL: Para asla kayan noktali sayi (float) ile tutulmaz. Veritabaninda
 * Decimal(12,2), uygulama icinde ise tamsayi KURUS olarak hesaplanir.
 * Boylece 0.1 + 0.2 = 0.30000000000000004 gibi hatalar olusmaz.
 */

export type Kurus = number;

/** Lira (ondalikli) -> kurus (tamsayi). 185.5 -> 18550 */
export function liraToKurus(lira: number | string): Kurus {
  const n = typeof lira === "string" ? Number(lira.replace(",", ".")) : lira;
  if (!Number.isFinite(n)) throw new Error(`Gecersiz tutar: ${lira}`);
  return Math.round(n * 100);
}

/** Kurus -> lira (ondalikli). 18550 -> 185.5 */
export function kurusToLira(kurus: Kurus): number {
  return Math.round(kurus) / 100;
}

/** Veritabanina yazmak icin ondalikli metin: 18550 -> "185.50" */
export function kurusToDecimalString(kurus: Kurus): string {
  const k = Math.round(kurus);
  const sign = k < 0 ? "-" : "";
  const abs = Math.abs(k);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Prisma Decimal / string / number -> kurus */
export function toKurus(value: { toString(): string } | number | string | null | undefined): Kurus {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return liraToKurus(value);
  return liraToKurus(value.toString());
}

const TRY_FORMAT = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 18550 -> "185,50 ₺" */
export function formatKurus(kurus: Kurus): string {
  return TRY_FORMAT.format(kurusToLira(kurus));
}

/** 185.5 -> "185,50 ₺" */
export function formatLira(lira: number): string {
  return TRY_FORMAT.format(lira);
}

/** Simge olmadan: 18550 -> "185,50" */
export function formatKurusPlain(kurus: Kurus): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kurusToLira(kurus));
}

/** Kurusu en yakin tam liraya yuvarlar (tarife kurallarinda kullanilabilir). */
export function roundToLira(kurus: Kurus): Kurus {
  return Math.round(kurus / 100) * 100;
}

/** Negatife dusmeyi engeller. */
export function clampNonNegative(kurus: Kurus): Kurus {
  return kurus < 0 ? 0 : kurus;
}
