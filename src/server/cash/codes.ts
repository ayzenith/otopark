/**
 * Aşama 5 islem kodlari: gider ve diger gelir fisleri.
 *
 * Park (P-), tahsilat (T-), abonman (A-) ve yikama (Y-) kodlariyla ayni
 * mantik: gun icinde o tipten kacinci kayit. Kod TEKILLIK GARANTISI DEGILDIR
 * - tekillik idempotency anahtari ve veritabani unique kisitiyla saglanir.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { businessDayRange } from "@/lib/datetime";
import { buildCode } from "@/lib/utils";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Gider kodu: G-261004-0003 */
export async function giderKodu(db: DbClient, anında = new Date()): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.expense.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("G", anında, adet + 1);
}

/** Diger gelir kodu: D-261004-0001 */
export async function digerGelirKodu(db: DbClient, anında = new Date()): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.otherIncome.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("D", anında, adet + 1);
}
