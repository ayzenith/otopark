/**
 * DIGER GELIRLER (park / yikama / abonman DIŞI gelir)
 *
 * ============================================================================
 * Ornek: hurda satisi, otomat geliri, kira geliri. Sisteme etiketiyle girilir;
 * HAZIR BIR ETIKET LISTESI YOKTUR cunku isletme hangi gelir kalemlerinin
 * olacagini bildirmedi - uydurulmaz, personel/patron serbest metin yazar.
 *
 * GELIR KAYDI TAHSILAT URETIR. Park ve yikamadan farkli olarak burada
 * "hizmet" yok, dogrudan para var. Bu yuzden OtherIncome satiri + ona bagli
 * Payment satiri birlikte olusur; boylece gelir kasa dokumune, vardiya
 * ozetine ve gunluk tahsilat raporuna kendiliginden girer.
 *
 * TUTAR ISTEMCIDEN ALINIR (gider gibi): hesaplanan bir deger degil, dis
 * dunyadan gelen bir olgudur. Bu yuzden izne baglidir ve denetime yazilir.
 *
 * KAYIT SILINMEZ (mimari kural 4) ve IPTALDE CIFTE MUHASEBE TUZAGINA
 * DUSULMEZ (mimari kural 5): para fiilen geri verildiyse orijinal tahsilat
 * CONFIRMED kalir + ters kayit uretilir; para hic el degistirmediyse
 * orijinal VOIDED olur ve ters kayit URETILMEZ.
 * ============================================================================
 */

import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { vardiyaZorunlu } from "@/server/shift";
import { tahsilatKodu } from "@/server/parking/codes";
import { digerGelirKodu } from "@/server/cash/codes";
import { acikKasaId } from "@/server/cash/drawer";
import type { SessionUser } from "@/server/auth/session";

export interface DigerGelirIstegi {
  /** Gelirin adi - serbest metin (hazir liste yok). */
  etiket: string;
  tutarKurus: number;
  gelirTarihi: Date;
  odemeYontemi: PaymentMethod;
  aciklama?: string | null;
  idempotencyKey: string;
}

export interface DigerGelirSonucu {
  otherIncomeId: string;
  kod: string;
  tahsilatKodu: string;
  tutarKurus: number;
  kasaOturumuId: string | null;
  tekrarEdenIstek: boolean;
}

export async function digerGelirKaydet(
  actor: SessionUser,
  istek: DigerGelirIstegi,
): Promise<DigerGelirSonucu> {
  const onceki = await prisma.otherIncome.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
    include: { payments: { where: { direction: "IN" }, take: 1 } },
  });
  if (onceki) {
    return {
      otherIncomeId: onceki.id,
      kod: onceki.code,
      tahsilatKodu: onceki.payments[0]?.code ?? "—",
      tutarKurus: toKurus(onceki.amount),
      kasaOturumuId: onceki.payments[0]?.cashDrawerSessionId ?? null,
      tekrarEdenIstek: true,
    };
  }

  const etiket = istek.etiket.trim();
  if (etiket.length < 3) {
    throw new IslemHatasi(
      "ETIKET_ZORUNLU",
      "Gelirin ne olduğu yazılmalıdır. (Örnek: 'Otomat geliri', 'Hurda satışı')",
    );
  }
  if (!Number.isInteger(istek.tutarKurus) || istek.tutarKurus <= 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Gelir tutarı sıfırdan büyük olmalıdır.");
  }
  if (istek.gelirTarihi.getTime() > Date.now() + 86_400_000) {
    throw new IslemHatasi("GELECEK_TARIH", "Gelir tarihi ileri bir güne verilemez.");
  }

  // Tahsilat uretildigi icin ACIK VARDIYA ZORUNLUDUR: aksi halde tahsilat
  // hicbir vardiyaya bagli olmaz ve kasa kapanisi yapilamaz.
  const vardiya = await vardiyaZorunlu(actor.id);
  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const gelir = await tx.otherIncome.create({
      data: {
        code: await digerGelirKodu(tx, simdi),
        label: etiket,
        amount: kurusToDecimalString(istek.tutarKurus),
        incomeDate: istek.gelirTarihi,
        method: istek.odemeYontemi,
        description: istek.aciklama?.trim() || null,
        status: "CONFIRMED",
        idempotencyKey: istek.idempotencyKey,
        createdById: actor.id,
      },
    });

    const kasaOturumuId = await acikKasaId(tx);

    const odeme = await tx.payment.create({
      data: {
        code: await tahsilatKodu(tx, simdi),
        amount: kurusToDecimalString(istek.tutarKurus),
        method: istek.odemeYontemi,
        direction: "IN",
        sourceType: "OTHER_INCOME",
        otherIncomeId: gelir.id,
        shiftId: vardiya.id,
        cashDrawerSessionId: kasaOturumuId,
        collectedById: actor.id,
        status: "CONFIRMED",
        idempotencyKey: `${istek.idempotencyKey}-tahsilat`,
        paidAt: simdi,
      },
      select: { id: true, code: true },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.PAYMENT_CREATE,
        entityType: "OtherIncome",
        entityId: gelir.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: gelir.code,
          etiket,
          tutarKurus: istek.tutarKurus,
          yontem: istek.odemeYontemi,
          tahsilatKodu: odeme.code,
          kasaOturumuId,
          vardiyaId: vardiya.id,
        },
        note: `Diğer gelir kaydedildi: ${etiket}`,
      },
      tx,
    );

    return {
      otherIncomeId: gelir.id,
      kod: gelir.code,
      tahsilatKodu: odeme.code,
      tutarKurus: istek.tutarKurus,
      kasaOturumuId,
      tekrarEdenIstek: false,
    };
  });
}

export interface DigerGelirIptalIstegi {
  otherIncomeId: string;
  sebep: string;
  /**
   * PARA FIILEN IADE EDILDI MI?
   *
   *  true  -> orijinal tahsilat CONFIRMED kalir, TERS KAYIT (OUT) uretilir.
   *  false -> orijinal tahsilat VOIDED olur, ters kayit URETILMEZ.
   *
   * Ikisini birlikte yapmak tutari IKI KEZ dusurur (mimari kural 5).
   */
  iadeEdildi: boolean;
  idempotencyKey: string;
}

export async function digerGelirIptal(actor: SessionUser, istek: DigerGelirIptalIstegi) {
  const sebep = istek.sebep.trim();
  if (sebep.length < 3) throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");

  const gelir = await prisma.otherIncome.findUnique({
    where: { id: istek.otherIncomeId },
    include: { payments: { where: { status: "CONFIRMED", direction: "IN" } } },
  });
  if (!gelir) throw new IslemHatasi("GELIR_YOK", "Gelir kaydı bulunamadı.");
  if (gelir.status === "VOIDED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu gelir kaydı daha önce iptal edilmiş.");
  }

  const vardiya = istek.iadeEdildi ? await vardiyaZorunlu(actor.id) : null;
  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    let tersKayitKodu: string | null = null;
    let iadeEdilenKurus = 0;
    let iptalEdilenKurus = 0;

    for (const odeme of gelir.payments) {
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
            otherIncomeId: gelir.id,
            shiftId: vardiya!.id,
            cashDrawerSessionId: await acikKasaId(tx),
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
          data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
        });
        iptalEdilenKurus += tutar;
      }
    }

    await tx.otherIncome.update({
      where: { id: gelir.id },
      data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.PAYMENT_VOID,
        entityType: "OtherIncome",
        entityId: gelir.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: "CONFIRMED", tutarKurus: toKurus(gelir.amount) },
        after: {
          durum: "VOIDED",
          iadeEdildi: istek.iadeEdildi,
          tersKayitKodu,
          iadeEdilenKurus,
          iptalEdilenKurus,
        },
        note: sebep,
      },
      tx,
    );

    return {
      otherIncomeId: gelir.id,
      kod: gelir.code,
      tersKayitKodu,
      iadeEdilenKurus,
      iptalEdilenKurus,
    };
  });
}
