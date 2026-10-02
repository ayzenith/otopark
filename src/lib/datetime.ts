/**
 * Tarih, saat ve sure islemleri - Turkiye kullanimina gore.
 *
 * KURAL: Veritabaninda her zaman UTC (TIMESTAMPTZ) saklanir, arayuzde
 * Europe/Istanbul gosterilir.
 *
 * ISLETME GUNU: Karar 02.10.2026 - takvim gunu, 00:00-00:00 (Europe/Istanbul).
 * Sinir BUSINESS_DAY_START_HOUR ile yapilandirilabilir; ileride gece vardiyasi
 * icin degistirilebilir.
 */

import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const TIMEZONE = "Europe/Istanbul";

/** Isletme gununun basladigi saat. 0 = takvim gunu (karar: 02.10.2026). */
export const BUSINESS_DAY_START_HOUR = 0;

/** 02.10.2026 */
export function formatDate(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "dd.MM.yyyy");
}

/** 14:32 */
export function formatTime(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "HH:mm");
}

/** 02.10.2026 14:32 */
export function formatDateTime(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "dd.MM.yyyy HH:mm");
}

/** 02.10.2026 14:32:07 */
export function formatDateTimeWithSeconds(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "dd.MM.yyyy HH:mm:ss");
}

/** Form alanlari icin: 2026-10-02 */
export function formatDateInput(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

/**
 * Sureyi Turkce okunabilir bicimde yazar.
 *   0    -> "0 dakika"
 *   45   -> "45 dakika"
 *   60   -> "1 saat"
 *   192  -> "3 saat 12 dakika"
 *   1500 -> "1 gun 1 saat"
 */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const mins = m % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (mins > 0) parts.push(`${mins} dakika`);
  if (parts.length === 0) return "0 dakika";
  // Uzun surelerde dakika gurultu yapar: gun varsa dakikayi gosterme.
  if (days > 0 && parts.length === 3) return `${parts[0]} ${parts[1]}`;
  return parts.join(" ");
}

/** Iki tarih arasindaki dakika farki (asagi yuvarlar). */
export function diffMinutes(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

/**
 * Verilen anin ait oldugu ISLETME GUNUNUN baslangicini UTC olarak dondurur.
 * BUSINESS_DAY_START_HOUR = 0 oldugunda bu, Istanbul saatiyle gece yarisidir.
 */
export function businessDayStart(at: Date = new Date(), startHour = BUSINESS_DAY_START_HOUR): Date {
  const local = toZonedTime(at, TIMEZONE);
  const y = local.getFullYear();
  const mo = local.getMonth();
  const d = local.getDate();
  const h = local.getHours();

  // Gun siniri 00:00 degilse ve saat sinirin altindaysa, onceki isletme gunudur.
  const dayOffset = startHour > 0 && h < startHour ? -1 : 0;
  const base = new Date(y, mo, d + dayOffset, startHour, 0, 0, 0);
  return fromZonedTime(base, TIMEZONE);
}

/** Isletme gununun bitisi (bir sonraki gunun baslangici). */
export function businessDayEnd(at: Date = new Date(), startHour = BUSINESS_DAY_START_HOUR): Date {
  const start = businessDayStart(at, startHour);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** Gunluk raporlar icin [baslangic, bitis) araligi. */
export function businessDayRange(at: Date = new Date()): { start: Date; end: Date } {
  return { start: businessDayStart(at), end: businessDayEnd(at) };
}

/** Istanbul saatine gore gunun dakikasi (00:00 -> 0, 20:30 -> 1230). */
export function minuteOfDay(at: Date): number {
  const local = toZonedTime(at, TIMEZONE);
  return local.getHours() * 60 + local.getMinutes();
}

/** Istanbul saatine gore hafta sonu mu? (Cumartesi/Pazar) */
export function isWeekend(at: Date): boolean {
  const day = toZonedTime(at, TIMEZONE).getDay();
  return day === 0 || day === 6;
}

/** Iki tarih arasindaki tam gun sayisi (abonman kalan gun hesabi icin). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}
