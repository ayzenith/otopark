/**
 * MUSTERI KAYITLARI VE ARAC BAGLAMA
 *
 * Kurallar (Asama 3):
 *   9.  Bir musteri birden fazla araca sahip olabilir.
 *   10. Bir arac zaman icinde farkli musterilere baglanabilir; GECMIS KAYITLAR
 *       BOZULMAZ.
 *
 * 10 NASIL GARANTI EDILIYOR:
 *   - Vehicle.customerId "su anki sahip"tir; degistiginde eski deger denetim
 *     kaydina (before/after) yazilir.
 *   - Gecmis park kayitlari (ParkingSession) arac VE plaka bilgisini kendi
 *     satirinda tasir; musteri degisince degismez.
 *   - Abonman baglari (SubscriptionVehicle) SILINMEZ; yalnizca removedAt
 *     doldurulur. Boylece "bu arac 2026 Mart'ta su musterinin abonmanindaydi"
 *     bilgisi kalicidir.
 *   - Abonman donemleri (SubscriptionPeriod) ve tahsilatlar hic dokunulmaz.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { formatPlate, isValidTurkishPlate, normalizePlate } from "@/lib/plate";
import type { SessionUser } from "@/server/auth/session";

export interface MusteriGirdisi {
  adSoyad: string;
  telefon: string;
  ikinciTelefon?: string | null;
  eposta?: string | null;
  kurumsalMi?: boolean;
  firmaAdi?: string | null;
  vergiNo?: string | null;
  notlar?: string | null;
}

/**
 * Telefonu karsilastirilabilir hale getirir: yalnizca rakamlar.
 * "0532 111 22 33", "+90 532 111 22 33" ve "532-111-2233" ayni musteriyi
 * bulabilsin diye aramada bu bicim kullanilir.
 */
export function normalizeTelefon(telefon: string): string {
  const rakamlar = telefon.replace(/\D/g, "");
  // Ulke kodu varsa dusurulur: 90 ile baslayan 12 haneli numara.
  if (rakamlar.length === 12 && rakamlar.startsWith("90")) return rakamlar.slice(2);
  if (rakamlar.length === 11 && rakamlar.startsWith("0")) return rakamlar.slice(1);
  return rakamlar;
}

function dogrulaMusteri(girdi: MusteriGirdisi): void {
  if (girdi.adSoyad.trim().length < 2) {
    throw new IslemHatasi("MUSTERI_AD", "Müşteri adı en az 2 karakter olmalıdır.");
  }
  const tel = normalizeTelefon(girdi.telefon);
  if (tel.length < 7) {
    throw new IslemHatasi(
      "MUSTERI_TELEFON",
      "Telefon numarası eksik görünüyor. Örnek: 0532 111 22 33",
    );
  }
  if (girdi.kurumsalMi && !girdi.firmaAdi?.trim()) {
    throw new IslemHatasi("MUSTERI_FIRMA", "Kurumsal müşteride firma adı zorunludur.");
  }
}

export async function musteriOlustur(actor: SessionUser, girdi: MusteriGirdisi) {
  dogrulaMusteri(girdi);

  const musteri = await prisma.$transaction(async (tx) => {
    const olusan = await tx.customer.create({
      data: {
        fullName: girdi.adSoyad.trim(),
        phone: girdi.telefon.trim(),
        altPhone: girdi.ikinciTelefon?.trim() || null,
        // Arama alanlari: gosterim bicimi degil, karsilastirilabilir bicim.
        phoneNormalized: normalizeTelefon(girdi.telefon),
        altPhoneNormalized: girdi.ikinciTelefon?.trim()
          ? normalizeTelefon(girdi.ikinciTelefon)
          : null,
        email: girdi.eposta?.trim() || null,
        isCompany: girdi.kurumsalMi ?? false,
        companyName: girdi.firmaAdi?.trim() || null,
        taxId: girdi.vergiNo?.trim() || null,
        notes: girdi.notlar?.trim() || null,
        createdById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.CUSTOMER_CREATE,
        entityType: "Customer",
        entityId: olusan.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: { adSoyad: olusan.fullName, telefon: olusan.phone, kurumsal: olusan.isCompany },
      },
      tx,
    );

    return olusan;
  });

  return musteri;
}

export async function musteriGuncelle(
  actor: SessionUser,
  musteriId: string,
  girdi: MusteriGirdisi & { aktifMi?: boolean },
) {
  dogrulaMusteri(girdi);

  const oncesi = await prisma.customer.findUnique({ where: { id: musteriId } });
  if (!oncesi) throw new IslemHatasi("MUSTERI_YOK", "Müşteri bulunamadı.");

  return prisma.$transaction(async (tx) => {
    const sonrasi = await tx.customer.update({
      where: { id: musteriId },
      data: {
        fullName: girdi.adSoyad.trim(),
        phone: girdi.telefon.trim(),
        altPhone: girdi.ikinciTelefon?.trim() || null,
        phoneNormalized: normalizeTelefon(girdi.telefon),
        altPhoneNormalized: girdi.ikinciTelefon?.trim()
          ? normalizeTelefon(girdi.ikinciTelefon)
          : null,
        email: girdi.eposta?.trim() || null,
        isCompany: girdi.kurumsalMi ?? false,
        companyName: girdi.firmaAdi?.trim() || null,
        taxId: girdi.vergiNo?.trim() || null,
        notes: girdi.notlar?.trim() || null,
        isActive: girdi.aktifMi ?? oncesi.isActive,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
        entityType: "Customer",
        entityId: musteriId,
        userId: actor.id,
        actorLabel: actor.username,
        before: {
          adSoyad: oncesi.fullName,
          telefon: oncesi.phone,
          eposta: oncesi.email,
          aktif: oncesi.isActive,
        },
        after: {
          adSoyad: sonrasi.fullName,
          telefon: sonrasi.phone,
          eposta: sonrasi.email,
          aktif: sonrasi.isActive,
        },
      },
      tx,
    );

    return sonrasi;
  });
}

// ---------------------------------------------------------------------------
// ARAC BAGLAMA
// ---------------------------------------------------------------------------

export interface AracBaglamaIstegi {
  musteriId: string;
  plaka: string;
  aracSinifiId?: string;
  markaModel?: string | null;
  renk?: string | null;
  /** Plaka bicimi gecersiz olsa da kaydedilsin mi (yabanci/gecici plaka)? */
  bicimiZorla?: boolean;
  /**
   * Arac baska bir musteriye bagliysa devralmayi ONAYLA.
   * Onay olmadan sessizce el degistirmez - "kimin araci" sorusu
   * kazayla degistirilmemelidir.
   */
  devralmayiOnayla?: boolean;
}

export async function musteriyeAracBagla(actor: SessionUser, istek: AracBaglamaIstegi) {
  const musteri = await prisma.customer.findUnique({ where: { id: istek.musteriId } });
  if (!musteri) throw new IslemHatasi("MUSTERI_YOK", "Müşteri bulunamadı.");

  const plateNormalized = normalizePlate(istek.plaka);
  if (plateNormalized.length < 4) {
    throw new IslemHatasi("PLAKA_GECERSIZ", "Plaka çok kısa. Örnek: 34 ABC 123");
  }
  if (!isValidTurkishPlate(plateNormalized) && !istek.bicimiZorla) {
    throw new IslemHatasi(
      "PLAKA_BICIMI",
      `"${formatPlate(plateNormalized)}" Türkiye plaka biçimine uymuyor. ` +
        "Yabancı veya geçici plaka ise yine de kaydedebilirsiniz.",
    );
  }

  const mevcut = await prisma.vehicle.findUnique({
    where: { plateNormalized },
    include: { customer: { select: { id: true, fullName: true } } },
  });

  if (mevcut?.customerId && mevcut.customerId !== istek.musteriId && !istek.devralmayiOnayla) {
    throw new IslemHatasi(
      "ARAC_BASKA_MUSTERIDE",
      `${formatPlate(plateNormalized)} şu anda "${mevcut.customer?.fullName}" ` +
        "müşterisine kayıtlı. Devretmek istediğinizi onaylayın; geçmiş kayıtlar korunur.",
    );
  }

  const sinifId = istek.aracSinifiId ?? mevcut?.vehicleClassId ?? (await varsayilanSinifId());

  return prisma.$transaction(async (tx) => {
    const arac = await tx.vehicle.upsert({
      where: { plateNormalized },
      update: {
        customerId: istek.musteriId,
        vehicleClassId: sinifId,
        brandModel: istek.markaModel?.trim() || mevcut?.brandModel || null,
        color: istek.renk?.trim() || mevcut?.color || null,
      },
      create: {
        plateNormalized,
        plateDisplay: formatPlate(plateNormalized),
        vehicleClassId: sinifId,
        customerId: istek.musteriId,
        brandModel: istek.markaModel?.trim() || null,
        color: istek.renk?.trim() || null,
        createdById: actor.id,
      },
      include: { vehicleClass: true },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.CUSTOMER_VEHICLE_LINK,
        entityType: "Vehicle",
        entityId: arac.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: mevcut
          ? { musteriId: mevcut.customerId, musteriAdi: mevcut.customer?.fullName ?? null }
          : null,
        after: { musteriId: istek.musteriId, musteriAdi: musteri.fullName, plaka: plateNormalized },
        note: mevcut?.customerId && mevcut.customerId !== istek.musteriId ? "Araç devredildi" : null,
      },
      tx,
    );

    return arac;
  });
}

/**
 * Araci musteriden ayirir.
 *
 * Arac kaydi SILINMEZ (park gecmisi ona bagli); yalnizca customerId bosaltilir.
 * Abonman baglari da silinmez - gecmis korunur.
 */
export async function musteridenAracCoz(actor: SessionUser, vehicleId: string) {
  const arac = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { customer: { select: { id: true, fullName: true } } },
  });
  if (!arac) throw new IslemHatasi("ARAC_YOK", "Araç bulunamadı.");
  if (!arac.customerId) return arac;

  const aktifBag = await prisma.subscriptionVehicle.findFirst({
    where: {
      vehicleId,
      removedAt: null,
      subscription: { status: "ACTIVE", endDate: { gte: new Date() } },
    },
    include: { subscription: { select: { code: true } } },
  });
  if (aktifBag) {
    throw new IslemHatasi(
      "ARAC_ABONMANDA",
      `Bu araç ${aktifBag.subscription.code} abonmanında aktif. ` +
        "Önce abonmandan çıkarın, sonra müşteriden ayırın.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const sonrasi = await tx.vehicle.update({
      where: { id: vehicleId },
      data: { customerId: null },
    });
    await writeAudit(
      {
        action: AUDIT_ACTIONS.CUSTOMER_VEHICLE_UNLINK,
        entityType: "Vehicle",
        entityId: vehicleId,
        userId: actor.id,
        actorLabel: actor.username,
        before: { musteriId: arac.customerId, musteriAdi: arac.customer?.fullName ?? null },
        after: { musteriId: null },
      },
      tx,
    );
    return sonrasi;
  });
}

async function varsayilanSinifId(): Promise<string> {
  const otomobil = await prisma.vehicleClass.findUnique({ where: { code: "OTOMOBIL" } });
  if (otomobil?.isActive) return otomobil.id;
  const ilk = await prisma.vehicleClass.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!ilk) {
    throw new IslemHatasi("ARAC_SINIFI_YOK", "Sistemde tanımlı araç sınıfı yok.");
  }
  return ilk.id;
}

// ---------------------------------------------------------------------------
// SORGULAR
// ---------------------------------------------------------------------------

/**
 * Musteri arama: ad, telefon veya PLAKA.
 *
 * Plakayla arama personel icin kritiktir: musteri adini bilmeden
 * "34 ABC 123 kimin?" sorusu yanitlanabilir.
 */
export async function musteriAra(sorgu: string, limit = 30) {
  const q = sorgu.trim();
  if (q.length === 0) {
    return prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      take: limit,
      include: { _count: { select: { vehicles: true, subscriptions: true } } },
    });
  }

  const telefon = normalizeTelefon(q);
  const plaka = normalizePlate(q);

  const kosullar: Prisma.CustomerWhereInput[] = [
    { fullName: { contains: q, mode: "insensitive" } },
    { companyName: { contains: q, mode: "insensitive" } },
  ];
  if (telefon.length >= 4) {
    // Normalize edilmis alanlarda aranir: "0532 111 22 33" kaydi
    // "5321112233", "+905321112233" ve "0532 111 22 33" yazimlarinin
    // hepsiyle bulunur.
    kosullar.push(
      { phoneNormalized: { contains: telefon } },
      { altPhoneNormalized: { contains: telefon } },
    );
  }
  if (plaka.length >= 3) {
    kosullar.push({ vehicles: { some: { plateNormalized: { contains: plaka } } } });
  }

  return prisma.customer.findMany({
    where: { OR: kosullar },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    take: limit,
    include: { _count: { select: { vehicles: true, subscriptions: true } } },
  });
}

/**
 * Musteri detayi: tum araclari ve HER ARACIN ABONMAN GECMISI.
 *
 * Abonman gecmisi bag kayitlarindan okunur (removedAt dolu olanlar dahil),
 * boylece araci artik abonmanda olmayan gecmis donemler de gorunur.
 */
export async function musteriDetay(musteriId: string) {
  const musteri = await prisma.customer.findUnique({
    where: { id: musteriId },
    include: {
      vehicles: {
        orderBy: { createdAt: "asc" },
        include: {
          vehicleClass: { select: { name: true } },
          subscriptionVehicles: {
            orderBy: { addedAt: "desc" },
            include: {
              subscription: {
                select: {
                  id: true,
                  code: true,
                  planLabel: true,
                  startDate: true,
                  endDate: true,
                  status: true,
                  paymentStatus: true,
                  agreedPrice: true,
                  customerId: true,
                  customer: { select: { fullName: true } },
                },
              },
            },
          },
          _count: { select: { parkingSessions: true } },
        },
      },
      subscriptions: {
        orderBy: { startDate: "desc" },
        include: {
          periods: { orderBy: { periodNo: "desc" } },
          vehicles: { include: { vehicle: { select: { plateDisplay: true } } } },
          _count: { select: { payments: true } },
        },
      },
    },
  });

  if (!musteri) throw new IslemHatasi("MUSTERI_YOK", "Müşteri bulunamadı.");
  return musteri;
}
