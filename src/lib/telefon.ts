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
 * Metindeki İLK telefon numarasını ayıklar.
 *
 * İşletmeler tek alana birden fazla numara yazar:
 *   "+90 (212) 555 00 00 / 0555 056 79 79"
 *   "0212 555 00 00 - 0555 056 79 79 (WhatsApp)"
 *
 * Tüm rakamları birleştirmek `tel:+90212555000005550567979` gibi YANLIŞ BİR
 * NUMARA üretir ve müşteri hiçbir yeri arayamaz. Bu yüzden ayraçtan önceki
 * ilk parça alınır.
 *
 * Ayraç sayılanlar: / , ; | • – — ve "ve" bağlacı. Parantez ve tire
 * numaranın KENDİ İÇİNDE geçtiği için ayraç sayılmaz.
 */
function ilkNumaraParcasi(ham: string): string {
  const parca = ham.split(/\s*(?:[/,;|•]|\s[–—]\s|\sve\s)\s*/)[0] ?? ham;
  return parca.trim() === "" ? ham : parca;
}

/**
 * E.164 bir numarayı en fazla 15 haneyle sınırlar. Daha uzunu numara
 * değildir; bağlantı üretilmez ki sessizce yanlış yere aranmasın.
 */
const EN_FAZLA_HANE = 15;

/**
 * `tel:` bağlantısı. Kullanıcının yazdığı biçim korunur, yalnızca boşluk ve
 * ayraçlar temizlenir; başındaki + işareti kalır.
 */
export function telHref(telefon: string | null | undefined): string | null {
  const tam = (telefon ?? "").trim();
  if (tam === "") return null;

  const ham = ilkNumaraParcasi(tam);
  const artiVarMi = ham.startsWith("+");
  const sayilar = rakamlar(ham);
  if (sayilar.length < 7 || sayilar.length > EN_FAZLA_HANE) return null;

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
  const tam = (numara ?? "").trim();
  if (tam === "") return null;

  const ham = ilkNumaraParcasi(tam);
  const sayilar = rakamlar(ham);
  if (sayilar.length < 7 || sayilar.length > EN_FAZLA_HANE) return null;

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
