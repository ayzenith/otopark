/**
 * Kullaniciya GOSTERILEBILIR is hatalari.
 *
 * Neden ayri bir dosya: hem is mantigi katmani (src/server/parking, shift, ...)
 * hem yetki katmani (authz) bu tipi tanimak zorunda. Ayri dosyada olmasi
 * dairesel import'u (circular dependency) onler.
 *
 * KURAL: IslemHatasi mesajlari KULLANICIYA AYNEN GOSTERILIR. Bu yuzden
 * mesajlar Turkce, anlasilir ve eylem onerir ("Yine de kaydedebilirsiniz",
 * "Çıkış işlemi yapmak ister misiniz?"). Beklenmeyen hatalar ise asla
 * kullaniciya sizdirilmaz; genel bir mesaja cevrilir.
 */

export class IslemHatasi extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "IslemHatasi";
    this.code = code;
  }
}
