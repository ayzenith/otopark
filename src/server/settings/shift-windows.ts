/**
 * VARDİYA PENCERELERİ (işletme ayarı)
 *
 * ============================================================================
 * KARAR (05.10.2026): TEK VARDİYA ZORUNLULUĞU YOK.
 * ----------------------------------------------------------------------------
 * Personel kendi vardiyasını istediği saatte açıp kapatır. Burada tanımlanan
 * pencereler YALNIZCA BİLGİ VE RAPOR ETİKETİDİR:
 *
 *   · vardiya açılırken personele "şu an Gündüz vardiyası penceresinde" yazar,
 *   · raporlarda vardiya hangi pencereye düştüğü etiketiyle gruplanabilir.
 *
 * HİÇBİR YERDE ENGEL ÜRETMEZ: saat dışında vardiya açmak serbesttir, uyarı
 * bile çıkmaz. Boş liste = pencere tanımlı değil, hiçbir etiket gösterilmez.
 *
 * Aynı anda yalnızca bir açık KASA olabilir (tek fiziki kasa) — bu ayrı bir
 * kuraldır ve veritabanı kısmi unique indeksiyle garanti edilir. Vardiya
 * sayısıyla ilgisi yoktur.
 *
 * Pencere gece yarısını AŞABİLİR (20:00–08:00 gibi); `icinde()` bunu doğru
 * yorumlar.
 * ============================================================================
 */

import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { minuteOfDay } from "@/lib/datetime";
import type { SessionUser } from "@/server/auth/session";

export const VardiyaPenceresiSemasi = z.object({
  ad: z.string().trim().min(2).max(40),
  /** Günün dakikası, 0–1439. */
  baslangicDakika: z.number().int().min(0).max(1439),
  bitisDakika: z.number().int().min(0).max(1439),
});

export const VardiyaPencereleriSemasi = z.array(VardiyaPenceresiSemasi).max(6);

export type VardiyaPenceresi = z.infer<typeof VardiyaPenceresiSemasi>;

/** "08:00" -> 480. Geçersizse null. */
export function saatiDakikaya(metin: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(metin.trim());
  if (!m) return null;
  const saat = Number(m[1]);
  const dakika = Number(m[2]);
  if (saat > 23 || dakika > 59) return null;
  return saat * 60 + dakika;
}

/** 480 -> "08:00" */
export function dakikayiSaate(dakika: number): string {
  const s = Math.floor(dakika / 60);
  const d = dakika % 60;
  return `${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}`;
}

/**
 * Verilen gün dakikası bu pencerenin içinde mi?
 *
 * Gece yarısını aşan pencere (20:00–08:00 => 1200..480) doğru yorumlanır.
 * Başlangıç = bitiş ise pencere 24 saati kapsar.
 */
export function pencereIcinde(pencere: VardiyaPenceresi, gunDakikasi: number): boolean {
  const { baslangicDakika: bas, bitisDakika: bit } = pencere;
  if (bas === bit) return true; // 24 saat
  if (bas < bit) return gunDakikasi >= bas && gunDakikasi < bit;
  return gunDakikasi >= bas || gunDakikasi < bit; // gece yarisini asar
}

/** Bir ana denk gelen pencere (ilk eşleşen). Yoksa null. */
export function pencereBul(
  pencereler: VardiyaPenceresi[],
  an: Date = new Date(),
): VardiyaPenceresi | null {
  const dakika = minuteOfDay(an);
  return pencereler.find((p) => pencereIcinde(p, dakika)) ?? null;
}

/** Kayıtlı pencereleri okur ve DOĞRULAR. Bozuk veri sessizce yok sayılmaz. */
export async function vardiyaPencereleri(): Promise<VardiyaPenceresi[]> {
  const ayar = await prisma.businessSetting.findUnique({
    where: { id: "singleton" },
    select: { shiftWindows: true },
  });
  if (!ayar) return [];

  const sonuc = VardiyaPencereleriSemasi.safeParse(ayar.shiftWindows);
  if (!sonuc.success) {
    // Bozuk ayar personelin vardiya acmasini ENGELLEMEMELI: pencere yalnizca
    // bilgi etiketidir. Bu yuzden hata firlatmak yerine bos liste donulur ve
    // sunucuya yazilir.
    console.error(
      "[vardiya-penceresi] Kayıtlı pencere verisi okunamadı, yok sayıldı:",
      sonuc.error.issues,
    );
    return [];
  }
  return sonuc.data;
}

/** Pencereleri kaydeder (patron). Çakışma kontrolü yapılır ama ZORUNLU değil. */
export async function vardiyaPencereleriKaydet(
  actor: SessionUser,
  pencereler: VardiyaPenceresi[],
) {
  const dogrulanmis = VardiyaPencereleriSemasi.safeParse(pencereler);
  if (!dogrulanmis.success) {
    throw new IslemHatasi(
      "GECERSIZ_PENCERE",
      "Vardiya penceresi geçersiz: ad 2–40 karakter, saatler 00:00–23:59 arası olmalı ve en fazla 6 pencere tanımlanabilir.",
    );
  }

  const adlar = dogrulanmis.data.map((p) => p.ad.toLocaleLowerCase("tr-TR"));
  if (new Set(adlar).size !== adlar.length) {
    throw new IslemHatasi("AD_TEKRAR", "Aynı adda iki vardiya penceresi tanımlanamaz.");
  }

  const onceki = await prisma.businessSetting.findUnique({
    where: { id: "singleton" },
    select: { shiftWindows: true },
  });

  const ayar = await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    update: { shiftWindows: dogrulanmis.data, updatedById: actor.id },
    create: { id: "singleton", shiftWindows: dogrulanmis.data, updatedById: actor.id },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "BusinessSetting",
    entityId: "singleton",
    userId: actor.id,
    actorLabel: actor.username,
    before: { vardiyaPencereleri: onceki?.shiftWindows ?? [] },
    after: { vardiyaPencereleri: dogrulanmis.data },
    note:
      dogrulanmis.data.length === 0
        ? "Vardiya pencereleri kaldırıldı (etiket gösterilmez)"
        : "Vardiya pencereleri güncellendi (bilgi amaçlı; vardiya açmayı engellemez)",
  });

  return ayar;
}
