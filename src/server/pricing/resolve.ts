/**
 * Tarife cozumleme: giris aninda hangi kural uygulanacak?
 *
 * Algoritma (docs/05 5.1):
 *   1. Gecerli planlar bulunur (isActive + surum tarih araligi giris anini kapsar)
 *   2. En yuksek priority kazanir; esitlikte isDefault
 *   3. Plan icinde once aracin sinifina ait kural, yoksa genel (null) kural
 *   4. Secilen kuralin TAM KOPYASI snapshot olarak uretilir
 *
 * Snapshot GIRIS ANINDA yazilir (karar: 02.10.2026). Yonetici fiyati sonradan
 * degistirse bile o arac giris anindaki tarifeyle ucretlendirilir.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { toKurus } from "@/lib/money";
import { prisma } from "@/server/db";
import { SNAPSHOT_SURUMU, TarifeSnapshotSemasi, type TarifeSnapshot } from "./types";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface CozumlemeSonucu {
  snapshot: TarifeSnapshot;
  tariffVersionId: string;
  tariffRuleId: string;
}

/**
 * Giris aninda uygulanacak tarifeyi cozumler.
 *
 * Tarife bulunamazsa null doner. Bu bir HATA DEGILDIR: patron henuz tarife
 * girmemis olabilir. Arac girisi engellenmez; cikista tarifeTanimsiz uyarisi
 * gosterilir. (Isletme fiyat girmeden de sistemi kullanabilsin.)
 */
export async function cozumleTarife(
  aracSinifiId: string,
  anında: Date,
  db: DbClient = prisma,
): Promise<CozumlemeSonucu | null> {
  const surumler = await db.tariffVersion.findMany({
    where: {
      isActive: true,
      effectiveFrom: { lte: anında },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anında } }],
      tariffPlan: { isActive: true },
    },
    include: {
      tariffPlan: true,
      rules: {
        where: {
          isActive: true,
          OR: [{ vehicleClassId: aracSinifiId }, { vehicleClassId: null }],
        },
        include: { vehicleClass: true },
      },
    },
  });

  if (surumler.length === 0) return null;

  // En yuksek priority, esitlikte isDefault, sonra en yeni surum.
  const sirali = [...surumler].sort((a, b) => {
    if (b.tariffPlan.priority !== a.tariffPlan.priority) {
      return b.tariffPlan.priority - a.tariffPlan.priority;
    }
    if (a.tariffPlan.isDefault !== b.tariffPlan.isDefault) {
      return a.tariffPlan.isDefault ? -1 : 1;
    }
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  });

  for (const surum of sirali) {
    // Once aracin sinifina ozel kural, yoksa genel kural.
    const kural =
      surum.rules.find((r) => r.vehicleClassId === aracSinifiId) ??
      surum.rules.find((r) => r.vehicleClassId === null);
    if (!kural) continue;

    const snapshot: TarifeSnapshot = {
      surum: SNAPSHOT_SURUMU,
      planId: surum.tariffPlanId,
      planAdi: surum.tariffPlan.name,
      surumId: surum.id,
      surumNo: surum.versionNo,
      kuralId: kural.id,
      aracSinifiId: kural.vehicleClassId,
      aracSinifiAdi: kural.vehicleClass?.name ?? null,

      ucretsizDakika: kural.freeMinutes,
      ucretsizDusulur: kural.freeMinutesDeductible,

      ilkBlokDakika: kural.firstPeriodMinutes,
      ilkBlokUcret: toKurus(kural.firstPeriodPrice),

      saatlikUcret: toKurus(kural.hourlyPrice),
      saatYuvarlamaDakika: Math.max(1, kural.hourlyRoundingMinutes),

      gunlukUcret: toKurus(kural.dailyPrice),
      gunlukUstLimit: toKurus(kural.dailyCapPrice),

      geceSabitUcret: kural.nightFlatPrice === null ? null : toKurus(kural.nightFlatPrice),
      geceBaslangicDakika: kural.nightStartMinute,
      geceBitisDakika: kural.nightEndMinute,

      haftaSonuKatsayisi:
        kural.weekendMultiplier === null ? null : Number(kural.weekendMultiplier.toString()),

      asgariUcret: toKurus(kural.minCharge),
    };

    // Kendi urettigimiz snapshot'i da dogrulariz: bozuk veri uretmeyelim.
    const dogrulanmis = TarifeSnapshotSemasi.safeParse(snapshot);
    if (!dogrulanmis.success) {
      throw new Error(
        `Tarife kuralı geçerli bir snapshot üretmedi (kural: ${kural.id}): ` +
          dogrulanmis.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(", "),
      );
    }

    return { snapshot: dogrulanmis.data, tariffVersionId: surum.id, tariffRuleId: kural.id };
  }

  return null;
}

/**
 * Kayitli snapshot'i okur ve dogrular.
 *
 * Cikista ucret bu snapshot'tan yeniden hesaplanir. Bozuk snapshot sessizce
 * yok sayilmaz; hata firlatilir ki yanlis ucret tahsil edilmesin.
 */
export function okuSnapshot(deger: unknown): TarifeSnapshot {
  const sonuc = TarifeSnapshotSemasi.safeParse(deger);
  if (!sonuc.success) {
    throw new Error(
      "Park kaydındaki tarife bilgisi okunamadı. Yönetici ile görüşün. " +
        `(${sonuc.error.issues.map((i) => i.path.join(".")).join(", ")})`,
    );
  }
  return sonuc.data;
}
