/**
 * UCRET HESAPLAMA MOTORU - SAF FONKSIYON
 *
 * ============================================================================
 * Bu dosya veritabanina ERISMEZ, tarih/saat icin "simdi"yi OKUMAZ, rastgelelik
 * icermez. Ayni girdi her zaman ayni cikti verir. Bu sayede onlarca senaryo
 * birim testiyle dogrulanabilir.
 *
 * Algoritma ve gerekceler: docs/05-tarife-ve-abonman.md (5.2)
 *
 * ONEMLI: Hicbir fiyat varsayilmaz. Tum degerler snapshot'tan gelir; snapshot
 * da patronun panelden girdigi tarifeden uretilir. Patron henuz tarife
 * girmediyse tum fiyatlar 0'dir ve sonuc tarifeTanimsiz=true doner.
 * ============================================================================
 */

import { clampNonNegative } from "@/lib/money";
import type { DokumSatiri, TarifeSnapshot, UcretSonucu } from "./types";

export interface HesapGirdisi {
  girisAt: Date;
  cikisAt: Date;
  snapshot: TarifeSnapshot;
  /** Istanbul saatine gore gunun dakikasi - cagiran taraf hesaplar (saf kalsin). */
  girisGunDakikasi?: number;
  cikisGunDakikasi?: number;
  /** Giris gunu hafta sonu mu - cagiran taraf hesaplar. */
  haftaSonuMu?: boolean;
}

/**
 * Park ucretini hesaplar.
 *
 * Adimlar (docs/05):
 *  1. Ucretsiz sure
 *  2. Ucretlendirilecek sureyi belirle
 *  3. Tam gunleri ayir
 *  4. Artan sureyi hesapla (ilk blok -> saatlik -> gunluk ust limit)
 *  5. Gece tarifesi
 *  6. Hafta sonu katsayisi
 *  7. Asgari ucret
 *  8. Yuvarlama
 */
export function hesaplaUcret(girdi: HesapGirdisi): UcretSonucu {
  const { girisAt, cikisAt, snapshot: s } = girdi;

  const sureDakika = Math.max(0, Math.floor((cikisAt.getTime() - girisAt.getTime()) / 60000));
  const dokum: DokumSatiri[] = [];
  const uygulananKurallar: string[] = [];

  // Tarifede hicbir fiyat tanimli degil mi?
  const tarifeTanimsiz =
    s.ilkBlokUcret === 0 &&
    s.saatlikUcret === 0 &&
    s.gunlukUcret === 0 &&
    s.gunlukUstLimit === 0 &&
    s.ekGunBlokUcret === 0 &&
    s.asgariUcret === 0 &&
    (s.geceSabitUcret ?? 0) === 0;

  // --- ADIM 1: UCRETSIZ SURE ---
  if (sureDakika <= s.ucretsizDakika) {
    return {
      sureDakika,
      tutar: 0,
      dokum: [{ aciklama: `Ücretsiz süre içinde (${s.ucretsizDakika} dk)`, tutar: 0 }],
      ucretsizMi: true,
      tarifeTanimsiz,
      uygulananKurallar: ["ucretsiz_sure"],
    };
  }

  if (tarifeTanimsiz) {
    return {
      sureDakika,
      tutar: 0,
      dokum: [{ aciklama: "Tarifede fiyat tanımlı değil", tutar: 0 }],
      ucretsizMi: false,
      tarifeTanimsiz: true,
      uygulananKurallar: ["tarife_tanimsiz"],
    };
  }

  // --- ADIM 2: UCRETLENDIRILECEK SURE ---
  let ucretliDakika = sureDakika;
  if (s.ucretsizDusulur && s.ucretsizDakika > 0) {
    ucretliDakika = Math.max(0, sureDakika - s.ucretsizDakika);
    uygulananKurallar.push("ucretsiz_sure_dusuldu");
    dokum.push({ aciklama: `Ücretsiz ${s.ucretsizDakika} dk düşüldü`, tutar: 0 });
  }

  // --- ADIM 3-4: GUNLER VE ARTAN SURE ---
  //
  // IKI MODEL VAR. Hangisinin uygulandigini snapshot soyler; ikisi de
  // patronun panelden girdigi degerlerden cikar, kodda sabit fiyat yoktur.
  //
  // A) EK GUN BLOGU MODELI (ekGunBlokUcret > 0) - isletmenin 04.10.2026
  //    kararindaki model: ilk 24 saat saatlik kademeden hesaplanir ve gunluk
  //    ust limitle sinirlanir; 24 saatten sonra BASLAYAN her 24 saatlik blok
  //    icin sabit ucret eklenir. 24 sa 1 dk, bir ek blok baslatmis sayilir.
  //
  // B) ORANTILI TAM GUN MODELI (ekGunBlokUcret = 0) - Asama 2 davranisi:
  //    tam gunler gunluk ucretten, artan sure saatlik kademeden hesaplanir.
  let tutar = 0;

  if (s.ekGunBlokUcret > 0) {
    // --- MODEL A ---
    const ilkGunDakika = Math.min(ucretliDakika, 1440);
    const ilkGunTutari = ustLimitUygula(s, kademeliTutar(s, ilkGunDakika, dokum), dokum, uygulananKurallar);
    tutar += ilkGunTutari;

    const asanDakika = Math.max(0, ucretliDakika - 1440);
    if (asanDakika > 0) {
      // BASLAYAN blok tam sayilir: 24 sa 1 dk -> 1 blok, 48 sa 1 dk -> 2 blok.
      const blok = Math.ceil(asanDakika / 1440);
      const blokTutari = blok * s.ekGunBlokUcret;
      tutar += blokTutari;
      dokum.push({
        aciklama:
          blok === 1
            ? `24 saat sonrası ek gün × ${kurusMetin(s.ekGunBlokUcret)}`
            : `24 saat sonrası ${blok} ek gün × ${kurusMetin(s.ekGunBlokUcret)}`,
        tutar: blokTutari,
      });
      uygulananKurallar.push("ek_gun_blogu");
    }
  } else {
    // --- MODEL B ---
    const tamGun = Math.floor(ucretliDakika / 1440);
    const artanDakika = ucretliDakika % 1440;

    /**
     * Bir tam gunun fiyati.
     *
     * YAPISAL KARAR (fiyat varsayimi DEGIL): patron gunluk ucreti girmemisse
     * tam gunler, bir gun boyunca islemis saatlik ucretten hesaplanir. Boylece
     * yalnizca saatlik ucret girilmis bir tarifede 26 saatlik park yine dogru
     * ucretlendirilir. Gunluk ust limit varsa o da sinir olarak uygulanir.
     */
    let gunlukBirimUcret: number;
    if (s.gunlukUcret > 0) {
      gunlukBirimUcret = s.gunlukUcret;
    } else if (s.gunlukUstLimit > 0) {
      gunlukBirimUcret = s.gunlukUstLimit;
      if (tamGun > 0) uygulananKurallar.push("gunluk_ucret_yerine_ust_limit");
    } else {
      gunlukBirimUcret = birGunlukSaatlikUcret(s);
      if (tamGun > 0) uygulananKurallar.push("gunluk_ucret_yerine_saatlik");
    }

    if (tamGun > 0) {
      const gunTutari = tamGun * gunlukBirimUcret;
      tutar += gunTutari;
      dokum.push({
        aciklama: `${tamGun} tam gün × ${kurusMetin(gunlukBirimUcret)}`,
        tutar: gunTutari,
      });
    }

    const artanTutar = ustLimitUygula(
      s,
      kademeliTutar(s, artanDakika, dokum),
      dokum,
      uygulananKurallar,
    );
    tutar += artanTutar;
  }

  // --- ADIM 5: GECE TARIFESI ---
  // Giris ve cikis tamamen gece araliginda ise, gece sabit ucreti AVANTAJLIYSA
  // uygulanir (docs/05 Adim 5). S4 onayi beklemektedir; gece ucreti patron
  // tarafindan girilmediginde bu kural hic devreye girmez.
  if (
    s.geceSabitUcret !== null &&
    s.geceSabitUcret > 0 &&
    s.geceBaslangicDakika !== null &&
    s.geceBitisDakika !== null &&
    girdi.girisGunDakikasi !== undefined &&
    girdi.cikisGunDakikasi !== undefined &&
    sureDakika <= 1440 &&
    geceAraligindaMi(girdi.girisGunDakikasi, s.geceBaslangicDakika, s.geceBitisDakika) &&
    geceAraligindaMi(girdi.cikisGunDakikasi, s.geceBaslangicDakika, s.geceBitisDakika)
  ) {
    if (s.geceSabitUcret < tutar) {
      dokum.push({
        aciklama: `Gece tarifesi uygulandı (${kurusMetin(s.geceSabitUcret)})`,
        tutar: s.geceSabitUcret - tutar,
      });
      tutar = s.geceSabitUcret;
      uygulananKurallar.push("gece_tarifesi");
    }
  }

  // --- ADIM 6: HAFTA SONU KATSAYISI ---
  if (s.haftaSonuKatsayisi !== null && s.haftaSonuKatsayisi !== 1 && girdi.haftaSonuMu) {
    const oncesi = tutar;
    tutar = Math.round(tutar * s.haftaSonuKatsayisi);
    dokum.push({
      aciklama: `Hafta sonu katsayısı ×${s.haftaSonuKatsayisi}`,
      tutar: tutar - oncesi,
    });
    uygulananKurallar.push("hafta_sonu_katsayisi");
  }

  // --- ADIM 7: ASGARI UCRET ---
  if (s.asgariUcret > 0 && tutar < s.asgariUcret) {
    dokum.push({
      aciklama: `Asgari ücret uygulandı (${kurusMetin(s.asgariUcret)})`,
      tutar: s.asgariUcret - tutar,
    });
    tutar = s.asgariUcret;
    uygulananKurallar.push("asgari_ucret");
  }

  // --- ADIM 8: YUVARLAMA VE NEGATIF KORUMASI ---
  tutar = clampNonNegative(Math.round(tutar));

  return {
    sureDakika,
    tutar,
    dokum,
    ucretsizMi: false,
    tarifeTanimsiz: false,
    uygulananKurallar,
  };
}

/**
 * Saatlik kademenin bir sure icin tutari: ilk blok + baslayan saatler.
 * Dokum satirlarini da yazar, boylece personel hesabi musteriye aciklayabilir.
 *
 * 0 dakika icin 0 doner ve dokuma satir yazmaz.
 */
function kademeliTutar(s: TarifeSnapshot, dakika: number, dokum: DokumSatiri[]): number {
  if (dakika <= 0) return 0;

  let tutar = 0;
  let kalan = dakika;

  // Ilk blok
  if (s.ilkBlokDakika > 0 && s.ilkBlokUcret > 0) {
    tutar += s.ilkBlokUcret;
    dokum.push({ aciklama: `İlk ${s.ilkBlokDakika} dk`, tutar: s.ilkBlokUcret });
    kalan = Math.max(0, kalan - s.ilkBlokDakika);
  }

  // Saatlik (baslayan birim tam sayilir)
  if (kalan > 0 && s.saatlikUcret > 0) {
    const birim = s.saatYuvarlamaDakika;
    const adet = Math.ceil(kalan / birim);
    const saatTutari = adet * s.saatlikUcret;
    tutar += saatTutari;
    dokum.push({
      aciklama:
        birim === 60
          ? `${adet} saat × ${kurusMetin(s.saatlikUcret)}`
          : `${adet} × ${birim} dk × ${kurusMetin(s.saatlikUcret)}`,
      tutar: saatTutari,
    });
  }

  return tutar;
}

/**
 * Gunluk ust limiti uygular.
 *
 * YAPISAL KARAR: ust limit girilmemisse gunluk ucret sinir olarak kullanilir;
 * boylece kismi bir gun hicbir zaman tam gunden pahali olmaz.
 */
function ustLimitUygula(
  s: TarifeSnapshot,
  tutar: number,
  dokum: DokumSatiri[],
  uygulananKurallar: string[],
): number {
  const etkinUstLimit =
    s.gunlukUstLimit > 0 ? s.gunlukUstLimit : s.gunlukUcret > 0 ? s.gunlukUcret : 0;

  if (etkinUstLimit > 0 && tutar > etkinUstLimit) {
    dokum.push({
      aciklama: `Günlük üst limit uygulandı (${kurusMetin(etkinUstLimit)})`,
      tutar: etkinUstLimit - tutar,
    });
    uygulananKurallar.push("gunluk_ust_limit");
    return etkinUstLimit;
  }
  return tutar;
}

/**
 * Bir gun (1440 dk) boyunca islemis saatlik ucret.
 * Gunluk ucret tanimli degilken tam gunlerin fiyatlandirilmasinda kullanilir.
 */
function birGunlukSaatlikUcret(s: TarifeSnapshot): number {
  let tutar = 0;
  let kalan = 1440;
  if (s.ilkBlokDakika > 0 && s.ilkBlokUcret > 0) {
    tutar += s.ilkBlokUcret;
    kalan = Math.max(0, kalan - s.ilkBlokDakika);
  }
  if (kalan > 0 && s.saatlikUcret > 0) {
    tutar += Math.ceil(kalan / s.saatYuvarlamaDakika) * s.saatlikUcret;
  }
  return tutar;
}

/**
 * Verilen gun dakikasi gece araligina giriyor mu?
 * Aralik gece yarisini asabilir (ornek: 20:00-08:00 => 1200..480).
 */
export function geceAraligindaMi(
  gunDakikasi: number,
  baslangic: number,
  bitis: number,
): boolean {
  if (baslangic === bitis) return false;
  if (baslangic < bitis) return gunDakikasi >= baslangic && gunDakikasi < bitis;
  // Gece yarisini asan aralik
  return gunDakikasi >= baslangic || gunDakikasi < bitis;
}

/** Dokum satirlarinda kullanilan kisa para metni (simge yok, sade). */
function kurusMetin(kurus: number): string {
  const lira = kurus / 100;
  return Number.isInteger(lira)
    ? `${lira.toLocaleString("tr-TR")} ₺`
    : `${lira.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
}

/** Indirim uygulanmis odenecek tutar. Asla 0'in altina inmez. */
export function odenecekTutar(hesaplanan: number, indirim: number): number {
  return clampNonNegative(hesaplanan - clampNonNegative(indirim));
}
