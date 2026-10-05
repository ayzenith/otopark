/**
 * TELEFON BAĞLANTILARI (saf fonksiyonlar)
 *
 * Sitedeki "Ara" ve "WhatsApp" butonları için kullanılır. SAF'tır: veritabanı
 * ya da ortam bilgisi okumaz, birim testiyle kapsanır.
 *
 * TÜRKİYE VARSAYIMI: işletme Türkiye'dedir, numaralar TR biçiminde girilir
 * (0555 056 79 79 / 5550567979 / +90 555 056 79 79). WhatsApp bağlantısı
 * ülke kodu ZORUNLU istediği için başa 90 eklenir. Başka bir ülke kodu
 * açıkça yazılmışsa (+49…) ona dokunulmaz.
 *
 * Numara GİRİLMEMİŞSE null döner ve buton hiç çizilmez (mimari kural 19).
 */

/** Yalnızca rakamlar. */
function rakamlar(metin: string): string {
  return metin.replace(/\D/g, "");
}

/**
 * `tel:` bağlantısı. Kullanıcının yazdığı biçim korunur, yalnızca boşluk ve
 * ayraçlar temizlenir; başındaki + işareti kalır.
 */
export function telHref(telefon: string | null | undefined): string | null {
  const ham = (telefon ?? "").trim();
  if (ham === "") return null;

  const artiVarMi = ham.startsWith("+");
  const sayilar = rakamlar(ham);
  if (sayilar.length < 7) return null;

  return `tel:${artiVarMi ? "+" : ""}${sayilar}`;
}

/**
 * `https://wa.me/<numara>` bağlantısı. WhatsApp ülke kodsuz numara KABUL
 * ETMEZ; bu yüzden TR numaraları 90 ile tamamlanır:
 *
 *   0555 056 79 79   → 905550567979
 *   5550567979       → 905550567979
 *   +90 555 056 7979 → 905550567979
 *   +49 170 1234567  → 491701234567  (yabancı numaraya dokunulmaz)
 */
export function whatsappHref(numara: string | null | undefined): string | null {
  const ham = (numara ?? "").trim();
  if (ham === "") return null;

  const sayilar = rakamlar(ham);
  if (sayilar.length < 7) return null;

  // Ulke kodu acikca yazilmis (+ ile baslayan): oldugu gibi kullanilir.
  if (ham.startsWith("+")) return `https://wa.me/${sayilar}`;

  // 90 ile baslayan 12 hane: zaten TR ulke kodlu.
  if (sayilar.length === 12 && sayilar.startsWith("90")) return `https://wa.me/${sayilar}`;

  // 0 ile baslayan 11 hane (0555…): bastaki sifir ulke koduyla degisir.
  if (sayilar.length === 11 && sayilar.startsWith("0")) return `https://wa.me/90${sayilar.slice(1)}`;

  // Sifirsiz 10 hane (555…): dogrudan ulke kodu eklenir.
  if (sayilar.length === 10) return `https://wa.me/90${sayilar}`;

  // Beklenmedik uzunluk: numarayi BOZMADAN oldugu gibi gecer. Yanlis bir
  // ulke kodu eklemektense kullanicinin yazdigini korumak dogrudur.
  return `https://wa.me/${sayilar}`;
}
