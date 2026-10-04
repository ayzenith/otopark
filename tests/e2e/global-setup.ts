/**
 * E2E test verisi hazirligi.
 *
 * DIKKAT: Buradaki tarife YALNIZCA TEST icindir; isletmenin gercek fiyati
 * DEGILDIR. Testler gercek bir tarayicida gercek bir veritabanina karsi
 * calisir, bu yuzden bir tarife tanimlanmak zorunda.
 */

import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

export const E2E_KULLANICI = "e2e_personel";
export const E2E_PATRON = "e2e_patron";
export const E2E_PAROLA = "Kavun42Tepsi";

/** TEST tarifesi: ilk 60 dk 40 ₺, sonra saatlik 25 ₺. */
export const E2E_TARIFE = {
  ilkBlokDakika: 60,
  ilkBlokUcretKurus: 4000,
  saatlikUcretKurus: 2500,
};

/**
 * ONCEDEN PARK EDILMIS ARAC.
 *
 * Yeni giris yapan aracin suresi 0 dakikadir, dolayisiyla ucreti de 0 olur.
 * Ucret gosterimini ve tahsilati gercek bir tutarla test edebilmek icin
 * 3 saat 12 dakika once girmis bir arac hazirlanir.
 *   Beklenen ucret: ilk 60 dk 40 ₺ + ceil(132/60)=3 × 25 ₺ = 115 ₺
 */
export const E2E_PARK_SURESI_DAKIKA = 192;
export const E2E_BEKLENEN_UCRET_METNI = "115,00";

/**
 * Her Playwright projesi (telefon-kucuk, telefon-orta, masaustu) KENDI park
 * edilmis aracini kullanir. global-setup yalnizca bir kez calistigi icin,
 * tek bir arac paylasilsaydi ilk proje onu cikarir ve digerleri bulamazdi.
 */
export const E2E_PARK_EDILMIS_PLAKALAR: Record<string, string> = {
  "telefon-kucuk": "34ZPA01",
  "telefon-orta": "34ZPB01",
  masaustu: "34ZPC01",
};

export function parkEdilmisPlaka(projeAdi: string): string {
  const plaka = E2E_PARK_EDILMIS_PLAKALAR[projeAdi];
  if (!plaka) throw new Error(`Bu proje için park edilmiş araç tanımlı değil: ${projeAdi}`);
  return plaka;
}

export default async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    const parolaOzeti = await hash(E2E_PAROLA, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Arac sinifi
    const sinif = await prisma.vehicleClass.upsert({
      where: { code: "OTOMOBIL" },
      update: {},
      create: { code: "OTOMOBIL", name: "Otomobil", sortOrder: 20 },
    });

    // Personel ve patron
    for (const [username, role] of [
      [E2E_KULLANICI, "STAFF"],
      [E2E_PATRON, "OWNER"],
    ] as const) {
      await prisma.user.upsert({
        where: { username },
        update: { passwordHash: parolaOzeti, isActive: true, mustChangePassword: false },
        create: {
          username,
          passwordHash: parolaOzeti,
          fullName: username === E2E_PATRON ? "E2E Patron" : "E2E Personel",
          role,
          isActive: true,
          mustChangePassword: false,
        },
      });
    }

    // Test tarifesi (yoksa olustur)
    const varOlanPlan = await prisma.tariffPlan.findFirst({ where: { name: "E2E Test Tarifesi" } });
    if (!varOlanPlan) {
      const plan = await prisma.tariffPlan.create({
        data: { name: "E2E Test Tarifesi", isActive: true, isDefault: true, priority: 100 },
      });
      await prisma.tariffVersion.create({
        data: {
          tariffPlanId: plan.id,
          versionNo: 1,
          effectiveFrom: new Date(Date.now() - 3600_000),
          isActive: true,
          changeNote: "E2E test tarifesi",
          rules: {
            create: [
              {
                vehicleClassId: null,
                firstPeriodMinutes: E2E_TARIFE.ilkBlokDakika,
                firstPeriodPrice: (E2E_TARIFE.ilkBlokUcretKurus / 100).toFixed(2),
                hourlyPrice: (E2E_TARIFE.saatlikUcretKurus / 100).toFixed(2),
                hourlyRoundingMinutes: 60,
                isActive: true,
              },
            ],
          },
        },
      });
    }

    // Kapasite tanimli degil: giris engellenmesin.
    await prisma.parkingCapacitySetting.upsert({
      where: { id: "singleton" },
      update: { totalCapacity: 0 },
      create: { id: "singleton", totalCapacity: 0 },
    });

    // Onceki testlerin birakmis oldugu E2E kayitlarini temizle.
    // Yalnizca "34Z" ile baslayan test plakalari silinir.
    await prisma.$executeRawUnsafe("SET session_replication_role = 'replica';");
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Payment" WHERE "parkingSessionId" IN (SELECT id FROM "ParkingSession" WHERE "plateNormalized" LIKE '34Z%')`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "ParkingSession" WHERE "plateNormalized" LIKE '34Z%'`,
    );
    await prisma.$executeRawUnsafe(`DELETE FROM "Vehicle" WHERE "plateNormalized" LIKE '34Z%'`);
    await prisma.$executeRawUnsafe("SET session_replication_role = 'origin';");

    // Acik vardiyalari kapat ki testler temiz baslayabilsin.
    await prisma.shift.updateMany({
      where: { status: "OPEN" },
      data: { status: "CLOSED", endedAt: new Date() },
    });

    // --- Onceden park edilmis arac ---
    // Ucret gosterimi ve tahsilat gercek bir tutarla test edilebilsin.
    const personel = await prisma.user.findUniqueOrThrow({ where: { username: E2E_KULLANICI } });
    const hazirlikVardiyasi = await prisma.shift.create({
      data: {
        userId: personel.id,
        status: "CLOSED",
        startedAt: new Date(Date.now() - 8 * 3600_000),
        endedAt: new Date(Date.now() - 1000),
        openingNote: "E2E hazırlık vardiyası",
      },
    });

    const girisAt = new Date(Date.now() - E2E_PARK_SURESI_DAKIKA * 60_000);
    const tarifeSurumu = await prisma.tariffVersion.findFirstOrThrow({
      where: { tariffPlan: { name: "E2E Test Tarifesi" } },
      include: { rules: true },
    });
    const kural = tarifeSurumu.rules[0]!;

    for (const plaka of Object.values(E2E_PARK_EDILMIS_PLAKALAR)) {
    const parkEdilmisArac = await prisma.vehicle.create({
      data: {
        plateNormalized: plaka,
        plateDisplay: plaka,
        vehicleClassId: sinif.id,
      },
    });

    await prisma.parkingSession.create({
      data: {
        code: `P-E2E-${plaka}-${Date.now().toString().slice(-4)}`,
        vehicleId: parkEdilmisArac.id,
        plateNormalized: plaka,
        plateDisplay: plaka,
        vehicleClassId: sinif.id,
        entryAt: girisAt,
        entryUserId: personel.id,
        entryShiftId: hazirlikVardiyasi.id,
        status: "ACTIVE",
        billingMode: "TARIFF",
        tariffVersionId: tarifeSurumu.id,
        tariffRuleId: kural.id,
        tariffSnapshot: {
          surum: 1,
          planId: tarifeSurumu.tariffPlanId,
          planAdi: "E2E Test Tarifesi",
          surumId: tarifeSurumu.id,
          surumNo: tarifeSurumu.versionNo,
          kuralId: kural.id,
          aracSinifiId: null,
          aracSinifiAdi: null,
          ucretsizDakika: 0,
          ucretsizDusulur: false,
          ilkBlokDakika: E2E_TARIFE.ilkBlokDakika,
          ilkBlokUcret: E2E_TARIFE.ilkBlokUcretKurus,
          saatlikUcret: E2E_TARIFE.saatlikUcretKurus,
          saatYuvarlamaDakika: 60,
          gunlukUcret: 0,
          gunlukUstLimit: 0,
          geceSabitUcret: null,
          geceBaslangicDakika: null,
          geceBitisDakika: null,
          haftaSonuKatsayisi: null,
          asgariUcret: 0,
        },
        idempotencyKey: `e2e-hazirlik-${plaka}-${Date.now()}`,
      },
    });
    }
  } finally {
    await prisma.$disconnect();
  }
}
