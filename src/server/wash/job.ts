/**
 * OTO YIKAMA IS EMRI
 *
 * ============================================================================
 * FIYAT ISTEMCIDEN ALINMAZ
 * ----------------------------------------------------------------------------
 * Otopark cikisinda oldugu gibi: istemci yalnizca "hangi arac" ve "hangi
 * hizmetler" bilgisini gonderir. Her satirin fiyati SUNUCUDA cozumlenir.
 * Istemciden gelen tutara asla guvenilmez.
 *
 * TARIHSEL DEGISMEZLIK: her satir, olusturuldugu andaki hizmet adinin ve
 * fiyatinin KOPYASINI tasir (serviceNameSnapshot, unitPrice). Katalog veya
 * fiyat sonradan degisse bile gecmis is emri degismez.
 *
 * OTOPARKTAN AYRIDIR: yikama ucreti park ucretinden tamamen bagimsizdir.
 * Ayni arac hem park edip hem yikanabilir; iki tutar birbirine karismaz ve
 * ayri Payment kayitlariyla tahsil edilir.
 *
 * ABONMAN INDIRIMI YOKTUR (karar 04.10.2026): abonmanli musterinin yikama
 * ucreti abonmansiz musterininkiyle aynidir. Bu dosya abonman tablolarina
 * hic bakmaz.
 * ============================================================================
 */

import { Prisma, type WashStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { formatPlate, isValidTurkishPlate, normalizePlate } from "@/lib/plate";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { vardiyaZorunlu } from "@/server/shift";
import { yikamaKodu } from "@/server/parking/codes";
import { cozumleYikamaFiyati } from "./pricing";
import type { SessionUser } from "@/server/auth/session";

type Tx = Prisma.TransactionClient;

export interface YikamaSatirIstegi {
  washServiceId: string;
  adet?: number;
}

export interface YikamaOlusturIstegi {
  plaka: string;
  /** Verilmezse aracin kayitli sinifi, yeni araclarda varsayilan sinif. */
  aracSinifiId?: string;
  musteriId?: string | null;
  hizmetler: YikamaSatirIstegi[];
  not?: string | null;
  /** Plaka bicimi gecersiz olsa da kaydedilsin mi? */
  bicimiZorla?: boolean;
  /**
   * Fiyati tanimsiz hizmetlerle yine de devam edilsin mi?
   *
   * Varsayilan FALSE: fiyat tanimsizsa islem reddedilir ve personele hangi
   * hizmet/sinif icin fiyat girilmedigi soylenir. Personel onay verirse satir
   * 0 TL olarak kaydedilir, is emrine not duser ve patron panelinde uyari
   * olarak gorunur - "sessizce 0 TL" asla olmaz.
   */
  fiyatsizDevam?: boolean;
  idempotencyKey: string;
}

export interface YikamaSonucu {
  washJobId: string;
  kod: string;
  plakaGosterim: string;
  aracSinifiAdi: string;
  durum: WashStatus;
  satirlar: { ad: string; adet: number; birimKurus: number; toplamKurus: number }[];
  toplamKurus: number;
  /** Fiyati tanimsiz hizmet var mi? */
  fiyatTanimsiz: boolean;
  uyarilar: string[];
  tekrarEdenIstek: boolean;
}

/**
 * Yeni yikama is emri olusturur (durum: SIRADA).
 *
 * Tahsilat ayri islemdir: is emri olusturmak para kaydi uretmez.
 */
export async function yikamaOlustur(
  actor: SessionUser,
  istek: YikamaOlusturIstegi,
): Promise<YikamaSonucu> {
  // --- 0. IDEMPOTENCY: ayni istek daha once islendi mi? ---
  const onceki = await mevcutIstegiBul(istek.idempotencyKey);
  if (onceki) return onceki;

  const vardiya = await vardiyaZorunlu(actor.id);
  const uyarilar: string[] = [];

  if (istek.hizmetler.length === 0) {
    throw new IslemHatasi("HIZMET_SECILMEDI", "En az bir yıkama hizmeti seçilmelidir.");
  }

  // --- 1. PLAKA ---
  const plateNormalized = normalizePlate(istek.plaka);
  if (plateNormalized.length < 4) {
    throw new IslemHatasi("PLAKA_GECERSIZ", "Plaka çok kısa. Örnek: 34 ABC 123");
  }
  const bicimGecerli = isValidTurkishPlate(plateNormalized);
  if (!bicimGecerli && !istek.bicimiZorla) {
    throw new IslemHatasi(
      "PLAKA_BICIMI",
      `"${formatPlate(plateNormalized)}" Türkiye plaka biçimine uymuyor. ` +
        "Yabancı veya geçici plaka ise yine de kaydedebilirsiniz.",
    );
  }
  if (!bicimGecerli) uyarilar.push("Plaka biçimi standart dışı; not olarak kaydedildi.");

  const plakaGosterim = formatPlate(plateNormalized);
  const simdi = new Date();

  // --- 2. ARAC ---
  let arac = await prisma.vehicle.findUnique({
    where: { plateNormalized },
    include: { vehicleClass: true },
  });

  if (!arac) {
    const sinifId = istek.aracSinifiId ?? (await varsayilanSinifId());
    arac = await prisma.vehicle.create({
      data: {
        plateNormalized,
        plateDisplay: plakaGosterim,
        vehicleClassId: sinifId,
        customerId: istek.musteriId ?? null,
        createdById: actor.id,
      },
      include: { vehicleClass: true },
    });
    await writeAudit({
      action: AUDIT_ACTIONS.VEHICLE_CREATE,
      entityType: "Vehicle",
      entityId: arac.id,
      userId: actor.id,
      actorLabel: actor.username,
      after: { plateNormalized, vehicleClassId: sinifId },
      note: "Yıkama kaydı sırasında oluşturuldu.",
    });
  } else if (istek.aracSinifiId && istek.aracSinifiId !== arac.vehicleClassId) {
    // Yikama fiyati SINIFA BAGLI oldugu icin sinif degisikligi onemlidir.
    const oncesi = arac.vehicleClassId;
    arac = await prisma.vehicle.update({
      where: { id: arac.id },
      data: { vehicleClassId: istek.aracSinifiId },
      include: { vehicleClass: true },
    });
    await writeAudit({
      action: AUDIT_ACTIONS.VEHICLE_UPDATE,
      entityType: "Vehicle",
      entityId: arac.id,
      userId: actor.id,
      actorLabel: actor.username,
      before: { vehicleClassId: oncesi },
      after: { vehicleClassId: arac.vehicleClassId },
      note: "Yıkama fiyatı araç sınıfına bağlıdır.",
    });
  }

  // --- 3. FIYATLARI SUNUCUDA COZUMLE ---
  const cozulen: {
    washServiceId: string;
    priceVersionId: string | null;
    ad: string;
    adet: number;
    birimKurus: number;
  }[] = [];
  const fiyatsizHizmetler: string[] = [];

  for (const satir of istek.hizmetler) {
    const adet = Math.max(1, Math.min(20, Math.floor(satir.adet ?? 1)));
    const hizmet = await prisma.washServiceCatalog.findUnique({
      where: { id: satir.washServiceId },
    });
    if (!hizmet || !hizmet.isActive) {
      throw new IslemHatasi("HIZMET_YOK", "Seçilen yıkama hizmeti bulunamadı veya pasif.");
    }

    const fiyat = await cozumleYikamaFiyati(satir.washServiceId, arac.vehicleClassId, simdi);
    if (!fiyat) {
      fiyatsizHizmetler.push(`${hizmet.name} (${arac.vehicleClass.name})`);
      cozulen.push({
        washServiceId: hizmet.id,
        priceVersionId: null,
        ad: hizmet.name,
        adet,
        birimKurus: 0,
      });
      continue;
    }

    cozulen.push({
      washServiceId: hizmet.id,
      priceVersionId: fiyat.priceVersionId,
      ad: fiyat.hizmetAdi,
      adet,
      birimKurus: fiyat.fiyatKurus,
    });
  }

  if (fiyatsizHizmetler.length > 0 && !istek.fiyatsizDevam) {
    throw new IslemHatasi(
      "FIYAT_TANIMSIZ",
      `Şu hizmetlerin fiyatı tanımlı değil: ${fiyatsizHizmetler.join(", ")}. ` +
        "Patron panelinden fiyat girilmeli. Yine de 0 ₺ olarak kaydedebilirsiniz.",
    );
  }
  if (fiyatsizHizmetler.length > 0) {
    uyarilar.push(
      `Fiyatı tanımsız hizmet 0 ₺ kaydedildi: ${fiyatsizHizmetler.join(", ")}. ` +
        "Patron panelinden fiyat girilmeli.",
    );
  }

  const toplam = cozulen.reduce((t, s) => t + s.birimKurus * s.adet, 0);

  const notlar = [
    istek.not?.trim() || null,
    !bicimGecerli ? "Plaka biçimi standart dışı" : null,
    fiyatsizHizmetler.length > 0
      ? `FİYAT TANIMSIZ: ${fiyatsizHizmetler.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // --- 4. KAYIT (tek transaction) ---
  try {
    const isEmri = await prisma.$transaction(async (tx) => {
      const olusan = await tx.washJob.create({
        data: {
          code: await yikamaKodu(tx, simdi),
          vehicleId: arac!.id,
          plateNormalized,
          plateDisplay: plakaGosterim,
          customerId: istek.musteriId ?? arac!.customerId ?? null,
          vehicleClassId: arac!.vehicleClassId,
          status: "QUEUED",
          queuedAt: simdi,
          createdById: actor.id,
          shiftId: vardiya.id,
          totalAmount: kurusToDecimalString(toplam),
          payableAmount: kurusToDecimalString(toplam),
          paymentStatus: "UNPAID",
          notes: notlar || null,
          idempotencyKey: istek.idempotencyKey,
          items: {
            create: cozulen.map((s) => ({
              washServiceId: s.washServiceId,
              washServicePriceVersionId: s.priceVersionId,
              serviceNameSnapshot: s.ad,
              unitPrice: kurusToDecimalString(s.birimKurus),
              quantity: s.adet,
              lineTotal: kurusToDecimalString(s.birimKurus * s.adet),
            })),
          },
        },
      });

      await writeAudit(
        {
          action: AUDIT_ACTIONS.WASH_CREATE,
          entityType: "WashJob",
          entityId: olusan.id,
          userId: actor.id,
          actorLabel: actor.username,
          after: {
            kod: olusan.code,
            plaka: plateNormalized,
            aracSinifi: arac!.vehicleClass.name,
            hizmetler: cozulen.map((s) => ({ ad: s.ad, adet: s.adet, birimKurus: s.birimKurus })),
            toplamKurus: toplam,
          },
          note: notlar || null,
        },
        tx,
      );

      return olusan;
    });

    return {
      washJobId: isEmri.id,
      kod: isEmri.code,
      plakaGosterim: plakaGosterim,
      aracSinifiAdi: arac.vehicleClass.name,
      durum: isEmri.status,
      satirlar: cozulen.map((s) => ({
        ad: s.ad,
        adet: s.adet,
        birimKurus: s.birimKurus,
        toplamKurus: s.birimKurus * s.adet,
      })),
      toplamKurus: toplam,
      fiyatTanimsiz: fiyatsizHizmetler.length > 0,
      uyarilar,
      tekrarEdenIstek: false,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Yaris kosulu: ayni anahtarla iki istek. Ilk kaydi dondur.
      const varOlan = await mevcutIstegiBul(istek.idempotencyKey);
      if (varOlan) return varOlan;
    }
    throw err;
  }
}

/** Daha once ayni idempotency anahtariyla islenmis is emrini bulur. */
async function mevcutIstegiBul(idempotencyKey: string): Promise<YikamaSonucu | null> {
  const varOlan = await prisma.washJob.findUnique({
    where: { idempotencyKey },
    include: { items: true, vehicleClass: true },
  });
  if (!varOlan) return null;

  return {
    washJobId: varOlan.id,
    kod: varOlan.code,
    plakaGosterim: varOlan.plateDisplay,
    aracSinifiAdi: varOlan.vehicleClass.name,
    durum: varOlan.status,
    satirlar: varOlan.items.map((i) => ({
      ad: i.serviceNameSnapshot,
      adet: i.quantity,
      birimKurus: toKurus(i.unitPrice),
      toplamKurus: toKurus(i.lineTotal),
    })),
    toplamKurus: toKurus(varOlan.totalAmount),
    fiyatTanimsiz: varOlan.items.some((i) => toKurus(i.unitPrice) === 0),
    uyarilar: ["Bu işlem daha önce kaydedilmişti."],
    tekrarEdenIstek: true,
  };
}

// ---------------------------------------------------------------------------
// DURUM GECISLERI
// ---------------------------------------------------------------------------

/**
 * Izinli gecisler. Tamamlanmis veya iptal edilmis is emri geri alinmaz;
 * yanlislik varsa iptal edilir ve yenisi acilir.
 */
const IZINLI_GECISLER: Record<WashStatus, WashStatus[]> = {
  QUEUED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "QUEUED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const DURUM_ETIKETLERI: Record<WashStatus, string> = {
  QUEUED: "Sırada",
  IN_PROGRESS: "Yıkamada",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export async function yikamaDurumDegistir(
  actor: SessionUser,
  istek: { washJobId: string; yeniDurum: WashStatus; sebep?: string },
) {
  const isEmri = await prisma.washJob.findUnique({ where: { id: istek.washJobId } });
  if (!isEmri) throw new IslemHatasi("IS_EMRI_YOK", "Yıkama kaydı bulunamadı.");

  if (isEmri.status === istek.yeniDurum) return isEmri;

  const izinli = IZINLI_GECISLER[isEmri.status];
  if (!izinli.includes(istek.yeniDurum)) {
    throw new IslemHatasi(
      "GECIS_IZINSIZ",
      `"${DURUM_ETIKETLERI[isEmri.status]}" durumundan ` +
        `"${DURUM_ETIKETLERI[istek.yeniDurum]}" durumuna geçilemez.`,
    );
  }

  if (istek.yeniDurum === "CANCELLED") {
    throw new IslemHatasi(
      "IPTAL_AYRI_ISLEM",
      "İptal için gerekçe zorunludur; iptal işlemini kullanın.",
    );
  }

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.washJob.update({
      where: { id: isEmri.id },
      data: {
        status: istek.yeniDurum,
        startedAt:
          istek.yeniDurum === "IN_PROGRESS" ? (isEmri.startedAt ?? simdi) : isEmri.startedAt,
        completedAt: istek.yeniDurum === "COMPLETED" ? simdi : null,
        assignedUserId:
          istek.yeniDurum === "IN_PROGRESS" ? (isEmri.assignedUserId ?? actor.id) : isEmri.assignedUserId,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_STATUS_CHANGE,
        entityType: "WashJob",
        entityId: isEmri.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: isEmri.status },
        after: { durum: guncel.status, kod: guncel.code },
        note: istek.sebep?.trim() || null,
      },
      tx,
    );

    return guncel;
  });
}

// ---------------------------------------------------------------------------
// SATIR EKLEME / CIKARMA
// ---------------------------------------------------------------------------

/**
 * Devam eden is emrine hizmet ekler (ornek: musteri motor yikama da istedi).
 *
 * Fiyat EKLENDIGI ANDA cozumlenir ve satira kopyalanir. Tamamlanmis veya
 * iptal edilmis is emrine satir eklenemez.
 */
export async function yikamaSatirEkle(
  actor: SessionUser,
  istek: { washJobId: string; washServiceId: string; adet?: number; fiyatsizDevam?: boolean },
) {
  const isEmri = await prisma.washJob.findUnique({
    where: { id: istek.washJobId },
    include: { vehicleClass: true },
  });
  if (!isEmri) throw new IslemHatasi("IS_EMRI_YOK", "Yıkama kaydı bulunamadı.");
  if (isEmri.status === "COMPLETED" || isEmri.status === "CANCELLED") {
    throw new IslemHatasi(
      "IS_EMRI_KAPALI",
      `"${DURUM_ETIKETLERI[isEmri.status]}" durumundaki işe hizmet eklenemez.`,
    );
  }
  if (isEmri.paymentStatus === "PAID") {
    throw new IslemHatasi(
      "TAHSILAT_YAPILDI",
      "Tahsilatı yapılmış işe hizmet eklenemez. Yeni iş emri açın.",
    );
  }

  const hizmet = await prisma.washServiceCatalog.findUnique({
    where: { id: istek.washServiceId },
  });
  if (!hizmet || !hizmet.isActive) {
    throw new IslemHatasi("HIZMET_YOK", "Yıkama hizmeti bulunamadı veya pasif.");
  }

  const adet = Math.max(1, Math.min(20, Math.floor(istek.adet ?? 1)));
  const fiyat = await cozumleYikamaFiyati(istek.washServiceId, isEmri.vehicleClassId, new Date());

  if (!fiyat && !istek.fiyatsizDevam) {
    throw new IslemHatasi(
      "FIYAT_TANIMSIZ",
      `${hizmet.name} hizmetinin ${isEmri.vehicleClass.name} fiyatı tanımlı değil. ` +
        "Yine de 0 ₺ olarak ekleyebilirsiniz.",
    );
  }

  const birim = fiyat?.fiyatKurus ?? 0;

  return prisma.$transaction(async (tx) => {
    const satir = await tx.washJobItem.create({
      data: {
        washJobId: isEmri.id,
        washServiceId: hizmet.id,
        washServicePriceVersionId: fiyat?.priceVersionId ?? null,
        serviceNameSnapshot: hizmet.name,
        unitPrice: kurusToDecimalString(birim),
        quantity: adet,
        lineTotal: kurusToDecimalString(birim * adet),
      },
    });

    const guncel = await tutarlariTazele(tx, isEmri.id);

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_ITEM_ADD,
        entityType: "WashJob",
        entityId: isEmri.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: { hizmet: hizmet.name, adet, birimKurus: birim, yeniToplamKurus: guncel.toplam },
        note: fiyat ? null : "Fiyat tanımsız; 0 ₺ olarak eklendi.",
      },
      tx,
    );

    return { satir, toplamKurus: guncel.toplam };
  });
}

export async function yikamaSatirCikar(
  actor: SessionUser,
  istek: { washJobId: string; washJobItemId: string },
) {
  const satir = await prisma.washJobItem.findUnique({
    where: { id: istek.washJobItemId },
    include: { washJob: true },
  });
  if (!satir || satir.washJobId !== istek.washJobId) {
    throw new IslemHatasi("SATIR_YOK", "Hizmet satırı bulunamadı.");
  }
  if (satir.washJob.status === "COMPLETED" || satir.washJob.status === "CANCELLED") {
    throw new IslemHatasi("IS_EMRI_KAPALI", "Kapanmış işin hizmetleri değiştirilemez.");
  }
  if (satir.washJob.paymentStatus === "PAID") {
    throw new IslemHatasi("TAHSILAT_YAPILDI", "Tahsilatı yapılmış işin hizmetleri çıkarılamaz.");
  }

  const kalan = await prisma.washJobItem.count({ where: { washJobId: istek.washJobId } });
  if (kalan <= 1) {
    throw new IslemHatasi(
      "SON_SATIR",
      "İş emrinde en az bir hizmet kalmalıdır. Tamamen vazgeçmek için işi iptal edin.",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.washJobItem.delete({ where: { id: satir.id } });
    const guncel = await tutarlariTazele(tx, istek.washJobId);

    await writeAudit(
      {
        action: AUDIT_ACTIONS.WASH_ITEM_REMOVE,
        entityType: "WashJob",
        entityId: istek.washJobId,
        userId: actor.id,
        actorLabel: actor.username,
        before: {
          hizmet: satir.serviceNameSnapshot,
          adet: satir.quantity,
          satirToplamKurus: toKurus(satir.lineTotal),
        },
        after: { yeniToplamKurus: guncel.toplam },
      },
      tx,
    );

    return { toplamKurus: guncel.toplam };
  });
}

/**
 * Is emrinin tutarlarini satirlardan YENIDEN hesaplar.
 *
 * Tutar hicbir zaman istemciden gelmez ve elle guncellenmez; daima
 * satirlarin toplamidir. Indirim varsa odenecek tutardan dusulur.
 */
export async function tutarlariTazele(tx: Tx, washJobId: string) {
  const isEmri = await tx.washJob.findUniqueOrThrow({
    where: { id: washJobId },
    include: { items: true },
  });

  const toplam = isEmri.items.reduce((t, i) => t + toKurus(i.lineTotal), 0);
  const indirim = isEmri.discountAmount ? toKurus(isEmri.discountAmount) : 0;
  const odenecek = Math.max(0, toplam - indirim);

  await tx.washJob.update({
    where: { id: washJobId },
    data: {
      totalAmount: kurusToDecimalString(toplam),
      payableAmount: kurusToDecimalString(odenecek),
    },
  });

  return { toplam, indirim, odenecek };
}

async function varsayilanSinifId(): Promise<string> {
  const otomobil = await prisma.vehicleClass.findUnique({ where: { code: "OTOMOBIL" } });
  if (otomobil?.isActive) return otomobil.id;
  const ilk = await prisma.vehicleClass.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!ilk) throw new IslemHatasi("ARAC_SINIFI_YOK", "Sistemde tanımlı araç sınıfı yok.");
  return ilk.id;
}
