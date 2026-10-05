/**
 * ABONMAN TAHSILATI
 *
 * ============================================================================
 * KORUNAN KURALLAR
 * ----------------------------------------------------------------------------
 *  1. Abonman olusturmak tahsilat uretmez; tahsilat BU dosyadaki ayri
 *     islemdir.
 *  2. Tahsilati YAPAN KULLANICI kaydedilir (Payment.collectedById) ve
 *     denetim kaydina yazilir.
 *  3. Odemesi alinmamis abonman GECERLI sayilir (S9) - tahsilat eksikligi
 *     araci otoparka sokmamak icin GEREKCE DEGILDIR. Yalnizca uyari uretir.
 *  6. Gecmis donemlerin fiyati degismez; tahsilat hangi DONEME ait oldugu
 *     bilgisiyle saklanir.
 *
 * FINANSAL KAYIT SILINMEZ: hatali tahsilat VOIDED + gerekce ile iptal edilir.
 * Paranin fiilen iade edilip edilmedigi CAGIRAN TARAFTAN alinir; Asama 2'de
 * ogrenildigi gibi ikisini birlikte yapmak tutari IKI KEZ dusurur.
 * ============================================================================
 */

import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { acikKasaId } from "@/server/cash/drawer";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { tahsilatKodu } from "@/server/parking/codes";
import { vardiyaZorunlu } from "@/server/shift";
import type { SessionUser } from "@/server/auth/session";

type Tx = Prisma.TransactionClient;

export interface TahsilatIstegi {
  subscriptionId: string;
  /** Hangi doneme sayilacak. Verilmezse SON donem. */
  subscriptionPeriodId?: string;
  tutarKurus: number;
  odemeYontemi: PaymentMethod;
  kartNotu?: string | null;
  not?: string | null;
  idempotencyKey: string;
}

export interface TahsilatSonucu {
  paymentId: string;
  tahsilatKodu: string;
  donemNo: number;
  tutarKurus: number;
  donemFiyatiKurus: number;
  donemToplamTahsilatKurus: number;
  kalanKurus: number;
  odemeDurumu: "UNPAID" | "PARTIAL" | "PAID";
  /** Donem bedelinden fazla tahsil edildiyse bilgilendirme. */
  fazlaOdemeKurus: number;
  tekrarEdenIstek: boolean;
}

/**
 * Abonman tahsilati kaydeder.
 *
 * Tutar CAGIRANDAN gelir - abonman ucreti musteriye ozel oldugu icin sistem
 * "ne kadar olmali" diye varsayim yapmaz; yalnizca donem bedeliyle
 * karsilastirip kalan/fazla bilgisini dondurur.
 */
export async function abonmanTahsilatiKaydet(
  actor: SessionUser,
  istek: TahsilatIstegi,
): Promise<TahsilatSonucu> {
  if (!Number.isInteger(istek.tutarKurus) || istek.tutarKurus <= 0) {
    throw new IslemHatasi("TUTAR_GECERSIZ", "Tahsilat tutarı sıfırdan büyük olmalıdır.");
  }

  // Cift kayit engeli: ayni anahtarla ikinci istek yeni tahsilat URETMEZ.
  const onceki = await prisma.subscriptionPayment.findFirst({
    where: { payment: { idempotencyKey: istek.idempotencyKey } },
    include: { payment: true, subscriptionPeriod: true },
  });
  if (onceki) {
    const ozet = await donemOzeti(prisma, onceki.subscriptionId, onceki.subscriptionPeriodId);
    return {
      paymentId: onceki.paymentId,
      tahsilatKodu: onceki.payment.code,
      donemNo: onceki.subscriptionPeriod?.periodNo ?? 0,
      tutarKurus: toKurus(onceki.amount),
      donemFiyatiKurus: ozet.fiyat,
      donemToplamTahsilatKurus: ozet.tahsilEdilen,
      kalanKurus: Math.max(0, ozet.fiyat - ozet.tahsilEdilen),
      odemeDurumu: ozet.durum,
      fazlaOdemeKurus: Math.max(0, ozet.tahsilEdilen - ozet.fiyat),
      tekrarEdenIstek: true,
    };
  }

  const vardiya = await vardiyaZorunlu(actor.id);

  const abonman = await prisma.subscription.findUnique({
    where: { id: istek.subscriptionId },
    include: {
      customer: { select: { fullName: true } },
      periods: { orderBy: { periodNo: "desc" } },
    },
  });
  if (!abonman) throw new IslemHatasi("ABONMAN_YOK", "Abonman bulunamadı.");

  const donem = istek.subscriptionPeriodId
    ? abonman.periods.find((d) => d.id === istek.subscriptionPeriodId)
    : abonman.periods[0];
  if (!donem) {
    throw new IslemHatasi("DONEM_YOK", "Abonman dönemi bulunamadı.");
  }

  const sonuc = await prisma.$transaction(async (tx) => {
    const odeme = await tx.payment.create({
      data: {
        code: await tahsilatKodu(tx),
        amount: kurusToDecimalString(istek.tutarKurus),
        method: istek.odemeYontemi,
        // Kart notu yalnizca KART odemesinde anlamlidir.
        cardNote: istek.odemeYontemi === "CARD" ? istek.kartNotu?.trim() || null : null,
        direction: "IN",
        sourceType: "SUBSCRIPTION",
        shiftId: vardiya.id,
        cashDrawerSessionId: await acikKasaId(tx),
        // KURAL 2: tahsilati yapan kullanici.
        collectedById: actor.id,
        status: "CONFIRMED",
        idempotencyKey: istek.idempotencyKey,
      },
    });

    await tx.subscriptionPayment.create({
      data: {
        subscriptionId: abonman.id,
        subscriptionPeriodId: donem.id,
        paymentId: odeme.id,
        amount: kurusToDecimalString(istek.tutarKurus),
        createdById: actor.id,
      },
    });

    const ozet = await donemOzeti(tx, abonman.id, donem.id);

    await tx.subscription.update({
      where: { id: abonman.id },
      data: { paymentStatus: ozet.durum, updatedById: actor.id },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT,
        entityType: "Subscription",
        entityId: abonman.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          tahsilatKodu: odeme.code,
          musteri: abonman.customer.fullName,
          donemNo: donem.periodNo,
          tutar: odeme.amount.toString(),
          yontem: odeme.method,
          tahsilEden: actor.username,
          donemDurumu: ozet.durum,
        },
        note: istek.not?.trim() || null,
      },
      tx,
    );

    return { odeme, ozet, donemNo: donem.periodNo };
  });

  return {
    paymentId: sonuc.odeme.id,
    tahsilatKodu: sonuc.odeme.code,
    donemNo: sonuc.donemNo,
    tutarKurus: istek.tutarKurus,
    donemFiyatiKurus: sonuc.ozet.fiyat,
    donemToplamTahsilatKurus: sonuc.ozet.tahsilEdilen,
    kalanKurus: Math.max(0, sonuc.ozet.fiyat - sonuc.ozet.tahsilEdilen),
    odemeDurumu: sonuc.ozet.durum,
    fazlaOdemeKurus: Math.max(0, sonuc.ozet.tahsilEdilen - sonuc.ozet.fiyat),
    tekrarEdenIstek: false,
  };
}

/**
 * Donemin tahsilat ozeti.
 *
 * YALNIZCA CONFIRMED tahsilatlar sayilir; iptal edilenler (VOIDED) ve ters
 * kayitlar (direction = OUT) dusulur.
 */
async function donemOzeti(
  db: Tx | typeof prisma,
  subscriptionId: string,
  subscriptionPeriodId: string | null,
) {
  const donem = subscriptionPeriodId
    ? await db.subscriptionPeriod.findUnique({ where: { id: subscriptionPeriodId } })
    : await db.subscriptionPeriod.findFirst({
        where: { subscriptionId },
        orderBy: { periodNo: "desc" },
      });

  const fiyat = donem ? toKurus(donem.price) : 0;

  const kayitlar = await db.subscriptionPayment.findMany({
    where: {
      subscriptionId,
      ...(donem ? { subscriptionPeriodId: donem.id } : {}),
      payment: { status: "CONFIRMED" },
    },
    include: { payment: { select: { direction: true, amount: true } } },
  });

  const tahsilEdilen = kayitlar.reduce((toplam, k) => {
    const tutar = toKurus(k.payment.amount);
    return k.payment.direction === "OUT" ? toplam - tutar : toplam + tutar;
  }, 0);

  const durum: "UNPAID" | "PARTIAL" | "PAID" =
    tahsilEdilen <= 0 ? "UNPAID" : tahsilEdilen >= fiyat ? "PAID" : "PARTIAL";

  return { fiyat, tahsilEdilen, durum, donemId: donem?.id ?? null };
}

/** Abonmanin son donemine gore odeme durumunu yeniden hesaplar ve yazar. */
export async function odemeDurumunuTazele(subscriptionId: string) {
  const ozet = await donemOzeti(prisma, subscriptionId, null);
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { paymentStatus: ozet.durum },
  });
  return ozet;
}

// ---------------------------------------------------------------------------
// TAHSILAT IPTALI
// ---------------------------------------------------------------------------

export interface TahsilatIptalIstegi {
  paymentId: string;
  sebep: string;
  /**
   * PARA FIILEN IADE EDILDI MI?
   *
   *  true  -> orijinal tahsilat CONFIRMED kalir, TERS KAYIT (OUT) uretilir.
   *           Kasa raporunda hem tahsilat hem iade gorunur.
   *  false -> orijinal tahsilat VOIDED olur, ters kayit URETILMEZ
   *           (yanlis kayit; para hic el degistirmedi).
   *
   * Ikisini birlikte yapmak tutari IKI KEZ dusurur (Asama 2, hata 3).
   */
  iadeEdildi: boolean;
  idempotencyKey: string;
}

export async function abonmanTahsilatIptal(actor: SessionUser, istek: TahsilatIptalIstegi) {
  if (istek.sebep.trim().length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");
  }

  const kayit = await prisma.subscriptionPayment.findFirst({
    where: { paymentId: istek.paymentId },
    include: { payment: true, subscription: { select: { id: true, code: true } } },
  });
  if (!kayit) throw new IslemHatasi("TAHSILAT_YOK", "Abonman tahsilatı bulunamadı.");
  if (kayit.payment.status === "VOIDED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu tahsilat daha önce iptal edilmiş.");
  }
  if (kayit.payment.direction === "OUT") {
    throw new IslemHatasi("TERS_KAYIT", "Ters kayıt (iade) iptal edilemez.");
  }

  const vardiya = await vardiyaZorunlu(actor.id);
  const simdi = new Date();
  const tutar = toKurus(kayit.payment.amount);

  const sonuc = await prisma.$transaction(async (tx) => {
    let tersKayitKodu: string | null = null;

    if (istek.iadeEdildi) {
      // Para geri verildi: orijinal kayit DURUR, ters kayit eklenir.
      const ters = await tx.payment.create({
        data: {
          code: await tahsilatKodu(tx, simdi),
          amount: kurusToDecimalString(tutar),
          method: kayit.payment.method,
          direction: "OUT",
          sourceType: "REFUND",
          shiftId: vardiya.id,
          cashDrawerSessionId: await acikKasaId(tx),
          collectedById: actor.id,
          status: "CONFIRMED",
          reversalOfId: kayit.paymentId,
          idempotencyKey: `${istek.idempotencyKey}-iade`,
          paidAt: simdi,
        },
      });
      await tx.subscriptionPayment.create({
        data: {
          subscriptionId: kayit.subscriptionId,
          subscriptionPeriodId: kayit.subscriptionPeriodId,
          paymentId: ters.id,
          amount: kurusToDecimalString(tutar),
          createdById: actor.id,
        },
      });
      tersKayitKodu = ters.code;
    } else {
      // Para hic el degistirmedi: kayit gecersiz kilinir, ters kayit YOK.
      await tx.payment.update({
        where: { id: kayit.paymentId },
        data: {
          status: "VOIDED",
          voidedAt: simdi,
          voidedById: actor.id,
          voidReason: istek.sebep.trim(),
        },
      });
    }

    const ozet = await donemOzeti(tx, kayit.subscriptionId, kayit.subscriptionPeriodId);
    await tx.subscription.update({
      where: { id: kayit.subscriptionId },
      data: { paymentStatus: ozet.durum, updatedById: actor.id },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_PAYMENT_VOID,
        entityType: "Payment",
        entityId: kayit.paymentId,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: kayit.payment.status, tutar, abonman: kayit.subscription.code },
        after: {
          iadeEdildi: istek.iadeEdildi,
          durum: istek.iadeEdildi ? "CONFIRMED" : "VOIDED",
          tersKayitKodu,
          donemDurumu: ozet.durum,
        },
        note: istek.sebep.trim(),
      },
      tx,
    );

    return { ozet, tersKayitKodu };
  });

  return {
    paymentId: istek.paymentId,
    iadeEdildi: istek.iadeEdildi,
    tersKayitKodu: sonuc.tersKayitKodu,
    iptalEdilenKurus: tutar,
    odemeDurumu: sonuc.ozet.durum,
  };
}
