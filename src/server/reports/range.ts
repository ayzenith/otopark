/**
 * TARİH ARALIĞI ÇÖZÜMLEME (saf fonksiyon)
 *
 * ============================================================================
 * Patron panelinin ve raporların "Bugün | Bu hafta | Bu ay | Bu yıl | Özel"
 * filtresi. Veritabanına ERİŞMEZ; yalnızca tarih hesabı yapar, böylece
 * sınırlar birim testiyle doğrulanabilir.
 *
 * İŞLETME GÜNÜ: takvim günü 00:00–00:00 Europe/Istanbul (karar 02.10.2026).
 * Tüm aralıklar [baslangic, bitis) — bitiş HARİÇTİR, böylece gün sınırındaki
 * işlem iki döneme birden sayılmaz.
 *
 * HAFTA PAZARTESİ BAŞLAR (TR kullanımı), pazar günü haftanın son günüdür.
 * ============================================================================
 */

import { businessDayRange } from "@/lib/datetime";

export const DONEMLER = ["gun", "hafta", "ay", "yil", "ozel"] as const;
export type Donem = (typeof DONEMLER)[number];

export const DONEM_ETIKETLERI: Record<Donem, string> = {
  gun: "Bugün",
  hafta: "Bu hafta",
  ay: "Bu ay",
  yil: "Bu yıl",
  ozel: "Özel aralık",
};

export interface Aralik {
  baslangic: Date;
  /** HARİÇ. */
  bitis: Date;
  donem: Donem;
  /** Aynı uzunlukta bir önceki dönem (karşılaştırma için). */
  oncekiBaslangic: Date;
  oncekiBitis: Date;
}

/** Istanbul saatine göre yerel gün bileşenleri. */
function yerelParcalar(at: Date): { yil: number; ay: number; gun: number; haftaGunu: number } {
  const bicim = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parcalar = bicim.formatToParts(at);
  const al = (tur: string) => parcalar.find((p) => p.type === tur)?.value ?? "";
  const haftaAdlari = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    yil: Number(al("year")),
    ay: Number(al("month")),
    gun: Number(al("day")),
    haftaGunu: Math.max(0, haftaAdlari.indexOf(al("weekday"))),
  };
}

/** Istanbul'da verilen yerel günün işletme günü başlangıcı. */
function gunBaslangici(yil: number, ay: number, gun: number): Date {
  // businessDayRange yerel gün sınırını doğru hesaplar; öğle vakti vererek
  // yaz saati/geçiş günlerinde sınır kaymasını önleriz.
  return businessDayRange(new Date(`${yil}-${String(ay).padStart(2, "0")}-${String(gun).padStart(2, "0")}T12:00:00+03:00`)).start;
}

function gunEkle(tarih: Date, gun: number): Date {
  const p = yerelParcalar(tarih);
  const temel = new Date(`${p.yil}-${String(p.ay).padStart(2, "0")}-${String(p.gun).padStart(2, "0")}T12:00:00+03:00`);
  temel.setUTCDate(temel.getUTCDate() + gun);
  const y = yerelParcalar(temel);
  return gunBaslangici(y.yil, y.ay, y.gun);
}

/**
 * Dönem aralığını çözümler.
 *
 * `ozel` için `baslangicMetni` / `bitisMetni` ("YYYY-MM-DD") gerekir; bitiş
 * günü DAHİL sayılır (kullanıcı "1–7 Ekim" derken 7 Ekim'i kastediyor), bu
 * yüzden içeride +1 gün yapılır.
 */
export function aralikCozumle(
  donem: Donem,
  opts: { baslangicMetni?: string | null; bitisMetni?: string | null; simdi?: Date } = {},
): Aralik {
  const simdi = opts.simdi ?? new Date();
  const p = yerelParcalar(simdi);
  const bugunBas = gunBaslangici(p.yil, p.ay, p.gun);
  const yarinBas = gunEkle(bugunBas, 1);

  let baslangic: Date;
  let bitis: Date;

  switch (donem) {
    case "gun":
      baslangic = bugunBas;
      bitis = yarinBas;
      break;

    case "hafta": {
      // Pazartesi başlar: pazar (0) için 6 gün geri.
      const geri = p.haftaGunu === 0 ? 6 : p.haftaGunu - 1;
      baslangic = gunEkle(bugunBas, -geri);
      bitis = yarinBas;
      break;
    }

    case "ay":
      baslangic = gunBaslangici(p.yil, p.ay, 1);
      bitis = yarinBas;
      break;

    case "yil":
      baslangic = gunBaslangici(p.yil, 1, 1);
      bitis = yarinBas;
      break;

    case "ozel": {
      const bas = gecerliGunMetni(opts.baslangicMetni);
      const bit = gecerliGunMetni(opts.bitisMetni);
      if (!bas || !bit) {
        // Tarih verilmediyse bugüne düşülür; sessizce yanlış dönem
        // göstermekten iyidir.
        baslangic = bugunBas;
        bitis = yarinBas;
        break;
      }
      baslangic = gunBaslangici(bas.yil, bas.ay, bas.gun);
      // Bitiş günü DAHİL: +1 gün.
      bitis = gunEkle(gunBaslangici(bit.yil, bit.ay, bit.gun), 1);
      if (bitis.getTime() <= baslangic.getTime()) {
        // Ters verilen aralık tek güne indirilir.
        bitis = gunEkle(baslangic, 1);
      }
      break;
    }
  }

  // Önceki dönem: AYNI UZUNLUKTA, hemen öncesi. "Geçen aya göre" karşılaştırma
  // bunu kullanır; ay uzunlukları farklı olduğunda bile elma-elma kıyas için
  // gün sayısı eşitlenir.
  const uzunluk = bitis.getTime() - baslangic.getTime();
  return {
    baslangic,
    bitis,
    donem,
    oncekiBaslangic: new Date(baslangic.getTime() - uzunluk),
    oncekiBitis: baslangic,
  };
}

function gecerliGunMetni(metin: string | null | undefined) {
  if (!metin) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(metin.trim());
  if (!m) return null;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const gun = Number(m[3]);
  if (ay < 1 || ay > 12 || gun < 1 || gun > 31) return null;
  return { yil, ay, gun };
}

export function donemGecerliMi(deger: string | null | undefined): Donem {
  return (DONEMLER as readonly string[]).includes(deger ?? "") ? (deger as Donem) : "gun";
}

/**
 * Yüzde değişim: (yeni - eski) / |eski| × 100.
 *
 * Eski dönem 0 ise yüzde TANIMSIZDIR (null döner) — "%∞ arttı" demek
 * yanıltıcıdır. Arayüz bu durumda yüzde yerine "önceki dönem 0" yazar.
 */
export function yuzdeDegisim(yeni: number, eski: number): number | null {
  if (eski === 0) return null;
  return Math.round(((yeni - eski) / Math.abs(eski)) * 1000) / 10;
}
