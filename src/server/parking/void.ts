/**
 * PARK ISLEMI IPTALI
 *
 * ============================================================================
 * FINANSAL KAYIT SILINMEZ.
 * ----------------------------------------------------------------------------
 * Hatali islem VOIDED durumuna alinir; gerekce, iptal eden kullanici ve zaman
 * saklanir. Veritabani tetikleyicisi DELETE girisimlerini zaten reddeder.
 *
 * TAHSILAT IPTALINDE IKI AYRI DURUM VAR - ve bu bir muhasebe meselesidir:
 *
 *   1) PARA FIILEN IADE EDILDI (musteriye geri verildi)
 *      -> Orijinal tahsilat CONFIRMED kalir, cunku gercekten oldu.
 *      -> Ters kayit (direction=OUT, sourceType=REFUND) olusturulur.
 *      -> Kasa: +50 sonra -50. Fiziksel gerceklikle birebir ortusur.
 *
 *   2) PARA ALINMAMIŞTI veya hic el degistirmedi (yanlis plaka, hatali kayit)
 *      -> Orijinal tahsilat VOIDED yapilir, ters kayit URETILMEZ.
 *      -> Kasa: hic hareket olmamis gibi.
 *
 * Ikisini birlikte yapmak (VOIDED + ters kayit) parayi IKI KEZ dusurur ve
 * kasayi hatali gosterir. Bu nedenle cagiran taraf hangi durumun gecerli
 * oldugunu BILDIRMEK ZORUNDADIR; sistem bunu varsaymaz, cunku parayi fiilen
 * geri verip vermedigini yalnizca islemi yapan personel bilir.
 * ============================================================================
 */

import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { vardiyaZorunlu, IslemHatasi } from "@/server/shift";
import { tahsilatKodu } from "./codes";
import type { SessionUser } from "@/server/auth/session";

export interface IptalIstegi {
  parkingSessionId: string;
  sebep: string;
  /**
   * Tahsil edilen para musteriye FIILEN iade edildi mi?
   *
   * true  -> ters kayit uretilir, orijinal tahsilat CONFIRMED kalir
   * false -> orijinal tahsilat VOIDED yapilir, ters kayit uretilmez
   *
   * Tahsilati olan bir kaydi iptal ederken bu alan ZORUNLUDUR.
   */
  iadeEdildi?: boolean;
  idempotencyKey: string;
}

export interface IptalSonucu {
  parkingSessionId: string;
  kod: string;
  /** Kac tahsilat etkilendi. */
  etkilenenTahsilatSayisi: number;
  /** Ters kayit uretildiyse kodu. */
  tersKayitKodu: string | null;
  /** Musteriye iade edilen tutar (kurus). */
  iadeEdilenKurus: number;
  /** Iptal edilen (VOIDED) tahsilat toplami (kurus). */
  iptalEdilenKurus: number;
}

export async function parkIptal(actor: SessionUser, istek: IptalIstegi): Promise<IptalSonucu> {
  const vardiya = await vardiyaZorunlu(actor.id);

  const sebep = istek.sebep.trim();
  if (sebep.length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İptal için gerekçe girilmesi zorunludur.");
  }

  return prisma.$transaction(async (tx) => {
    const kilitli = await tx.$queryRaw<
      { id: string; status: string }[]
    >`SELECT id, status FROM "ParkingSession" WHERE id = ${istek.parkingSessionId} FOR UPDATE`;

    if (kilitli.length === 0) throw new IslemHatasi("KAYIT_YOK", "Park kaydı bulunamadı.");
    if (kilitli[0]!.status === "VOIDED") {
      throw new IslemHatasi("ZATEN_IPTAL", "Bu kayıt daha önce iptal edilmiş.");
    }

    const kayit = await tx.parkingSession.findUniqueOrThrow({
      where: { id: istek.parkingSessionId },
      include: { payments: { where: { status: "CONFIRMED", direction: "IN" } } },
    });

    const tahsilatVar = kayit.payments.length > 0;

    // Tahsilat varsa, paranin iade edilip edilmedigi BILDIRILMEK ZORUNDA.
    if (tahsilatVar && istek.iadeEdildi === undefined) {
      throw new IslemHatasi(
        "IADE_BILGISI_ZORUNLU",
        "Bu işlemde tahsilat var. Paranın müşteriye iade edilip edilmediğini belirtmelisiniz.",
      );
    }

    const oncekiDurum = kayit.status;

    // --- Park kaydini iptal et (SILMEZ) ---
    // Cikis bilgileri korunur: "ne zaman cikti, ne kadar tahsil edildi"
    // bilgisi kaybolmaz; yalnizca durum VOIDED olur.
    await tx.parkingSession.update({
      where: { id: kayit.id },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedById: actor.id,
        voidReason: sebep,
      },
    });

    let iadeToplami = 0;
    let iptalToplami = 0;
    let tersKod: string | null = null;

    for (const odeme of kayit.payments) {
      const tutar = toKurus(odeme.amount);

      if (istek.iadeEdildi) {
        // --- DURUM 1: para fiilen iade edildi ---
        // Orijinal tahsilat CONFIRMED KALIR: gercekten oldu, kasa gordu.
        const ters = await tx.payment.create({
          data: {
            code: await tahsilatKodu(tx),
            amount: kurusToDecimalString(tutar),
            method: odeme.method,
            direction: "OUT",
            sourceType: "REFUND",
            parkingSessionId: kayit.id,
            shiftId: vardiya.id,
            collectedById: actor.id,
            status: "CONFIRMED",
            reversalOfId: odeme.id,
            idempotencyKey: `${istek.idempotencyKey}-iade-${odeme.id}`,
          },
        });
        tersKod = ters.code;
        iadeToplami += tutar;

        await writeAudit(
          {
            action: AUDIT_ACTIONS.PAYMENT_VOID,
            entityType: "Payment",
            entityId: odeme.id,
            userId: actor.id,
            actorLabel: actor.username,
            before: { status: "CONFIRMED", tutarKurus: tutar },
            after: {
              durum: "IADE_EDILDI",
              tersKayitId: ters.id,
              tersKayitKodu: ters.code,
              aciklama: "Orijinal tahsilat kaydı korundu; iade ters kayıtla işlendi.",
            },
            note: sebep,
          },
          tx,
        );
      } else {
        // --- DURUM 2: para el degistirmedi ---
        // Orijinal tahsilat VOIDED yapilir; ters kayit URETILMEZ.
        await tx.payment.update({
          where: { id: odeme.id },
          data: {
            status: "VOIDED",
            voidedAt: new Date(),
            voidedById: actor.id,
            voidReason: sebep,
          },
        });
        iptalToplami += tutar;

        await writeAudit(
          {
            action: AUDIT_ACTIONS.PAYMENT_VOID,
            entityType: "Payment",
            entityId: odeme.id,
            userId: actor.id,
            actorLabel: actor.username,
            before: { status: "CONFIRMED", tutarKurus: tutar },
            after: {
              status: "VOIDED",
              aciklama: "Para el değiştirmedi; ters kayıt üretilmedi.",
            },
            note: sebep,
          },
          tx,
        );
      }
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.PARKING_VOID,
        entityType: "ParkingSession",
        entityId: kayit.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { status: oncekiDurum, collectedAmount: kayit.collectedAmount?.toString() },
        after: {
          status: "VOIDED",
          iadeEdildi: istek.iadeEdildi ?? null,
          iadeEdilenKurus: iadeToplami,
          iptalEdilenKurus: iptalToplami,
        },
        note: sebep,
      },
      tx,
    );

    return {
      parkingSessionId: kayit.id,
      kod: kayit.code,
      etkilenenTahsilatSayisi: kayit.payments.length,
      tersKayitKodu: tersKod,
      iadeEdilenKurus: iadeToplami,
      iptalEdilenKurus: iptalToplami,
    };
  });
}
