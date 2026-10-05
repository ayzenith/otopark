"use server";

/**
 * İŞLETME AYARLARI - SERVER ACTIONS
 *
 * Vardiya pencereleri burada yönetilir. PENCERE ZORLAYICI DEĞİLDİR: personel
 * saat dışında da vardiya açabilir (karar 05.10.2026 — tek vardiya
 * zorunluluğu yok).
 */

import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { IslemHatasi } from "@/server/errors";
import {
  saatiDakikaya,
  vardiyaPencereleriKaydet,
  type VardiyaPenceresi,
} from "@/server/settings/shift-windows";
import { isletmeKunyesiKaydet } from "@/server/settings/business";

/**
 * Form gönderimi: `ad1/baslangic1/bitis1 … ad6/baslangic6/bitis6`.
 *
 * Satır satır alan göndermek, dinamik liste için FormData'nın en sade yolu.
 * Adı boş olan satır ATLANIR — böylece patron bir satırı boşaltıp kaydedince
 * o pencere silinir.
 */
const SATIR_SAYISI = 6;

function nesneye(girdi: unknown): Record<string, string> {
  if (typeof FormData !== "undefined" && girdi instanceof FormData) {
    return Object.fromEntries(
      [...girdi.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
    );
  }
  return (girdi ?? {}) as Record<string, string>;
}

export async function vardiyaPencereleriAction(
  girdi: unknown,
): Promise<ActionResult<{ adet: number }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SETTINGS_BUSINESS_EDIT);
    const veri = nesneye(girdi);

    const pencereler: VardiyaPenceresi[] = [];
    for (let i = 1; i <= SATIR_SAYISI; i++) {
      const ad = (veri[`ad${i}`] ?? "").trim();
      const basMetni = (veri[`baslangic${i}`] ?? "").trim();
      const bitMetni = (veri[`bitis${i}`] ?? "").trim();

      // Tamamen boş satır: sessizce atlanır (silme yolu budur).
      if (ad === "" && basMetni === "" && bitMetni === "") continue;

      if (ad === "") {
        throw new IslemHatasi(
          "AD_ZORUNLU",
          `${i}. vardiya satırında saat girilmiş ama ad yazılmamış. Adı yazın ya da satırı tamamen boşaltın.`,
        );
      }
      const bas = saatiDakikaya(basMetni);
      const bit = saatiDakikaya(bitMetni);
      if (bas === null || bit === null) {
        throw new IslemHatasi(
          "GECERSIZ_SAAT",
          `"${ad}" vardiyasının saatleri SS:DD biçiminde olmalı (örnek: 08:00).`,
        );
      }
      pencereler.push({ ad, baslangicDakika: bas, bitisDakika: bit });
    }

    await vardiyaPencereleriKaydet(user, pencereler);

    revalidatePath("/yonetim/ayarlar/isletme");
    revalidatePath("/vardiya");
    revalidatePath("/kasa");
    return { adet: pencereler.length };
  });
}

/**
 * İŞLETME KÜNYESİ (Aşama 7)
 *
 * Adres, telefon, çalışma saatleri hem panelde hem kurumsal sitede görünür.
 * İşletme bu bilgileri vermedi (docs/07 S18); girilmeyen alan BOŞ kalır,
 * uydurulmaz ve sitede o bölüm çizilmez.
 */
export async function isletmeKunyesiAction(
  girdi: unknown,
): Promise<ActionResult<{ isletmeAdi: string }>> {
  return runAction(async () => {
    const user = await requirePermission(PERMISSIONS.SETTINGS_BUSINESS_EDIT);
    const veri = nesneye(girdi);

    const kayit = await isletmeKunyesiKaydet(user, {
      isletmeAdi: (veri.isletmeAdi ?? "").trim(),
      adres: veri.adres ?? "",
      telefon: veri.telefon ?? "",
      whatsapp: veri.whatsapp ?? "",
      calismaSaatleri: veri.calismaSaatleri ?? "",
      mapsUrl: veri.mapsUrl ?? "",
      instagramUrl: veri.instagramUrl ?? "",
    });

    revalidatePath("/yonetim/ayarlar/isletme");
    // Künye sitenin her sayfasında (başlık ve alt bilgi) görünür.
    revalidatePath("/", "layout");
    return { isletmeAdi: kayit.businessName };
  });
}
