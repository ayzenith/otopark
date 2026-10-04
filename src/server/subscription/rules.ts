/**
 * ABONMAN GECERLILIK KURALLARI - SAF FONKSIYON KATMANI
 *
 * ============================================================================
 * MEVCUT ISLETME KURALI (S11, onay 04.10.2026)
 * ----------------------------------------------------------------------------
 * Standart abonman UNLIMITED_7_24'tur:
 *   - 7 gun 24 saat gecerlidir,
 *   - gunluk giris/cikis sayisinda limit YOKTUR,
 *   - abonman aktif oldugu surece arac gunun her saatinde girip cikabilir.
 *
 * Asagidaki diger kural turleri ILERIDE farkli abonman tipleri tanimlanabilsin
 * diye modellenmistir. Su anda:
 *   - arayuzden SECILEMEZ,
 *   - abonman olusturma servisi yalnizca UNLIMITED_7_24 kabul eder,
 *   - dolayisiyla hicbir gercek kayitta kullanilmaz.
 * Burada yazili olmalari, veri modelinin ve hesap mantiginin ileride sema
 * degisikligi gerektirmeden genisletilebilecegini GARANTI eder.
 *
 * FIYAT YOKTUR: bu dosya yalnizca "kapsam var mi?" sorusunu yanitlar.
 * Hicbir ticari fiyat veya isletme degeri icermez.
 * ============================================================================
 */

import { z } from "zod";
import { isWeekend, minuteOfDay } from "@/lib/datetime";

export type KuralTuru =
  | "UNLIMITED_7_24"
  | "TIME_WINDOW"
  | "WEEKDAY_ONLY"
  | "WEEKEND_ONLY"
  | "ENTRY_QUOTA";

/** Su anda isletmede kullanilan tek kural. */
export const VARSAYILAN_KURAL: KuralTuru = "UNLIMITED_7_24";

/**
 * Arayuzde secilebilen kural turleri.
 *
 * Patronun onayi olmadan yeni abonman tipi devreye alinmaz; bu yuzden liste
 * tek elemanlidir. Yeni tip eklemek icin BURAYA eklenmesi yeterlidir -
 * sema, dogrulama ve hesap mantigi hazirdir.
 */
export const SECILEBILIR_KURALLAR: readonly KuralTuru[] = ["UNLIMITED_7_24"] as const;

export const KURAL_ETIKETLERI: Record<KuralTuru, string> = {
  UNLIMITED_7_24: "7/24 sınırsız giriş-çıkış",
  TIME_WINDOW: "Belirli saat aralığı",
  WEEKDAY_ONLY: "Yalnızca hafta içi",
  WEEKEND_ONLY: "Yalnızca hafta sonu",
  ENTRY_QUOTA: "Giriş sayısı limitli",
};

// ---------------------------------------------------------------------------
// KURAL PARAMETRE SEMALARI
// ---------------------------------------------------------------------------

/** Saat araligi kurali: gun icindeki dakika cinsinden [baslangic, bitis). */
export const SaatAraligiSemasi = z.object({
  baslangicDakika: z.number().int().min(0).max(1439),
  bitisDakika: z.number().int().min(0).max(1439),
});

/** Giris sayisi limiti. kapsam: gun veya donem basina. */
export const GirisKotasiSemasi = z.object({
  adet: z.number().int().positive(),
  kapsam: z.enum(["GUN", "DONEM"]),
});

export type SaatAraligi = z.infer<typeof SaatAraligiSemasi>;
export type GirisKotasi = z.infer<typeof GirisKotasiSemasi>;

/**
 * Depolanmis kural parametrelerini turune gore dogrular.
 *
 * Bozuk/eksik parametre SESSIZCE gecirilmez: hata firlatilir. Abonman
 * kapsaminin "belki" olmasi kabul edilemez - musteriye ya ucretsiz denir
 * ya denmez.
 */
export function dogrulaKuralParametresi(tur: KuralTuru, deger: unknown): unknown {
  switch (tur) {
    case "UNLIMITED_7_24":
    case "WEEKDAY_ONLY":
    case "WEEKEND_ONLY":
      // Parametre gerektirmez.
      return null;
    case "TIME_WINDOW":
      return SaatAraligiSemasi.parse(deger);
    case "ENTRY_QUOTA":
      return GirisKotasiSemasi.parse(deger);
  }
}

// ---------------------------------------------------------------------------
// KAPSAM DEGERLENDIRME
// ---------------------------------------------------------------------------

export interface KuralGirdisi {
  tur: KuralTuru;
  parametre: unknown;
  /** Degerlendirme ani (giris veya cikis ani). */
  an: Date;
  /**
   * Kota kurali icin: bu abonmanin ilgili kapsamda (gun/donem) kac girisi var.
   * Diger kurallarda kullanilmaz. Sayim veritabaninda yapilir; bu fonksiyon
   * saf kalir.
   */
  mevcutGirisSayisi?: number;
}

export interface KuralSonucu {
  /** Abonman bu anda kapsam veriyor mu? */
  kapsamda: boolean;
  /** Kapsam disiysa personele gosterilecek gerekce. */
  gerekce: string | null;
  /** Uygulanan kuralin insan okunur adi (denetim ve ekran icin). */
  kuralAdi: string;
}

/**
 * Abonman verilen anda kapsam veriyor mu?
 *
 * SAF FONKSIYON: veritabani, saat, rastgelelik kullanmaz. Tum girdi
 * parametreden gelir, boylece her senaryo testle kanitlanabilir.
 */
export function kapsamDegerlendir(girdi: KuralGirdisi): KuralSonucu {
  const kuralAdi = KURAL_ETIKETLERI[girdi.tur];

  switch (girdi.tur) {
    // Mevcut standart: her zaman kapsamda.
    case "UNLIMITED_7_24":
      return { kapsamda: true, gerekce: null, kuralAdi };

    case "WEEKDAY_ONLY": {
      const haftaSonu = isWeekend(girdi.an);
      return {
        kapsamda: !haftaSonu,
        gerekce: haftaSonu ? "Abonman yalnızca hafta içi geçerli." : null,
        kuralAdi,
      };
    }

    case "WEEKEND_ONLY": {
      const haftaSonu = isWeekend(girdi.an);
      return {
        kapsamda: haftaSonu,
        gerekce: haftaSonu ? null : "Abonman yalnızca hafta sonu geçerli.",
        kuralAdi,
      };
    }

    case "TIME_WINDOW": {
      const aralik = SaatAraligiSemasi.parse(girdi.parametre);
      const dakika = minuteOfDay(girdi.an);
      const icinde = saatAraligindaMi(dakika, aralik);
      return {
        kapsamda: icinde,
        gerekce: icinde
          ? null
          : `Abonman yalnızca ${dakikaSaate(aralik.baslangicDakika)} - ` +
            `${dakikaSaate(aralik.bitisDakika)} arasında geçerli.`,
        kuralAdi,
      };
    }

    case "ENTRY_QUOTA": {
      const kota = GirisKotasiSemasi.parse(girdi.parametre);
      const mevcut = girdi.mevcutGirisSayisi ?? 0;
      const kaldi = kota.adet - mevcut;
      return {
        kapsamda: kaldi > 0,
        gerekce:
          kaldi > 0
            ? null
            : `Abonman ${kota.kapsam === "GUN" ? "günlük" : "dönem"} giriş hakkı doldu ` +
              `(${kota.adet} giriş).`,
        kuralAdi,
      };
    }
  }
}

/**
 * Gun dakikasi verilen aralikta mi? Gece yarisini asan aralik desteklenir
 * (orn. 22:00 - 06:00). Ucret motorundaki gece araligi mantigiyla aynidir.
 */
export function saatAraligindaMi(gunDakikasi: number, aralik: SaatAraligi): boolean {
  const { baslangicDakika: bas, bitisDakika: bit } = aralik;
  // Esit degerler "tum gun" anlamina gelir (00:00 - 00:00 gibi).
  if (bas === bit) return true;
  if (bas < bit) return gunDakikasi >= bas && gunDakikasi < bit;
  return gunDakikasi >= bas || gunDakikasi < bit;
}

function dakikaSaate(dakika: number): string {
  const s = Math.floor(dakika / 60);
  const d = dakika % 60;
  return `${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}`;
}
