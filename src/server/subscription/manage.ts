/**
 * ABONMAN YONETIMI: olusturma, yenileme, iptal, arac baglama.
 *
 * ============================================================================
 * KORUNAN KURALLAR (Asama 3)
 * ----------------------------------------------------------------------------
 *  1. Abonman olusturmak OTOMATIK TAHSILAT URETMEZ. Yeni abonman daima
 *     paymentStatus = UNPAID baslar; tahsilat ayri bir islemdir (payment.ts).
 *  5. Fiyat MUSTERIYE OZELDIR. Sistemde "aylik abonman = X TL" diye genel bir
 *     fiyat YOKTUR; her abonmanin kendi agreedPrice'i vardir.
 *  6. ESKI DONEMLERIN FIYATI VE KURALI DEGISMEZ. Yenileme yeni bir
 *     SubscriptionPeriod satiri yazar; onceki satira dokunulmaz.
 *  8. Ayni plaka ayni donemde iki aktif abonmana baglanamaz. Uygulama
 *     katmani anlamli hata verir, VERITABANI TETIKLEYICISI son garantidir
 *     (migration 20261004090000).
 * 10. Arac-abonman baglari SILINMEZ; cikarma islemi removedAt doldurur.
 *
 * FIYAT UYDURULMAZ: hicbir fonksiyonun varsayilan ucreti yoktur. Ucret her
 * zaman cagirandan (patron panelinden) gelir.
 * ============================================================================
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { formatPlate, isValidTurkishPlate, normalizePlate } from "@/lib/plate";
import { formatDate } from "@/lib/datetime";
import { abonmanKodu } from "@/server/parking/codes";
import { dogrulaKuralParametresi, VARSAYILAN_KURAL, type KuralTuru } from "./rules";
import type { SessionUser } from "@/server/auth/session";

type Tx = Prisma.TransactionClient;

export interface AbonmanOlusturIstegi {
  musteriId: string;
  /** "Aylık", "3 Aylık" gibi SERBEST etiket. Sistem buna gore fiyat belirlemez. */
  planEtiketi: string;
  baslangic: Date;
  bitis: Date;
  /** Musteriye ozel anlasilan ucret (kurus). Zorunludur; varsayilani yoktur. */
  ucretKurus: number;
  ucretNotu?: string | null;
  /** Abonmana dahil arac sayisi. Bagli arac sayisi bunu asamaz. */
  aracSayisi?: number;
  plakalar?: string[];
  /** Gecersiz bicimli plakalar (yabanci/gecici) icin onay. */
  bicimiZorla?: boolean;
  faturaDonemi?: "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM";
  otomatikYenile?: boolean;
  yoneticiNotu?: string | null;
  /** Kural turu. Su anda yalnizca 7/24 sinirsiz kabul edilir. */
  kuralTuru?: KuralTuru;
  kuralParametresi?: unknown;
}

function dogrulaTarihler(baslangic: Date, bitis: Date): void {
  if (!(baslangic instanceof Date) || Number.isNaN(baslangic.getTime())) {
    throw new IslemHatasi("TARIH_GECERSIZ", "Başlangıç tarihi geçersiz.");
  }
  if (!(bitis instanceof Date) || Number.isNaN(bitis.getTime())) {
    throw new IslemHatasi("TARIH_GECERSIZ", "Bitiş tarihi geçersiz.");
  }
  if (bitis <= baslangic) {
    throw new IslemHatasi(
      "TARIH_SIRASI",
      "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
    );
  }
}

function dogrulaUcret(ucretKurus: number): void {
  if (!Number.isInteger(ucretKurus) || ucretKurus < 0) {
    throw new IslemHatasi("UCRET_GECERSIZ", "Ücret geçerli bir tutar olmalıdır.");
  }
}

/**
 * Kural turunu dogrular.
 *
 * Patron onayi olmadan yeni abonman tipi devreye girmesin diye yalnizca
 * UNLIMITED_7_24 kabul edilir. Diger turler semada ve hesap mantiginda
 * hazirdir; burasi tek kapidir.
 */
function dogrulaKural(tur: KuralTuru | undefined, parametre: unknown) {
  const secilen = tur ?? VARSAYILAN_KURAL;
  if (secilen !== VARSAYILAN_KURAL) {
    throw new IslemHatasi(
      "KURAL_DESTEKLENMIYOR",
      "Şu anda yalnızca 7/24 sınırsız abonman tanımlanabilir. " +
        "Farklı abonman kuralları işletme onayıyla devreye alınacaktır.",
    );
  }
  return { tur: secilen, parametre: dogrulaKuralParametresi(secilen, parametre) };
}

/** Baslangic/bitis araligina gore baslangic durumu. */
function baslangicDurumu(baslangic: Date, bitis: Date, simdi = new Date()) {
  if (bitis < simdi) return "EXPIRED" as const;
  if (baslangic > simdi) return "PENDING" as const;
  return "ACTIVE" as const;
}

export async function abonmanOlustur(actor: SessionUser, istek: AbonmanOlusturIstegi) {
  dogrulaTarihler(istek.baslangic, istek.bitis);
  dogrulaUcret(istek.ucretKurus);
  const kural = dogrulaKural(istek.kuralTuru, istek.kuralParametresi);

  const musteri = await prisma.customer.findUnique({ where: { id: istek.musteriId } });
  if (!musteri) throw new IslemHatasi("MUSTERI_YOK", "Müşteri bulunamadı.");

  const plakalar = (istek.plakalar ?? []).map((p) => normalizePlate(p)).filter((p) => p.length > 0);
  const tekilPlakalar = [...new Set(plakalar)];
  const aracSayisi = istek.aracSayisi ?? Math.max(1, tekilPlakalar.length);

  if (tekilPlakalar.length > aracSayisi) {
    throw new IslemHatasi(
      "ARAC_SAYISI",
      `Abonmana ${aracSayisi} araç dahil; ${tekilPlakalar.length} plaka girdiniz. ` +
        "Araç sayısını yükseltin veya plaka çıkarın.",
    );
  }

  for (const plaka of tekilPlakalar) {
    if (!isValidTurkishPlate(plaka) && !istek.bicimiZorla) {
      throw new IslemHatasi(
        "PLAKA_BICIMI",
        `"${formatPlate(plaka)}" Türkiye plaka biçimine uymuyor. ` +
          "Yabancı veya geçici plaka ise yine de kaydedebilirsiniz.",
      );
    }
  }

  const durum = baslangicDurumu(istek.baslangic, istek.bitis);

  const sonuc = await prisma.$transaction(async (tx) => {
    const abonman = await tx.subscription.create({
      data: {
        code: await abonmanKodu(tx),
        customerId: istek.musteriId,
        planLabel: istek.planEtiketi.trim() || "Abonman",
        startDate: istek.baslangic,
        endDate: istek.bitis,
        agreedPrice: kurusToDecimalString(istek.ucretKurus),
        priceNote: istek.ucretNotu?.trim() || null,
        billingPeriod: istek.faturaDonemi ?? "MONTHLY",
        status: durum,
        // KURAL 1: tahsilat olusturulmaz, abonman UNPAID baslar.
        paymentStatus: "UNPAID",
        includedVehicleCount: aracSayisi,
        autoRenew: istek.otomatikYenile ?? false,
        managerNotes: istek.yoneticiNotu?.trim() || null,
        accessRuleKind: kural.tur,
        accessRule: kuralaJson(kural.parametre),
        createdById: actor.id,
        updatedById: actor.id,
        periods: {
          create: {
            periodNo: 1,
            startDate: istek.baslangic,
            endDate: istek.bitis,
            // KURAL 6: donemin fiyati ve kurali burada DONDURULUR.
            price: kurusToDecimalString(istek.ucretKurus),
            accessRuleKind: kural.tur,
            accessRule: kuralaJson(kural.parametre),
            note: istek.ucretNotu?.trim() || null,
            createdById: actor.id,
          },
        },
      },
    });

    for (const plaka of tekilPlakalar) {
      await bagla(tx, actor, abonman.id, plaka, istek.bicimiZorla ?? false, istek.musteriId);
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_CREATE,
        entityType: "Subscription",
        entityId: abonman.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: abonman.code,
          musteri: musteri.fullName,
          baslangic: abonman.startDate,
          bitis: abonman.endDate,
          ucret: abonman.agreedPrice.toString(),
          durum: abonman.status,
          odemeDurumu: abonman.paymentStatus,
          kural: abonman.accessRuleKind,
          plakalar: tekilPlakalar,
        },
        note: "Abonman oluşturuldu; tahsilat ayrı işlemdir.",
      },
      tx,
    );

    return abonman;
  });

  return sonuc;
}

function kuralaJson(parametre: unknown): Prisma.InputJsonValue | undefined {
  return parametre === null || parametre === undefined
    ? undefined
    : (parametre as Prisma.InputJsonValue);
}

// ---------------------------------------------------------------------------
// ARAC BAGLAMA / CIKARMA
// ---------------------------------------------------------------------------

/**
 * Plakayi abonmana baglar (transaction icinde kullanilir).
 *
 * CAKISMA KONTROLU: ayni arac baska bir AKTIF/BEKLEYEN abonmana bagliysa
 * islem reddedilir. Suresi dolmus/iptal edilmis abonmanin bagi ise OTOMATIK
 * olarak kapatilir (removedAt) ve denetim kaydina yazilir - silinmez.
 *
 * KURALIN TAM TANIMI: bir aracin ayni anda yalnizca TEK ACIK abonman bagi
 * olabilir - tarihleri cakissa da cakismasa da. Bu, "ayni anda iki aktif
 * abonman" yasagindan DAHA KATIDIR ve bilincli bir tercihtir:
 *   - veritabanindaki kismi tekil indeks (subscription_vehicle_active_uniq)
 *     bunu zaten garanti eder; uygulama katmani ayni kurali uygular ki
 *     kullanici anlamsiz bir veritabani hatasi gormesin,
 *   - "bu plaka hangi abonmanda?" sorusunun tek bir yaniti olur,
 *   - donem uzatmanin dogru yolu YENILEMEdir (abonmanYenile): ayni abonmana
 *     yeni donem eklenir, plaka bagi hic degismez.
 * Plakayi baska bir abonmana tasimak icin once eski abonmandan cikarilmasi
 * gerekir; cikarma kaydi silmez.
 */
async function bagla(
  tx: Tx,
  actor: SessionUser,
  subscriptionId: string,
  plateNormalized: string,
  bicimiZorla: boolean,
  musteriId: string,
) {
  if (!isValidTurkishPlate(plateNormalized) && !bicimiZorla) {
    throw new IslemHatasi(
      "PLAKA_BICIMI",
      `"${formatPlate(plateNormalized)}" Türkiye plaka biçimine uymuyor.`,
    );
  }

  const arac = await tx.vehicle.upsert({
    where: { plateNormalized },
    update: { customerId: musteriId },
    create: {
      plateNormalized,
      plateDisplay: formatPlate(plateNormalized),
      vehicleClassId: await varsayilanSinifId(tx),
      customerId: musteriId,
      createdById: actor.id,
    },
  });

  // Ayni abonmana ikinci kez baglama: sessizce gec (idempotent).
  const zatenBagli = await tx.subscriptionVehicle.findFirst({
    where: { subscriptionId, vehicleId: arac.id, removedAt: null },
  });
  if (zatenBagli) return zatenBagli;

  const digerBaglar = await tx.subscriptionVehicle.findMany({
    where: { vehicleId: arac.id, removedAt: null, subscriptionId: { not: subscriptionId } },
    include: { subscription: { select: { id: true, code: true, status: true, endDate: true } } },
  });

  const simdi = new Date();
  for (const bag of digerBaglar) {
    const canli =
      (bag.subscription.status === "ACTIVE" || bag.subscription.status === "PENDING") &&
      bag.subscription.endDate >= simdi;

    if (canli) {
      throw new IslemHatasi(
        "ARAC_BASKA_ABONMANDA",
        `${formatPlate(plateNormalized)} şu anda ${bag.subscription.code} abonmanında aktif. ` +
          "Bir araç aynı anda yalnızca tek abonmanda olabilir. " +
          "Süreyi uzatmak için o abonmanın \"Yeni dönem\" bölümünü kullanın; " +
          "başka abonmana taşımak için önce eski abonmandan çıkarın.",
      );
    }

    // Suresi dolmus/iptal abonmanin bagi: kapat, SILME.
    await tx.subscriptionVehicle.update({
      where: { id: bag.id },
      data: { removedAt: simdi },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_VEHICLE_REMOVE,
        entityType: "SubscriptionVehicle",
        entityId: bag.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { subscriptionId: bag.subscriptionId, plaka: plateNormalized },
        after: { removedAt: simdi },
        note: `Süresi dolmuş abonman bağı kapatıldı (${bag.subscription.code}); kayıt korundu.`,
      },
      tx,
    );
  }

  const yeni = await tx.subscriptionVehicle.create({
    data: { subscriptionId, vehicleId: arac.id, addedById: actor.id },
  });

  await writeAudit(
    {
      action: AUDIT_ACTIONS.SUBSCRIPTION_VEHICLE_ADD,
      entityType: "SubscriptionVehicle",
      entityId: yeni.id,
      userId: actor.id,
      actorLabel: actor.username,
      after: { subscriptionId, vehicleId: arac.id, plaka: plateNormalized },
    },
    tx,
  );

  return yeni;
}

export async function abonmanaAracEkle(
  actor: SessionUser,
  istek: { subscriptionId: string; plaka: string; bicimiZorla?: boolean },
) {
  const abonman = await prisma.subscription.findUnique({
    where: { id: istek.subscriptionId },
    include: { vehicles: { where: { removedAt: null } } },
  });
  if (!abonman) throw new IslemHatasi("ABONMAN_YOK", "Abonman bulunamadı.");
  if (abonman.status === "CANCELLED") {
    throw new IslemHatasi("ABONMAN_IPTAL", "İptal edilmiş abonmana araç eklenemez.");
  }
  if (abonman.vehicles.length >= abonman.includedVehicleCount) {
    throw new IslemHatasi(
      "ARAC_SAYISI",
      `Bu abonmana ${abonman.includedVehicleCount} araç dahil ve hepsi kullanılmış. ` +
        "Önce araç sayısını yükseltin.",
    );
  }

  const plaka = normalizePlate(istek.plaka);
  if (plaka.length < 4) throw new IslemHatasi("PLAKA_GECERSIZ", "Plaka çok kısa.");

  try {
    return await prisma.$transaction((tx) =>
      bagla(tx, actor, abonman.id, plaka, istek.bicimiZorla ?? false, abonman.customerId),
    );
  } catch (err) {
    throw cakismaHatasinaCevir(err, plaka);
  }
}

export async function abonmandanAracCikar(
  actor: SessionUser,
  istek: { subscriptionId: string; vehicleId: string; sebep?: string },
) {
  const bag = await prisma.subscriptionVehicle.findFirst({
    where: { subscriptionId: istek.subscriptionId, vehicleId: istek.vehicleId, removedAt: null },
    include: { vehicle: { select: { plateDisplay: true } } },
  });
  if (!bag) throw new IslemHatasi("BAG_YOK", "Bu araç bu abonmanda aktif görünmüyor.");

  return prisma.$transaction(async (tx) => {
    // SILME YOK: kayit korunur, yalnizca kaldirma tarihi yazilir (kural 10).
    const guncel = await tx.subscriptionVehicle.update({
      where: { id: bag.id },
      data: { removedAt: new Date() },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_VEHICLE_REMOVE,
        entityType: "SubscriptionVehicle",
        entityId: bag.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { removedAt: null, plaka: bag.vehicle.plateDisplay },
        after: { removedAt: guncel.removedAt },
        note: istek.sebep?.trim() || null,
      },
      tx,
    );
    return guncel;
  });
}

/** Veritabani tetikleyicisinin hatasini kullaniciya anlamli mesaja cevirir. */
function cakismaHatasinaCevir(err: unknown, plaka: string): unknown {
  const mesaj = err instanceof Error ? err.message : String(err);
  if (/aktif abonmana bagli|unique_violation|subscription_vehicle_active_uniq/i.test(mesaj)) {
    return new IslemHatasi(
      "ARAC_BASKA_ABONMANDA",
      `${formatPlate(plaka)} aynı dönemde başka bir aktif abonmana bağlı. ` +
        "Bir araç aynı anda tek abonmanda olabilir.",
    );
  }
  return err;
}

// ---------------------------------------------------------------------------
// YENILEME
// ---------------------------------------------------------------------------

export interface YenilemeIstegi {
  subscriptionId: string;
  baslangic: Date;
  bitis: Date;
  /** YENI DONEMIN ucreti. Eski donemin ucreti DEGISMEZ. */
  ucretKurus: number;
  not?: string | null;
}

/**
 * Abonmani yeniler: YENI DONEM satiri yazar.
 *
 * KURAL 6: onceki SubscriptionPeriod satirina DOKUNULMAZ - fiyati ve kurali
 * oldugu gibi kalir. Yeni donemin fiyati farkli olabilir; gecmise yansimaz.
 * KURAL 1: yenileme tahsilat uretmez; yeni donem UNPAID baslar.
 */
export async function abonmanYenile(actor: SessionUser, istek: YenilemeIstegi) {
  dogrulaTarihler(istek.baslangic, istek.bitis);
  dogrulaUcret(istek.ucretKurus);

  const abonman = await prisma.subscription.findUnique({
    where: { id: istek.subscriptionId },
    include: { periods: { orderBy: { periodNo: "desc" }, take: 1 } },
  });
  if (!abonman) throw new IslemHatasi("ABONMAN_YOK", "Abonman bulunamadı.");
  if (abonman.status === "CANCELLED") {
    throw new IslemHatasi(
      "ABONMAN_IPTAL",
      "İptal edilmiş abonman yenilenemez. Yeni abonman oluşturun.",
    );
  }

  const sonDonem = abonman.periods[0];
  if (sonDonem) {
    if (istek.bitis <= sonDonem.endDate) {
      throw new IslemHatasi(
        "YENILEME_KISA",
        `Yeni dönem ${formatDate(sonDonem.endDate)} tarihinden sonra bitmelidir; ` +
          "yenileme kapsamı uzatmalıdır.",
      );
    }
    if (istek.baslangic < sonDonem.endDate) {
      throw new IslemHatasi(
        "DONEM_CAKISMASI",
        `Dönemler çakışıyor. Yeni dönem en erken ${formatDate(sonDonem.endDate)} ` +
          "tarihinde başlayabilir (önceki dönemin bitişi).",
      );
    }
  }

  const yeniNo = (sonDonem?.periodNo ?? 0) + 1;
  const eskiUcret = sonDonem ? toKurus(sonDonem.price) : null;

  return prisma.$transaction(async (tx) => {
    const donem = await tx.subscriptionPeriod.create({
      data: {
        subscriptionId: abonman.id,
        periodNo: yeniNo,
        startDate: istek.baslangic,
        endDate: istek.bitis,
        price: kurusToDecimalString(istek.ucretKurus),
        // Kural kopyasi: abonmanin o anki kurali donemle birlikte dondurulur.
        accessRuleKind: abonman.accessRuleKind,
        accessRule: (abonman.accessRule ?? undefined) as Prisma.InputJsonValue | undefined,
        note: istek.not?.trim() || null,
        createdById: actor.id,
      },
    });

    const guncel = await tx.subscription.update({
      where: { id: abonman.id },
      data: {
        endDate: istek.bitis,
        // agreedPrice "su anki donemin ucreti"dir; gecmis donemler kendi
        // fiyatini SubscriptionPeriod satirinda tasir.
        agreedPrice: kurusToDecimalString(istek.ucretKurus),
        status: baslangicDurumu(abonman.startDate, istek.bitis),
        // KURAL 1: yeni donem tahsil edilmemis sayilir.
        paymentStatus: "UNPAID",
        updatedById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_RENEW,
        entityType: "Subscription",
        entityId: abonman.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: {
          bitis: abonman.endDate,
          oncekiDonemNo: sonDonem?.periodNo ?? null,
          oncekiDonemUcreti: eskiUcret,
        },
        after: {
          donemNo: yeniNo,
          baslangic: donem.startDate,
          bitis: donem.endDate,
          ucret: donem.price.toString(),
          durum: guncel.status,
        },
        note: "Yeni dönem açıldı; önceki dönemin fiyatı değiştirilmedi.",
      },
      tx,
    );

    return { abonman: guncel, donem };
  });
}

/**
 * Donem fiyatini duzeltir.
 *
 * YALNIZCA SON DONEM duzeltilebilir (yanlis yazim gibi). Gecmis donemler
 * kapali muhasebe kaydidir ve kural 6 geregi degistirilemez.
 */
export async function donemFiyatiDuzelt(
  actor: SessionUser,
  istek: { periodId: string; ucretKurus: number; sebep: string },
) {
  dogrulaUcret(istek.ucretKurus);
  if (istek.sebep.trim().length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "Fiyat düzeltme gerekçesi zorunludur.");
  }

  const donem = await prisma.subscriptionPeriod.findUnique({
    where: { id: istek.periodId },
    include: {
      subscription: { include: { periods: { orderBy: { periodNo: "desc" }, take: 1 } } },
    },
  });
  if (!donem) throw new IslemHatasi("DONEM_YOK", "Abonman dönemi bulunamadı.");

  const sonDonemNo = donem.subscription.periods[0]?.periodNo ?? donem.periodNo;
  if (donem.periodNo !== sonDonemNo) {
    throw new IslemHatasi(
      "GECMIS_DONEM",
      `${donem.periodNo}. dönem kapanmış bir kayıttır ve fiyatı değiştirilemez. ` +
        "Geçmiş dönem fiyatları korunur.",
    );
  }

  const eski = toKurus(donem.price);

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.subscriptionPeriod.update({
      where: { id: donem.id },
      data: { price: kurusToDecimalString(istek.ucretKurus) },
    });
    await tx.subscription.update({
      where: { id: donem.subscriptionId },
      data: { agreedPrice: kurusToDecimalString(istek.ucretKurus), updatedById: actor.id },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_PRICE_CHANGE,
        entityType: "SubscriptionPeriod",
        entityId: donem.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { donemNo: donem.periodNo, ucret: eski },
        after: { donemNo: donem.periodNo, ucret: istek.ucretKurus },
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

/**
 * Abonmani iptal eder.
 *
 * FINANSAL KAYIT SILINMEZ: donemler ve tahsilatlar oldugu gibi kalir.
 * Iptal yalnizca abonmanin BUNDAN SONRA kapsam vermemesini saglar.
 * Araclarin baglari kapatilir (removedAt) ki plakalar yeni abonmana
 * baglanabilsin; bag satirlari silinmez.
 */
export async function abonmanIptal(
  actor: SessionUser,
  istek: { subscriptionId: string; sebep: string },
) {
  if (istek.sebep.trim().length < 3) {
    throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");
  }

  const abonman = await prisma.subscription.findUnique({
    where: { id: istek.subscriptionId },
    include: { vehicles: { where: { removedAt: null } } },
  });
  if (!abonman) throw new IslemHatasi("ABONMAN_YOK", "Abonman bulunamadı.");
  if (abonman.status === "CANCELLED") return abonman;

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.subscription.update({
      where: { id: abonman.id },
      data: {
        status: "CANCELLED",
        cancelledAt: simdi,
        cancelledById: actor.id,
        cancelReason: istek.sebep.trim(),
        updatedById: actor.id,
      },
    });

    for (const bag of abonman.vehicles) {
      await tx.subscriptionVehicle.update({ where: { id: bag.id }, data: { removedAt: simdi } });
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.SUBSCRIPTION_CANCEL,
        entityType: "Subscription",
        entityId: abonman.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: abonman.status, bitis: abonman.endDate },
        after: { durum: "CANCELLED", iptalEdilenAracBagi: abonman.vehicles.length },
        note: istek.sebep.trim(),
      },
      tx,
    );

    return guncel;
  });
}

// ---------------------------------------------------------------------------
// OTOMATIK DURUM TAZELEME
// ---------------------------------------------------------------------------

/**
 * Suresi dolan abonmanlari EXPIRED, basladigi halde bekleyenleri ACTIVE yapar.
 *
 * NEDEN AYRI BIR SUREC GEREKMEZ: ucret hesabi hicbir zaman status alanina
 * guvenmez; cozumleAbonman daima TARIH araligina bakar. Yani suresi dolan
 * abonman, bu fonksiyon hic calismasa bile normal tarifeye duser. Bu tazeleme
 * YALNIZCA listelerin ve uyarilarin dogru gorunmesi icindir; zamanlanmis gorev
 * (cron) gerektirmez, listeler acildiginda calisir.
 */
export async function abonmanDurumlariniTazele(simdi = new Date()) {
  const dolanlar = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "PENDING"] }, endDate: { lt: simdi } },
    select: { id: true, code: true, status: true, endDate: true },
  });

  const baslayanlar = await prisma.subscription.findMany({
    where: { status: "PENDING", startDate: { lte: simdi }, endDate: { gte: simdi } },
    select: { id: true, code: true, startDate: true },
  });

  for (const a of dolanlar) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: a.id }, data: { status: "EXPIRED" } });
      await writeAudit(
        {
          action: AUDIT_ACTIONS.SUBSCRIPTION_EXPIRE,
          entityType: "Subscription",
          entityId: a.id,
          userId: null,
          actorLabel: "sistem",
          before: { durum: a.status },
          after: { durum: "EXPIRED", bitis: a.endDate },
          note: "Süresi doldu; normal tarife uygulanır.",
        },
        tx,
      );
    });
  }

  for (const a of baslayanlar) {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.update({ where: { id: a.id }, data: { status: "ACTIVE" } });
      await writeAudit(
        {
          action: AUDIT_ACTIONS.SUBSCRIPTION_UPDATE,
          entityType: "Subscription",
          entityId: a.id,
          userId: null,
          actorLabel: "sistem",
          before: { durum: "PENDING" },
          after: { durum: "ACTIVE", baslangic: a.startDate },
          note: "Başlangıç tarihi geldi.",
        },
        tx,
      );
    });
  }

  return { suresiDolan: dolanlar.length, baslatilan: baslayanlar.length };
}

async function varsayilanSinifId(tx: Tx): Promise<string> {
  const otomobil = await tx.vehicleClass.findUnique({ where: { code: "OTOMOBIL" } });
  if (otomobil?.isActive) return otomobil.id;
  const ilk = await tx.vehicleClass.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!ilk) throw new IslemHatasi("ARAC_SINIFI_YOK", "Sistemde tanımlı araç sınıfı yok.");
  return ilk.id;
}
