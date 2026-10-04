/**
 * Vardiya yonetimi.
 *
 * Her park ve yikama islemi bir vardiyaya baglanir; boylece "bu tahsilati kim,
 * hangi vardiyada aldi" sorusu veriyle yanitlanir. Vardiya kasa modulunun
 * (Asama 5) da temelidir.
 */

import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import type { SessionUser } from "@/server/auth/session";
import { IslemHatasi } from "@/server/errors";

// IslemHatasi src/server/errors.ts icinde tanimli; buradan yeniden ihrac
// edilir ki mevcut cagrilar degismesin.
export { IslemHatasi } from "@/server/errors";

/** Kullanicinin acik vardiyasini dondurur, yoksa null. */
export async function acikVardiya(userId: string) {
  return prisma.shift.findFirst({
    where: { userId, status: "OPEN" },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Islem icin acik vardiya zorunludur.
 *
 * Personel vardiya acmadan islem yapamaz: aksi halde tahsilatlar hicbir
 * vardiyaya bagli olmaz ve kasa kapanisi yapilamaz.
 */
export async function vardiyaZorunlu(userId: string) {
  const vardiya = await acikVardiya(userId);
  if (!vardiya) {
    throw new IslemHatasi(
      "VARDIYA_YOK",
      "Açık vardiyanız yok. İşlem yapmak için önce vardiyanızı başlatın.",
    );
  }
  return vardiya;
}

export async function vardiyaBaslat(actor: SessionUser, not?: string) {
  const mevcut = await acikVardiya(actor.id);
  if (mevcut) {
    throw new IslemHatasi("VARDIYA_ACIK", "Zaten açık bir vardiyanız var.");
  }

  const vardiya = await prisma.shift.create({
    data: { userId: actor.id, status: "OPEN", openingNote: not ?? null },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SHIFT_OPEN,
    entityType: "Shift",
    entityId: vardiya.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: { startedAt: vardiya.startedAt },
  });

  return vardiya;
}

/**
 * Vardiyayi kapatir.
 *
 * Otoparkta aktif arac olmasi vardiya kapanisini ENGELLEMEZ: araclar gece
 * boyunca icerde kalabilir ve bir sonraki vardiya onlari cikarir. Ancak
 * kullaniciya kac arac devredildigi bildirilir.
 */
export async function vardiyaKapat(actor: SessionUser, not?: string) {
  const vardiya = await vardiyaZorunlu(actor.id);

  const [devredilenArac, tahsilat] = await Promise.all([
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
    prisma.payment.aggregate({
      where: { shiftId: vardiya.id, status: "CONFIRMED", direction: "IN" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const kapali = await prisma.shift.update({
    where: { id: vardiya.id },
    data: {
      status: "CLOSED",
      endedAt: new Date(),
      closedById: actor.id,
      closingNote: not ?? null,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SHIFT_CLOSE,
    entityType: "Shift",
    entityId: vardiya.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: {
      endedAt: kapali.endedAt,
      tahsilatAdedi: tahsilat._count,
      tahsilatToplami: tahsilat._sum.amount?.toString() ?? "0",
      devredilenAracSayisi: devredilenArac,
    },
  });

  return { vardiya: kapali, devredilenArac, tahsilatAdedi: tahsilat._count };
}
