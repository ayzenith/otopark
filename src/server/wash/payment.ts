/**
 * OTO YIKAMA TAHSILATI VE IPTALI
 *
 * ============================================================================
 * TUTAR ISTEMCIDEN ALINMAZ
 * ----------------------------------------------------------------------------
 * Tahsil edilecek tutar her zaman IS EMRI SATIRLARINDAN yeniden hesaplanir.
 * Istemci yalnizca "hangi is emri" ve "hangi odeme yontemi" gonderir.
 * Indirim ayri bir izne baglidir ve gerekce zorunludur.
 *
 * TAHSILATSIZ TAMAMLAMA: is tamamlanip para alinmamis olabilir (musteri sonra
 * odeyecek, patron ucretsiz yapti vb.). Bu durumda is emri COMPLETED olur ama
 * paymentStatus UNPAID kalir ve patron panelinde "tahsil edilmemis yikama"
 * olarak gorunur - kayip sessiz kalmaz.
 *
 * FINANSAL KAYIT SILINMEZ: hatali tahsilat VOIDED + gerekce ile iptal edilir.
 * Paranin fiilen iade edilip edilmedigi CAGIRANDAN alinir; ikisini birlikte
 * yapmak tutari IKI KEZ dusurur (Asama 2'de yasanan hata).
 *
 * OTOPARKTAN AYRIDIR: yikama tahsilati sourceType = WASH ile kaydedilir;
 * park tahsilatiyla (PARKING) karismaz, raporlarda ayri gorunur.
 * ============================================================================
 */

import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { clampNonNegative, kurusToDecimalString, toKurus } from "@/lib/money";
import { vardiyaZorunlu } from "@/server/shift";
import { tahsilatKodu } from "@/server/parking/codes";
import { PERMISSIONS } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/session";

export interface YikamaTahsilatIstegi {
  washJobId: string;
  odemeYontemi: PaymentMethod;
  kartNotu?: string | null;
  /** Indirim: wash.collect degil, parking.discount iznine benzer sekilde ayri izin. */
  indirimKurus?: number;
  indirimSebebi?: string | null;
  /** Is emri henuz tamamlanmadiysa tahsilatla birlikte tamamlansin mi? */
  tamamla?: boolean;
  idempotencyKey: string;
}

export interface YikamaTahsilatSonucu {
  washJobId: string;
  kod: string;
  tahsilatKodu: string | null;
  toplamKurus: number;
  indirimKurus: number;
  odenenKurus: number;
  odemeYontemi: PaymentMethod | null;
  durum: string;
  tekrarEdenIstek: boolean;
}

export async function yikamaTahsilat(
  actor: SessionUser,
  istek: YikamaTahsilatIstegi,
): Promise<YikamaTahsilatSonucu> {
  // Cift kayit engeli: ayni anahtarla ikinci istek yeni tahsilat URETMEZ.
  const onceki = await prisma.payment.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
    include: { washJob: true },
  });
  if (onceki?.washJob) {
    return {
      washJobId: onceki.washJob.id,
      kod: onceki.washJob.code,
      tahsilatKodu: onceki.code,
      toplamKurus: toKurus(onceki.washJob.totalAmount),
      indirimKurus: onceki.washJob.discountAmount ? toKurus(onceki.washJob.discountAmount) : 0,
      odenenKurus: toKurus(onceki.amount),
      odemeYontemi: onceki.method,
      durum: onceki.washJob.status,
      tekrarEdenIstek: true,
    };
  }

  const vardiya = await vardiyaZorunlu(actor.id);
  const indirimIzni = actor.permissions.has(PERMISSIONS.PARKING_DISCOUNT);

  const istenenIndirim = clampNonNegative(istek.indirimKurus ?? 0);
  if (istenenIndirim > 0 && !indirimIzni) {
    throw new IslemHatasi("INDIRIM_YETKISI", "İndirim uygulama yetkiniz yok.");
  }
  if (istenenIndirim > 0 && (istek.indirimSebebi?.trim().length ?? 0) < 3) {
    throw new IslemHatasi("INDIRIM_SEBEBI", "İndirim gerekçesi zorunludur.");
  }

  return prisma.$transaction(async (tx) => {
    // Kaydi kilitle: esszamanli iki tahsilat denemesinde ikincisi beklesin.
    const kilitli = await tx.$queryRaw<
      { id: string; status: string; paymentStatus: string }[]
    >`SELECT id, status, "paymentStatus" FROM "WashJob" WHERE id = ${istek.washJobId} FOR UPDATE`;

    if (kilitli.length === 0) {
      throw new IslemHatasi("IS_EMRI_YOK", "Yıkama kaydı bulunamadı.");
    }
    if (kilitli[0]!.paymentStatus === "PAID") {
      throw new IslemHatasi(
        "ZATEN_TAHSIL",
        "Bu yıkamanın tahsilatı yapılmış. Mükerrer tahsilat engellendi.",
      );
    }
    if (kilitli[0]!.status === "CANCELLED") {
      throw new IslemHatasi("IS_EMRI_IPTAL", "İptal edilmiş yıkamanın tahsilatı yapılamaz.");
    }

    const isEmri = await tx.washJob.findUniqueOrThrow({
      where: { id: istek.washJobId },
      include: { items: true },
    });

    // --- TUTAR SUNUCUDA YENIDEN HESAPLANIR ---
    const toplam = isEmri.items.reduce((t, i) => t + toKurus(i.lineTotal), 0);
    const indirim = Math.min(istenenIndirim, toplam);
    const odenecek = Math.max(0, toplam - indirim);
    const simdi = new Date();

    let odeme: { id: string; code: string } | null = null;
    if (odenecek > 0) {
      odeme = await tx.payment.create({
        data: {
          code: await tahsilatKodu(tx, simdi),
          amount: kurusToDecimalString(odenecek),
          method: istek.odemeYontemi,
          // Kart notu yalnizca KART odemesinde anlamlidir.
          cardNote: istek.odemeYontemi === "CARD" ? istek.kartNotu?.trim() || null : null,
          direction: "IN",
          sourceType: "WASH",
          washJobId: isEmri.id,
          shiftId: vardiya.id,
          collectedById: actor.id,
          status: "CONFIRMED",
          idempotencyKey: istek.idempotencyKey,
          paidAt: simdi,
        },
        select: { id: true, code: true },
      });
    }

    const tamamlanacak = istek.tamamla !== false && isEmri.status !== "COMPLETED";

    const guncel = await tx.washJob.update({
      where: { id: isEmri.id },
      data: {
        totalAmount: kurusToDecimalString(toplam),
        discountAmount: indirim > 0 ? kurusToDecimalString(indirim) : null,
        payableAmount: kurusToDecimalString(odenecek),
        collectedAmount: kurusToDecimalString(odenecek),
        // Tahsil edilecek tutar 0 ise de islem "odendi" sayilir: odenecek
        // bir sey kalmadi. Tahsilatsiz tamamlama AYRI fonksiyondur.
        paymentStatus: "PAID",
        status: tamamlanacak ? "COMPLETED" : isEmri.status,
        completedAt: tamamlanacak ? simdi : isEmri.completedAt,
        notes:
          indirim > 0
            ? [isEmri.notes, `İndirim: ${istek.indirimSebebi?.trim()}`].filter(Boolean).join(" · ")
            : isEmri.notes,
      },
    });

    if (indirim > 0) {
      await writeAudit(
        {
          action: AUDIT_ACTIONS.PARKING_DISCOUNT,
          entityType: "WashJob",
          entityId: isEmri.id,
          userId: actor.id,
          actorLabel: actor.username,
          before: { toplamKurus: toplam },
          after: { indirimKurus: indirim, odenecekKurus: odenecek },
          note: istek.indirimSebebi?.trim() ?? null,
        },
        tx,
      );
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_PAYMENT,
        entityType: "WashJob",
        entityId: isEmri.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: isEmri.code,
          tahsilatKodu: odeme?.code ?? null,
          toplamKurus: toplam,
          indirimKurus: indirim,
          odenenKurus: odenecek,
          yontem: istek.odemeYontemi,
          tahsilEden: actor.username,
          durum: guncel.status,
        },
      },
      tx,
    );

    return {
      washJobId: isEmri.id,
      kod: isEmri.code,
      tahsilatKodu: odeme?.code ?? null,
      toplamKurus: toplam,
      indirimKurus: indirim,
      odenenKurus: odenecek,
      odemeYontemi: odenecek > 0 ? istek.odemeYontemi : null,
      durum: guncel.status,
      tekrarEdenIstek: false,
    };
  });
}

/**
 * TAHSILATSIZ TAMAMLAMA.
 *
 * Is bitti ama para alinmadi. Gerekce ZORUNLUDUR: "neden tahsil edilmedi?"
 * sorusunun yanitsiz kalmasi kasa farki demektir. Is emri COMPLETED olur,
 * paymentStatus UNPAID kalir ve patron panelinde takip listesine duser.
 */
export async function yikamaTahsilatsizTamamla(
  actor: SessionUser,
  istek: { washJobId: string; sebep: string },
) {
  if (istek.sebep.trim().length < 3) {
    throw new IslemHatasi(
      "SEBEP_ZORUNLU",
      "Tahsilat yapılmadan tamamlamak için gerekçe zorunludur.",
    );
  }

  const isEmri = await prisma.washJob.findUnique({ where: { id: istek.washJobId } });
  if (!isEmri) throw new IslemHatasi("IS_EMRI_YOK", "Yıkama kaydı bulunamadı.");
  if (isEmri.status === "CANCELLED") {
    throw new IslemHatasi("IS_EMRI_IPTAL", "İptal edilmiş iş tamamlanamaz.");
  }
  if (isEmri.status === "COMPLETED") {
    throw new IslemHatasi("ZATEN_TAMAM", "Bu iş zaten tamamlanmış.");
  }

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.washJob.update({
      where: { id: isEmri.id },
      data: {
        status: "COMPLETED",
        completedAt: simdi,
        paymentStatus: "UNPAID",
        notes: [isEmri.notes, `TAHSİLAT YAPILMADI: ${istek.sebep.trim()}`]
          .filter(Boolean)
          .join(" · "),
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_STATUS_CHANGE,
        entityType: "WashJob",
        entityId: isEmri.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: isEmri.status, odemeDurumu: isEmri.paymentStatus },
        after: { durum: "COMPLETED", odemeDurumu: "UNPAID", tahsilatYapilmadi: true },
        note: istek.sebep.trim(),
      },
      tx,
    );

    return guncel;
  });
}

// ---------------------------------------------------------------------------
// IPTAL
// ---------------------------------------------------------------------------

export interface YikamaIptalIstegi {
  washJobId: string;
  sebep: string;
  /**
   * PARA FIILEN IADE EDILDI MI? (yalnizca tahsilati yapilmis iste anlamli)
   *
   *  true  -> orijinal tahsilat CONFIRMED kalir, TERS KAYIT (OUT) uretilir.
   *  false -> orijinal tahsilat VOIDED olur, ters kayit URETILMEZ.
   *
   * Ikisini birlikte yapmak tutari IKI KEZ dusurur.
   */
  iadeEdildi?: boolean;
  idempotencyKey: string;
}

export async function yikamaIptal(actor: SessionUser, istek: YikamaIptalIstegi) {
  if (istek.sebep.trim().length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");
  }

  const isEmri = await prisma.washJob.findUnique({
    where: { id: istek.washJobId },
    include: { payments: { where: { status: "CONFIRMED", direction: "IN" } } },
  });
  if (!isEmri) throw new IslemHatasi("IS_EMRI_YOK", "Yıkama kaydı bulunamadı.");
  if (isEmri.status === "CANCELLED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu yıkama daha önce iptal edilmiş.");
  }

  const tahsilatlar = isEmri.payments;
  if (tahsilatlar.length > 0 && istek.iadeEdildi === undefined) {
    throw new IslemHatasi(
      "IADE_BILGISI_GEREKLI",
      "Bu yıkamanın tahsilatı yapılmış. Paranın müşteriye fiilen iade edilip " +
        "edilmediğini belirtmeniz gerekir.",
    );
  }

  const vardiya = tahsilatlar.length > 0 ? await vardiyaZorunlu(actor.id) : null;
  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    let tersKayitKodu: string | null = null;
    let iadeEdilenKurus = 0;
    let iptalEdilenKurus = 0;

    for (const odeme of tahsilatlar) {
      const tutar = toKurus(odeme.amount);
      if (istek.iadeEdildi) {
        // Para geri verildi: orijinal kayit DURUR, ters kayit eklenir.
        const ters = await tx.payment.create({
          data: {
            code: await tahsilatKodu(tx, simdi),
            amount: kurusToDecimalString(tutar),
            method: odeme.method,
            direction: "OUT",
            sourceType: "REFUND",
            washJobId: isEmri.id,
            shiftId: vardiya!.id,
            collectedById: actor.id,
            status: "CONFIRMED",
            reversalOfId: odeme.id,
            idempotencyKey: `${istek.idempotencyKey}-iade-${odeme.id}`,
            paidAt: simdi,
          },
        });
        tersKayitKodu = ters.code;
        iadeEdilenKurus += tutar;
      } else {
        // Para hic el degistirmedi: kayit gecersiz kilinir, ters kayit YOK.
        await tx.payment.update({
          where: { id: odeme.id },
          data: {
            status: "VOIDED",
            voidedAt: simdi,
            voidedById: actor.id,
            voidReason: istek.sebep.trim(),
          },
        });
        iptalEdilenKurus += tutar;
      }
    }

    const guncel = await tx.washJob.update({
      where: { id: isEmri.id },
      data: {
        status: "CANCELLED",
        cancelledAt: simdi,
        cancelReason: istek.sebep.trim(),
        paymentStatus: "VOIDED",
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_VOID,
        entityType: "WashJob",
        entityId: isEmri.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: isEmri.status, odemeDurumu: isEmri.paymentStatus },
        after: {
          durum: "CANCELLED",
          iadeEdildi: istek.iadeEdildi ?? false,
          tersKayitKodu,
          iadeEdilenKurus,
          iptalEdilenKurus,
        },
        note: istek.sebep.trim(),
      },
      tx,
    );

    return {
      washJobId: guncel.id,
      kod: guncel.code,
      etkilenenTahsilatSayisi: tahsilatlar.length,
      tersKayitKodu,
      iadeEdilenKurus,
      iptalEdilenKurus,
    };
  });
}

export type { Prisma };
