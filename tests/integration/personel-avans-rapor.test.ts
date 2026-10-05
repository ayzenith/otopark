/**
 * AŞAMA 6 ENTEGRASYON TESTLERİ — PERSONEL, AVANS/MAAŞ, RAPORLAR, DENETİM
 *
 * ============================================================================
 * DİKKAT: Bu dosyadaki tüm tutarlar, isimler ve maaşlar YALNIZCA TEST
 * içindir. Londra Camping Otopark'ın gerçek personeli veya maaşları DEĞİLDİR.
 * ============================================================================
 *
 * Aşama 6 tamamlanma kriterleri (docs/06):
 *  - Avans GİDER DEĞİL: gider raporuna girmez, kasadan bir kez düşer
 *  - Maaş ödemesinde mahsup: gider tam, kasa çıkışı mahsup kadar az
 *  - Maaş verisi `personnel.cost.view` olmadan SORGULANMAZ
 *  - MANAGER rolü atanamaz; kasa kapatma izni kullanıcı bazında verilir
 *  - Son patron hesabı kapatılamaz / rolü düşürülemez
 *  - Panel verileri ile rapor verileri birebir uyuşur
 *  - Denetim kaydı silinemez ve değiştirilemez
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  aracSinifiGetir,
  kapasiteAyarla,
  kullaniciOlustur,
  oturum,
  prisma,
  tarifeOlustur,
  temizle,
  vardiyaOlustur,
} from "./helpers";
import { toKurus } from "@/lib/money";
import { PERMISSIONS, resolvePermissions } from "@/lib/permissions";
import { aracGirisi } from "@/server/parking/entry";
import { aracCikisi } from "@/server/parking/exit";
import { kasaAc, kasaDokumu, kasaKapat } from "@/server/cash/drawer";
import { giderKaydet } from "@/server/finance/expense";
import { finansRaporu } from "@/server/finance/queries";
import {
  acikAvansBakiyesi,
  acikAvansOzeti,
  acikAvanslar,
  avansIptal,
  avansListesi,
  avansVer,
  maasOde,
} from "@/server/staff/advance";
import {
  izinAyarla,
  parolaSifirla,
  personelDetay,
  personelDurum,
  personelGuncelle,
  personelIzinleri,
  personelListesi,
  personelOlustur,
  profilKaydet,
} from "@/server/staff/users";
import { aralikCozumle } from "@/server/reports/range";
import { panelVerisi, personelTahsilatRaporu } from "@/server/reports/dashboard";
import { uyarilar } from "@/server/reports/alerts";
import { denetimKayitlari } from "@/server/reports/audit-query";
import {
  vardiyaPencereleri,
  vardiyaPencereleriKaydet,
} from "@/server/settings/shift-windows";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;

let sinifId: string;
let patron: SessionUser;
let personel: SessionUser;
let kategoriId: string;

let sayac = 0;
const anahtar = () => `a6-${Date.now()}-${++sayac}`;
const bugun = () => new Date();

/** Testte kullanılacak personel hesabı açar ve kimliğini verir. */
async function testPersoneli(ad = "Test Personeli", kullaniciAdi?: string) {
  const sonuc = await personelOlustur(patron, {
    kullaniciAdi: kullaniciAdi ?? `test_${++sayac}`,
    adSoyad: ad,
    rol: "STAFF",
  });
  return sonuc;
}

beforeEach(async () => {
  await temizle();
  sinifId = (await aracSinifiGetir()).id;

  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  await vardiyaOlustur(o.id);
  patron = oturum(o);

  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);

  await kapasiteAyarla(0);
  await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 100 * TL });

  const kategori = await prisma.expenseCategory.create({
    data: { code: `A6_${++sayac}`, name: "Test gideri", sortOrder: 1 },
  });
  kategoriId = kategori.id;
  // Maaş ödemesi MAAS kategorisini arar.
  await prisma.expenseCategory.upsert({
    where: { code: "MAAS" },
    update: { isActive: true },
    create: { code: "MAAS", name: "Personel maaşı", isSystem: true, sortOrder: 10 },
  });
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

// ===========================================================================
describe("personel hesabı açma", () => {
  it("hesap açılır ve başlangıç parolası BİR KEZ döner", async () => {
    const sonuc = await personelOlustur(patron, {
      kullaniciAdi: "ahmet",
      adSoyad: "Test Ahmet",
      rol: "STAFF",
    });

    expect(sonuc.kullaniciAdi).toBe("ahmet");
    expect(sonuc.uretildiMi).toBe(true);
    expect(sonuc.baslangicParolasi.length).toBeGreaterThanOrEqual(12);

    const kayit = await prisma.user.findUniqueOrThrow({ where: { id: sonuc.userId } });
    // Parola AÇIK METİN olarak saklanmaz.
    expect(kayit.passwordHash).not.toContain(sonuc.baslangicParolasi);
    expect(kayit.passwordHash.startsWith("$argon2")).toBe(true);
    // İlk girişte parola değiştirme ZORUNLU.
    expect(kayit.mustChangePassword).toBe(true);
  });

  it("TÜRKÇE kullanıcı adı normalize edilir", async () => {
    const sonuc = await personelOlustur(patron, {
      kullaniciAdi: "ŞÜKRÜ",
      adSoyad: "Test Şükrü",
      rol: "STAFF",
    });
    expect(sonuc.kullaniciAdi).toBe("sukru");
  });

  it("aynı kullanıcı adı ikinci kez alınamaz", async () => {
    await personelOlustur(patron, { kullaniciAdi: "veli", adSoyad: "Test Veli", rol: "STAFF" });
    await expect(
      personelOlustur(patron, { kullaniciAdi: "VELİ", adSoyad: "Başka Veli", rol: "STAFF" }),
    ).rejects.toThrow(/alınmış/);
  });

  it("MANAGER ROLÜ ATANAMAZ (karar 05.10.2026)", async () => {
    await expect(
      personelOlustur(patron, {
        kullaniciAdi: "mudur",
        adSoyad: "Test Müdür",
        // MANAGER, RoleName tipinde GEÇERLİ (enum'dan silinmedi) ama
        // SECILEBILIR_ROLLER dışında olduğu için servis reddeder.
        rol: "MANAGER",
      }),
    ).rejects.toThrow(/yalnızca Patron ve Personel/);
  });

  it("zayıf parola reddedilir", async () => {
    await expect(
      personelOlustur(patron, {
        kullaniciAdi: "zayif",
        adSoyad: "Test Zayıf",
        rol: "STAFF",
        baslangicParolasi: "1234",
      }),
    ).rejects.toThrow();
  });

  it("kısa kullanıcı adı ve ad reddedilir", async () => {
    await expect(
      personelOlustur(patron, { kullaniciAdi: "ab", adSoyad: "Test Kisa", rol: "STAFF" }),
    ).rejects.toThrow(/3–32 karakter/);
    await expect(
      personelOlustur(patron, { kullaniciAdi: "gecerli", adSoyad: "Ab", rol: "STAFF" }),
    ).rejects.toThrow(/en az 3 karakter/);
  });

  it("hesap açılışı denetim kaydı üretir", async () => {
    const sonuc = await personelOlustur(patron, {
      kullaniciAdi: "denetim",
      adSoyad: "Test Denetim",
      rol: "STAFF",
    });
    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "USER_CREATE", entityId: sonuc.userId },
    });
    expect(kayit.actorLabel).toBe(patron.username);
  });
});

// ===========================================================================
describe("hesap durumu ve parola", () => {
  it("hesap kapatılınca AÇIK OTURUMLAR da iptal edilir", async () => {
    const yeni = await testPersoneli();
    // Elle oturum satırı: gerçek giriş akışına gerek yok.
    await prisma.session.create({
      data: {
        tokenHash: `test-${anahtar()}`,
        userId: yeni.userId,
        expires: new Date(Date.now() + 3600_000),
      },
    });

    const sonuc = await personelDurum(patron, { userId: yeni.userId, aktif: false });
    expect(sonuc.iptalEdilenOturum).toBe(1);
    expect(await prisma.session.count({ where: { userId: yeni.userId } })).toBe(0);
  });

  it("hesap SİLİNMEZ, pasifleştirilir", async () => {
    const yeni = await testPersoneli();
    await personelDurum(patron, { userId: yeni.userId, aktif: false });

    const kayit = await prisma.user.findUniqueOrThrow({ where: { id: yeni.userId } });
    expect(kayit.isActive).toBe(false);
    expect(kayit.deactivatedAt).not.toBeNull();
  });

  it("patron KENDİ hesabını kapatamaz", async () => {
    await expect(
      personelDurum(patron, { userId: patron.id, aktif: false }),
    ).rejects.toThrow(/Kendi hesabınızı/);
  });

  it("SON PATRON hesabı kapatılamaz", async () => {
    const ikinciPatron = await personelOlustur(patron, {
      kullaniciAdi: "patron2",
      adSoyad: "Test Patron 2",
      rol: "OWNER",
    });
    // İkinci patron varken ilki kapatılabilir.
    const ikincininOturumu = oturum({
      id: ikinciPatron.userId,
      username: ikinciPatron.kullaniciAdi,
      fullName: "Test Patron 2",
      role: "OWNER",
    });
    await personelDurum(ikincininOturumu, { userId: patron.id, aktif: false });

    // Artık tek patron kaldı: o da kapatılamaz.
    await expect(
      personelDurum(patron, { userId: ikinciPatron.userId, aktif: false }),
    ).rejects.toThrow(/tek işletme sahibi/);
  });

  it("SON PATRONUN rolü personele düşürülemez", async () => {
    await expect(
      personelGuncelle(patron, { userId: patron.id, rol: "STAFF" }),
    ).rejects.toThrow(/tek işletme sahibi/);
  });

  it("parola sıfırlanınca oturumlar kapanır ve değiştirme zorunlu olur", async () => {
    const yeni = await testPersoneli();
    await prisma.session.create({
      data: {
        tokenHash: `test-${anahtar()}`,
        userId: yeni.userId,
        expires: new Date(Date.now() + 3600_000),
      },
    });

    const sonuc = await parolaSifirla(patron, { userId: yeni.userId });
    expect(sonuc.parola.length).toBeGreaterThanOrEqual(12);
    expect(await prisma.session.count({ where: { userId: yeni.userId } })).toBe(0);

    const kayit = await prisma.user.findUniqueOrThrow({ where: { id: yeni.userId } });
    expect(kayit.mustChangePassword).toBe(true);
    expect(kayit.failedLoginCount).toBe(0);
    expect(kayit.lockedUntil).toBeNull();
  });
});

// ===========================================================================
describe("izinler — kasa kapatma kullanıcı bazında verilir", () => {
  it("PERSONEL taban kümesinde kasa kapatma YOKTUR", async () => {
    const yeni = await testPersoneli();
    const izinler = await personelIzinleri(yeni.userId);
    const satir = izinler.satirlar.find((s) => s.izin === PERMISSIONS.CASH_DRAWER_CLOSE)!;
    expect(satir.tabanda).toBe(false);
    expect(satir.etkin).toBe(false);
  });

  it("izin EK OLARAK verilince etkin olur", async () => {
    const yeni = await testPersoneli();
    await izinAyarla(patron, {
      userId: yeni.userId,
      izin: PERMISSIONS.CASH_DRAWER_CLOSE,
      durum: true,
    });

    const izinler = await personelIzinleri(yeni.userId);
    const satir = izinler.satirlar.find((s) => s.izin === PERMISSIONS.CASH_DRAWER_CLOSE)!;
    expect(satir.sapma).toBe(true);
    expect(satir.etkin).toBe(true);

    // Oturum çözümlemesi de aynı sonucu vermeli.
    const kayit = await prisma.userPermission.findMany({ where: { userId: yeni.userId } });
    const kume = resolvePermissions("STAFF", kayit);
    expect(kume.has(PERMISSIONS.CASH_DRAWER_CLOSE)).toBe(true);
  });

  it("rolde olan izin KALDIRILABİLİR", async () => {
    const yeni = await testPersoneli();
    await izinAyarla(patron, {
      userId: yeni.userId,
      izin: PERMISSIONS.PARKING_EXIT,
      durum: false,
    });
    const izinler = await personelIzinleri(yeni.userId);
    const satir = izinler.satirlar.find((s) => s.izin === PERMISSIONS.PARKING_EXIT)!;
    expect(satir.tabanda).toBe(true);
    expect(satir.etkin).toBe(false);
  });

  it("'role dön' sapmayı siler", async () => {
    const yeni = await testPersoneli();
    await izinAyarla(patron, {
      userId: yeni.userId,
      izin: PERMISSIONS.CASH_DRAWER_CLOSE,
      durum: true,
    });
    await izinAyarla(patron, {
      userId: yeni.userId,
      izin: PERMISSIONS.CASH_DRAWER_CLOSE,
      durum: null,
    });

    const izinler = await personelIzinleri(yeni.userId);
    const satir = izinler.satirlar.find((s) => s.izin === PERMISSIONS.CASH_DRAWER_CLOSE)!;
    expect(satir.sapma).toBeNull();
    expect(satir.etkin).toBe(false);
    expect(await prisma.userPermission.count({ where: { userId: yeni.userId } })).toBe(0);
  });

  it("patron KENDİ kullanıcı yönetimi yetkisini kaldıramaz", async () => {
    await expect(
      izinAyarla(patron, { userId: patron.id, izin: PERMISSIONS.USER_MANAGE, durum: false }),
    ).rejects.toThrow(/Kendi kullanıcı yönetimi/);
  });

  it("tanımsız izin anahtarı reddedilir", async () => {
    const yeni = await testPersoneli();
    await expect(
      izinAyarla(patron, { userId: yeni.userId, izin: "uydurma.izin", durum: true }),
    ).rejects.toThrow(/Tanımsız izin/);
  });

  it("izin değişikliği denetim kaydı üretir", async () => {
    const yeni = await testPersoneli();
    await izinAyarla(patron, {
      userId: yeni.userId,
      izin: PERMISSIONS.CASH_DRAWER_CLOSE,
      durum: true,
    });
    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "USER_PERMISSION_CHANGE", entityId: yeni.userId },
    });
    expect(kayit.note).toMatch(/cash\.drawer\.close/);
  });
});

// ===========================================================================
describe("maaş verisi — alan bazlı gizlilik", () => {
  it("maaş kaydedilir ve PATRON görür", async () => {
    const yeni = await testPersoneli();
    await profilKaydet(patron, { userId: yeni.userId, maasKurus: 30_000 * TL });

    const liste = await personelListesi(patron);
    const satir = liste.find((p) => p.id === yeni.userId)!;
    expect(satir.maliyet?.maasKurus).toBe(30_000 * TL);
  });

  it("personnel.cost.view OLMADAN maaş alanı HİÇ DÖNMEZ", async () => {
    const yeni = await testPersoneli();
    await profilKaydet(patron, { userId: yeni.userId, maasKurus: 30_000 * TL });

    // Personel rolünde bu izin yok.
    const liste = await personelListesi(personel);
    const satir = liste.find((p) => p.id === yeni.userId)!;
    expect(satir.maliyet).toBeNull();

    const detay = await personelDetay(personel, yeni.userId);
    expect(detay?.maliyet).toBeNull();
  });

  it("izinsiz kullanıcı maaş YAZAMAZ", async () => {
    const yeni = await testPersoneli();
    await expect(
      profilKaydet(personel, { userId: yeni.userId, maasKurus: 1 * TL }),
    ).rejects.toThrow(/yetkiniz yok/);
  });

  it("GİRİLMEYEN maaş 0 DEĞİL null'dır", async () => {
    const yeni = await testPersoneli();
    await profilKaydet(patron, { userId: yeni.userId, maasKurus: null, sgkKurus: 500 * TL });

    const detay = await personelDetay(patron, yeni.userId);
    expect(detay?.maliyet?.maasKurus).toBeNull();
    expect(detay?.maliyet?.sgkKurus).toBe(500 * TL);
  });

  it("negatif maaş reddedilir", async () => {
    const yeni = await testPersoneli();
    await expect(
      profilKaydet(patron, { userId: yeni.userId, maasKurus: -1 }),
    ).rejects.toThrow(/negatif/);
  });

  it("ayrılış tarihi işe girişten önce olamaz", async () => {
    const yeni = await testPersoneli();
    await expect(
      profilKaydet(patron, {
        userId: yeni.userId,
        iseGirisTarihi: new Date("2026-06-01T12:00:00+03:00"),
        ayrilisTarihi: new Date("2026-01-01T12:00:00+03:00"),
      }),
    ).rejects.toThrow(/önce olamaz/);
  });

  it("maaş değişikliği denetim kaydında İZLENEBİLİR", async () => {
    const yeni = await testPersoneli();
    await profilKaydet(patron, { userId: yeni.userId, maasKurus: 30_000 * TL });
    await profilKaydet(patron, { userId: yeni.userId, maasKurus: 35_000 * TL });

    const kayitlar = await prisma.auditLog.findMany({
      where: { action: "STAFF_PROFILE_UPDATE" },
      orderBy: { at: "asc" },
    });
    expect(kayitlar).toHaveLength(2);
    const ikinci = kayitlar[1]!.before as Record<string, unknown>;
    expect(ikinci.maas).toBe("30000");
  });
});

// ===========================================================================
describe("personel avansı — GİDER DEĞİL, ALACAK", () => {
  it("avans verilir, kasadan düşer ama GİDER RAPORUNA GİRMEZ", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 5_000 * TL });
    const yeni = await testPersoneli();

    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 500 * TL,
      idempotencyKey: anahtar(),
    });

    expect(avans.kod).toMatch(/^V-\d{6}-\d{4}$/);
    expect(avans.acikBakiyeKurus).toBe(500 * TL);

    // Kasa: 500 ₺ azaldı.
    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.kasaCikisi).toBe(500 * TL);
    expect(dokum.beklenenNakit).toBe(4_500 * TL);

    // Gider raporu: avans HİÇ GÖRÜNMEZ.
    const rapor = await finansRaporu(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );
    expect(rapor.gider.toplam).toBe(0);
    expect(await prisma.expense.count()).toBe(0);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci avans oluşmaz", async () => {
    await kasaAc(patron, { acilisNakdiKurus: 5_000 * TL });
    const yeni = await testPersoneli();
    const anah = anahtar();
    const girdi = { userId: yeni.userId, tutarKurus: 500 * TL, idempotencyKey: anah };

    const birinci = await avansVer(patron, girdi);
    const ikinci = await avansVer(patron, girdi);

    expect(ikinci.staffAdvanceId).toBe(birinci.staffAdvanceId);
    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(await prisma.staffAdvance.count()).toBe(1);
    expect(await prisma.cashMovement.count()).toBe(1);
  });

  it("kasa kapalıyken avans verilebilir ama kasa hareketi üretilmez", async () => {
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 300 * TL,
      idempotencyKey: anahtar(),
    });
    expect(avans.kasaHareketiId).toBeNull();
    expect(await prisma.cashMovement.count()).toBe(0);
    // Alacak yine kaydedilir.
    expect(await acikAvansBakiyesi(yeni.userId)).toBe(300 * TL);
  });

  it("kasadanVerildi=false ise kasa etkilenmez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1_000 * TL });
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 200 * TL,
      kasadanVerildi: false,
      idempotencyKey: anahtar(),
    });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1_000 * TL);
  });

  it("pasif personele avans verilemez", async () => {
    const yeni = await testPersoneli();
    await personelDurum(patron, { userId: yeni.userId, aktif: false });
    await expect(
      avansVer(patron, {
        userId: yeni.userId,
        tutarKurus: 100 * TL,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/kullanım dışı/);
  });

  it("sıfır veya negatif avans reddedilir", async () => {
    const yeni = await testPersoneli();
    for (const tutar of [0, -100]) {
      await expect(
        avansVer(patron, {
          userId: yeni.userId,
          tutarKurus: tutar,
          idempotencyKey: anahtar(),
        }),
      ).rejects.toThrow(/sıfırdan büyük/);
    }
  });

  it("AVANS SİLİNMEZ (veritabanı tetikleyicisi)", async () => {
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 100 * TL,
      idempotencyKey: anahtar(),
    });
    await expect(
      prisma.staffAdvance.delete({ where: { id: avans.staffAdvanceId } }),
    ).rejects.toThrow();
  });

  it("iptal edilen avans kasayı geri yükler ve borçtan düşer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1_000 * TL });
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 400 * TL,
      idempotencyKey: anahtar(),
    });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(600 * TL);

    await avansIptal(patron, {
      staffAdvanceId: avans.staffAdvanceId,
      sebep: "Yanlış personele girildi",
    });

    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1_000 * TL);
    expect(await acikAvansBakiyesi(yeni.userId)).toBe(0);

    const kayit = await prisma.staffAdvance.findUniqueOrThrow({
      where: { id: avans.staffAdvanceId },
    });
    expect(kayit.status).toBe("VOIDED");
    expect(kayit.voidReason).toMatch(/Yanlış personele/);
  });

  it("iptal gerekçesi zorunludur", async () => {
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 100 * TL,
      idempotencyKey: anahtar(),
    });
    await expect(
      avansIptal(patron, { staffAdvanceId: avans.staffAdvanceId, sebep: "x" }),
    ).rejects.toThrow(/gerekçesi zorunludur/);
  });

  it("KAPANMIŞ kasadan verilen avans geriye dönük iptal edilemez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1_000 * TL });
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 200 * TL,
      idempotencyKey: anahtar(),
    });
    await kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 800 * TL });

    await expect(
      avansIptal(patron, { staffAdvanceId: avans.staffAdvanceId, sebep: "Geriye dönük" }),
    ).rejects.toThrow(/kasa sayımını/);
  });

  it("açık avans özeti personel bazında toplanır", async () => {
    const a = await testPersoneli("Test A");
    const b = await testPersoneli("Test B");
    for (const [kisi, tutar] of [
      [a.userId, 100 * TL],
      [a.userId, 250 * TL],
      [b.userId, 400 * TL],
    ] as const) {
      await avansVer(patron, { userId: kisi, tutarKurus: tutar, idempotencyKey: anahtar() });
    }

    const ozet = await acikAvansOzeti();
    expect(ozet).toHaveLength(2);
    // En büyük borç başta.
    expect(ozet[0]!.tutar).toBe(400 * TL);
    const aSatiri = ozet.find((o) => o.personelId === a.userId)!;
    expect(aSatiri.adet).toBe(2);
    expect(aSatiri.tutar).toBe(350 * TL);
  });
});

// ===========================================================================
describe("maaş ödemesi — avans mahsubu", () => {
  it("TAM SENARYO: 10.000 maaş, 500 avans → gider 10.000, kasa −10.000", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 20_000 * TL });
    const yeni = await testPersoneli();

    // 1) Avans: kasa −500, gider 0
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 500 * TL,
      idempotencyKey: anahtar(),
    });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(19_500 * TL);

    // 2) Maaş: gider 10.000, kasa −9.500
    const acik = await acikAvanslar(yeni.userId);
    const maas = await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 10_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH",
      mahsupAvansIdleri: acik.map((a) => a.id),
      idempotencyKey: anahtar(),
    });

    expect(maas.giderKurus).toBe(10_000 * TL);
    expect(maas.mahsupKurus).toBe(500 * TL);
    expect(maas.odenenKurus).toBe(9_500 * TL);

    // Kasa: 20.000 − 500 − 9.500 = 10.000
    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.beklenenNakit).toBe(10_000 * TL);
    // Kasa çıkışı toplamı maaşa eşit: ne eksik ne fazla.
    expect(dokum.kasaCikisi + dokum.nakitGider).toBe(10_000 * TL);

    // Gider raporu: maaşın TAMAMI.
    const rapor = await finansRaporu(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );
    expect(rapor.gider.toplam).toBe(10_000 * TL);

    // Avans mahsup edildi.
    expect(await acikAvansBakiyesi(yeni.userId)).toBe(0);
    const avansKaydi = await prisma.staffAdvance.findFirstOrThrow({
      where: { userId: yeni.userId },
    });
    expect(avansKaydi.status).toBe("SETTLED");
    expect(avansKaydi.settledByExpenseId).toBe(maas.expenseId);
    expect(avansKaydi.settledAt).not.toBeNull();
  });

  it("mahsupsuz maaş: gider = kasadan çıkan", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 20_000 * TL });
    const yeni = await testPersoneli();

    const maas = await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 8_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(maas.mahsupKurus).toBe(0);
    expect(maas.odenenKurus).toBe(8_000 * TL);
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(12_000 * TL);
  });

  it("MAHSUP MAAŞTAN BÜYÜK OLAMAZ", async () => {
    await kasaAc(patron, { acilisNakdiKurus: 20_000 * TL });
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 2_000 * TL,
      idempotencyKey: anahtar(),
    });
    const acik = await acikAvanslar(yeni.userId);

    await expect(
      maasOde(patron, {
        userId: yeni.userId,
        maasKurus: 1_000 * TL,
        odemeTarihi: bugun(),
        odemeYontemi: "CASH",
        mahsupAvansIdleri: acik.map((a) => a.id),
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/fazla/);

    // Avans HÂLÂ açık: başarısız işlem onu tüketmedi.
    expect(await acikAvansBakiyesi(yeni.userId)).toBe(2_000 * TL);
  });

  it("BAŞKA personelin avansı mahsup edilemez", async () => {
    const a = await testPersoneli("Test A");
    const b = await testPersoneli("Test B");
    await avansVer(patron, { userId: a.userId, tutarKurus: 300 * TL, idempotencyKey: anahtar() });
    const aAvans = await acikAvanslar(a.userId);

    await expect(
      maasOde(patron, {
        userId: b.userId,
        maasKurus: 5_000 * TL,
        odemeTarihi: bugun(),
        odemeYontemi: "CASH",
        mahsupAvansIdleri: aAvans.map((x) => x.id),
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/Başka bir personelin/);
  });

  it("AYNI AVANS İKİ KEZ mahsup edilemez", async () => {
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 300 * TL,
      idempotencyKey: anahtar(),
    });
    const acik = await acikAvanslar(yeni.userId);

    await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 5_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH",
      mahsupAvansIdleri: acik.map((a) => a.id),
      idempotencyKey: anahtar(),
    });

    await expect(
      maasOde(patron, {
        userId: yeni.userId,
        maasKurus: 5_000 * TL,
        odemeTarihi: bugun(),
        odemeYontemi: "CASH",
        mahsupAvansIdleri: acik.map((a) => a.id),
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/zaten mahsup/);
  });

  it("IPTAL EDİLMİŞ avans mahsup edilemez", async () => {
    const yeni = await testPersoneli();
    const avans = await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 300 * TL,
      idempotencyKey: anahtar(),
    });
    await avansIptal(patron, { staffAdvanceId: avans.staffAdvanceId, sebep: "Hatalı kayıt" });

    await expect(
      maasOde(patron, {
        userId: yeni.userId,
        maasKurus: 5_000 * TL,
        odemeTarihi: bugun(),
        odemeYontemi: "CASH",
        mahsupAvansIdleri: [avans.staffAdvanceId],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/mahsup edilmiş veya iptal/);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci maaş gideri oluşmaz", async () => {
    const yeni = await testPersoneli();
    const anah = anahtar();
    const girdi = {
      userId: yeni.userId,
      maasKurus: 5_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH" as const,
      idempotencyKey: anah,
    };
    const birinci = await maasOde(patron, girdi);
    const ikinci = await maasOde(patron, girdi);

    expect(ikinci.expenseId).toBe(birinci.expenseId);
    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(await prisma.expense.count()).toBe(1);
  });

  it("VERİTABANI KISITI: mahsup giderden büyük yazılamaz", async () => {
    const yeni = await testPersoneli();
    const maas = await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 1_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "TRANSFER",
      idempotencyKey: anahtar(),
    });
    await expect(
      prisma.expense.update({
        where: { id: maas.expenseId },
        data: { advanceOffsetAmount: "2000.00" },
      }),
    ).rejects.toThrow();
  });

  it("AVANS gider kategorisi KULLANIM DIŞIDIR (çifte sayım koruması)", async () => {
    const avansKategorisi = await prisma.expenseCategory.upsert({
      where: { code: "AVANS" },
      update: { isActive: false },
      create: { code: "AVANS", name: "Personel avansı", isSystem: true, isActive: false },
    });

    await expect(
      giderKaydet(patron, {
        expenseCategoryId: avansKategorisi.id,
        tutarKurus: 500 * TL,
        giderTarihi: bugun(),
        odemeYontemi: "CASH",
        aciklama: "Elle avans gideri denemesi",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/kullanım dışı/);
  });

  it("maaş ödemesi denetim kaydında mahsubu yazar", async () => {
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 500 * TL,
      idempotencyKey: anahtar(),
    });
    const acik = await acikAvanslar(yeni.userId);
    const maas = await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 10_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH",
      mahsupAvansIdleri: acik.map((a) => a.id),
      idempotencyKey: anahtar(),
    });

    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "STAFF_SALARY_PAY", entityId: maas.expenseId },
    });
    const sonra = kayit.after as Record<string, unknown>;
    expect(sonra.maasKurus).toBe(10_000 * TL);
    expect(sonra.mahsupKurus).toBe(500 * TL);
    expect(sonra.odenenKurus).toBe(9_500 * TL);
  });

  it("avans listesi mahsup edilen gideri gösterir", async () => {
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 500 * TL,
      idempotencyKey: anahtar(),
    });
    const acik = await acikAvanslar(yeni.userId);
    const maas = await maasOde(patron, {
      userId: yeni.userId,
      maasKurus: 10_000 * TL,
      odemeTarihi: bugun(),
      odemeYontemi: "CASH",
      mahsupAvansIdleri: acik.map((a) => a.id),
      idempotencyKey: anahtar(),
    });

    const liste = await avansListesi({ userId: yeni.userId });
    expect(liste).toHaveLength(1);
    expect(liste[0]!.durum).toBe("SETTLED");
    expect(liste[0]!.mahsupGiderKodu).toBe(maas.kod);
  });
});

// ===========================================================================
describe("vardiya pencereleri — bilgi amaçlı, engel değil", () => {
  it("pencereler kaydedilir ve okunur", async () => {
    await vardiyaPencereleriKaydet(patron, [
      { ad: "Gündüz", baslangicDakika: 480, bitisDakika: 1200 },
      { ad: "Gece", baslangicDakika: 1200, bitisDakika: 480 },
    ]);
    const pencereler = await vardiyaPencereleri();
    expect(pencereler).toHaveLength(2);
    expect(pencereler[0]!.ad).toBe("Gündüz");
  });

  it("boş liste kaydedilebilir (pencere tanımı kaldırılır)", async () => {
    await vardiyaPencereleriKaydet(patron, [
      { ad: "Gündüz", baslangicDakika: 480, bitisDakika: 1200 },
    ]);
    await vardiyaPencereleriKaydet(patron, []);
    expect(await vardiyaPencereleri()).toHaveLength(0);
  });

  it("aynı adda iki pencere olamaz", async () => {
    await expect(
      vardiyaPencereleriKaydet(patron, [
        { ad: "Gündüz", baslangicDakika: 480, bitisDakika: 1200 },
        { ad: "gündüz", baslangicDakika: 0, bitisDakika: 480 },
      ]),
    ).rejects.toThrow(/Aynı adda/);
  });

  it("PENCERE VARDİYA AÇMAYI ENGELLEMEZ", async () => {
    // Yalnızca gece penceresi tanımlı; personel gündüz de vardiya açabilir.
    await vardiyaPencereleriKaydet(patron, [
      { ad: "Gece", baslangicDakika: 1200, bitisDakika: 480 },
    ]);

    const yeni = await kullaniciOlustur({ username: "vardiyali", role: "STAFF" });
    const vardiya = await prisma.shift.create({ data: { userId: yeni.id, status: "OPEN" } });
    expect(vardiya.status).toBe("OPEN");
  });

  it("BOZUK ayar verisi vardiyayı engellemez, yok sayılır", async () => {
    // Elle bozuk JSON yazılırsa pencere etiketi gösterilmez ama sistem çalışır.
    await prisma.businessSetting.upsert({
      where: { id: "singleton" },
      update: { shiftWindows: [{ saçma: true }] },
      create: { id: "singleton", shiftWindows: [{ saçma: true }] },
    });
    expect(await vardiyaPencereleri()).toEqual([]);
  });
});

// ===========================================================================
describe("patron paneli ve raporlar", () => {
  /** Plakayı sokar, geriye alır ve nakit çıkış yapar. */
  async function nakitTahsilat(plaka: string, dakikaOnce: number, actor = personel) {
    const giris = await aracGirisi(actor, {
      plaka,
      aracSinifiId: sinifId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - dakikaOnce * 60_000) },
    });
    const cikis = await aracCikisi(actor, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    return cikis.odenenTutar;
  }

  it("PANEL VERİSİ ile GELİR-GİDER RAPORU birebir uyuşur", async () => {
    const tutar = await nakitTahsilat("34 PNL 001", 90);
    await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 200 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Panel testi gideri",
      idempotencyKey: anahtar(),
    });

    const aralik = aralikCozumle("gun");
    const [panel, rapor] = await Promise.all([
      panelVerisi(aralik),
      finansRaporu(aralik.baslangic, aralik.bitis),
    ]);

    expect(panel.rapor.gelir.park).toBe(rapor.gelir.park);
    expect(panel.rapor.gelir.toplam).toBe(rapor.gelir.toplam);
    expect(panel.rapor.gider.toplam).toBe(rapor.gider.toplam);
    expect(panel.rapor.net).toBe(rapor.net);
    expect(panel.rapor.gelir.park).toBe(tutar);
  });

  it("DOLULUK YÜZDESİ kapasite tanımsızken NULL döner", async () => {
    const panel = await panelVerisi(aralikCozumle("gun"));
    expect(panel.sayaclar.dolulukYuzdesi).toBeNull();
  });

  it("kapasite girilirse doluluk hesaplanır", async () => {
    await kapasiteAyarla(10);
    await aracGirisi(personel, {
      plaka: "34 PNL 010",
      aracSinifiId: sinifId,
      idempotencyKey: anahtar(),
    });
    const panel = await panelVerisi(aralikCozumle("gun"));
    expect(panel.sayaclar.dolulukYuzdesi).toBe(10);
  });

  it("30 günlük trend BOŞ GÜNLERİ de içerir (grafik kopmaz)", async () => {
    const panel = await panelVerisi(aralikCozumle("gun"));
    expect(panel.trend).toHaveLength(30);
    expect(panel.trend.every((n) => typeof n.toplam === "number")).toBe(true);
  });

  it("dönem karşılaştırması önceki dönemi okur", async () => {
    await nakitTahsilat("34 PNL 020", 90);
    const panel = await panelVerisi(aralikCozumle("gun"));
    const gelirSatiri = panel.karsilastirma.find((k) => k.etiket === "Gelir toplamı")!;
    expect(gelirSatiri.simdi).toBeGreaterThan(0);
    // Dün işlem yok: önceki 0 => yüzde TANIMSIZ.
    expect(gelirSatiri.onceki).toBe(0);
    expect(gelirSatiri.yuzde).toBeNull();
  });

  it("aktif vardiyalar ve tahsilatları listelenir", async () => {
    await nakitTahsilat("34 PNL 030", 90);
    const panel = await panelVerisi(aralikCozumle("gun"));
    // Hem patron hem personel vardiyası açık (beforeEach).
    expect(panel.aktifVardiyalar.length).toBeGreaterThanOrEqual(2);
    const personelVardiyasi = panel.aktifVardiyalar.find((v) =>
      v.personel.includes("personel1"),
    );
    expect(personelVardiyasi?.tahsilatKurus).toBeGreaterThan(0);
  });

  it("PERSONEL BAZLI tahsilat raporu kaynaklara göre ayırır", async () => {
    const t1 = await nakitTahsilat("34 PRS 001", 90, personel);
    const t2 = await nakitTahsilat("34 PRS 002", 90, patron);

    const satirlar = await personelTahsilatRaporu(aralikCozumle("gun"));
    expect(satirlar).toHaveLength(2);

    const personelSatiri = satirlar.find((s) => s.userId === personel.id)!;
    expect(personelSatiri.park).toBe(t1);
    expect(personelSatiri.nakit).toBe(t1);
    expect(personelSatiri.yikama).toBe(0);
    expect(personelSatiri.toplam).toBe(t1);
    expect(personelSatiri.vardiyaSayisi).toBe(1);

    const patronSatiri = satirlar.find((s) => s.userId === patron.id)!;
    expect(patronSatiri.toplam).toBe(t2);
  });

  it("İADE personel raporunda AYRI gösterilir ve toplamdan düşer", async () => {
    const tutar = await nakitTahsilat("34 PRS 010", 90, personel);
    const odeme = await prisma.payment.findFirstOrThrow({
      where: { collectedById: personel.id, direction: "IN" },
    });
    // Ters kayıt
    await prisma.payment.create({
      data: {
        code: "T-TEST-IADE6",
        amount: odeme.amount,
        method: "CASH",
        direction: "OUT",
        sourceType: "REFUND",
        shiftId: odeme.shiftId,
        collectedById: personel.id,
        status: "CONFIRMED",
        idempotencyKey: anahtar(),
      },
    });

    const satirlar = await personelTahsilatRaporu(aralikCozumle("gun"));
    const satir = satirlar.find((s) => s.userId === personel.id)!;
    expect(satir.iade).toBe(tutar);
    expect(satir.toplam).toBe(0);
    expect(satir.nakit).toBe(0);
  });
});

// ===========================================================================
describe("uyarı merkezi", () => {
  it("tarife varken 'tarife yok' uyarısı ÇIKMAZ", async () => {
    const liste = await uyarilar();
    expect(liste.find((u) => u.kod === "tarife_yok")).toBeUndefined();
  });

  it("tarife silinince KRİTİK uyarı çıkar", async () => {
    await prisma.tariffRule.deleteMany({});
    await prisma.tariffVersion.deleteMany({});
    const liste = await uyarilar();
    const uyari = liste.find((u) => u.kod === "tarife_yok")!;
    expect(uyari.onem).toBe("kritik");
  });

  it("kasa kapalıyken bilgi uyarısı çıkar, açıkken çıkmaz", async () => {
    expect((await uyarilar()).find((u) => u.kod === "kasa_kapali")).toBeDefined();
    await kasaAc(patron, { acilisNakdiKurus: 0 });
    expect((await uyarilar()).find((u) => u.kod === "kasa_kapali")).toBeUndefined();
  });

  it("kasa dışı nakit tahsilat uyarıya düşer", async () => {
    const giris = await aracGirisi(personel, {
      plaka: "34 UYR 001",
      aracSinifiId: sinifId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 90 * 60_000) },
    });
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const uyari = (await uyarilar()).find((u) => u.kod === "kasa_disi_tahsilat")!;
    expect(uyari.adet).toBe(1);
    expect(uyari.tutarKurus).toBe(cikis.odenenTutar);
  });

  it("açık avans BİLGİ uyarısına düşer ve gider demez", async () => {
    const yeni = await testPersoneli();
    await avansVer(patron, {
      userId: yeni.userId,
      tutarKurus: 300 * TL,
      idempotencyKey: anahtar(),
    });

    const uyari = (await uyarilar()).find((u) => u.kod === "acik_avans")!;
    expect(uyari.onem).toBe("bilgi");
    expect(uyari.tutarKurus).toBe(300 * TL);
    expect(uyari.ayrinti).toMatch(/gider değil/);
  });

  it("uyarılar önem sırasına göre dizilir (kritik önce)", async () => {
    await prisma.tariffRule.deleteMany({});
    await prisma.tariffVersion.deleteMany({});
    const liste = await uyarilar();
    const sira = { kritik: 0, uyari: 1, bilgi: 2 };
    for (let i = 1; i < liste.length; i++) {
      expect(sira[liste[i]!.onem]).toBeGreaterThanOrEqual(sira[liste[i - 1]!.onem]);
    }
  });

  it("her uyarı bir ekrana bağlanır", async () => {
    await prisma.tariffRule.deleteMany({});
    await prisma.tariffVersion.deleteMany({});
    for (const u of await uyarilar()) {
      expect(u.href.startsWith("/"), u.kod).toBe(true);
      expect(u.baslik.length, u.kod).toBeGreaterThan(5);
    }
  });
});

// ===========================================================================
describe("denetim kaydı ekranı", () => {
  it("kayıtlar en yeniden eskiye listelenir", async () => {
    await testPersoneli("Test Bir", "denetim_bir");
    await testPersoneli("Test İki", "denetim_iki");

    const sonuc = await denetimKayitlari({ grup: "personel" });
    expect(sonuc.satirlar.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < sonuc.satirlar.length; i++) {
      expect(sonuc.satirlar[i - 1]!.at.getTime()).toBeGreaterThanOrEqual(
        sonuc.satirlar[i]!.at.getTime(),
      );
    }
  });

  it("grup filtresi yalnızca o gruptaki eylemleri verir", async () => {
    await testPersoneli();
    await kasaAc(patron, { acilisNakdiKurus: 0 });

    const personelKayitlari = await denetimKayitlari({ grup: "personel" });
    expect(personelKayitlari.satirlar.every((s) => s.eylem.startsWith("USER_") || s.eylem.startsWith("STAFF_"))).toBe(true);

    const paraKayitlari = await denetimKayitlari({ grup: "para" });
    expect(paraKayitlari.satirlar.some((s) => s.eylem === "DRAWER_OPEN")).toBe(true);
  });

  it("kişi filtresi uygulanır", async () => {
    await testPersoneli();
    const sonuc = await denetimKayitlari({ userId: patron.id });
    expect(sonuc.satirlar.length).toBeGreaterThan(0);
    expect(sonuc.satirlar.every((s) => s.kisi === patron.username)).toBe(true);
  });

  it("eylem etiketleri TÜRKÇE döner", async () => {
    await testPersoneli();
    const sonuc = await denetimKayitlari({ grup: "personel" });
    const satir = sonuc.satirlar.find((s) => s.eylem === "USER_CREATE")!;
    expect(satir.eylemEtiketi).toBe("Personel hesabı açıldı");
  });

  it("sayfalama imleci çalışır ve kayıt tekrarlamaz", async () => {
    for (let i = 0; i < 5; i++) {
      await testPersoneli(`Test ${i}`, `sayfa_${i}`);
    }
    const ilk = await denetimKayitlari({ limit: 2 });
    expect(ilk.satirlar).toHaveLength(2);
    expect(ilk.devamVarMi).toBe(true);

    const ikinci = await denetimKayitlari({ limit: 2, imlecId: ilk.sonId });
    const kesisim = ikinci.satirlar.filter((s) => ilk.satirlar.some((x) => x.id === s.id));
    expect(kesisim).toHaveLength(0);
  });

  it("DENETİM KAYDI DEĞİŞTİRİLEMEZ ve SİLİNEMEZ (tetikleyici)", async () => {
    await testPersoneli();
    const kayit = await prisma.auditLog.findFirstOrThrow({ where: { action: "USER_CREATE" } });

    await expect(
      prisma.auditLog.update({ where: { id: kayit.id }, data: { note: "değiştirildi" } }),
    ).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: kayit.id } })).rejects.toThrow();
  });

  it("PAROLA denetim kaydına AÇIK yazılmaz", async () => {
    const yeni = await testPersoneli();
    const sonuc = await parolaSifirla(patron, { userId: yeni.userId });

    const kayitlar = await prisma.auditLog.findMany({ where: { action: "PASSWORD_RESET" } });
    const metin = JSON.stringify(kayitlar);
    expect(metin).not.toContain(sonuc.parola);
  });
});

// ===========================================================================
describe("yetki sınırları (Aşama 6)", () => {
  it("PERSONEL taban kümesinde personel yönetimi ve finans YOK", () => {
    for (const izin of [
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.PERSONNEL_COST_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.CASH_DRAWER_CLOSE,
      PERMISSIONS.CASH_REPORT_ALL,
      PERMISSIONS.FINANCE_EXPENSE_CREATE,
    ]) {
      expect(personel.permissions.has(izin), izin).toBe(false);
    }
  });

  it("PATRON tüm Aşama 6 izinlerine sahiptir", () => {
    for (const izin of [
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.PERSONNEL_VIEW,
      PERMISSIONS.PERSONNEL_MANAGE,
      PERMISSIONS.PERSONNEL_COST_VIEW,
      PERMISSIONS.AUDIT_VIEW,
      PERMISSIONS.CASH_REPORT_ALL,
      PERMISSIONS.SETTINGS_BUSINESS_EDIT,
    ]) {
      expect(patron.permissions.has(izin), izin).toBe(true);
    }
  });
});
