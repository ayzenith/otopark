/**
 * VERITABANI BUTUNLUK GARANTILERI
 *
 * Bu testler uygulama kodunu degil, VERITABANININ KENDISINI dogrular. Cunku
 * uygulama kontrolu yaris kosulunda yetersizdir: iki personel ayni anda ayni
 * islemi yaparsa yalnizca veritabani kisiti dogru sonucu garanti eder.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  aracOlustur,
  aracSinifiGetir,
  kullaniciOlustur,
  prisma,
  temizle,
  vardiyaOlustur,
} from "./helpers";

let sinifId: string;
let userId: string;
let shiftId: string;

beforeEach(async () => {
  await temizle();
  const sinif = await aracSinifiGetir();
  sinifId = sinif.id;
  const user = await kullaniciOlustur({ username: "personel1" });
  userId = user.id;
  const shift = await vardiyaOlustur(userId);
  shiftId = shift.id;
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

async function parkKaydiOlustur(plaka: string, ek: Record<string, unknown> = {}) {
  const arac = await prisma.vehicle.findUnique({ where: { plateNormalized: plaka } });
  const aracId = arac?.id ?? (await aracOlustur(plaka, sinifId)).id;
  return prisma.parkingSession.create({
    data: {
      code: `P-TEST-${Math.random().toString(36).slice(2, 10)}`,
      vehicleId: aracId,
      plateNormalized: plaka,
      plateDisplay: plaka,
      vehicleClassId: sinifId,
      entryAt: new Date(),
      entryUserId: userId,
      entryShiftId: shiftId,
      idempotencyKey: `test-${Math.random().toString(36).slice(2)}`,
      ...ek,
    },
  });
}

describe("mükerrer aktif giriş engeli (kısmi tekil indeks)", () => {
  it("aynı plakadan ikinci AKTİF giriş veritabanı seviyesinde reddedilir", async () => {
    await parkKaydiOlustur("34ABC123");
    // Uygulama kontrolünü atlayıp doğrudan veritabanına yazmaya çalışıyoruz:
    // kısıt gerçekten veritabanında olmalı.
    await expect(parkKaydiOlustur("34ABC123")).rejects.toThrow();
  });

  it("araç çıkış yaptıktan sonra aynı plaka tekrar giriş yapabilir", async () => {
    const birinci = await parkKaydiOlustur("34ABC123");
    await prisma.parkingSession.update({
      where: { id: birinci.id },
      data: {
        status: "COMPLETED",
        exitAt: new Date(),
        exitUserId: userId,
        payableAmount: "0.00",
      },
    });
    // Artık ikinci giriş serbest.
    const ikinci = await parkKaydiOlustur("34ABC123");
    expect(ikinci.status).toBe("ACTIVE");
  });

  it("iptal edilmiş (VOIDED) kayıt yeni girişi engellemez", async () => {
    const birinci = await parkKaydiOlustur("34ABC123");
    await prisma.parkingSession.update({
      where: { id: birinci.id },
      data: { status: "VOIDED", voidedAt: new Date(), voidReason: "Hatalı giriş" },
    });
    const ikinci = await parkKaydiOlustur("34ABC123");
    expect(ikinci.status).toBe("ACTIVE");
  });

  it("farklı plakalar birbirini etkilemez", async () => {
    await parkKaydiOlustur("34ABC123");
    await parkKaydiOlustur("06XYZ456");
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(2);
  });

  it("EŞZAMANLI iki giriş denemesinde yalnızca biri başarılı olur", async () => {
    // Yarış koşulu: iki personel aynı anda aynı plakayı giriyor.
    const sonuclar = await Promise.allSettled([
      parkKaydiOlustur("35EST999"),
      parkKaydiOlustur("35EST999"),
    ]);
    const basarili = sonuclar.filter((s) => s.status === "fulfilled");
    expect(basarili).toHaveLength(1);
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(1);
  });
});

describe("finansal kayıtlar silinemez (tetikleyici)", () => {
  it("ödeme kaydı silinemez", async () => {
    const park = await parkKaydiOlustur("34SIL111");
    const odeme = await prisma.payment.create({
      data: {
        code: "T-TEST-0001",
        amount: "185.00",
        method: "CASH",
        sourceType: "PARKING",
        parkingSessionId: park.id,
        shiftId,
        collectedById: userId,
        idempotencyKey: "odeme-test-1",
      },
    });

    await expect(prisma.payment.delete({ where: { id: odeme.id } })).rejects.toThrow(
      /silinemez/i,
    );
    // Kayıt yerinde duruyor.
    expect(await prisma.payment.count()).toBe(1);
  });

  it("ödeme kaydı VOIDED yapılabilir (doğru iptal yolu)", async () => {
    const park = await parkKaydiOlustur("34SIL222");
    const odeme = await prisma.payment.create({
      data: {
        code: "T-TEST-0002",
        amount: "185.00",
        method: "CASH",
        sourceType: "PARKING",
        parkingSessionId: park.id,
        shiftId,
        collectedById: userId,
        idempotencyKey: "odeme-test-2",
      },
    });

    const iptal = await prisma.payment.update({
      where: { id: odeme.id },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: "Yanlış tutar girildi",
      },
    });
    expect(iptal.status).toBe("VOIDED");
    expect(iptal.voidReason).toBe("Yanlış tutar girildi");
  });

  it("park kaydı silinemez", async () => {
    const park = await parkKaydiOlustur("34SIL333");
    await expect(prisma.parkingSession.delete({ where: { id: park.id } })).rejects.toThrow(
      /silinemez/i,
    );
  });

  it("gider kaydı silinemez", async () => {
    const kategori = await prisma.expenseCategory.upsert({
      where: { code: "TEST_GIDER" },
      update: {},
      create: { code: "TEST_GIDER", name: "Test gideri" },
    });
    const gider = await prisma.expense.create({
      data: {
        code: "G-TEST-0001",
        expenseCategoryId: kategori.id,
        amount: "500.00",
        expenseDate: new Date(),
        description: "Test",
      },
    });
    await expect(prisma.expense.delete({ where: { id: gider.id } })).rejects.toThrow(
      /silinemez/i,
    );
  });
});

describe("denetim kayıtları değiştirilemez (append-only)", () => {
  it("denetim kaydı güncellenemez", async () => {
    const kayit = await prisma.auditLog.create({
      data: { action: "TEST", entityType: "Test", actorLabel: "test" },
    });
    await expect(
      prisma.auditLog.update({ where: { id: kayit.id }, data: { note: "değiştirildi" } }),
    ).rejects.toThrow(/değiştirilemez|degistirilemez/i);
  });

  it("denetim kaydı silinemez", async () => {
    const kayit = await prisma.auditLog.create({
      data: { action: "TEST", entityType: "Test", actorLabel: "test" },
    });
    await expect(prisma.auditLog.delete({ where: { id: kayit.id } })).rejects.toThrow(
      /değiştirilemez|degistirilemez|silinemez/i,
    );
  });
});

describe("idempotency anahtarı (çift kayıt engeli)", () => {
  it("aynı anahtarla ikinci park kaydı oluşmaz", async () => {
    const arac = await aracOlustur("34IDM123", sinifId);
    const veri = {
      code: "P-IDM-0001",
      vehicleId: arac.id,
      plateNormalized: "34IDM123",
      plateDisplay: "34IDM123",
      vehicleClassId: sinifId,
      entryAt: new Date(),
      entryUserId: userId,
      entryShiftId: shiftId,
      idempotencyKey: "ayni-anahtar",
    };
    await prisma.parkingSession.create({ data: veri });
    // Yavaş hatta personel butona iki kez bastı: ikinci istek reddedilir.
    await expect(
      prisma.parkingSession.create({ data: { ...veri, code: "P-IDM-0002" } }),
    ).rejects.toThrow();
  });

  it("aynı anahtarla ikinci ödeme oluşmaz", async () => {
    const park = await parkKaydiOlustur("34IDM999");
    const veri = {
      code: "T-IDM-0001",
      amount: "100.00",
      method: "CASH" as const,
      sourceType: "PARKING" as const,
      parkingSessionId: park.id,
      shiftId,
      collectedById: userId,
      idempotencyKey: "odeme-ayni-anahtar",
    };
    await prisma.payment.create({ data: veri });
    await expect(
      prisma.payment.create({ data: { ...veri, code: "T-IDM-0002" } }),
    ).rejects.toThrow();
    expect(await prisma.payment.count()).toBe(1);
  });
});

describe("veri tutarlılığı kısıtları", () => {
  it("çıkış saati girişten önce olamaz", async () => {
    const park = await parkKaydiOlustur("34TUT111");
    await expect(
      prisma.parkingSession.update({
        where: { id: park.id },
        data: { exitAt: new Date(park.entryAt.getTime() - 60000) },
      }),
    ).rejects.toThrow();
  });

  it("tamamlanmış park kaydı çıkış bilgisi olmadan kaydedilemez", async () => {
    const park = await parkKaydiOlustur("34TUT222");
    await expect(
      prisma.parkingSession.update({
        where: { id: park.id },
        data: { status: "COMPLETED" }, // exitAt, exitUserId, payableAmount yok
      }),
    ).rejects.toThrow();
  });

  it("negatif ödeme tutarı kaydedilemez", async () => {
    const park = await parkKaydiOlustur("34TUT333");
    await expect(
      prisma.payment.create({
        data: {
          code: "T-NEG-0001",
          amount: "-100.00",
          method: "CASH",
          sourceType: "PARKING",
          parkingSessionId: park.id,
          shiftId,
          collectedById: userId,
          idempotencyKey: "negatif",
        },
      }),
    ).rejects.toThrow();
  });

  it("abonman bitiş tarihi başlangıçtan önce olamaz", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "Test Müşteri", phone: "5550000000" },
    });
    await expect(
      prisma.subscription.create({
        data: {
          code: "A-TEST-0001",
          customerId: musteri.id,
          planLabel: "Aylık",
          startDate: new Date("2026-10-31"),
          endDate: new Date("2026-10-01"),
          agreedPrice: "3000.00",
        },
      }),
    ).rejects.toThrow();
  });

  it("bir araç aynı anda iki abonmana bağlanamaz", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "Test Müşteri", phone: "5550000001" },
    });
    const arac = await aracOlustur("34ABN123", sinifId);

    const abonman1 = await prisma.subscription.create({
      data: {
        code: "A-TEST-0010",
        customerId: musteri.id,
        planLabel: "Aylık",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-31"),
        agreedPrice: "3000.00",
      },
    });
    const abonman2 = await prisma.subscription.create({
      data: {
        code: "A-TEST-0011",
        customerId: musteri.id,
        planLabel: "Aylık",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-31"),
        agreedPrice: "4000.00",
      },
    });

    await prisma.subscriptionVehicle.create({
      data: { subscriptionId: abonman1.id, vehicleId: arac.id },
    });
    await expect(
      prisma.subscriptionVehicle.create({
        data: { subscriptionId: abonman2.id, vehicleId: arac.id },
      }),
    ).rejects.toThrow();
  });

  it("abonmandan çıkarılan araç yeni abonmana bağlanabilir", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "Test Müşteri", phone: "5550000002" },
    });
    const arac = await aracOlustur("34ABN456", sinifId);
    const a1 = await prisma.subscription.create({
      data: {
        code: "A-TEST-0020",
        customerId: musteri.id,
        planLabel: "Aylık",
        startDate: new Date("2026-09-01"),
        endDate: new Date("2026-09-30"),
        agreedPrice: "3000.00",
      },
    });
    const sv = await prisma.subscriptionVehicle.create({
      data: { subscriptionId: a1.id, vehicleId: arac.id },
    });
    // Abonman bitti: araç bağlantısı damgalanır.
    await prisma.subscriptionVehicle.update({
      where: { id: sv.id },
      data: { removedAt: new Date() },
    });

    const a2 = await prisma.subscription.create({
      data: {
        code: "A-TEST-0021",
        customerId: musteri.id,
        planLabel: "Aylık",
        startDate: new Date("2026-10-01"),
        endDate: new Date("2026-10-31"),
        agreedPrice: "3500.00",
      },
    });
    const yeni = await prisma.subscriptionVehicle.create({
      data: { subscriptionId: a2.id, vehicleId: arac.id },
    });
    expect(yeni.removedAt).toBeNull();
  });

  it("ayar tabloları tek satır kabul eder", async () => {
    await expect(
      prisma.businessSetting.create({ data: { id: "ikinci-satir" } }),
    ).rejects.toThrow();
  });
});

describe("para alanlarının hassasiyeti", () => {
  it("Decimal(12,2) kuruş hassasiyetini korur", async () => {
    const park = await parkKaydiOlustur("34PRA111");
    const odeme = await prisma.payment.create({
      data: {
        code: "T-PRA-0001",
        amount: "185.55",
        method: "CASH",
        sourceType: "PARKING",
        parkingSessionId: park.id,
        shiftId,
        collectedById: userId,
        idempotencyKey: "hassasiyet-1",
      },
    });
    expect(odeme.amount.toString()).toBe("185.55");
  });

  it("çok sayıda küçük tutarın toplamı kayma yapmaz", async () => {
    const park = await parkKaydiOlustur("34PRA222");
    for (let i = 0; i < 100; i++) {
      await prisma.payment.create({
        data: {
          code: `T-TOP-${String(i).padStart(4, "0")}`,
          amount: "0.07",
          method: "CASH",
          sourceType: "PARKING",
          parkingSessionId: park.id,
          shiftId,
          collectedById: userId,
          idempotencyKey: `toplam-${i}`,
        },
      });
    }
    const toplam = await prisma.payment.aggregate({ _sum: { amount: true } });
    // 100 x 0,07 = tam 7,00 TL olmalı.
    expect(toplam._sum.amount?.toString()).toBe("7");
  });
});
