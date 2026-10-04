/**
 * TARIFE YONETIMI (patron)
 *
 * ============================================================================
 * TEMEL KURAL: AKTIF SURUM BILE DOGRUDAN DUZENLENMEZ.
 * ----------------------------------------------------------------------------
 * Her fiyat degisikligi YENI SURUM uretir; eski surumun effectiveTo'su kapanir.
 * Bu, "gecmisteki park ucretleri geriye donuk degismesin" gereksiniminin
 * teknik garantisidir: gecmis park kayitlari kendi snapshot'larini tasir ve
 * eski surum satiri hic degismedigi icin izlenebilir kalir.
 *
 * HICBIR FIYAT VARSAYILMAZ. Tum degerler patron tarafindan girilir; bu modul
 * yalnizca girilen degerleri kaydeder ve dogrular.
 * ============================================================================
 */

import { z } from "zod";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { hesaplaUcret } from "./calculate";
import { IslemHatasi } from "@/server/shift";
import type { SessionUser } from "@/server/auth/session";

/** Kurus cinsinden tutar girdisi. Negatif kabul edilmez. */
const KurusGirdi = z.coerce.number().int().min(0).max(100_000_000);

export const KuralGirdiSemasi = z.object({
  /** null = tum arac siniflari icin genel kural. */
  vehicleClassId: z.string().min(1).nullable(),

  ucretsizDakika: z.coerce.number().int().min(0).max(1440).default(0),
  ucretsizDusulur: z.coerce.boolean().default(false),

  ilkBlokDakika: z.coerce.number().int().min(0).max(1440).default(0),
  ilkBlokUcret: KurusGirdi.default(0),

  saatlikUcret: KurusGirdi.default(0),
  saatYuvarlamaDakika: z.coerce.number().int().min(1).max(1440).default(60),

  gunlukUcret: KurusGirdi.default(0),
  gunlukUstLimit: KurusGirdi.default(0),

  geceSabitUcret: KurusGirdi.nullable().default(null),
  geceBaslangicDakika: z.coerce.number().int().min(0).max(1439).nullable().default(null),
  geceBitisDakika: z.coerce.number().int().min(0).max(1439).nullable().default(null),

  haftaSonuKatsayisi: z.coerce.number().positive().max(10).nullable().default(null),

  asgariUcret: KurusGirdi.default(0),
});

export type KuralGirdi = z.infer<typeof KuralGirdiSemasi>;

/** Gece tarifesinin tum alanlari birlikte tanimli olmalidir. */
function dogrulaKural(k: KuralGirdi): string[] {
  const hatalar: string[] = [];

  const geceAlanlari = [k.geceSabitUcret, k.geceBaslangicDakika, k.geceBitisDakika];
  const geceDolu = geceAlanlari.filter((a) => a !== null && a !== 0).length;
  if (geceDolu > 0 && geceAlanlari.some((a) => a === null)) {
    hatalar.push(
      "Gece tarifesi için ücret, başlangıç ve bitiş saatinin üçü birlikte girilmelidir.",
    );
  }
  if (
    k.geceBaslangicDakika !== null &&
    k.geceBitisDakika !== null &&
    k.geceBaslangicDakika === k.geceBitisDakika
  ) {
    hatalar.push("Gece tarifesi başlangıç ve bitiş saati aynı olamaz.");
  }
  if (k.ilkBlokDakika > 0 && k.ilkBlokUcret === 0) {
    hatalar.push("İlk blok süresi girildi ama ücreti girilmedi.");
  }
  if (k.ilkBlokUcret > 0 && k.ilkBlokDakika === 0) {
    hatalar.push("İlk blok ücreti girildi ama süresi girilmedi.");
  }
  if (k.gunlukUstLimit > 0 && k.gunlukUcret > 0 && k.gunlukUstLimit < k.gunlukUcret) {
    hatalar.push(
      "Günlük üst limit, günlük ücretten küçük olamaz. (Kısmi gün tam günden pahalı olmamalı.)",
    );
  }
  return hatalar;
}

export async function tarifePlanlari() {
  return prisma.tariffPlan.findMany({
    orderBy: [{ priority: "desc" }, { name: "asc" }],
    include: {
      versions: {
        orderBy: { versionNo: "desc" },
        include: {
          rules: { include: { vehicleClass: true } },
          _count: { select: { parkingSessions: true } },
        },
      },
    },
  });
}

/** Su an gecerli olan surumu dondurur (varsa). */
export async function gecerliSurum(planId: string, anında = new Date()) {
  return prisma.tariffVersion.findFirst({
    where: {
      tariffPlanId: planId,
      isActive: true,
      effectiveFrom: { lte: anında },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anında } }],
    },
    include: { rules: { include: { vehicleClass: true } } },
    orderBy: { versionNo: "desc" },
  });
}

export async function planOlustur(
  actor: SessionUser,
  girdi: { ad: string; aciklama?: string; varsayilan?: boolean; oncelik?: number },
) {
  const ad = girdi.ad.trim();
  if (ad.length < 2) throw new IslemHatasi("GECERSIZ_AD", "Plan adı en az 2 karakter olmalı.");

  const plan = await prisma.$transaction(async (tx) => {
    // Yeni plan varsayilan yapildiysa digerlerinin varsayilanligi kalkar.
    if (girdi.varsayilan) {
      await tx.tariffPlan.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.tariffPlan.create({
      data: {
        name: ad,
        description: girdi.aciklama?.trim() || null,
        isDefault: girdi.varsayilan ?? false,
        priority: girdi.oncelik ?? 0,
        isActive: true,
        createdById: actor.id,
      },
    });
  });

  await writeAudit({
    action: AUDIT_ACTIONS.TARIFF_VERSION_CREATE,
    entityType: "TariffPlan",
    entityId: plan.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: { ad: plan.name, varsayilan: plan.isDefault, oncelik: plan.priority },
    note: "Yeni tarife planı oluşturuldu",
  });

  return plan;
}

export interface SurumOlusturGirdisi {
  planId: string;
  /** Gecerlilik baslangici. Gecmise tarih verilemez. */
  gecerlilikBaslangici: Date;
  degisiklikNotu: string;
  kurallar: KuralGirdi[];
}

/**
 * Yeni tarife surumu olusturur.
 *
 * Eski surumun effectiveTo'su yeni surumun baslangicina ayarlanir; eski surum
 * satirinin FIYATLARI HIC DEGISMEZ. Boylece o surumle ucretlendirilen gecmis
 * park kayitlari izlenebilir kalir.
 */
export async function surumOlustur(actor: SessionUser, girdi: SurumOlusturGirdisi) {
  const not = girdi.degisiklikNotu.trim();
  if (not.length < 3) {
    throw new IslemHatasi("NOT_ZORUNLU", "Değişiklik notu girilmesi zorunludur.");
  }
  if (girdi.kurallar.length === 0) {
    throw new IslemHatasi("KURAL_YOK", "En az bir tarife kuralı girilmelidir.");
  }

  // Ayni arac sinifi icin iki kural olamaz.
  const sinifAnahtarlari = girdi.kurallar.map((k) => k.vehicleClassId ?? "GENEL");
  if (new Set(sinifAnahtarlari).size !== sinifAnahtarlari.length) {
    throw new IslemHatasi("KURAL_TEKRAR", "Aynı araç sınıfı için birden fazla kural girilemiş.");
  }

  const tumHatalar = girdi.kurallar.flatMap((k, i) =>
    dogrulaKural(k).map((h) => `${i + 1}. kural: ${h}`),
  );
  if (tumHatalar.length > 0) {
    throw new IslemHatasi("KURAL_GECERSIZ", tumHatalar.join(" "));
  }

  // Gecmise tarihli surum, gecmis park kayitlarinin tarifesini belirsiz hale
  // getirir. Buna izin verilmez.
  const simdi = new Date();
  if (girdi.gecerlilikBaslangici.getTime() < simdi.getTime() - 60_000) {
    throw new IslemHatasi(
      "GECMIS_TARIH",
      "Geçerlilik başlangıcı geçmişe tarihlenemez. Geçmiş park ücretleri değişmemelidir.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const plan = await tx.tariffPlan.findUniqueOrThrow({
      where: { id: girdi.planId },
      include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
    });

    const oncekiSurum = plan.versions[0] ?? null;
    const yeniNo = (oncekiSurum?.versionNo ?? 0) + 1;

    // Onceki surumu kapat - FIYATLARINA DOKUNULMAZ.
    if (oncekiSurum && oncekiSurum.effectiveTo === null) {
      await tx.tariffVersion.update({
        where: { id: oncekiSurum.id },
        data: { effectiveTo: girdi.gecerlilikBaslangici },
      });
    }

    const surum = await tx.tariffVersion.create({
      data: {
        tariffPlanId: plan.id,
        versionNo: yeniNo,
        effectiveFrom: girdi.gecerlilikBaslangici,
        effectiveTo: null,
        isActive: true,
        changeNote: not,
        createdById: actor.id,
        rules: {
          create: girdi.kurallar.map((k) => ({
            vehicleClassId: k.vehicleClassId,
            freeMinutes: k.ucretsizDakika,
            freeMinutesDeductible: k.ucretsizDusulur,
            firstPeriodMinutes: k.ilkBlokDakika,
            firstPeriodPrice: kurusToDecimalString(k.ilkBlokUcret),
            hourlyPrice: kurusToDecimalString(k.saatlikUcret),
            hourlyRoundingMinutes: k.saatYuvarlamaDakika,
            dailyPrice: kurusToDecimalString(k.gunlukUcret),
            dailyCapPrice: kurusToDecimalString(k.gunlukUstLimit),
            nightFlatPrice:
              k.geceSabitUcret === null ? null : kurusToDecimalString(k.geceSabitUcret),
            nightStartMinute: k.geceBaslangicDakika,
            nightEndMinute: k.geceBitisDakika,
            weekendMultiplier:
              k.haftaSonuKatsayisi === null ? null : k.haftaSonuKatsayisi.toFixed(3),
            minCharge: kurusToDecimalString(k.asgariUcret),
            isActive: true,
          })),
        },
      },
      include: { rules: true },
    });

    await tx.tariffChangeLog.create({
      data: {
        tariffPlanId: plan.id,
        fromVersionId: oncekiSurum?.id ?? null,
        toVersionId: surum.id,
        changedById: actor.id,
        note: not,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.TARIFF_VERSION_CREATE,
        entityType: "TariffVersion",
        entityId: surum.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: oncekiSurum
          ? { surumNo: oncekiSurum.versionNo, kapatilanTarih: girdi.gecerlilikBaslangici }
          : undefined,
        after: {
          plan: plan.name,
          surumNo: yeniNo,
          gecerlilikBaslangici: girdi.gecerlilikBaslangici,
          kurallar: girdi.kurallar.map((k) => ({
            aracSinifiId: k.vehicleClassId,
            ucretsizDakika: k.ucretsizDakika,
            ilkBlokDakika: k.ilkBlokDakika,
            ilkBlokUcretKurus: k.ilkBlokUcret,
            saatlikUcretKurus: k.saatlikUcret,
            gunlukUcretKurus: k.gunlukUcret,
            gunlukUstLimitKurus: k.gunlukUstLimit,
            asgariUcretKurus: k.asgariUcret,
          })),
        },
        note: not,
      },
      tx,
    );

    return surum;
  });
}

/** Planı aktif/pasif yapar. Pasif plan yeni girislerde kullanilmaz. */
export async function planDurumDegistir(actor: SessionUser, planId: string, aktif: boolean) {
  const plan = await prisma.tariffPlan.update({
    where: { id: planId },
    data: { isActive: aktif },
  });

  await writeAudit({
    action: aktif ? AUDIT_ACTIONS.TARIFF_VERSION_CREATE : AUDIT_ACTIONS.TARIFF_DEACTIVATE,
    entityType: "TariffPlan",
    entityId: planId,
    userId: actor.id,
    actorLabel: actor.username,
    after: { isActive: aktif },
    note: aktif ? "Tarife planı aktifleştirildi" : "Tarife planı pasifleştirildi",
  });

  return plan;
}

/**
 * Tarife onizlemesi: patron fiyat degistirmeden once etkisini gorur.
 * "Örnek: 3 saat park 115 ₺ yerine 130 ₺ olacak" (docs/05 5.3)
 */
export function tarifeOnizleme(kural: KuralGirdi, ornekDakikalar = [30, 120, 192, 660, 1500]) {
  return ornekDakikalar.map((dakika) => ({
    dakika,
    kurus: onizlemeHesapla(kural, dakika),
  }));
}

function onizlemeHesapla(k: KuralGirdi, dakika: number): number {
  // Hesaplama motorunu kullanir; boylece onizleme ile gercek tahsilat ayni
  // mantiktan gecer ve birbirinden sapmaz.
  const giris = new Date("2026-01-05T09:00:00Z"); // Pazartesi, hafta sonu degil
  return hesaplaUcret({
    girisAt: giris,
    cikisAt: new Date(giris.getTime() + dakika * 60000),
    snapshot: {
      surum: 1,
      planId: "onizleme",
      planAdi: "Önizleme",
      surumId: "onizleme",
      surumNo: 0,
      kuralId: "onizleme",
      aracSinifiId: k.vehicleClassId,
      aracSinifiAdi: null,
      ucretsizDakika: k.ucretsizDakika,
      ucretsizDusulur: k.ucretsizDusulur,
      ilkBlokDakika: k.ilkBlokDakika,
      ilkBlokUcret: k.ilkBlokUcret,
      saatlikUcret: k.saatlikUcret,
      saatYuvarlamaDakika: k.saatYuvarlamaDakika,
      gunlukUcret: k.gunlukUcret,
      gunlukUstLimit: k.gunlukUstLimit,
      geceSabitUcret: k.geceSabitUcret,
      geceBaslangicDakika: k.geceBaslangicDakika,
      geceBitisDakika: k.geceBitisDakika,
      haftaSonuKatsayisi: k.haftaSonuKatsayisi,
      asgariUcret: k.asgariUcret,
    },
    haftaSonuMu: false,
  }).tutar;
}

/** Kapasite ayarini guncelle. 0 = tanimli degil (giris engellenmez). */
export async function kapasiteGuncelle(
  actor: SessionUser,
  girdi: { kapasite: number; uyariEsigi?: number },
) {
  if (girdi.kapasite < 0 || !Number.isInteger(girdi.kapasite)) {
    throw new IslemHatasi("GECERSIZ_KAPASITE", "Kapasite 0 veya pozitif tam sayı olmalı.");
  }

  const onceki = await prisma.parkingCapacitySetting.findUnique({ where: { id: "singleton" } });

  const ayar = await prisma.parkingCapacitySetting.upsert({
    where: { id: "singleton" },
    update: {
      totalCapacity: girdi.kapasite,
      warnThresholdPercent: girdi.uyariEsigi ?? onceki?.warnThresholdPercent ?? 90,
      updatedById: actor.id,
    },
    create: {
      id: "singleton",
      totalCapacity: girdi.kapasite,
      warnThresholdPercent: girdi.uyariEsigi ?? 90,
      updatedById: actor.id,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "ParkingCapacitySetting",
    entityId: "singleton",
    userId: actor.id,
    actorLabel: actor.username,
    before: { kapasite: onceki?.totalCapacity ?? 0 },
    after: { kapasite: ayar.totalCapacity, uyariEsigi: ayar.warnThresholdPercent },
    note:
      girdi.kapasite === 0
        ? "Kapasite tanımı kaldırıldı (giriş engellenmez)"
        : "Otopark kapasitesi güncellendi",
  });

  return ayar;
}

/** Personel fiyat listesi ekrani icin gecerli tarifeler. */
export async function gecerliTarifeler(anında = new Date()) {
  const surumler = await prisma.tariffVersion.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: anında },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anında } }],
      tariffPlan: { isActive: true },
    },
    include: {
      tariffPlan: true,
      rules: { include: { vehicleClass: true } },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  return surumler.map((s) => ({
    planAdi: s.tariffPlan.name,
    surumNo: s.versionNo,
    gecerlilikBaslangici: s.effectiveFrom,
    kurallar: s.rules.map((r) => ({
      aracSinifi: r.vehicleClass?.name ?? "Tüm araçlar",
      ucretsizDakika: r.freeMinutes,
      ilkBlokDakika: r.firstPeriodMinutes,
      ilkBlokUcret: toKurus(r.firstPeriodPrice),
      saatlikUcret: toKurus(r.hourlyPrice),
      gunlukUcret: toKurus(r.dailyPrice),
      gunlukUstLimit: toKurus(r.dailyCapPrice),
      asgariUcret: toKurus(r.minCharge),
    })),
  }));
}
