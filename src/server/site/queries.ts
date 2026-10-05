/**
 * KURUMSAL SİTE - PUBLIC OKUMA KATMANI
 *
 * ============================================================================
 * EN ÖNEMLİ KURAL: BU DOSYA HİÇBİR ŞEY UYDURMAZ.
 * ----------------------------------------------------------------------------
 * İşletme künyesi (adres, telefon, çalışma saati), sitede gösterilecek
 * fiyatlar ve galeri görselleri İŞLETME TARAFINDAN VERİLMEDİ (docs/07 S18-S19,
 * 05.10.2026 itibarıyla hâlâ açık). Bu yüzden:
 *
 *   · girilmemiş alan BOŞ döner, yer tutucu metinle DOLDURULMAZ,
 *   · site o bölümü hiç çizmez (yanlış bilgi göstermektense hiç gösterme),
 *   · patron panelinde "sitede eksik bilgi" sayacına girer.
 *
 * Fiyat kuralı daha da katıdır: site, otopark tarifesini veya yıkama fiyat
 * tablosunu KENDİ OKUMAZ. Yalnızca patronun "bunu sitede göster" diyerek
 * `SitePublicPrice` satırı olarak yazdığı metni gösterir. Böylece panelde bir
 * fiyat değişince site kendiliğinden değişmez; patron ne yazdıysa o görünür.
 * (Abonman fiyatı kişiye özeldir ve sitede YAZILMAZ - S19.)
 * ============================================================================
 */

import { prisma } from "@/server/db";

/** Sitenin tanıdığı sayfa anahtarları. Yeni sayfa eklemek için buraya satır eklenir. */
export const SITE_SAYFA_ANAHTARLARI = {
  ANASAYFA: "anasayfa",
  OTOPARK: "otopark",
  YIKAMA: "yikama",
  ILETISIM: "iletisim",
} as const;

export type SiteSayfaAnahtari =
  (typeof SITE_SAYFA_ANAHTARLARI)[keyof typeof SITE_SAYFA_ANAHTARLARI];

export const SITE_SAYFA_BASLIKLARI: Record<SiteSayfaAnahtari, string> = {
  anasayfa: "Ana sayfa",
  otopark: "Otopark",
  yikama: "Oto yıkama",
  iletisim: "İletişim",
};

export interface SiteKunyesi {
  isletmeAdi: string;
  adres: string | null;
  mapsUrl: string | null;
  telefon: string | null;
  whatsapp: string | null;
  calismaSaatleri: string | null;
  instagram: string | null;
}

export interface SiteSayfasi {
  anahtar: string;
  baslik: string;
  govde: string;
}

export interface SiteFiyatSatiri {
  id: string;
  etiket: string;
  fiyatMetni: string;
  not: string | null;
}

export interface SiteGorseli {
  id: string;
  url: string;
  alt: string;
}

export interface SiteIcerigi {
  kunye: SiteKunyesi;
  sayfalar: Record<string, SiteSayfasi>;
  fiyatlar: SiteFiyatSatiri[];
  galeri: SiteGorseli[];
  /** Girilmediği için sitede GÖSTERİLMEYEN alanlar. Patron paneli bunu listeler. */
  eksikler: string[];
}

/** Boş/boşluk metni null'a çevirir. "" ile null arasındaki farkı tek yerde kapatır. */
function bosNull(deger: string | null | undefined): string | null {
  const t = (deger ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Sitenin ihtiyaç duyduğu her şeyi tek seferde okur.
 *
 * Oturum GEREKTİRMEZ: public taraf hiçbir müşteri/işlem verisine dokunmaz.
 * Okuduğu tek tablolar: BusinessSetting, SitePage, SitePublicPrice,
 * SiteGalleryImage.
 */
export async function siteIcerigi(): Promise<SiteIcerigi> {
  const [ayar, sayfalar, fiyatlar, galeri] = await Promise.all([
    prisma.businessSetting.findUnique({ where: { id: "singleton" } }),
    prisma.sitePage.findMany({ where: { isPublished: true } }),
    prisma.sitePublicPrice.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.siteGalleryImage.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const kunye: SiteKunyesi = {
    isletmeAdi: bosNull(ayar?.businessName) ?? "Londra Camping",
    adres: bosNull(ayar?.addressText),
    mapsUrl: bosNull(ayar?.mapsUrl),
    telefon: bosNull(ayar?.phone),
    whatsapp: bosNull(ayar?.whatsappPhone),
    calismaSaatleri: bosNull(ayar?.workingHoursText),
    instagram: bosNull(ayar?.instagramUrl),
  };

  const eksikler: string[] = [];
  if (!kunye.adres) eksikler.push("Adres");
  if (!kunye.telefon) eksikler.push("Telefon");
  if (!kunye.calismaSaatleri) eksikler.push("Çalışma saatleri");
  if (!kunye.mapsUrl) eksikler.push("Google Maps bağlantısı");
  if (fiyatlar.length === 0) eksikler.push("Sitede gösterilecek fiyatlar");
  if (galeri.length === 0) eksikler.push("Galeri görselleri");

  const sayfaHaritasi: Record<string, SiteSayfasi> = {};
  for (const s of sayfalar) {
    const govde = s.bodyMarkdown.trim();
    // Yayında ama metni boş bırakılmış sayfa gösterilmez: boş bir başlık
    // ziyaretçiye "site yarım" izlenimi verir.
    if (govde === "") continue;
    sayfaHaritasi[s.key] = { anahtar: s.key, baslik: s.title, govde };
  }
  if (!sayfaHaritasi[SITE_SAYFA_ANAHTARLARI.ANASAYFA]) {
    eksikler.push("Ana sayfa tanıtım metni");
  }

  return {
    kunye,
    sayfalar: sayfaHaritasi,
    fiyatlar: fiyatlar.map((f) => ({
      id: f.id,
      etiket: f.label,
      fiyatMetni: f.priceText,
      not: bosNull(f.sourceNote),
    })),
    galeri: galeri.map((g) => ({ id: g.id, url: g.url, alt: g.alt })),
    eksikler,
  };
}

/** Panelde düzenleme için: yayında olsun olmasın TÜM sayfalar. */
export async function siteSayfalariYonetim() {
  const kayitlar = await prisma.sitePage.findMany({ orderBy: { key: "asc" } });
  const harita = new Map(kayitlar.map((k) => [k.key, k]));

  // Tanımlı her anahtar için bir satır döner; kaydı olmayan anahtar BOŞ gelir
  // ki patron paneli "bu sayfa henüz yazılmamış" diye gösterebilsin.
  return Object.values(SITE_SAYFA_ANAHTARLARI).map((anahtar) => {
    const kayit = harita.get(anahtar);
    return {
      anahtar,
      varsayilanBaslik: SITE_SAYFA_BASLIKLARI[anahtar],
      baslik: kayit?.title ?? "",
      govde: kayit?.bodyMarkdown ?? "",
      yayinda: kayit?.isPublished ?? false,
      guncellendi: kayit?.updatedAt ?? null,
    };
  });
}

/** Panelde düzenleme için: yayından kaldırılmış satırlar DAHİL tüm fiyat satırları. */
export async function siteFiyatlariYonetim() {
  return prisma.sitePublicPrice.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

/** Panelde düzenleme için: tüm galeri görselleri. */
export async function siteGalerisiYonetim() {
  return prisma.siteGalleryImage.findMany({ orderBy: { sortOrder: "asc" } });
}
