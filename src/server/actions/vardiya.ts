"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { vardiyaBaslat, vardiyaKapat } from "@/server/shift";

const NotSemasi = z.object({ not: z.string().trim().max(300).optional() });

// NOT: Is hatalari (IslemHatasi) runAction icinde kullaniciya
// gosterilebilir mesaja cevrilir; burada ek sarmalayici gerekmez.

export async function vardiyaBaslatAction(girdi: unknown = {}) {
  const actor = await requirePermission(PERMISSIONS.CASH_SHIFT_OPEN);
  const { not } = NotSemasi.parse(girdi);
  const sonuc = await runAction(() => vardiyaBaslat(actor, not));
  if (sonuc.ok) revalidatePath("/vardiya");
  return sonuc;
}

export async function vardiyaKapatAction(girdi: unknown = {}) {
  const actor = await requirePermission(PERMISSIONS.CASH_SHIFT_CLOSE);
  const { not } = NotSemasi.parse(girdi);
  const sonuc = await runAction(() => vardiyaKapat(actor, not));
  if (sonuc.ok) revalidatePath("/vardiya");
  return sonuc;
}
