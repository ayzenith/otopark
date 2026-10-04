"use server";

/**
 * PARK ISLEMLERI - SERVER ACTIONS
 *
 * Bu dosya INCE BIR KABUKTUR: yetki kontrolu + Zod dogrulamasi + servis cagrisi.
 * Is mantigi src/server/parking/** icinde yasar.
 *
 * ONEMLI: Hicbir action tutar/ucret bilgisi KABUL ETMEZ. Istemci yalnizca
 * "hangi arac" ve "hangi odeme yontemi" gonderir; ucret sunucuda hesaplanir.
 * Tek istisna indirim ve elle tutardir; bunlar da IZNE baglidir ve gerekce
 * zorunludur.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, runAction, type ActionResult } from "@/server/auth/authz";
import { aracGirisi, kapasiteDurumu, type GirisSonucu } from "@/server/parking/entry";
import { aracCikisi, cikisOnizleme, type CikisOnizleme, type CikisSonucu } from "@/server/parking/exit";
import { parkIptal, type IptalSonucu } from "@/server/parking/void";

// NOT: Is hatalari (IslemHatasi) runAction icinde kullaniciya
// gosterilebilir mesaja cevrilir; burada ek sarmalayici gerekmez.

const GirisSemasi = z.object({
  plaka: z.string().trim().min(1, "Plaka zorunludur.").max(20),
  aracSinifiId: z.string().min(1).optional(),
  bicimiZorla: z.boolean().optional(),
  kapasiteyiZorla: z.boolean().optional(),
  not: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export async function girisYapAction(girdi: unknown): Promise<ActionResult<GirisSonucu>> {
  const actor = await requirePermission(PERMISSIONS.PARKING_ENTRY);
  const veri = GirisSemasi.parse(girdi);

  const sonuc = await runAction(() => aracGirisi(actor, veri));
  if (sonuc.ok) {
    revalidatePath("/vardiya");
    revalidatePath("/araclar");
  }
  return sonuc;
}

const SorguSemasi = z.object({ plaka: z.string().trim().min(1).max(20) });

/** Cikis onizlemesi - HICBIR SEY YAZMAZ. */
export async function cikisSorgulaAction(girdi: unknown): Promise<ActionResult<CikisOnizleme>> {
  await requirePermission(PERMISSIONS.PARKING_SEARCH);
  const { plaka } = SorguSemasi.parse(girdi);
  return runAction(() => cikisOnizleme(plaka));
}

const CikisSemasi = z.object({
  parkingSessionId: z.string().min(1),
  odemeYontemi: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  kartNotu: z.string().trim().max(100).optional(),
  // Indirim ve elle tutar yalnizca IZNE sahip kullanicilarda gecerlidir;
  // servis katmani izni ayrica dogrular.
  indirimKurus: z.number().int().min(0).max(100_000_000).optional(),
  indirimSebebi: z.string().trim().max(300).optional(),
  elleTutarKurus: z.number().int().min(0).max(100_000_000).optional(),
  elleTutarSebebi: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export async function cikisYapAction(girdi: unknown): Promise<ActionResult<CikisSonucu>> {
  const actor = await requirePermission(PERMISSIONS.PARKING_EXIT);
  const veri = CikisSemasi.parse(girdi);

  const sonuc = await runAction(() => aracCikisi(actor, veri));
  if (sonuc.ok) {
    revalidatePath("/vardiya");
    revalidatePath("/araclar");
  }
  return sonuc;
}

const IptalSemasi = z.object({
  parkingSessionId: z.string().min(1),
  sebep: z.string().trim().min(3, "Gerekçe zorunludur.").max(300),
  iadeEdildi: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export async function iptalAction(girdi: unknown): Promise<ActionResult<IptalSonucu>> {
  const actor = await requirePermission(PERMISSIONS.PARKING_VOID);
  const veri = IptalSemasi.parse(girdi);

  const sonuc = await runAction(() => parkIptal(actor, veri));
  if (sonuc.ok) {
    revalidatePath("/vardiya");
    revalidatePath("/araclar");
  }
  return sonuc;
}

export async function kapasiteDurumuAction() {
  await requirePermission(PERMISSIONS.PARKING_SEARCH);
  return kapasiteDurumu();
}
