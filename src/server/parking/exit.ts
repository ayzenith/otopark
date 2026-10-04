/**
 * ARAC CIKISI VE TAHSILAT
 *
 * ============================================================================
 * EN ONEMLI GUVENLIK KURALI
 * ----------------------------------------------------------------------------
 * Ucret HER ZAMAN SUNUCUDA YENIDEN HESAPLANIR. Istemciden gelen tutar, sure
 * veya fiyat bilgisine ASLA guvenilmez; istemci yalnizca "hangi arac" ve
 * "hangi odeme yontemi" bilgisini gonderir.
 *
 * Sorgulama (onizleme) ile cikis islemi ayni hesaplama fonksiyonunu kullanir;
 * yani ekranda gosterilen tutar ile tahsil edilen tutar ayni kaynaktan gelir.
 * Arada gecen sure yuzunden tutar degisirse, cikis ani esas alinir.
 * ============================================================================
 *
 * Transaction icerigi (docs/02 2.5):
 *   1. Kayit FOR UPDATE ile kilitlenir, status='ACTIVE' dogrulanir
 *   2. Ucret sunucuda hesaplanir (tariffSnapshot'tan)
 *   3. ParkingSession guncellenir
 *   4. Tutar > 0 ise Payment satiri olusturulur
 *   5. Denetim kaydi yazilir
 * Biri basarisiz olursa hicbiri yazilmaz.
 */

import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { normalizePlate } from "@/lib/plate";
import { isWeekend, minuteOfDay } from "@/lib/datetime";
import { clampNonNegative, kurusToDecimalString, toKurus } from "@/lib/money";
import { hesaplaUcret, odenecekTutar } from "@/server/pricing/calculate";
import { okuSnapshot } from "@/server/pricing/resolve";
import { vardiyaZorunlu, IslemHatasi } from "@/server/shift";
import { tahsilatKodu } from "./codes";
import type { DokumSatiri } from "@/server/pricing/types";
import type { SessionUser } from "@/server/auth/session";

export interface CikisOnizleme {
  parkingSessionId: string;
  kod: string;
  plakaGosterim: string;
  aracSinifiAdi: string;
  girisAt: Date;
  /** Onizlemenin yapildigi an - tutar bu ana gore hesaplandi. */
  hesapAnı: Date;
  sureDakika: number;
  /** Abonman kapsaminda mi? (giris anindaki billingMode) */
  abonmanKapsaminda: boolean;
  abonmanMusteriAdi: string | null;
  tarifeAdi: string | null;
  tarifeSurumNo: number | null;
  dokum: DokumSatiri[];
  /** Hesaplanan tutar (kurus). */
  tutar: number;
  ucretsizMi: boolean;
  tarifeTanimsiz: boolean;
  uygulananKurallar: string[];
}

/**
 * Cikis onizlemesi: sureyi ve tutari hesaplar, HICBIR SEY YAZMAZ.
 * Personel ekranindaki tahsilat panelini doldurur.
 */
export async function cikisOnizleme(plakaVeyaId: string): Promise<CikisOnizleme> {
  const plateNormalized = normalizePlate(plakaVeyaId);

  const kayit = await prisma.parkingSession.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ plateNormalized }, { id: plakaVeyaId }],
    },
    include: {
      vehicle: { include: { vehicleClass: true } },
      subscription: { include: { customer: { select: { fullName: true } } } },
    },
  });

  if (!kayit) {
    // Yanlislikla ikinci tahsilat yapilmasin: son 24 saatteki cikislari bildir.
    const sonCikis = await prisma.parkingSession.findFirst({
      where: {
        plateNormalized,
        status: "COMPLETED",
        exitAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { exitAt: "desc" },
      select: { exitAt: true, collectedAmount: true, code: true },
    });

    if (sonCikis?.exitAt) {
      const saat = sonCikis.exitAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      });
      const tutar = sonCikis.collectedAmount
        ? ` (${sonCikis.collectedAmount.toString()} ₺ tahsil edildi)`
        : "";
      throw new IslemHatasi(
        "ZATEN_CIKMIS",
        `Bu araç bugün ${saat}'te çıkış yapmış${tutar}. Fiş: ${sonCikis.code}`,
      );
    }

    throw new IslemHatasi("AKTIF_KAYIT_YOK", "Bu plakayla otoparkta araç bulunamadı.");
  }

  const simdi = new Date();
  const hesap = hesaplaCikisUcreti(kayit, simdi);

  return {
    parkingSessionId: kayit.id,
    kod: kayit.code,
    plakaGosterim: kayit.plateDisplay,
    aracSinifiAdi: kayit.vehicle.vehicleClass.name,
    girisAt: kayit.entryAt,
    hesapAnı: simdi,
    sureDakika: hesap.sureDakika,
    abonmanKapsaminda: kayit.billingMode === "SUBSCRIPTION",
    abonmanMusteriAdi: kayit.subscription?.customer.fullName ?? null,
    tarifeAdi: hesap.snapshot?.planAdi ?? null,
    tarifeSurumNo: hesap.snapshot?.surumNo ?? null,
    dokum: hesap.dokum,
    tutar: hesap.tutar,
    ucretsizMi: hesap.ucretsizMi,
    tarifeTanimsiz: hesap.tarifeTanimsiz,
    uygulananKurallar: hesap.uygulananKurallar,
  };
}

/**
 * Cikis ucretini hesaplar - hem onizleme hem gercek cikis bunu kullanir.
 *
 * ABONMAN KURALI (S10, karar 02.10.2026): giris anindaki billingMode
 * SUBSCRIPTION ise park UCRETSIZ tamamlanir. Abonman park sirasinda bitse
 * bile bu degismez; cunku musteriye giriste abonmanli oldugu soylendi.
 */
function hesaplaCikisUcreti(
  kayit: {
    entryAt: Date;
    billingMode: string;
    tariffSnapshot: Prisma.JsonValue | null;
  },
  cikisAt: Date,
) {
  const sureDakika = Math.max(0, Math.floor((cikisAt.getTime() - kayit.entryAt.getTime()) / 60000));

  // --- ABONMAN: ucretsiz cikis ---
  if (kayit.billingMode === "SUBSCRIPTION") {
    return {
      sureDakika,
      tutar: 0,
      dokum: [{ aciklama: "Abonman kapsamında — ücret alınmaz", tutar: 0 }],
      ucretsizMi: true,
      tarifeTanimsiz: false,
      uygulananKurallar: ["abonman"],
      snapshot: null,
    };
  }

  // --- FREE / MANUAL_OVERRIDE ---
  if (kayit.billingMode === "FREE") {
    return {
      sureDakika,
      tutar: 0,
      dokum: [{ aciklama: "Ücretsiz park (yönetici kararı)", tutar: 0 }],
      ucretsizMi: true,
      tarifeTanimsiz: false,
      uygulananKurallar: ["ucretsiz_isaretli"],
      snapshot: null,
    };
  }

  // --- TARIFE: snapshot yok demek patron tarife girmemis demek ---
  if (kayit.tariffSnapshot === null) {
    return {
      sureDakika,
      tutar: 0,
      dokum: [{ aciklama: "Girişte tarife tanımlı değildi", tutar: 0 }],
      ucretsizMi: false,
      tarifeTanimsiz: true,
      uygulananKurallar: ["tarife_tanimsiz"],
      snapshot: null,
    };
  }

  // Snapshot DOGRULANIR: bozuksa hata firlatilir, yanlis ucret tahsil edilmez.
  const snapshot = okuSnapshot(kayit.tariffSnapshot);

  const sonuc = hesaplaUcret({
    girisAt: kayit.entryAt,
    cikisAt,
    snapshot,
    girisGunDakikasi: minuteOfDay(kayit.entryAt),
    cikisGunDakikasi: minuteOfDay(cikisAt),
    haftaSonuMu: isWeekend(kayit.entryAt),
  });

  return { ...sonuc, snapshot };
}

export interface CikisIstegi {
  parkingSessionId: string;
  odemeYontemi: PaymentMethod;
  /** Kart odemesi icin serbest not (dekont no, son dort hane). POS entegrasyonu YOKTUR. */
  kartNotu?: string;
  /** Indirim (kurus) - parking.discount izni gerekir. */
  indirimKurus?: number;
  indirimSebebi?: string;
  /** Tutari elle degistirme (kurus) - parking.override_price izni gerekir (yalnizca OWNER). */
  elleTutarKurus?: number;
  elleTutarSebebi?: string;
  idempotencyKey: string;
}

export interface CikisSonucu {
  parkingSessionId: string;
  kod: string;
  plakaGosterim: string;
  girisAt: Date;
  cikisAt: Date;
  sureDakika: number;
  hesaplananTutar: number;
  indirimTutari: number;
  odenenTutar: number;
  odemeYontemi: PaymentMethod | null;
  tahsilatKodu: string | null;
  abonmanKapsaminda: boolean;
  ucretsizMi: boolean;
  tarifeTanimsiz: boolean;
  dokum: DokumSatiri[];
}

/**
 * Arac cikisini tamamlar ve tahsilati kaydeder.
 *
 * Istemciden tutar ALINMAZ. indirimKurus ve elleTutarKurus yalnizca ilgili
 * IZNE sahip kullanicilarda gecerlidir ve ikisi de denetime yazilir.
 */
export async function aracCikisi(actor: SessionUser, istek: CikisIstegi): Promise<CikisSonucu> {
  const vardiya = await vardiyaZorunlu(actor.id);

  // Idempotency: ayni istek iki kez geldiyse ilk sonucu dondur.
  const varOlanOdeme = await prisma.payment.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
    include: { parkingSession: true },
  });
  if (varOlanOdeme?.parkingSession) {
    const p = varOlanOdeme.parkingSession;
    return {
      parkingSessionId: p.id,
      kod: p.code,
      plakaGosterim: p.plateDisplay,
      girisAt: p.entryAt,
      cikisAt: p.exitAt!,
      sureDakika: p.durationMinutes ?? 0,
      hesaplananTutar: toKurus(p.calculatedAmount),
      indirimTutari: toKurus(p.discountAmount),
      odenenTutar: toKurus(p.collectedAmount),
      odemeYontemi: varOlanOdeme.method,
      tahsilatKodu: varOlanOdeme.code,
      abonmanKapsaminda: p.billingMode === "SUBSCRIPTION",
      ucretsizMi: toKurus(p.payableAmount) === 0,
      tarifeTanimsiz: false,
      dokum: [{ aciklama: "Bu işlem daha önce tamamlanmıştı", tutar: toKurus(p.collectedAmount) }],
    };
  }

  const indirimIzni = actor.permissions.has("parking.discount");
  const elleTutarIzni = actor.permissions.has("parking.override_price");

  if (istek.indirimKurus && istek.indirimKurus > 0 && !indirimIzni) {
    throw new IslemHatasi("YETKISIZ_INDIRIM", "İndirim uygulama yetkiniz yok.");
  }
  if (istek.elleTutarKurus !== undefined && !elleTutarIzni) {
    throw new IslemHatasi("YETKISIZ_TUTAR", "Tutarı elle değiştirme yetkiniz yok.");
  }
  if (istek.indirimKurus && istek.indirimKurus > 0 && !istek.indirimSebebi?.trim()) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İndirim için gerekçe girilmesi zorunludur.");
  }
  if (istek.elleTutarKurus !== undefined && !istek.elleTutarSebebi?.trim()) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "Tutarı elle değiştirmek için gerekçe zorunludur.");
  }

  return prisma.$transaction(async (tx) => {
    // --- 1. KAYDI KILITLE ---
    // FOR UPDATE: esszamanli ikinci cikis denemesi bu satirda bekler, sonra
    // status kontrolune takilir. Boylece mukerrer tahsilat olusmaz.
    const kilitli = await tx.$queryRaw<
      { id: string; status: string }[]
    >`SELECT id, status FROM "ParkingSession" WHERE id = ${istek.parkingSessionId} FOR UPDATE`;

    if (kilitli.length === 0) {
      throw new IslemHatasi("KAYIT_YOK", "Park kaydı bulunamadı.");
    }
    if (kilitli[0]!.status !== "ACTIVE") {
      throw new IslemHatasi(
        "ZATEN_CIKMIS",
        "Bu aracın çıkışı yapılmış. Mükerrer tahsilat engellendi.",
      );
    }

    const kayit = await tx.parkingSession.findUniqueOrThrow({
      where: { id: istek.parkingSessionId },
    });

    const cikisAt = new Date();

    // --- 2. UCRETI SUNUCUDA YENIDEN HESAPLA ---
    const hesap = hesaplaCikisUcreti(kayit, cikisAt);
    const hesaplanan = hesap.tutar;

    // Indirim ve elle tutar
    const indirim = indirimIzni ? clampNonNegative(istek.indirimKurus ?? 0) : 0;
    let odenecek = odenecekTutar(hesaplanan, indirim);
    if (istek.elleTutarKurus !== undefined && elleTutarIzni) {
      odenecek = clampNonNegative(istek.elleTutarKurus);
    }

    // --- 3. PARK KAYDINI GUNCELLE ---
    const notParcalari = [
      kayit.entryNote,
      hesap.tarifeTanimsiz ? "ÇIKIŞTA TARİFE TANIMLI DEĞİLDİ" : null,
    ].filter(Boolean);

    const guncel = await tx.parkingSession.update({
      where: { id: kayit.id },
      data: {
        status: "COMPLETED",
        exitAt: cikisAt,
        exitUserId: actor.id,
        exitShiftId: vardiya.id,
        durationMinutes: hesap.sureDakika,
        calculatedAmount: kurusToDecimalString(hesaplanan),
        discountAmount: indirim > 0 ? kurusToDecimalString(indirim) : null,
        discountReason: indirim > 0 ? (istek.indirimSebebi ?? null) : null,
        discountById: indirim > 0 ? actor.id : null,
        payableAmount: kurusToDecimalString(odenecek),
        collectedAmount: kurusToDecimalString(odenecek),
        billingMode:
          istek.elleTutarKurus !== undefined ? "MANUAL_OVERRIDE" : kayit.billingMode,
        entryNote: notParcalari.length > 0 ? notParcalari.join(" · ") : null,
      },
    });

    // --- 4. TAHSILAT KAYDI (tutar > 0 ise) ---
    let odeme: { id: string; code: string } | null = null;
    if (odenecek > 0) {
      const olusan = await tx.payment.create({
        data: {
          code: await tahsilatKodu(tx, cikisAt),
          amount: kurusToDecimalString(odenecek),
          method: istek.odemeYontemi,
          cardNote: istek.odemeYontemi === "CARD" ? (istek.kartNotu?.trim() || null) : null,
          direction: "IN",
          sourceType: "PARKING",
          parkingSessionId: kayit.id,
          shiftId: vardiya.id,
          collectedById: actor.id,
          status: "CONFIRMED",
          paidAt: cikisAt,
          idempotencyKey: istek.idempotencyKey,
        },
      });
      odeme = { id: olusan.id, code: olusan.code };
    }

    // --- 5. DENETIM KAYITLARI ---
    await writeAudit(
      {
        action: AUDIT_ACTIONS.PARKING_EXIT,
        entityType: "ParkingSession",
        entityId: kayit.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { status: "ACTIVE" },
        after: {
          kod: kayit.code,
          plaka: kayit.plateNormalized,
          cikisAt,
          sureDakika: hesap.sureDakika,
          hesaplananKurus: hesaplanan,
          indirimKurus: indirim,
          odenenKurus: odenecek,
          odemeYontemi: odenecek > 0 ? istek.odemeYontemi : null,
          billingMode: guncel.billingMode,
          tarifeTanimsiz: hesap.tarifeTanimsiz,
          uygulananKurallar: hesap.uygulananKurallar,
        },
      },
      tx,
    );

    if (indirim > 0) {
      await writeAudit(
        {
          action: AUDIT_ACTIONS.PARKING_DISCOUNT,
          entityType: "ParkingSession",
          entityId: kayit.id,
          userId: actor.id,
          actorLabel: actor.username,
          after: { indirimKurus: indirim, sebep: istek.indirimSebebi },
          note: istek.indirimSebebi,
        },
        tx,
      );
    }

    if (istek.elleTutarKurus !== undefined) {
      await writeAudit(
        {
          action: AUDIT_ACTIONS.PARKING_PRICE_OVERRIDE,
          entityType: "ParkingSession",
          entityId: kayit.id,
          userId: actor.id,
          actorLabel: actor.username,
          before: { hesaplananKurus: hesaplanan },
          after: { elleGirilenKurus: odenecek, sebep: istek.elleTutarSebebi },
          note: istek.elleTutarSebebi,
        },
        tx,
      );
    }

    if (odeme) {
      await writeAudit(
        {
          action: AUDIT_ACTIONS.PAYMENT_CREATE,
          entityType: "Payment",
          entityId: odeme.id,
          userId: actor.id,
          actorLabel: actor.username,
          after: {
            kod: odeme.code,
            tutarKurus: odenecek,
            yontem: istek.odemeYontemi,
            kaynak: "PARKING",
          },
        },
        tx,
      );
    }

    return {
      parkingSessionId: kayit.id,
      kod: kayit.code,
      plakaGosterim: kayit.plateDisplay,
      girisAt: kayit.entryAt,
      cikisAt,
      sureDakika: hesap.sureDakika,
      hesaplananTutar: hesaplanan,
      indirimTutari: indirim,
      odenenTutar: odenecek,
      odemeYontemi: odenecek > 0 ? istek.odemeYontemi : null,
      tahsilatKodu: odeme?.code ?? null,
      abonmanKapsaminda: kayit.billingMode === "SUBSCRIPTION",
      ucretsizMi: odenecek === 0,
      tarifeTanimsiz: hesap.tarifeTanimsiz,
      dokum: hesap.dokum,
    };
  });
}
