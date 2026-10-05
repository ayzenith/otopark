/**
 * STOK SORGULARI (okuma)
 *
 * Miktarlar `number` olarak doner (3 ondalikli). Para alanlari kurus tamsayi.
 */

import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";
import type { InventoryMovementType, InventoryUnit } from "@prisma/client";

export interface MalzemeSatiri {
  id: string;
  ad: string;
  birim: InventoryUnit;
  stok: number;
  asgariStok: number | null;
  /** Stok asgari esige dustu mu? Esik yoksa her zaman false. */
  kritik: boolean;
  aktif: boolean;
  sonHareketAt: Date | null;
}

export async function malzemeListesi(
  opts: { pasifleriDeGoster?: boolean } = {},
): Promise<MalzemeSatiri[]> {
  const liste = await prisma.inventoryItem.findMany({
    where: opts.pasifleriDeGoster ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  return liste.map((m) => {
    const stok = Number(m.currentStock.toString());
    const asgari = m.minStock === null ? null : Number(m.minStock.toString());
    return {
      id: m.id,
      ad: m.name,
      birim: m.unit,
      stok,
      asgariStok: asgari,
      kritik: asgari !== null && stok <= asgari,
      aktif: m.isActive,
      sonHareketAt: m.movements[0]?.createdAt ?? null,
    };
  });
}

/** Asgari esigin altina dusmus malzemeler (patron panelinde uyari sayaci). */
export async function kritikStoklar(): Promise<MalzemeSatiri[]> {
  // Prisma alan-alan karsilastirmayi desteklemedigi icin aktif malzemeler
  // okunup bellekte filtrelenir. Malzeme sayisi onlarla olculur; sorun degil.
  return (await malzemeListesi()).filter((m) => m.kritik);
}

export interface StokHareketSatiri {
  id: string;
  malzemeAdi: string;
  birim: InventoryUnit;
  tip: InventoryMovementType;
  miktar: number;
  /** Stoga etkisi: artis (+) veya azalis (-) yonlu miktar. */
  etki: number;
  birimMaliyet: number | null;
  /** miktar × birimMaliyet (alisin toplam tutari). */
  toplamMaliyet: number | null;
  giderKodu: string | null;
  yikamaKodu: string | null;
  not: string | null;
  at: Date;
  girenKisi: string | null;
}

export async function stokHareketleri(
  opts: { inventoryItemId?: string; baslangic?: Date; bitis?: Date; limit?: number } = {},
): Promise<StokHareketSatiri[]> {
  const liste = await prisma.inventoryMovement.findMany({
    where: {
      ...(opts.inventoryItemId ? { inventoryItemId: opts.inventoryItemId } : {}),
      ...(opts.baslangic || opts.bitis
        ? {
            createdAt: {
              ...(opts.baslangic && { gte: opts.baslangic }),
              ...(opts.bitis && { lt: opts.bitis }),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    include: {
      inventoryItem: { select: { name: true, unit: true } },
      expense: { select: { code: true } },
      washJob: { select: { code: true } },
      createdBy: { select: { fullName: true, username: true } },
    },
  });

  return liste.map((h) => {
    const miktar = Number(h.quantity.toString());
    const artis = h.type === "PURCHASE" || h.type === "ADJUSTMENT";
    const birimMaliyet = h.unitCost === null ? null : toKurus(h.unitCost);
    return {
      id: h.id,
      malzemeAdi: h.inventoryItem.name,
      birim: h.inventoryItem.unit,
      tip: h.type,
      miktar,
      etki: artis ? miktar : -miktar,
      birimMaliyet,
      toplamMaliyet: birimMaliyet === null ? null : Math.round(birimMaliyet * miktar),
      giderKodu: h.expense?.code ?? null,
      yikamaKodu: h.washJob?.code ?? null,
      not: h.note,
      at: h.createdAt,
      girenKisi: h.createdBy?.fullName ?? h.createdBy?.username ?? null,
    };
  });
}

/**
 * Bir donemin stok ozeti: malzeme bazinda alis ve tuketim.
 *
 * "Bu ay ne kadar sampuan aldik, ne kadar harcadik" sorusunu yanitlar.
 * Alis tutarlari gider raporundaki YIKAMA_MALZEME kalemiyle karsilastirmak
 * icin ayri gosterilir.
 */
export async function stokOzeti(baslangic: Date, bitis: Date) {
  const hareketler = await prisma.inventoryMovement.groupBy({
    by: ["inventoryItemId", "type"],
    where: { createdAt: { gte: baslangic, lt: bitis } },
    _sum: { quantity: true },
    _count: true,
  });

  if (hareketler.length === 0) return [];

  const malzemeler = await prisma.inventoryItem.findMany({
    where: { id: { in: [...new Set(hareketler.map((h) => h.inventoryItemId))] } },
    select: { id: true, name: true, unit: true },
  });
  const haritaAdi = new Map(malzemeler.map((m) => [m.id, m]));

  const ozet = new Map<
    string,
    { ad: string; birim: InventoryUnit; alis: number; tuketim: number; zayi: number; duzeltme: number }
  >();

  for (const h of hareketler) {
    const malzeme = haritaAdi.get(h.inventoryItemId);
    if (!malzeme) continue;
    const mevcut =
      ozet.get(h.inventoryItemId) ??
      { ad: malzeme.name, birim: malzeme.unit, alis: 0, tuketim: 0, zayi: 0, duzeltme: 0 };
    const miktar = Number(h._sum.quantity?.toString() ?? "0");
    if (h.type === "PURCHASE") mevcut.alis += miktar;
    else if (h.type === "CONSUMPTION") mevcut.tuketim += miktar;
    else if (h.type === "WASTE") mevcut.zayi += miktar;
    else mevcut.duzeltme += miktar;
    ozet.set(h.inventoryItemId, mevcut);
  }

  return [...ozet.values()].sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
}

/** Bugunun stok hareketleri (personel stok ekranindaki "bugün" listesi). */
export async function bugunkuStokHareketleri(gun = new Date()) {
  const { start, end } = businessDayRange(gun);
  return stokHareketleri({ baslangic: start, bitis: end, limit: 50 });
}
