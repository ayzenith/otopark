/**
 * Turkiye plaka normalizasyonu ve dogrulamasi.
 *
 * Normalizasyon neden gerekli: personel plakayi "34 abc 123", "34ABC123" veya
 * Turkce klavyeden "34 ABÇ 123" gibi yazabilir. Aramanin ve tekillik kontrolunun
 * guvenilir olmasi icin tek bir kanonik bicim kullanilir.
 */

/** Turkce karakterlerin plaka baglaminda ASCII karsiliklari. */
const TURKISH_MAP: Record<string, string> = {
  İ: "I", I: "I", ı: "I", i: "I",
  Ş: "S", ş: "S",
  Ğ: "G", ğ: "G",
  Ü: "U", ü: "U",
  Ö: "O", ö: "O",
  Ç: "C", ç: "C",
};

/**
 * Plakayi kanonik bicime cevirir: buyuk harf, bosluk/noktalama yok,
 * Turkce karakterler ASCII'ye donusturulmus.
 *
 * "34 abc 123" -> "34ABC123"
 */
export function normalizePlate(input: string): string {
  if (!input) return "";
  let out = "";
  for (const ch of input.trim()) {
    const mapped = TURKISH_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    // Yalnizca harf ve rakam korunur; bosluk, tire, nokta atilir.
    if (/[0-9]/.test(ch)) out += ch;
    else if (/[a-zA-Z]/.test(ch)) out += ch.toUpperCase();
  }
  return out;
}

/**
 * Turkiye plaka bicimi kontrolu.
 *
 * Gecerli desenler (il kodu 01-81 + harf + rakam):
 *   2 rakam + 1 harf  + 4-5 rakam   (34 A 1234)
 *   2 rakam + 2 harf  + 3-4 rakam   (34 AB 123)
 *   2 rakam + 3 harf  + 2-3 rakam   (34 ABC 12)
 *
 * NOT: Yabanci ve gecici plakalar bu desene uymaz. Sistem bu durumda girisi
 * ENGELLEMEZ; personeli uyarir ve not girilerek kayit yapilmasina izin verir
 * (bkz. docs/04 - arac girisi akisi).
 */
export function isValidTurkishPlate(plate: string): boolean {
  const p = normalizePlate(plate);
  if (!/^(0[1-9]|[1-7][0-9]|8[01])/.test(p)) return false;
  return (
    /^[0-9]{2}[A-Z]{1}[0-9]{4,5}$/.test(p) ||
    /^[0-9]{2}[A-Z]{2}[0-9]{3,4}$/.test(p) ||
    /^[0-9]{2}[A-Z]{3}[0-9]{2,3}$/.test(p)
  );
}

/**
 * Plakayi okunabilir bicimde gosterir: "34ABC123" -> "34 ABC 123".
 * Desene uymayan girdiler oldugu gibi dondurulur.
 */
export function formatPlate(plate: string): string {
  const p = normalizePlate(plate);
  const m = /^([0-9]{2})([A-Z]{1,3})([0-9]{2,5})$/.exec(p);
  if (!m) return p;
  return `${m[1]} ${m[2]} ${m[3]}`;
}

/** Il kodunu dondurur (01-81), bulunamazsa null. */
export function getProvinceCode(plate: string): string | null {
  const p = normalizePlate(plate);
  const m = /^(0[1-9]|[1-7][0-9]|8[01])/.exec(p);
  return m ? m[1]! : null;
}
