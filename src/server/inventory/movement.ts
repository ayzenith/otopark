/**
 * STOK HAREKETLERI
 *
 * ============================================================================
 *   PURCHASE     alis   -> stok ARTAR  (istege bagli olarak GIDERE baglanir)
 *   CONSUMPTION  tuketim-> stok AZALIR (istege bagli olarak yikama isine baglanir)
 *   ADJUSTMENT   duzeltme-> stok sayima gore ARTAR  (gercek sayim fazlasi)
 *   WASTE        zayi   -> stok AZALIR (dokuldu, bozuldu)
 *
 * MIKTAR HER ZAMAN POZITIFTIR; yonu `type` belirler. Isaretli miktar
 * saklanmaz: "-5 litre alis" gibi bir satir stok hesabini sessizce ters
 * cevirir. Veritabani kisiti da miktarin pozitif olmasini zorunlu kilar.
 *
 * STOK NEGATIFE DUSMEZ: elde 3 litre varken 5 litre tuketim girilemez. Bu bir
 * "duzeltilsin" durumudur: ya once alis girilmeli ya da sayim duzeltmesi
 * yapilmali. Sessizce -2 litre yazmak, "stok neden eksik?" sorusunu
 * yanitlanamaz hale getirir. Veritabani CHECK kisiti son savunma hattidir.
 *
 * HAREKET SILINMEZ: yanlis hareket icin TERS YONDE duzeltme hareketi girilir.
 * Veritabani tetikleyicisi DELETE'i reddeder (migration 20261004200000).
 *
 * ALIS -> GIDER BAGLANTISI (Asama 4'ten Asama 5'e tasinan is): alis hareketi
 * bir gider kaydina baglanabilir. Boylece "bu ay yikama malzemesine ne kadar
 * harcadik" sorusu hem gider raporundan hem stok defterinden ayni cevabi
 * verir. Gider SATIRI stok hareketi tarafindan URETILMEZ; once gider
 * kaydedilir, sonra alis hareketi ona baglanir - tek para kaydi, tek yer.
 * ============================================================================
 */

import { Prisma, type InventoryMovementType } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

export const HAREKET_ETIKETLERI: Record<InventoryMovementType, string> = {
  PURCHASE: "Alış",
  CONSUMPTION: "Tüketim",
  ADJUSTMENT: "Sayım düzeltmesi",
  WASTE: "Zayi",
};

/** Hareket tipinin stoga etkisi: +1 artirir, -1 azaltir. */
export function stokYonu(tip: InventoryMovementType): 1 | -1 {
  return tip === "PURCHASE" || tip === "ADJUSTMENT" ? 1 : -1;
}

export interface StokHareketIstegi {
  inventoryItemId: string;
  tip: InventoryMovementType;
  /** Pozitif miktar. Birim malzeme kartindan gelir. */
  miktar: number;
  /** Alista birim maliyet (kurus). Yalnizca PURCHASE icin anlamlidir. */
  birimMaliyetKurus?: number | null;
  /** Alisin bagli oldugu gider kaydi (varsa). */
  expenseId?: string | null;
  /** Tuketimin bagli oldugu yikama is emri (varsa). */
  washJobId?: string | null;
  not?: string | null;
  idempotencyKey: string;
}

export interface StokHareketSonucu {
  movementId: string;
  malzemeAdi: string;
  tip: InventoryMovementType;
  miktar: number;
  oncekiStok: number;
  yeniStok: number;
  /** Yeni stok asgari esigin altina dustu mu? */
  kritikStokUyarisi: boolean;
  tekrarEdenIstek: boolean;
}

export async function stokHareketiEkle(
  actor: SessionUser,
  istek: StokHareketIstegi,
): Promise<StokHareketSonucu> {
  // Idempotency (mimari kural 7): ayni anahtarla ikinci istek stogu TEKRAR
  // degistirmez.
  const onceki = await prisma.inventoryMovement.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
    include: { inventoryItem: true },
  });
  if (onceki) {
    const stok = Number(onceki.inventoryItem.currentStock.toString());
    return {
      movementId: onceki.id,
      malzemeAdi: onceki.inventoryItem.name,
      tip: onceki.type,
      miktar: Number(onceki.quantity.toString()),
      oncekiStok: stok,
      yeniStok: stok,
      kritikStokUyarisi: kritikMi(stok, onceki.inventoryItem.minStock),
      tekrarEdenIstek: true,
    };
  }

  if (!Number.isFinite(istek.miktar) || istek.miktar <= 0) {
    throw new IslemHatasi("GECERSIZ_MIKTAR", "Miktar sıfırdan büyük olmalıdır.");
  }
  // 3 ondalikli saklanir; daha hassas girdi sessizce yuvarlanmasin.
  if (Math.round(istek.miktar * 1000) !== istek.miktar * 1000) {
    throw new IslemHatasi(
      "GECERSIZ_MIKTAR",
      "Miktar en fazla 3 ondalık basamak olabilir (örnek: 0,250).",
    );
  }
  if ((istek.birimMaliyetKurus ?? 0) < 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Birim maliyet negatif olamaz.");
  }
  if (istek.tip !== "PURCHASE" && istek.expenseId) {
    throw new IslemHatasi(
      "GIDER_YALNIZCA_ALISTA",
      "Gider bağlantısı yalnızca alış hareketinde kurulabilir.",
    );
  }

  if (istek.expenseId) {
    const gider = await prisma.expense.findUnique({
      where: { id: istek.expenseId },
      select: { status: true },
    });
    if (!gider) throw new IslemHatasi("GIDER_YOK", "Bağlanacak gider kaydı bulunamadı.");
    if (gider.status === "VOIDED") {
      throw new IslemHatasi("GIDER_IPTAL", "İptal edilmiş gidere stok hareketi bağlanamaz.");
    }
  }

  const yon = stokYonu(istek.tip);
  const miktarMetni = istek.miktar.toFixed(3);

  try {
    return await prisma.$transaction(async (tx) => {
      // Kaydi KILITLE: esszamanli iki tuketim, stogu ayni baslangictan
      // okuyup ikisi de "yeterli stok var" diyemesin.
      const kilitli = await tx.$queryRaw<
        { id: string; name: string; currentStock: Prisma.Decimal; isActive: boolean }[]
      >`SELECT id, name, "currentStock", "isActive" FROM "InventoryItem" WHERE id = ${istek.inventoryItemId} FOR UPDATE`;

      if (kilitli.length === 0) {
        throw new IslemHatasi("MALZEME_YOK", "Malzeme bulunamadı.");
      }
      const malzeme = kilitli[0]!;

      // Pasif malzemeye ALIS girilemez (artik kullanilmiyor), ama TUKETIM
      // ve duzeltme girilebilir: elde kalan stok eritilebilmelidir.
      if (!malzeme.isActive && istek.tip === "PURCHASE") {
        throw new IslemHatasi(
          "MALZEME_PASIF",
          `"${malzeme.name}" kullanım dışı. Alış girmek için önce geri açın.`,
        );
      }

      const oncekiStok = Number(malzeme.currentStock.toString());
      const yeniStok = Math.round((oncekiStok + yon * istek.miktar) * 1000) / 1000;

      if (yeniStok < 0) {
        throw new IslemHatasi(
          "STOK_YETERSIZ",
          `"${malzeme.name}" stoğu yetersiz: elde ${bicimle(oncekiStok)} var, ` +
            `${bicimle(istek.miktar)} düşülemez. Önce alış girin veya sayım düzeltmesi yapın.`,
        );
      }

      const hareket = await tx.inventoryMovement.create({
        data: {
          inventoryItemId: malzeme.id,
          type: istek.tip,
          quantity: miktarMetni,
          unitCost:
            istek.birimMaliyetKurus === null || istek.birimMaliyetKurus === undefined
              ? null
              : kurusToDecimalString(istek.birimMaliyetKurus),
          expenseId: istek.expenseId ?? null,
          washJobId: istek.washJobId ?? null,
          note: istek.not?.trim() || null,
          idempotencyKey: istek.idempotencyKey,
          createdById: actor.id,
        },
      });

      const guncel = await tx.inventoryItem.update({
        where: { id: malzeme.id },
        data: { currentStock: yeniStok.toFixed(3) },
        select: { minStock: true },
      });

      await writeAudit(
        {
          action: AUDIT_ACTIONS.SETTINGS_UPDATE,
          entityType: "InventoryMovement",
          entityId: hareket.id,
          userId: actor.id,
          actorLabel: actor.username,
          before: { stok: oncekiStok },
          after: {
            malzeme: malzeme.name,
            tip: istek.tip,
            miktar: istek.miktar,
            stok: yeniStok,
            birimMaliyetKurus: istek.birimMaliyetKurus ?? null,
            giderId: istek.expenseId ?? null,
            yikamaId: istek.washJobId ?? null,
          },
          note: `Stok hareketi: ${HAREKET_ETIKETLERI[istek.tip]} — ${malzeme.name}`,
        },
        tx,
      );

      return {
        movementId: hareket.id,
        malzemeAdi: malzeme.name,
        tip: istek.tip,
        miktar: istek.miktar,
        oncekiStok,
        yeniStok,
        kritikStokUyarisi: kritikMi(yeniStok, guncel.minStock),
        tekrarEdenIstek: false,
      };
    });
  } catch (hata) {
    // Veritabani CHECK kisiti son savunma hatti: uygulama kontrolu bir
    // sekilde atlanirsa stok negatife DUSMEZ.
    if (
      hata instanceof Prisma.PrismaClientKnownRequestError &&
      String(hata.meta?.constraint ?? "").includes("inventory_item_stock_non_negative")
    ) {
      throw new IslemHatasi("STOK_YETERSIZ", "Stok yetersiz: hareket uygulanamadı.");
    }
    throw hata;
  }
}

function kritikMi(stok: number, asgari: Prisma.Decimal | null): boolean {
  if (asgari === null) return false;
  return stok <= Number(asgari.toString());
}

function bicimle(miktar: number): string {
  return miktar.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

/**
 * Alis hareketini bir gider kaydina baglar (sonradan).
 *
 * Once stok girilip gider sonradan kaydedildiginde kullanilir. Tutar
 * DEGISTIRILMEZ; yalnizca baglanti kurulur.
 */
export async function alisiGidereBagla(
  actor: SessionUser,
  istek: { movementId: string; expenseId: string },
) {
  const hareket = await prisma.inventoryMovement.findUnique({
    where: { id: istek.movementId },
    include: { inventoryItem: { select: { name: true } } },
  });
  if (!hareket) throw new IslemHatasi("HAREKET_YOK", "Stok hareketi bulunamadı.");
  if (hareket.type !== "PURCHASE") {
    throw new IslemHatasi(
      "ALIS_DEGIL",
      "Yalnızca alış hareketi gider kaydına bağlanabilir.",
    );
  }
  if (hareket.expenseId) {
    throw new IslemHatasi("ZATEN_BAGLI", "Bu alış zaten bir gider kaydına bağlı.");
  }

  const gider = await prisma.expense.findUnique({
    where: { id: istek.expenseId },
    select: { id: true, code: true, status: true },
  });
  if (!gider) throw new IslemHatasi("GIDER_YOK", "Gider kaydı bulunamadı.");
  if (gider.status === "VOIDED") {
    throw new IslemHatasi("GIDER_IPTAL", "İptal edilmiş gidere bağlantı kurulamaz.");
  }

  const guncel = await prisma.inventoryMovement.update({
    where: { id: hareket.id },
    data: { expenseId: gider.id },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "InventoryMovement",
    entityId: hareket.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { giderId: null },
    after: { giderId: gider.id, giderKodu: gider.code },
    note: `Alış gidere bağlandı: ${hareket.inventoryItem.name} → ${gider.code}`,
  });

  return guncel;
}
