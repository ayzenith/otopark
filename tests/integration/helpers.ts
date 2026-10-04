import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/server/auth/password";

export const prisma = new PrismaClient();

/**
 * Testler arasinda veriyi temizler.
 *
 * TRUNCATE kullanilir, DELETE DEGIL. Iki nedeni var:
 *   1. Finansal tablolarda DELETE'i engelleyen tetikleyiciler var
 *      (BEFORE DELETE). TRUNCATE satir tetikleyicisi calistirmaz, bu yuzden
 *      "session_replication_role" ile tetikleyici kapatma hilesine gerek
 *      kalmaz. O hile baglanti bazliydi ve Prisma havuzdan baska bir
 *      baglanti verdiginde sessizce etkisiz kaliyordu.
 *   2. Tek ifadede ve cok daha hizli calisir.
 *
 * CASCADE, listede olmayan bagimli tablolari da bosaltir; boylece yeni bir
 * tablo eklendiginde test temizligi sessizce eksik kalmaz.
 */
export async function temizle(): Promise<void> {
  const tablolar = [
    "AuditLog", "LoginAttempt", "Session", "SubscriptionPayment", "Payment",
    "CashMovement", "InventoryMovement", "WashJobItem", "WashJob",
    "ParkingSession", "SubscriptionVehicle", "SubscriptionPeriod", "Subscription",
    "CashDrawerSession", "Shift", "Expense", "OtherIncome",
    "EmployeeProfile", "UserPermission", "Vehicle", "Customer",
    "TariffChangeLog", "TariffRule", "TariffVersion", "TariffPlan",
    "WashServicePriceVersion", "WashServiceCatalog", "InventoryItem",
    "SubscriptionType", "User",
    // Arac siniflari da temizlenir: testler kendi siniflarini olusturur.
    // Aksi halde bir testte eklenen sinif (ornek: TICARI) sonraki kosuda
    // "kod zaten kullaniliyor" hatasi verir ve testler birbirini etkiler.
    "VehicleClass",
  ];
  const liste = tablolar.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE;`);
}

/** Test kullanicisi olusturur. */
export async function kullaniciOlustur(opts: {
  username: string;
  role?: "OWNER" | "MANAGER" | "STAFF";
  password?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}) {
  return prisma.user.create({
    data: {
      username: opts.username.toLowerCase(),
      passwordHash: await hashPassword(opts.password ?? "Kavun42Tepsi"),
      fullName: `Test ${opts.username}`,
      role: opts.role ?? "STAFF",
      isActive: opts.isActive ?? true,
      mustChangePassword: opts.mustChangePassword ?? false,
    },
  });
}

/** Arac sinifi (yoksa olusturur). */
export async function aracSinifiGetir(code = "OTOMOBIL") {
  return prisma.vehicleClass.upsert({
    where: { code },
    update: {},
    create: { code, name: code, sortOrder: 10 },
  });
}

/** Test araci olusturur. */
export async function aracOlustur(plateNormalized: string, vehicleClassId: string) {
  return prisma.vehicle.create({
    data: { plateNormalized, plateDisplay: plateNormalized, vehicleClassId },
  });
}

/** Acik vardiya olusturur. */
export async function vardiyaOlustur(userId: string) {
  return prisma.shift.create({ data: { userId, status: "OPEN" } });
}

// ---------------------------------------------------------------------------
// ASAMA 2 YARDIMCILARI
// ---------------------------------------------------------------------------

import { kurusToDecimalString } from "@/lib/money";
import { resolvePermissions, type RoleName } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/session";

/**
 * Servis fonksiyonlarina gecirilecek oturum nesnesi uretir.
 * Cerez katmani gerektirmez; is mantigi dogrudan test edilir.
 */
export function oturum(
  user: { id: string; username: string; fullName: string; role: string },
  ekIzinler: { permission: string; granted: boolean }[] = [],
): SessionUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as RoleName,
    jobTitle: null,
    mustChangePassword: false,
    permissions: resolvePermissions(user.role as RoleName, ekIzinler),
    sessionId: "test-oturum",
  };
}

/**
 * Test tarifesi olusturur.
 *
 * DIKKAT: Buradaki fiyatlar YALNIZCA TEST icindir; isletmenin gercek tarifesi
 * DEGILDIR ve hicbir yere isletme verisi olarak yazilmaz.
 */
export async function tarifeOlustur(opts: {
  ad?: string;
  ucretsizDakika?: number;
  ilkBlokDakika?: number;
  ilkBlokUcret?: number;
  saatlikUcret?: number;
  gunlukUcret?: number;
  gunlukUstLimit?: number;
  /** 24 saat sonrasi her baslayan 24 saatlik blok icin sabit ucret. */
  ekGunBlokUcret?: number;
  asgariUcret?: number;
  aracSinifiId?: string | null;
  gecerlilikBaslangici?: Date;
  oncelik?: number;
  varsayilan?: boolean;
} = {}) {
  const plan = await prisma.tariffPlan.create({
    data: {
      name: opts.ad ?? "Test Tarifesi",
      isActive: true,
      isDefault: opts.varsayilan ?? true,
      priority: opts.oncelik ?? 0,
    },
  });

  const surum = await prisma.tariffVersion.create({
    data: {
      tariffPlanId: plan.id,
      versionNo: 1,
      effectiveFrom: opts.gecerlilikBaslangici ?? new Date(Date.now() - 3600_000),
      isActive: true,
      changeNote: "Test tarifesi",
      rules: {
        create: [
          {
            vehicleClassId: opts.aracSinifiId ?? null,
            freeMinutes: opts.ucretsizDakika ?? 0,
            firstPeriodMinutes: opts.ilkBlokDakika ?? 0,
            firstPeriodPrice: kurusToDecimalString(opts.ilkBlokUcret ?? 0),
            hourlyPrice: kurusToDecimalString(opts.saatlikUcret ?? 0),
            hourlyRoundingMinutes: 60,
            dailyPrice: kurusToDecimalString(opts.gunlukUcret ?? 0),
            dailyCapPrice: kurusToDecimalString(opts.gunlukUstLimit ?? 0),
            extraDayBlockPrice: kurusToDecimalString(opts.ekGunBlokUcret ?? 0),
            minCharge: kurusToDecimalString(opts.asgariUcret ?? 0),
            isActive: true,
          },
        ],
      },
    },
    include: { rules: true },
  });

  return { plan, surum, kural: surum.rules[0]! };
}

/** Kapasite ayarini belirler. 0 = tanimli degil. */
export async function kapasiteAyarla(kapasite: number) {
  return prisma.parkingCapacitySetting.upsert({
    where: { id: "singleton" },
    update: { totalCapacity: kapasite },
    create: { id: "singleton", totalCapacity: kapasite },
  });
}

/** Test abonmani olusturur (Asama 3 oncesi, yalnizca cozumleme testi icin). */
export async function abonmanOlustur(opts: {
  plateNormalized: string;
  vehicleClassId: string;
  baslangic: Date;
  bitis: Date;
  ucretKurus: number;
  durum?: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
  odemeDurumu?: "UNPAID" | "PARTIAL" | "PAID";
  musteriAdi?: string;
}) {
  const musteri = await prisma.customer.create({
    data: {
      fullName: opts.musteriAdi ?? "Test Müşteri",
      phone: `555${Math.floor(Math.random() * 10_000_000)}`,
    },
  });

  const arac = await prisma.vehicle.upsert({
    where: { plateNormalized: opts.plateNormalized },
    update: { customerId: musteri.id },
    create: {
      plateNormalized: opts.plateNormalized,
      plateDisplay: opts.plateNormalized,
      vehicleClassId: opts.vehicleClassId,
      customerId: musteri.id,
    },
  });

  const abonman = await prisma.subscription.create({
    data: {
      code: `A-TEST-${Math.random().toString(36).slice(2, 8)}`,
      customerId: musteri.id,
      planLabel: "Aylık",
      startDate: opts.baslangic,
      endDate: opts.bitis,
      agreedPrice: kurusToDecimalString(opts.ucretKurus),
      status: opts.durum ?? "ACTIVE",
      paymentStatus: opts.odemeDurumu ?? "PAID",
      vehicles: { create: { vehicleId: arac.id } },
    },
  });

  return { musteri, arac, abonman };
}

// ---------------------------------------------------------------------------
// ASAMA 4 YARDIMCILARI (OTO YIKAMA)
// ---------------------------------------------------------------------------

/** Arac sinifi olusturur veya getirir. */
export async function sinifGetir(code: string, ad = code, tarifeDisi = false) {
  return prisma.vehicleClass.upsert({
    where: { code },
    update: {},
    create: { code, name: ad, sortOrder: 10, excludeFromStandardTariff: tarifeDisi },
  });
}

/**
 * Test yikama hizmeti ve fiyatlarini olusturur.
 *
 * DIKKAT: Buradaki fiyatlar YALNIZCA TEST icindir; isletmenin gercek yikama
 * fiyatlari DEGILDIR.
 */
export async function yikamaHizmetiKur(opts: {
  kod: string;
  ad?: string;
  tahminiDakika?: number;
  siraNo?: number;
  /** Arac sinifi id -> kurus. Verilmeyen sinif = fiyat tanimsiz. */
  sinifFiyatlari?: Record<string, number>;
  /** Tum siniflar icin genel fiyat (kurus). */
  genelFiyat?: number;
  gecerlilikBaslangici?: Date;
}) {
  const hizmet = await prisma.washServiceCatalog.upsert({
    where: { code: opts.kod },
    update: {},
    create: {
      code: opts.kod,
      name: opts.ad ?? opts.kod,
      estimatedMinutes: opts.tahminiDakika ?? null,
      sortOrder: opts.siraNo ?? 0,
    },
  });

  const baslangic = opts.gecerlilikBaslangici ?? new Date(Date.now() - 3600_000);

  if (opts.genelFiyat !== undefined) {
    await prisma.washServicePriceVersion.create({
      data: {
        washServiceId: hizmet.id,
        vehicleClassId: null,
        price: kurusToDecimalString(opts.genelFiyat),
        effectiveFrom: baslangic,
      },
    });
  }

  for (const [sinifId, ucret] of Object.entries(opts.sinifFiyatlari ?? {})) {
    await prisma.washServicePriceVersion.create({
      data: {
        washServiceId: hizmet.id,
        vehicleClassId: sinifId,
        price: kurusToDecimalString(ucret),
        effectiveFrom: baslangic,
      },
    });
  }

  return hizmet;
}
