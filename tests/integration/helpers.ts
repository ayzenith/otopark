import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/server/auth/password";

export const prisma = new PrismaClient();

/** Testler arasinda veriyi temizler. Silme sirasi yabanci anahtarlara uyar. */
export async function temizle(): Promise<void> {
  // Tetikleyiciler DELETE'i engelleyen tablolar icin oturum bazli devre disi
  // birakma: test temizligi disinda ASLA kullanilmaz.
  await prisma.$executeRawUnsafe("SET session_replication_role = 'replica';");
  const tablolar = [
    "AuditLog", "LoginAttempt", "Session", "SubscriptionPayment", "Payment",
    "CashMovement", "InventoryMovement", "WashJobItem", "WashJob",
    "ParkingSession", "SubscriptionVehicle", "SubscriptionPeriod", "Subscription",
    "CashDrawerSession", "Shift", "Expense", "OtherIncome",
    "EmployeeProfile", "UserPermission", "Vehicle", "Customer",
    "TariffChangeLog", "TariffRule", "TariffVersion", "TariffPlan",
    "WashServicePriceVersion", "WashServiceCatalog", "InventoryItem",
    "SubscriptionType", "User",
  ];
  for (const t of tablolar) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`);
  }
  await prisma.$executeRawUnsafe("SET session_replication_role = 'origin';");
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
