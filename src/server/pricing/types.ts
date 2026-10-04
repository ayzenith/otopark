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
 *
 * SURUM 2 (04.10.2026): `ekGunBlokUcret` alani eklendi. Surum 1 snapshot'lar
 * bu alani tasimaz; okunurken 0 varsayilir ve bu TAM OLARAK o kayitlarin
 * giriste hesaplandigi davranistir (ozellik kapali). Boylece Asama 2-3'te
 * olusan park kayitlari aynen dogru fiyatlanmaya devam eder.
 */
export const SNAPSHOT_SURUMU = 2 as const;

export const TarifeSnapshotSemasi = z.object({
  /** Snapshot bicim surumu (1 veya 2). */
  surum: z.union([z.literal(1), z.literal(2)]),

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

  /**
   * 24 SAAT SONRASI EK BLOK UCRETI (karar 04.10.2026).
   *
   * 0'dan buyukse: ilk 24 saat saatlik kademeden hesaplanir ve gunluk ust
   * limitle sinirlanir; 24 saatten sonra BASLAYAN her 24 saatlik blok icin bu
   * tutar SABIT eklenir. 24 sa 1 dk park, bir ek blok baslatmis sayilir.
   *
   * 0 ise bu model kapalidir ve tam gunler gunlukUcret/gunlukUstLimit
   * uzerinden ORANTILI hesaplanir (Asama 2 davranisi).
   *
   * Surum 1 snapshot'larda alan yoktur; 0 varsayilir.
   */
  ekGunBlokUcret: KurusSemasi.default(0),

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
