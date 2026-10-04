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

/**
 * ABONMAN FIXTURE PLAKALARI (proje basina ayri).
 *
 * aktif   : odemesi ALINMAMIS aktif abonman - S9 davranisini gosterir
 *           (gecerli sayilir, uyari cikar, giris engellenmez)
 * dolmus  : suresi dolmus abonman - "normal tarife uygulanacak" uyarisi
 * parkli  : aktif abonmanli VE su anda otoparkta olan arac - abonmanli
 *           cikis akisinin ucret hesaplamadan tamamlandigini gosterir
 *
 * Plakalar gecerli Turkiye bicimindedir (2 rakam + 3 harf + 2 rakam).
 */
export const E2E_ABONMAN_PLAKALARI: Record<string, { aktif: string; dolmus: string; parkli: string }> = {
  "telefon-kucuk": { aktif: "34ZAK01", dolmus: "34ZBK01", parkli: "34ZCK01" },
  "telefon-orta": { aktif: "34ZAO01", dolmus: "34ZBO01", parkli: "34ZCO01" },
  masaustu: { aktif: "34ZAM01", dolmus: "34ZBM01", parkli: "34ZCM01" },
};

/** Abonman fixture musteri adlari; temizlikte "E2E " oneki kullanilir. */
export const E2E_ABONMAN_MUSTERISI = "E2E Abonman Müşterisi";
export const E2E_DOLMUS_MUSTERISI = "E2E Süresi Dolmuş Müşteri";
export const E2E_ABONMAN_TELEFONU = "0532 100 20 30";

/** "34ZAK01" -> "34 ZAK 01" (uygulamanin plateDisplay bicimi). */
export function bicimlePlaka(plaka: string): string {
  const m = /^(\d{2})([A-Z]{1,3})(\d{2,5})$/.exec(plaka);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : plaka;
}

export function abonmanPlakalari(projeAdi: string) {
  const kayit = E2E_ABONMAN_PLAKALARI[projeAdi];
  if (!kayit) throw new Error(`Bu proje için abonman fixture tanımlı değil: ${projeAdi}`);
  return kayit;
}

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
    // Yalnizca "34Z" ile baslayan test plakalari ve "E2E " ile baslayan
    // musteriler silinir; gercek veri ASLA silinmez.
    //
    // TEK TRANSACTION icinde yapilir: session_replication_role baglanti
    // bazlidir ve Prisma havuzdan baska bir baglanti verirse sessizce
    // etkisiz kalir - o zaman finansal tablolardaki "silinemez"
    // tetikleyicisi devreye girer ve hazirlik coker.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';");

      // Abonman tahsilatlari ve abonman kayitlari
      await tx.$executeRawUnsafe(
        `DELETE FROM "SubscriptionPayment" WHERE "subscriptionId" IN
           (SELECT s.id FROM "Subscription" s JOIN "Customer" c ON c.id = s."customerId"
            WHERE c."fullName" LIKE 'E2E %')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Payment" WHERE "parkingSessionId" IN
           (SELECT id FROM "ParkingSession" WHERE "plateNormalized" LIKE '34Z%')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Payment" WHERE "sourceType" = 'SUBSCRIPTION' AND "id" NOT IN
           (SELECT "paymentId" FROM "SubscriptionPayment")`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "ParkingSession" WHERE "plateNormalized" LIKE '34Z%'`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "SubscriptionVehicle" WHERE "vehicleId" IN
           (SELECT id FROM "Vehicle" WHERE "plateNormalized" LIKE '34Z%')
         OR "subscriptionId" IN
           (SELECT s.id FROM "Subscription" s JOIN "Customer" c ON c.id = s."customerId"
            WHERE c."fullName" LIKE 'E2E %')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "SubscriptionPeriod" WHERE "subscriptionId" IN
           (SELECT s.id FROM "Subscription" s JOIN "Customer" c ON c.id = s."customerId"
            WHERE c."fullName" LIKE 'E2E %')`,
      );
      await tx.$executeRawUnsafe(
        `DELETE FROM "Subscription" WHERE "customerId" IN
           (SELECT id FROM "Customer" WHERE "fullName" LIKE 'E2E %')`,
      );
      await tx.$executeRawUnsafe(`DELETE FROM "Vehicle" WHERE "plateNormalized" LIKE '34Z%'`);
      await tx.$executeRawUnsafe(`DELETE FROM "Customer" WHERE "fullName" LIKE 'E2E %'`);
    });

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

    // ----------------------------------------------------------------------
    // ABONMAN FIXTURE'LARI
    // ----------------------------------------------------------------------
    // DIKKAT: Buradaki abonman ucreti YALNIZCA TEST verisidir; isletmenin
    // gercek abonman fiyati DEGILDIR. Sistemde genel abonman fiyati yoktur.
    const E2E_ABONMAN_UCRETI = "1234.00";

    const abonmanMusterisi = await prisma.customer.create({
      data: {
        fullName: E2E_ABONMAN_MUSTERISI,
        phone: E2E_ABONMAN_TELEFONU,
        phoneNormalized: "5321002030",
      },
    });
    const dolmusMusteri = await prisma.customer.create({
      data: {
        fullName: E2E_DOLMUS_MUSTERISI,
        phone: "0533 100 20 30",
        phoneNormalized: "5331002030",
      },
    });

    let abonmanSayaci = 0;
    async function abonmanKur(opts: {
      musteriId: string;
      plaka: string;
      baslangic: Date;
      bitis: Date;
      durum: "ACTIVE" | "EXPIRED";
      odemeDurumu: "UNPAID" | "PAID";
    }) {
      abonmanSayaci += 1;
      const arac = await prisma.vehicle.create({
        data: {
          plateNormalized: opts.plaka,
          // Uygulama plakayi bicimli yazar; fixture de ayni bicimi kullanir
          // ki ekrandaki gosterim gercek kullanimla ayni olsun.
          plateDisplay: bicimlePlaka(opts.plaka),
          vehicleClassId: sinif.id,
          customerId: opts.musteriId,
          brandModel: "Renault Clio",
          color: "Gri",
        },
      });
      const abonman = await prisma.subscription.create({
        data: {
          code: `A-E2E-${Date.now().toString().slice(-5)}-${abonmanSayaci}`,
          customerId: opts.musteriId,
          planLabel: "Aylık",
          startDate: opts.baslangic,
          endDate: opts.bitis,
          agreedPrice: E2E_ABONMAN_UCRETI,
          status: opts.durum,
          paymentStatus: opts.odemeDurumu,
          includedVehicleCount: 1,
          accessRuleKind: "UNLIMITED_7_24",
          periods: {
            create: {
              periodNo: 1,
              startDate: opts.baslangic,
              endDate: opts.bitis,
              price: E2E_ABONMAN_UCRETI,
              accessRuleKind: "UNLIMITED_7_24",
            },
          },
          vehicles: { create: { vehicleId: arac.id } },
        },
      });
      return { arac, abonman };
    }

    for (const projeAdi of Object.keys(E2E_ABONMAN_PLAKALARI)) {
      const p = E2E_ABONMAN_PLAKALARI[projeAdi]!;

      // Odemesi ALINMAMIS aktif abonman (S9).
      await abonmanKur({
        musteriId: abonmanMusterisi.id,
        plaka: p.aktif,
        baslangic: new Date(Date.now() - 10 * 86_400_000),
        bitis: new Date(Date.now() + 20 * 86_400_000),
        durum: "ACTIVE",
        odemeDurumu: "UNPAID",
      });

      // Suresi DOLMUS abonman: normal tarifeye dusmeli.
      await abonmanKur({
        musteriId: dolmusMusteri.id,
        plaka: p.dolmus,
        baslangic: new Date(Date.now() - 60 * 86_400_000),
        bitis: new Date(Date.now() - 5 * 86_400_000),
        durum: "EXPIRED",
        odemeDurumu: "PAID",
      });

      // Aktif abonmanli VE su anda otoparkta olan arac.
      const parkli = await abonmanKur({
        musteriId: abonmanMusterisi.id,
        plaka: p.parkli,
        baslangic: new Date(Date.now() - 10 * 86_400_000),
        bitis: new Date(Date.now() + 20 * 86_400_000),
        durum: "ACTIVE",
        odemeDurumu: "PAID",
      });
      await prisma.parkingSession.create({
        data: {
          code: `P-E2E-AB-${p.parkli}-${Date.now().toString().slice(-4)}`,
          vehicleId: parkli.arac.id,
          plateNormalized: p.parkli,
          plateDisplay: bicimlePlaka(p.parkli),
          vehicleClassId: sinif.id,
          entryAt: girisAt,
          entryUserId: personel.id,
          entryShiftId: hazirlikVardiyasi.id,
          status: "ACTIVE",
          // Giriste abonmanli: cikis UCRETSIZ tamamlanir (S10).
          billingMode: "SUBSCRIPTION",
          subscriptionId: parkli.abonman.id,
          idempotencyKey: `e2e-abonman-park-${p.parkli}-${Date.now()}`,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
