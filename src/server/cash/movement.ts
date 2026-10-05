/**
 * KASA HAREKETLERI (tahsilat DIŞI para giris-cikislari)
 *
 * ============================================================================
 * Tahsilat degil, ama kasadaki parayi degistiren hareketler:
 *   DEPOSIT        kasaya para konuldu (patron bozuk para bıraktı)
 *   WITHDRAWAL     kasadan para alindi (patron parayi aldi)
 *   BANK_TRANSFER  kasadan bankaya yatirildi
 *   ADVANCE        personele avans verildi
 *   CORRECTION     sayim duzeltmesi (iki yone de olabilir)
 *
 * TUTAR HER ZAMAN POZITIFTIR; yon `direction` alaninda tasinir. Isaretli
 * tutar saklanmaz: "-500" satiri hesabi sessizce ters cevirebilir.
 *
 * KAYIT SILINMEZ (mimari kural 4): hatali hareket VOIDED + gerekce ile
 * iptal edilir, veritabani tetikleyicisi DELETE'i reddeder.
 *
 * GIDERLE KARISTIRMA: nakit gider kasadan odendiginde kasa hareketi
 * URETILMEZ, yalnizca Expense satiri kasa oturumuna baglanir. Ikisini
 * birlikte yapmak beklenen nakdi iki kez dusurur (bkz. drawer.ts).
 * ============================================================================
 */

import type { CashMovementType, PaymentDirection } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

/**
 * Hareket tipinin DOGAL yonu.
 *
 * CORRECTION'un dogal yonu yoktur: cagiran taraf acikca belirtir. Digerlerinde
 * yon tipten bellidir ve istemcinin gonderdigi yon YOK SAYILIR - personel
 * "bankaya yatirdim" derken parayi kasaya ekleyemez.
 */
export function hareketYonu(tip: CashMovementType): PaymentDirection | null {
  switch (tip) {
    case "DEPOSIT":
      return "IN";
    case "WITHDRAWAL":
    case "BANK_TRANSFER":
    case "ADVANCE":
      return "OUT";
    case "CORRECTION":
      return null; // yon cagirandan alinir
  }
}

export const HAREKET_ETIKETLERI: Record<CashMovementType, string> = {
  DEPOSIT: "Kasaya para konuldu",
  WITHDRAWAL: "Kasadan para alındı",
  BANK_TRANSFER: "Bankaya yatırıldı",
  ADVANCE: "Personel avansı",
  CORRECTION: "Sayım düzeltmesi",
};

export interface KasaHareketIstegi {
  cashDrawerSessionId: string;
  tip: CashMovementType;
  tutarKurus: number;
  aciklama: string;
  /** Yalnizca CORRECTION icin anlamlidir; digerlerinde tipten belirlenir. */
  yon?: PaymentDirection;
  /** Personel avansinda kime verildigi (denetim notuna yazilir). */
  ilgiliKullaniciId?: string | null;
  idempotencyKey: string;
}

export async function kasaHareketiEkle(actor: SessionUser, istek: KasaHareketIstegi) {
  // Idempotency (mimari kural 7): ayni anahtarla ikinci istek yeni hareket
  // URETMEZ; ilk kayit dondurulur.
  const onceki = await prisma.cashMovement.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
  });
  if (onceki) return onceki;

  const aciklama = istek.aciklama.trim();
  if (aciklama.length < 3) {
    throw new IslemHatasi(
      "ACIKLAMA_ZORUNLU",
      "Kasa hareketi için açıklama zorunludur. (Örnek: 'Bankaya yatırıldı — dekont 4471')",
    );
  }
  if (!Number.isInteger(istek.tutarKurus) || istek.tutarKurus <= 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Tutar sıfırdan büyük olmalıdır.");
  }

  const dogalYon = hareketYonu(istek.tip);
  const yon = dogalYon ?? istek.yon;
  if (!yon) {
    throw new IslemHatasi(
      "YON_ZORUNLU",
      "Sayım düzeltmesinde paranın kasaya mı girdiği, kasadan mı çıktığı belirtilmelidir.",
    );
  }

  const oturum = await prisma.cashDrawerSession.findUnique({
    where: { id: istek.cashDrawerSessionId },
    select: { id: true, status: true },
  });
  if (!oturum) throw new IslemHatasi("KASA_YOK", "Kasa oturumu bulunamadı.");
  if (oturum.status !== "OPEN") {
    throw new IslemHatasi(
      "KASA_KAPALI",
      "Kapatılmış kasaya hareket girilemez. Düzeltme için yeni kasa oturumunda düzeltme hareketi girin.",
    );
  }

  const hareket = await prisma.$transaction(async (tx) => {
    const olusan = await tx.cashMovement.create({
      data: {
        cashDrawerSessionId: oturum.id,
        type: istek.tip,
        direction: yon,
        amount: kurusToDecimalString(istek.tutarKurus),
        description: aciklama,
        status: "CONFIRMED",
        idempotencyKey: istek.idempotencyKey,
        createdById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.CASH_MOVEMENT,
        entityType: "CashMovement",
        entityId: olusan.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          tip: istek.tip,
          yon,
          tutarKurus: istek.tutarKurus,
          kasaOturumu: oturum.id,
          ilgiliKullaniciId: istek.ilgiliKullaniciId ?? null,
        },
        note: aciklama,
      },
      tx,
    );

    return olusan;
  });

  return hareket;
}

/**
 * Hatali kasa hareketini iptal eder.
 *
 * SATIR SILINMEZ: VOIDED + gerekce. Iptal edilen hareket beklenen nakit
 * hesabina girmez (yalnizca CONFIRMED satirlar toplanir).
 */
export async function kasaHareketiIptal(
  actor: SessionUser,
  istek: { cashMovementId: string; sebep: string },
) {
  const sebep = istek.sebep.trim();
  if (sebep.length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");
  }

  const hareket = await prisma.cashMovement.findUnique({
    where: { id: istek.cashMovementId },
    include: { cashDrawerSession: { select: { status: true } } },
  });
  if (!hareket) throw new IslemHatasi("HAREKET_YOK", "Kasa hareketi bulunamadı.");
  if (hareket.status === "VOIDED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu hareket daha önce iptal edilmiş.");
  }
  if (hareket.expenseId) {
    throw new IslemHatasi(
      "GIDERE_BAGLI",
      "Bu hareket bir gider kaydına bağlı. İptal için gider kaydını iptal edin.",
    );
  }
  // Kapatilmis kasanin hareketini iptal etmek, imzalanmis sayimi geriye donuk
  // degistirir. Buna izin verilmez: duzeltme yeni kasada yapilir.
  if (hareket.cashDrawerSession.status !== "OPEN") {
    throw new IslemHatasi(
      "KASA_KAPALI",
      "Kapatılmış kasanın hareketi iptal edilemez. Düzeltmeyi yeni kasa oturumunda yapın.",
    );
  }

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.cashMovement.update({
      where: { id: hareket.id },
      data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.CASH_MOVEMENT,
        entityType: "CashMovement",
        entityId: hareket.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: {
          durum: "CONFIRMED",
          tip: hareket.type,
          yon: hareket.direction,
          tutarKurus: toKurus(hareket.amount),
        },
        after: { durum: "VOIDED" },
        note: `Kasa hareketi iptal edildi: ${sebep}`,
      },
      tx,
    );

    return guncel;
  });
}
