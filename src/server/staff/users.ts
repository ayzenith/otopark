/**
 * PERSONEL YÖNETİMİ (patron)
 *
 * ============================================================================
 * KARAR (05.10.2026): GERÇEK PERSONEL ADLARI TOHUM VERİSİNE YAZILMAZ.
 * Hesaplar buradan — patron panelinden — açılır. `prisma/seed.ts` yalnızca tek
 * bir patron hesabı üretir; test personeli ayrı fixture'dadır.
 *
 * ROLLER: şu anda yalnızca OWNER ve STAFF kullanılıyor. MANAGER enum'da ve
 * izin matrisinde duruyor ama bu modülden ATANMAZ (`SECILEBILIR_ROLLER`).
 * İleride tek satırla açılabilir.
 *
 * KASA KAPATMA: patron + `cash.drawer.close` izni KULLANICI BAZINDA verilen
 * personel. İzin STAFF taban kümesinde yoktur; buradan verilir.
 *
 * HESAP SİLİNMEZ: işten ayrılan personelin hesabı pasifleştirilir. Silinirse
 * onun yaptığı tahsilatlar, vardiyalar ve denetim kayıtları sahipsiz kalır.
 * ============================================================================
 */

import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import {
  checkPasswordStrength,
  generateSecurePassword,
  hashPassword,
} from "@/server/auth/password";
import {
  ALL_PERMISSIONS,
  basePermissionsForRole,
  resolvePermissions,
  type Permission,
  type RoleName,
} from "@/lib/permissions";
import { destroyAllSessionsForUser } from "@/server/auth/session";
import type { SessionUser } from "@/server/auth/session";

/**
 * Arayüzden ATANABİLİR roller.
 *
 * MANAGER kasıtlı olarak YOK (karar 05.10.2026): işletme şimdilik yalnızca
 * patron + personel ile çalışıyor. Rol altyapıda duruyor; burayı tek satır
 * uzatmak onu açmaya yeter.
 */
export const SECILEBILIR_ROLLER: RoleName[] = ["OWNER", "STAFF"];

export function rolSecilebilirMi(rol: string): rol is RoleName {
  return (SECILEBILIR_ROLLER as string[]).includes(rol);
}

/** Kullanıcı adı kuralı: harf/rakam/alt çizgi, 3–32 karakter, küçük harf. */
export function kullaniciAdiNormalize(ad: string): string {
  return ad
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (h) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[h]!);
}

function dogrulaKullaniciAdi(ad: string): string {
  const normal = kullaniciAdiNormalize(ad);
  if (!/^[a-z0-9_]{3,32}$/.test(normal)) {
    throw new IslemHatasi(
      "GECERSIZ_KULLANICI_ADI",
      "Kullanıcı adı 3–32 karakter olmalı; yalnızca harf, rakam ve alt çizgi kullanılabilir. " +
        "Türkçe karakterler otomatik çevrilir (ör. \"şükrü\" → \"sukru\").",
    );
  }
  return normal;
}

// ---------------------------------------------------------------------------
// LİSTE
// ---------------------------------------------------------------------------

export interface PersonelSatiri {
  id: string;
  kullaniciAdi: string;
  adSoyad: string;
  rol: RoleName;
  gorevUnvani: string | null;
  telefon: string | null;
  aktif: boolean;
  parolaDegistirmeli: boolean;
  sonGirisAt: Date | null;
  kilitliMi: boolean;
  /** Role ek olarak verilen / kaldırılan izin sayısı. */
  izinSapmasi: number;
  /** Açık avans borcu (kuruş). */
  acikAvansKurus: number;
  /** Maliyet alanları: YALNIZCA personnel.cost.view olanda dolu. */
  maliyet: { maasKurus: number | null; sgkKurus: number | null; yemekKurus: number | null } | null;
  iseGirisAt: Date | null;
}

/**
 * Personel listesi.
 *
 * MALİYET ALANLARI İZNE BAĞLIDIR ve izin yoksa SORGULANMAZ (null döndürmek
 * yerine hiç select edilmez) — authz.ts'teki alan bazlı kısıtlama kuralı.
 */
export async function personelListesi(
  actor: SessionUser,
  opts: { pasifleriDeGoster?: boolean } = {},
): Promise<PersonelSatiri[]> {
  const maliyetGorebilir = actor.permissions.has("personnel.cost.view");

  const kullanicilar = await prisma.user.findMany({
    where: opts.pasifleriDeGoster ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      jobTitle: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lockedUntil: true,
      _count: { select: { permissions: true } },
      // Maas/SGK/yemek YALNIZCA izinliyse select edilir.
      employeeProfile: maliyetGorebilir
        ? { select: { monthlySalary: true, insuranceCost: true, mealAllowance: true, hireDate: true } }
        : { select: { hireDate: true } },
    },
  });

  const avanslar = await prisma.staffAdvance.groupBy({
    by: ["userId"],
    where: { status: "OPEN" },
    _sum: { amount: true },
  });
  const avansHarita = new Map(
    avanslar.map((a) => [a.userId, Number(a._sum.amount?.toString() ?? "0") * 100]),
  );

  const simdi = Date.now();

  return kullanicilar.map((k) => {
    const profil = k.employeeProfile as
      | {
          hireDate: Date | null;
          monthlySalary?: Prisma.Decimal | null;
          insuranceCost?: Prisma.Decimal | null;
          mealAllowance?: Prisma.Decimal | null;
        }
      | null;

    return {
      id: k.id,
      kullaniciAdi: k.username,
      adSoyad: k.fullName,
      rol: k.role as RoleName,
      gorevUnvani: k.jobTitle,
      telefon: k.phone,
      aktif: k.isActive,
      parolaDegistirmeli: k.mustChangePassword,
      sonGirisAt: k.lastLoginAt,
      kilitliMi: k.lockedUntil !== null && k.lockedUntil.getTime() > simdi,
      izinSapmasi: k._count.permissions,
      acikAvansKurus: Math.round(avansHarita.get(k.id) ?? 0),
      maliyet: maliyetGorebilir
        ? {
            maasKurus: kurusVeyaNull(profil?.monthlySalary),
            sgkKurus: kurusVeyaNull(profil?.insuranceCost),
            yemekKurus: kurusVeyaNull(profil?.mealAllowance),
          }
        : null,
      iseGirisAt: profil?.hireDate ?? null,
    };
  });
}

function kurusVeyaNull(deger: Prisma.Decimal | null | undefined): number | null {
  if (deger === null || deger === undefined) return null;
  return Math.round(Number(deger.toString()) * 100);
}

// ---------------------------------------------------------------------------
// HESAP OLUŞTUR
// ---------------------------------------------------------------------------

export interface PersonelOlusturIstegi {
  kullaniciAdi: string;
  adSoyad: string;
  rol: RoleName;
  gorevUnvani?: string | null;
  telefon?: string | null;
  /**
   * Başlangıç parolası. Verilmezse GÜVENLİ RASTGELE üretilir ve sonuçta
   * bir kez döndürülür — sistemde açık metin olarak SAKLANMAZ.
   */
  baslangicParolasi?: string | null;
}

export interface PersonelOlusturSonucu {
  userId: string;
  kullaniciAdi: string;
  /**
   * Patrona BİR KEZ gösterilecek başlangıç parolası.
   * Veritabanında yalnızca Argon2id özeti durur; bu değer bir daha okunamaz.
   */
  baslangicParolasi: string;
  uretildiMi: boolean;
}

export async function personelOlustur(
  actor: SessionUser,
  istek: PersonelOlusturIstegi,
): Promise<PersonelOlusturSonucu> {
  const kullaniciAdi = dogrulaKullaniciAdi(istek.kullaniciAdi);
  const adSoyad = istek.adSoyad.trim();

  if (adSoyad.length < 3) {
    throw new IslemHatasi("GECERSIZ_AD", "Ad soyad en az 3 karakter olmalıdır.");
  }
  if (!rolSecilebilirMi(istek.rol)) {
    // MANAGER buraya düşer: altyapıda var ama atanamaz.
    throw new IslemHatasi(
      "ROL_SECILEMEZ",
      "Şu anda yalnızca Patron ve Personel rolleri atanabilir (karar 05.10.2026).",
    );
  }

  const mevcut = await prisma.user.findUnique({ where: { username: kullaniciAdi } });
  if (mevcut) {
    throw new IslemHatasi(
      "KULLANICI_VAR",
      `"${kullaniciAdi}" kullanıcı adı alınmış.${
        mevcut.isActive ? "" : " (Hesap kullanım dışı — yeniden etkinleştirebilirsiniz.)"
      }`,
    );
  }

  // Parola: verilmediyse güvenli rastgele üret.
  const uretildiMi = !istek.baslangicParolasi?.trim();
  const parola = uretildiMi
    ? generateSecurePassword(16)
    : istek.baslangicParolasi!.trim();

  if (!uretildiMi) {
    const guc = checkPasswordStrength(parola);
    if (!guc.ok) {
      throw new IslemHatasi("PAROLA_ZAYIF", guc.errors.join(" "));
    }
  }

  const kullanici = await prisma.user.create({
    data: {
      username: kullaniciAdi,
      passwordHash: await hashPassword(parola),
      fullName: adSoyad,
      role: istek.rol as Role,
      jobTitle: istek.gorevUnvani?.trim() || null,
      phone: istek.telefon?.trim() || null,
      isActive: true,
      // İlk girişte parola değiştirme ZORUNLU: patronun bildiği parola
      // personelin kalıcı parolası olmamalı.
      mustChangePassword: true,
      createdById: actor.id,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.USER_CREATE,
    entityType: "User",
    entityId: kullanici.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: {
      kullaniciAdi: kullanici.username,
      adSoyad: kullanici.fullName,
      rol: kullanici.role,
      gorevUnvani: kullanici.jobTitle,
      parolaUretildiMi: uretildiMi,
    },
    note: "Personel hesabı oluşturuldu",
  });

  return {
    userId: kullanici.id,
    kullaniciAdi: kullanici.username,
    baslangicParolasi: parola,
    uretildiMi,
  };
}

// ---------------------------------------------------------------------------
// GÜNCELLE / DURUM / PAROLA
// ---------------------------------------------------------------------------

export async function personelGuncelle(
  actor: SessionUser,
  istek: {
    userId: string;
    adSoyad?: string;
    gorevUnvani?: string | null;
    telefon?: string | null;
    rol?: RoleName;
  },
) {
  const onceki = await prisma.user.findUnique({ where: { id: istek.userId } });
  if (!onceki) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  if (istek.adSoyad !== undefined && istek.adSoyad.trim().length < 3) {
    throw new IslemHatasi("GECERSIZ_AD", "Ad soyad en az 3 karakter olmalıdır.");
  }
  if (istek.rol !== undefined && !rolSecilebilirMi(istek.rol)) {
    throw new IslemHatasi(
      "ROL_SECILEMEZ",
      "Şu anda yalnızca Patron ve Personel rolleri atanabilir (karar 05.10.2026).",
    );
  }
  // Patron kendi rolünü düşürüp sistemde patronsuz kalmamalı.
  if (istek.rol !== undefined && istek.rol !== "OWNER" && onceki.role === "OWNER") {
    await sonPatronMu(onceki.id);
  }

  const kullanici = await prisma.user.update({
    where: { id: istek.userId },
    data: {
      ...(istek.adSoyad !== undefined ? { fullName: istek.adSoyad.trim() } : {}),
      ...(istek.gorevUnvani !== undefined
        ? { jobTitle: istek.gorevUnvani?.trim() || null }
        : {}),
      ...(istek.telefon !== undefined ? { phone: istek.telefon?.trim() || null } : {}),
      ...(istek.rol !== undefined ? { role: istek.rol as Role } : {}),
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.USER_UPDATE,
    entityType: "User",
    entityId: kullanici.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { adSoyad: onceki.fullName, rol: onceki.role, gorevUnvani: onceki.jobTitle },
    after: { adSoyad: kullanici.fullName, rol: kullanici.role, gorevUnvani: kullanici.jobTitle },
    note: "Personel bilgileri güncellendi",
  });

  return kullanici;
}

/** Sistemde başka aktif patron var mı? Yoksa hata fırlatır. */
async function sonPatronMu(userId: string): Promise<void> {
  const digerPatron = await prisma.user.count({
    where: { role: "OWNER", isActive: true, id: { not: userId } },
  });
  if (digerPatron === 0) {
    throw new IslemHatasi(
      "SON_PATRON",
      "Sistemdeki tek işletme sahibi hesabı bu. Rolünü düşürmek veya hesabı kapatmak " +
        "sistemi yönetilemez hale getirir. Önce başka bir patron hesabı oluşturun.",
    );
  }
}

/**
 * Hesabı kullanım dışına alır / geri açar. SİLMEZ.
 *
 * Pasifleştirmede AÇIK OTURUMLAR DA İPTAL EDİLİR: aksi halde işten çıkan
 * personel tarayıcısı açık kaldığı sürece işlem yapmaya devam eder.
 */
export async function personelDurum(
  actor: SessionUser,
  istek: { userId: string; aktif: boolean; sebep?: string | null },
) {
  const onceki = await prisma.user.findUnique({ where: { id: istek.userId } });
  if (!onceki) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");
  if (onceki.isActive === istek.aktif) {
    throw new IslemHatasi(
      "DURUM_AYNI",
      istek.aktif ? "Hesap zaten etkin." : "Hesap zaten kullanım dışı.",
    );
  }
  if (!istek.aktif) {
    if (onceki.id === actor.id) {
      throw new IslemHatasi("KENDINI_KAPATMA", "Kendi hesabınızı kapatamazsınız.");
    }
    if (onceki.role === "OWNER") await sonPatronMu(onceki.id);
  }

  const kullanici = await prisma.user.update({
    where: { id: istek.userId },
    data: {
      isActive: istek.aktif,
      deactivatedAt: istek.aktif ? null : new Date(),
      deactivatedById: istek.aktif ? null : actor.id,
      // Yeniden açılan hesapta kilit ve başarısız giriş sayacı sıfırlanır.
      ...(istek.aktif ? { lockedUntil: null, failedLoginCount: 0 } : {}),
    },
  });

  // Pasifleştirmede açık oturumları kapat.
  const iptalEdilenOturum = istek.aktif ? 0 : await destroyAllSessionsForUser(istek.userId);

  await writeAudit({
    action: istek.aktif ? AUDIT_ACTIONS.USER_REACTIVATE : AUDIT_ACTIONS.USER_DEACTIVATE,
    entityType: "User",
    entityId: kullanici.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { aktif: onceki.isActive },
    after: { aktif: kullanici.isActive, iptalEdilenOturum },
    note: istek.sebep?.trim() || (istek.aktif ? "Hesap yeniden açıldı" : "Hesap kapatıldı"),
  });

  return { kullanici, iptalEdilenOturum };
}

/**
 * Parolayı sıfırlar ve yeni parolayı BİR KEZ döndürür.
 *
 * Açık oturumlar iptal edilir ve ilk girişte parola değiştirme zorunlu olur.
 */
export async function parolaSifirla(
  actor: SessionUser,
  istek: { userId: string; yeniParola?: string | null },
): Promise<{ kullaniciAdi: string; parola: string; uretildiMi: boolean }> {
  const kullanici = await prisma.user.findUnique({ where: { id: istek.userId } });
  if (!kullanici) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  const uretildiMi = !istek.yeniParola?.trim();
  const parola = uretildiMi ? generateSecurePassword(16) : istek.yeniParola!.trim();

  if (!uretildiMi) {
    const guc = checkPasswordStrength(parola);
    if (!guc.ok) throw new IslemHatasi("PAROLA_ZAYIF", guc.errors.join(" "));
  }

  await prisma.user.update({
    where: { id: istek.userId },
    data: {
      passwordHash: await hashPassword(parola),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const iptalEdilenOturum = await destroyAllSessionsForUser(istek.userId);

  await writeAudit({
    action: AUDIT_ACTIONS.PASSWORD_RESET,
    entityType: "User",
    entityId: kullanici.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: { hedef: kullanici.username, iptalEdilenOturum, parolaUretildiMi: uretildiMi },
    note: "Parola patron tarafından sıfırlandı",
  });

  return { kullaniciAdi: kullanici.username, parola, uretildiMi };
}

// ---------------------------------------------------------------------------
// İZİNLER
// ---------------------------------------------------------------------------

export interface IzinSatiri {
  izin: Permission;
  /** Rolün taban kümesinde var mı? */
  tabanda: boolean;
  /** Kullanıcıya özel ekleme/kaldırma var mı? (null = sapma yok) */
  sapma: boolean | null;
  /** Nihai sonuç. */
  etkin: boolean;
}

/** Bir kullanıcının izin tablosu (taban + sapma + sonuç). */
export async function personelIzinleri(userId: string): Promise<{
  rol: RoleName;
  satirlar: IzinSatiri[];
}> {
  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, permissions: { select: { permission: true, granted: true } } },
  });
  if (!kullanici) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  const rol = kullanici.role as RoleName;
  const taban = new Set<string>(basePermissionsForRole(rol));
  const sapmalar = new Map(kullanici.permissions.map((p) => [p.permission, p.granted]));
  const etkinKume = resolvePermissions(
    rol,
    kullanici.permissions.map((p) => ({ permission: p.permission, granted: p.granted })),
  );

  return {
    rol,
    satirlar: ALL_PERMISSIONS.map((izin) => ({
      izin,
      tabanda: taban.has(izin),
      sapma: sapmalar.has(izin) ? sapmalar.get(izin)! : null,
      etkin: etkinKume.has(izin),
    })),
  };
}

/**
 * Kullanıcıya özel izin ekler/kaldırır veya sapmayı temizler.
 *
 * `durum`:
 *   true  -> izni EKLE (rolde yoksa da olsun)   — ör. cash.drawer.close
 *   false -> izni KALDIR (rolde olsa bile olmasın)
 *   null  -> sapmayı sil, rolün tabanına dön
 *
 * Patron kendi `user.manage` iznini kaldırıp kendini kilitleyemez.
 */
export async function izinAyarla(
  actor: SessionUser,
  istek: { userId: string; izin: string; durum: boolean | null },
) {
  const kullanici = await prisma.user.findUnique({
    where: { id: istek.userId },
    select: { id: true, username: true, role: true },
  });
  if (!kullanici) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  if (!(ALL_PERMISSIONS as string[]).includes(istek.izin)) {
    throw new IslemHatasi("GECERSIZ_IZIN", "Tanımsız izin anahtarı.");
  }
  // Kendini yönetilemez hale getirme koruması.
  if (
    kullanici.id === actor.id &&
    istek.izin === "user.manage" &&
    istek.durum !== true
  ) {
    throw new IslemHatasi(
      "KENDINI_KILITLEME",
      "Kendi kullanıcı yönetimi yetkinizi kaldıramazsınız; sisteme personel ekleyemez hale gelirsiniz.",
    );
  }

  const onceki = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId: istek.userId, permission: istek.izin } },
  });

  if (istek.durum === null) {
    if (onceki) {
      await prisma.userPermission.delete({ where: { id: onceki.id } });
    }
  } else {
    await prisma.userPermission.upsert({
      where: { userId_permission: { userId: istek.userId, permission: istek.izin } },
      update: { granted: istek.durum, grantedById: actor.id },
      create: {
        userId: istek.userId,
        permission: istek.izin,
        granted: istek.durum,
        grantedById: actor.id,
      },
    });
  }

  await writeAudit({
    action: AUDIT_ACTIONS.USER_PERMISSION_CHANGE,
    entityType: "User",
    entityId: istek.userId,
    userId: actor.id,
    actorLabel: actor.username,
    before: { izin: istek.izin, sapma: onceki ? onceki.granted : null },
    after: { izin: istek.izin, sapma: istek.durum },
    note:
      istek.durum === null
        ? `İzin sapması kaldırıldı: ${istek.izin}`
        : istek.durum
          ? `İzin verildi: ${istek.izin}`
          : `İzin kaldırıldı: ${istek.izin}`,
  });

  return { userId: istek.userId, izin: istek.izin, durum: istek.durum };
}

// ---------------------------------------------------------------------------
// PERSONEL PROFİLİ (maaş / SGK / yemek) — YALNIZCA PATRON
// ---------------------------------------------------------------------------

export interface ProfilIstegi {
  userId: string;
  iseGirisTarihi?: Date | null;
  ayrilisTarihi?: Date | null;
  /** Kuruş. null = girilmedi (0 DEĞİL). */
  maasKurus?: number | null;
  sgkKurus?: number | null;
  yemekKurus?: number | null;
  not?: string | null;
}

/**
 * Personel maliyet profilini kaydeder.
 *
 * KARAR (05.10.2026): maaş/SGK/yemek tutulabilir ve YALNIZCA PATRON görür.
 * Çağıran taraf `personnel.cost.view` iznini zorunlu kılar; bu fonksiyon da
 * kendi içinde bir kez daha kontrol eder (çift kapı).
 *
 * GİRİLMEYEN ALAN 0 DEĞİL null'dır (mimari kural 10'un personel karşılığı):
 * "maaş 0 ₺" ile "maaş girilmedi" karıştırılmaz.
 */
export async function profilKaydet(actor: SessionUser, istek: ProfilIstegi) {
  if (!actor.permissions.has("personnel.cost.view")) {
    throw new IslemHatasi(
      "YETKISIZ",
      "Personel maliyet bilgilerini görüntüleme/düzenleme yetkiniz yok.",
    );
  }

  const kullanici = await prisma.user.findUnique({
    where: { id: istek.userId },
    select: { id: true, username: true },
  });
  if (!kullanici) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  for (const [ad, deger] of [
    ["Maaş", istek.maasKurus],
    ["SGK", istek.sgkKurus],
    ["Yemek", istek.yemekKurus],
  ] as const) {
    if (deger !== null && deger !== undefined && deger < 0) {
      throw new IslemHatasi("GECERSIZ_TUTAR", `${ad} tutarı negatif olamaz.`);
    }
  }
  if (
    istek.iseGirisTarihi &&
    istek.ayrilisTarihi &&
    istek.ayrilisTarihi.getTime() < istek.iseGirisTarihi.getTime()
  ) {
    throw new IslemHatasi("TARIH_SIRASI", "Ayrılış tarihi işe giriş tarihinden önce olamaz.");
  }

  const desimal = (kurus: number | null | undefined) =>
    kurus === null || kurus === undefined ? null : (kurus / 100).toFixed(2);

  const onceki = await prisma.employeeProfile.findUnique({ where: { userId: istek.userId } });

  const profil = await prisma.employeeProfile.upsert({
    where: { userId: istek.userId },
    update: {
      hireDate: istek.iseGirisTarihi ?? null,
      endDate: istek.ayrilisTarihi ?? null,
      monthlySalary: desimal(istek.maasKurus),
      insuranceCost: desimal(istek.sgkKurus),
      mealAllowance: desimal(istek.yemekKurus),
      notes: istek.not?.trim() || null,
      updatedById: actor.id,
    },
    create: {
      userId: istek.userId,
      hireDate: istek.iseGirisTarihi ?? null,
      endDate: istek.ayrilisTarihi ?? null,
      monthlySalary: desimal(istek.maasKurus),
      insuranceCost: desimal(istek.sgkKurus),
      mealAllowance: desimal(istek.yemekKurus),
      notes: istek.not?.trim() || null,
      updatedById: actor.id,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.STAFF_PROFILE_UPDATE,
    entityType: "EmployeeProfile",
    entityId: profil.id,
    userId: actor.id,
    actorLabel: actor.username,
    // Tutarlar denetim kaydında kalır: maaş değişikliği izlenebilir olmalı.
    before: onceki
      ? {
          maas: onceki.monthlySalary?.toString() ?? null,
          sgk: onceki.insuranceCost?.toString() ?? null,
          yemek: onceki.mealAllowance?.toString() ?? null,
        }
      : undefined,
    after: {
      personel: kullanici.username,
      maas: profil.monthlySalary?.toString() ?? null,
      sgk: profil.insuranceCost?.toString() ?? null,
      yemek: profil.mealAllowance?.toString() ?? null,
    },
    note: "Personel maliyet profili güncellendi",
  });

  return profil;
}

/** Profil detayı — maliyet alanları izne bağlı. */
export async function personelDetay(actor: SessionUser, userId: string) {
  const maliyetGorebilir = actor.permissions.has("personnel.cost.view");

  const kullanici = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      jobTitle: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
      employeeProfile: maliyetGorebilir
        ? true
        : { select: { id: true, hireDate: true, endDate: true, notes: true } },
    },
  });
  if (!kullanici) return null;

  const [izinler, acikAvans] = await Promise.all([
    personelIzinleri(userId),
    prisma.staffAdvance.aggregate({
      where: { userId, status: "OPEN" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const profil = kullanici.employeeProfile as {
    hireDate: Date | null;
    endDate: Date | null;
    notes: string | null;
    monthlySalary?: Prisma.Decimal | null;
    insuranceCost?: Prisma.Decimal | null;
    mealAllowance?: Prisma.Decimal | null;
  } | null;

  return {
    id: kullanici.id,
    kullaniciAdi: kullanici.username,
    adSoyad: kullanici.fullName,
    rol: kullanici.role as RoleName,
    gorevUnvani: kullanici.jobTitle,
    telefon: kullanici.phone,
    aktif: kullanici.isActive,
    parolaDegistirmeli: kullanici.mustChangePassword,
    sonGirisAt: kullanici.lastLoginAt,
    kilitliMi: kullanici.lockedUntil !== null && kullanici.lockedUntil.getTime() > Date.now(),
    olusturmaAt: kullanici.createdAt,
    iseGirisAt: profil?.hireDate ?? null,
    ayrilisAt: profil?.endDate ?? null,
    profilNotu: profil?.notes ?? null,
    maliyet: maliyetGorebilir
      ? {
          maasKurus: kurusVeyaNull(profil?.monthlySalary),
          sgkKurus: kurusVeyaNull(profil?.insuranceCost),
          yemekKurus: kurusVeyaNull(profil?.mealAllowance),
        }
      : null,
    izinler,
    acikAvans: {
      adet: acikAvans._count,
      tutar: Math.round(Number(acikAvans._sum.amount?.toString() ?? "0") * 100),
    },
  };
}
