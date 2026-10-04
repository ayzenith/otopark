/**
 * Tarife anlik kopyasi (snapshot) ve ucret hesaplama tipleri.
 *
 * ONEMLI: tariffSnapshot veritabaninda JSONB olarak saklanir. Okunurken Zod ile
 * DOGRULANIR, cunku eski kayitlarin bicimi zamanla degisebilir ve bozuk bir
 * snapshot yuzunden yanlis ucret hesaplanmasi kabul edilemez.
 */

import { z } from "zod";

/**
 * Kurus cinsinden tamsayi tutar. Para asla float ile tasinmaz.
 * Veritabanindaki Decimal(12,2) degerler snapshot'a yazilirken kurusa cevrilir.
 */
export const KurusSemasi = z.number().int().min(0);

/**
 * Snapshot'in bicim surumu. Hesaplama motoru hangi surumle ugrastigini bilir;
 * ileride alan eklenirse eski kayitlar dogru yorumlanmaya devam eder.
 */
export const SNAPSHOT_SURUMU = 1 as const;

export const TarifeSnapshotSemasi = z.object({
  /** Snapshot bicim surumu. */
  surum: z.literal(1),

  /** Izlenebilirlik: hangi plan/surum/kural uygulandi. */
  planId: z.string(),
  planAdi: z.string(),
  surumId: z.string(),
  surumNo: z.number().int(),
  kuralId: z.string(),
  aracSinifiId: z.string().nullable(),
  aracSinifiAdi: z.string().nullable(),

  /** Ucretsiz sure (dakika). */
  ucretsizDakika: z.number().int().min(0),
  /** Ucretsiz sure toplam ucretli sureden dusulsun mu? */
  ucretsizDusulur: z.boolean(),

  /** Ilk blok: "ilk N dakika M kurus". */
  ilkBlokDakika: z.number().int().min(0),
  ilkBlokUcret: KurusSemasi,

  /** Saatlik ucret ve yuvarlama birimi (60 = baslayan saat tam sayilir). */
  saatlikUcret: KurusSemasi,
  saatYuvarlamaDakika: z.number().int().min(1),

  /** Tam gun (24 saat) ucreti. 0 = tanimsiz. */
  gunlukUcret: KurusSemasi,
  /** Gunluk ust limit. 0 = limit yok. */
  gunlukUstLimit: KurusSemasi,

  /** Gece tarifesi. Hepsi birlikte tanimli olmalidir, yoksa uygulanmaz. */
  geceSabitUcret: KurusSemasi.nullable(),
  geceBaslangicDakika: z.number().int().min(0).max(1439).nullable(),
  geceBitisDakika: z.number().int().min(0).max(1439).nullable(),

  /** Hafta sonu katsayisi (ornek: 1.25). null = uygulanmaz. */
  haftaSonuKatsayisi: z.number().positive().nullable(),

  /** Asgari ucret. */
  asgariUcret: KurusSemasi,
});

export type TarifeSnapshot = z.infer<typeof TarifeSnapshotSemasi>;

/** Hesap dokumunun bir satiri - personel ekraninda seffaf gosterilir. */
export interface DokumSatiri {
  aciklama: string;
  tutar: number; // kurus
}

export interface UcretSonucu {
  /** Toplam park suresi (dakika). */
  sureDakika: number;
  /** Hesaplanan tutar (kurus). */
  tutar: number;
  /** Personel ekraninda gosterilecek hesap dokumu. */
  dokum: DokumSatiri[];
  /** Ucretsiz sure icinde mi cikildi? */
  ucretsizMi: boolean;
  /**
   * Tarifede hicbir fiyat tanimli degil mi?
   *
   * true ise ucret 0 cikar ama bu "bedava" demek DEGILDIR: patron henuz
   * tarife girmemistir. Arayuz bu durumda BUYUK bir uyari gosterir ve
   * islem notuna yazilir - sessizce 0 TL tahsil edilmis gibi davranilmaz.
   */
  tarifeTanimsiz: boolean;
  /** Uygulanan ozel kurallar (gece tarifesi, ust limit vb.). */
  uygulananKurallar: string[];
}
