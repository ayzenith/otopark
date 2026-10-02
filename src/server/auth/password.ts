/**
 * Parola saklama ve dogrulama - Argon2id.
 *
 * Neden Argon2id: bcrypt'e gore bellek-zorlu (memory-hard), GPU ile kaba kuvvet
 * saldirilarina daha dayanikli ve OWASP'in guncel onerisi.
 */

import { hash, verify } from "@node-rs/argon2";

/** OWASP onerisine yakin parametreler. */
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain, ARGON2_OPTIONS);
  } catch {
    // Bozuk veya eski bicimli hash: dogrulama basarisiz sayilir, hata firlatilmaz.
    return false;
  }
}

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

/**
 * Parola gucu kontrolu. Sunucu tarafinda zorunludur; arayuzdeki kontrol
 * yalnizca kullaniciya erken geri bildirim icindir.
 */
export function checkPasswordStrength(plain: string): PasswordCheck {
  const errors: string[] = [];
  if (plain.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Parola en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  if (!/[a-zçğıöşü]/.test(plain)) errors.push("Parola en az bir küçük harf içermeli.");
  if (!/[A-ZÇĞIÖŞÜ]/.test(plain)) errors.push("Parola en az bir büyük harf içermeli.");
  if (!/[0-9]/.test(plain)) errors.push("Parola en az bir rakam içermeli.");

  const COMMON = ["123456", "password", "parola", "qwerty", "11111", "otopark", "admin"];
  const lower = plain.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    errors.push("Parola kolay tahmin edilebilir bir ifade içeriyor.");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Kriptografik olarak guvenli rastgele parola uretir.
 * Seed sirasinda ilk patron parolasini uretmek icin kullanilir; uretilen parola
 * yalnizca terminal ekranina bir kez yazilir, hicbir dosyaya kaydedilmez.
 *
 * Karistirilabilir karakterler (0/O, 1/l/I) alfabeden cikarildi.
 */
export function generateSecurePassword(length = 16): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length * 2);
  crypto.getRandomValues(bytes);

  let out = "";
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    // Modulo sapmasini onlemek icin tasan degerler atlanir.
    const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
    const b = bytes[i]!;
    if (b >= limit) continue;
    out += ALPHABET[b % ALPHABET.length];
  }

  // Uretilen parolanin guc kontrolunden gectiginden emin ol.
  if (!checkPasswordStrength(out).ok) return generateSecurePassword(length);
  return out;
}
