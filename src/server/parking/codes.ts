/**
 * Islem kodu uretimi: P-261004-0143 gibi insan okunur fis numaralari.
 *
 * Kod, gun icinde o tipten kacinci islem oldugunu gosterir. Esszamanli
 * isteklerde ayni numara uretilebilecegi icin kod TEKIL ANAHTAR OLARAK
 * KULLANILMAZ - tekillik idempotencyKey ile saglanir. Cakisma olursa
 * veritabani unique kisiti devreye girer ve tekrar denenir.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { businessDayRange } from "@/lib/datetime";
import { buildCode } from "@/lib/utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function parkKodu(db: DbClient, anında = new Date()): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.parkingSession.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("P", anında, adet + 1);
}

export async function tahsilatKodu(db: DbClient, anında = new Date()): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.payment.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("T", anında, adet + 1);
}

/** Abonman kodu: A-261004-0007 */
export async function abonmanKodu(db: DbClient, anında = new Date()): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.subscription.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("A", anında, adet + 1);
}
