/**
 * ARAC GIRISI
 *
 * Akis (docs/04 4.3):
 *   1. Plaka normalize edilir
 *   2. Ayni plakadan aktif giris var mi kontrol edilir (+ DB kisiti)
 *   3. Arac kaydi bulunur veya olusturulur
 *   4. Abonman durumu cozumlenir
 *   5. Tarife cozumlenir ve SNAPSHOT GIRISTE yazilir
 *   6. Kapasite kontrolu (tanimliysa)
 *   7. Tek transaction'da kayit + denetim
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { isValidTurkishPlate, normalizePlate, formatPlate } from "@/lib/plate";
import { cozumleTarife } from "@/server/pricing/resolve";
import { ABONMAN_BOS, cozumleAbonman, type AbonmanBilgisi } from "@/server/subscription/resolve";
import { vardiyaZorunlu, IslemHatasi } from "@/server/shift";
import { parkKodu } from "./codes";
import type { SessionUser } from "@/server/auth/session";

export interface GirisIstegi {
  plaka: string;
  aracSinifiId?: string;
  /** Plaka bicimi gecersiz olsa da kaydedilsin mi (yabanci/gecici plaka)? */
  bicimiZorla?: boolean;
  /** Kapasite dolu olsa da giris alinsin mi? */
  kapasiteyiZorla?: boolean;
  not?: string;
  /** Cift kayit engeli. Istemci her islem icin benzersiz bir anahtar uretir. */
  idempotencyKey: string;
}

export interface GirisSonucu {
  parkingSessionId: string;
  kod: string;
  plakaGosterim: string;
  girisAt: Date;
  aracSinifiAdi: string;
  abonman: AbonmanBilgisi;
  /** Tarife bulunamadi: patron henuz fiyat girmemis. */
  tarifeTanimsiz: boolean;
  /** Bilgilendirme amacli uyarilar (kapasite, plaka bicimi vb.). */
  uyarilar: string[];
}

/** Kapasite durumu. limit=0 => kapasite tanimli degil. */
export async function kapasiteDurumu() {
  const [ayar, aktif] = await Promise.all([
    prisma.parkingCapacitySetting.findUnique({ where: { id: "singleton" } }),
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
  ]);
  const limit = ayar?.totalCapacity ?? 0;
  return {
    limit,
    aktif,
    /** Kapasite TANIMLI DEGILSE doluluk hesaplanmaz ve giris engellenmez. */
    tanimli: limit > 0,
    doluMu: limit > 0 && aktif >= limit,
    yuzde: limit > 0 ? Math.round((aktif / limit) * 100) : null,
    uyariEsigi: ayar?.warnThresholdPercent ?? 90,
  };
}

export async function aracGirisi(actor: SessionUser, istek: GirisIstegi): Promise<GirisSonucu> {
  const vardiya = await vardiyaZorunlu(actor.id);
  const uyarilar: string[] = [];

  // --- 0. IDEMPOTENCY: ayni istek daha once islendi mi? ---
  // Bu kontrol mukerrer giris kontrolunden ONCE yapilir. Aksi halde yavas
  // hatta butona iki kez basan personel, kendi ilk isteginin olusturdugu
  // kayit yuzunden "bu arac zaten iceride" hatasi alir - oysa yapmasi
  // gereken hicbir sey yoktur.
  const oncekiIstek = await mevcutIstegiBul(istek.idempotencyKey);
  if (oncekiIstek) return oncekiIstek;

  // --- 1. PLAKA NORMALIZASYONU ---
  const plateNormalized = normalizePlate(istek.plaka);
  if (plateNormalized.length < 4) {
    throw new IslemHatasi("PLAKA_GECERSIZ", "Plaka çok kısa. Örnek: 34 ABC 123");
  }
  if (plateNormalized.length > 12) {
    throw new IslemHatasi("PLAKA_GECERSIZ", "Plaka çok uzun.");
  }

  const bicimGecerli = isValidTurkishPlate(plateNormalized);
  if (!bicimGecerli && !istek.bicimiZorla) {
    // Yabanci/gecici plakalar bu desene uymaz: ENGELLENMEZ, onay istenir.
    throw new IslemHatasi(
      "PLAKA_BICIMI",
      `"${formatPlate(plateNormalized)}" Türkiye plaka biçimine uymuyor. ` +
        "Yabancı veya geçici plaka ise yine de kaydedebilirsiniz.",
    );
  }
  if (!bicimGecerli) {
    uyarilar.push("Plaka biçimi standart dışı; not olarak kaydedildi.");
  }

  const plakaGosterim = formatPlate(plateNormalized);
  const simdi = new Date();

  // --- 2. MUKERRER AKTIF GIRIS KONTROLU ---
  // Uygulama kontrolu: kullaniciya anlamli mesaj verebilmek icin.
  // Asil garanti veritabanindaki kismi tekil indekstir (yaris kosulu).
  const mevcut = await prisma.parkingSession.findFirst({
    where: { plateNormalized, status: "ACTIVE" },
    select: { id: true, entryAt: true, code: true },
  });
  if (mevcut) {
    throw new IslemHatasi(
      "ZATEN_ICERIDE",
      `Bu araç ${mevcut.entryAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
      })} itibarıyla otoparkta. Çıkış işlemi yapmak ister misiniz?`,
    );
  }

  // --- 3. ARAC KAYDI ---
  let arac = await prisma.vehicle.findUnique({
    where: { plateNormalized },
    include: { vehicleClass: true },
  });

  if (!arac) {
    const sinifId = istek.aracSinifiId ?? (await varsayilanAracSinifiId());
    arac = await prisma.vehicle.create({
      data: {
        plateNormalized,
        plateDisplay: plakaGosterim,
        vehicleClassId: sinifId,
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
    });
  } else if (istek.aracSinifiId && istek.aracSinifiId !== arac.vehicleClassId) {
    // Personel sinifi degistirdiyse arac kaydi guncellenir.
    const oncesi = { vehicleClassId: arac.vehicleClassId };
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
      before: oncesi,
      after: { vehicleClassId: arac.vehicleClassId },
    });
  }

  // --- 4. ABONMAN COZUMLEME ---
  const abonman = await cozumleAbonman(plateNormalized, simdi);

  // --- 5. TARIFE COZUMLEME VE SNAPSHOT ---
  const tarife = abonman.ucretsizMi ? null : await cozumleTarife(arac.vehicleClassId, simdi);
  const tarifeTanimsiz = !abonman.ucretsizMi && tarife === null;
  if (tarifeTanimsiz) {
    // Karavan gibi STANDART TARIFE DISI siniflarda sebep farklidir: genel
    // tarife var ama bu sinif ona dahil degil. Personel "tarife girilmemis"
    // sanip patrona yanlis bilgi vermesin.
    uyarilar.push(
      arac.vehicleClass.excludeFromStandardTariff
        ? `${arac.vehicleClass.name} normal otopark tarifesine dahil değil ve ` +
            "kendi fiyatı henüz tanımlanmadı. Çıkışta ücret hesaplanamayacak."
        : "Tarife tanımlı değil. Çıkışta ücret hesaplanamayacak; patron panelinden tarife girilmeli.",
    );
  }

  // --- 6. KAPASITE KONTROLU ---
  const kapasite = await kapasiteDurumu();
  if (kapasite.doluMu && !istek.kapasiteyiZorla) {
    throw new IslemHatasi(
      "KAPASITE_DOLU",
      `Otopark dolu (${kapasite.aktif}/${kapasite.limit}). Yine de giriş almak ister misiniz?`,
    );
  }
  if (kapasite.doluMu) {
    uyarilar.push(`Kapasite aşıldı (${kapasite.aktif + 1}/${kapasite.limit}).`);
  }

  // --- 7. KAYIT (tek transaction) ---
  const notlar = [istek.not, !bicimGecerli ? "Plaka biçimi standart dışı" : null]
    .filter(Boolean)
    .join(" · ");

  try {
    const kayit = await prisma.$transaction(async (tx) => {
      const olusan = await tx.parkingSession.create({
        data: {
          code: await parkKodu(tx, simdi),
          vehicleId: arac!.id,
          plateNormalized,
          plateDisplay: plakaGosterim,
          vehicleClassId: arac!.vehicleClassId,
          entryAt: simdi,
          entryUserId: actor.id,
          entryShiftId: vardiya.id,
          entryNote: notlar || null,
          status: "ACTIVE",
          billingMode: abonman.ucretsizMi ? "SUBSCRIPTION" : "TARIFF",
          subscriptionId: abonman.subscriptionId,
          tariffVersionId: tarife?.tariffVersionId ?? null,
          tariffRuleId: tarife?.tariffRuleId ?? null,
          tariffSnapshot: tarife
            ? (tarife.snapshot as unknown as Prisma.InputJsonValue)
            : undefined,
          idempotencyKey: istek.idempotencyKey,
        },
      });

      await writeAudit(
        {
          action: AUDIT_ACTIONS.PARKING_ENTRY,
          entityType: "ParkingSession",
          entityId: olusan.id,
          userId: actor.id,
          actorLabel: actor.username,
          after: {
            kod: olusan.code,
            plaka: plateNormalized,
            girisAt: olusan.entryAt,
            billingMode: olusan.billingMode,
            tarifeSurumu: tarife?.snapshot.surumNo ?? null,
            abonmanDurumu: abonman.durum,
          },
          note: notlar || null,
        },
        tx,
      );

      return olusan;
    });

    return {
      parkingSessionId: kayit.id,
      kod: kayit.code,
      plakaGosterim: plakaGosterim,
      girisAt: kayit.entryAt,
      aracSinifiAdi: arac.vehicleClass.name,
      abonman,
      tarifeTanimsiz,
      uyarilar,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: tekil kisit. Hangi kisit oldugunu ayirt et.
      if (err.code === "P2002") {
        const hedef = String(err.meta?.target ?? "");
        if (hedef.includes("idempotency")) {
          // Yaris kosulu: iki istek ayni anda geldi, ikincisi tekil kisita
          // takildi. Ilk kaydi dondur, yeni kayit olusturma.
          const varOlan = await mevcutIstegiBul(istek.idempotencyKey);
          if (varOlan) return varOlan;
        }
        // Kismi tekil indeks: esszamanli ikinci giris.
        throw new IslemHatasi(
          "ZATEN_ICERIDE",
          "Bu araç şu anda otoparkta görünüyor. Sayfayı yenileyip tekrar deneyin.",
        );
      }
    }
    throw err;
  }
}

/**
 * Daha once ayni idempotency anahtariyla islenmis girisi bulur.
 *
 * Cift kayit engelinin temelidir: personel butona iki kez bassa veya istek
 * aglda tekrarlansa bile tek kayit olusur ve kullaniciya ayni sonuc doner.
 */
async function mevcutIstegiBul(idempotencyKey: string): Promise<GirisSonucu | null> {
  const varOlan = await prisma.parkingSession.findUnique({
    where: { idempotencyKey },
    include: {
      vehicle: { include: { vehicleClass: true } },
      subscription: { include: { customer: { select: { id: true, fullName: true } } } },
    },
  });
  if (!varOlan) return null;

  return {
    parkingSessionId: varOlan.id,
    kod: varOlan.code,
    plakaGosterim: varOlan.plateDisplay,
    girisAt: varOlan.entryAt,
    aracSinifiAdi: varOlan.vehicle.vehicleClass.name,
    // Abonman yeniden cozumlenmez: kaydin GIRIS ANINDAKI durumu esastir.
    abonman: {
      ...ABONMAN_BOS,
      durum: varOlan.billingMode === "SUBSCRIPTION" ? "AKTIF" : "YOK",
      ucretsizMi: varOlan.billingMode === "SUBSCRIPTION",
      subscriptionId: varOlan.subscriptionId,
      abonmanKodu: varOlan.subscription?.code ?? null,
      planEtiketi: varOlan.subscription?.planLabel ?? null,
      musteriAdi: varOlan.subscription?.customer.fullName ?? null,
      musteriId: varOlan.subscription?.customer.id ?? null,
      baslangicTarihi: varOlan.subscription?.startDate ?? null,
      bitisTarihi: varOlan.subscription?.endDate ?? null,
    },
    tarifeTanimsiz: varOlan.tariffSnapshot === null && varOlan.billingMode === "TARIFF",
    uyarilar: ["Bu işlem daha önce kaydedilmişti."],
  };
}

/**
 * Yeni plakalar icin varsayilan arac sinifi.
 *
 * "OTOMOBIL" kodu aranir; yoksa siralamada ilk aktif sinif kullanilir.
 * Hicbir sinif yoksa hata verilir - sinif listesi seed ile olusturulur.
 */
async function varsayilanAracSinifiId(): Promise<string> {
  const otomobil = await prisma.vehicleClass.findUnique({ where: { code: "OTOMOBIL" } });
  if (otomobil?.isActive) return otomobil.id;

  const ilk = await prisma.vehicleClass.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!ilk) {
    throw new IslemHatasi(
      "ARAC_SINIFI_YOK",
      "Sistemde tanımlı araç sınıfı yok. Yönetici ile görüşün.",
    );
  }
  return ilk.id;
}
