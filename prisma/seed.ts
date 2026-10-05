/**
 * Ilk kurulum verisi.
 *
 * ============================================================================
 * PAROLA GUVENLIGI
 * ----------------------------------------------------------------------------
 * Ilk patron hesabinin baslangic parolasi:
 *   - OWNER_INITIAL_PASSWORD ortam degiskeni verilmisse o kullanilir,
 *   - verilmemisse KRIPTOGRAFIK OLARAK GUVENLI rastgele bir parola uretilir.
 *
 * Uretilen parola YALNIZCA terminal ekranina bir kez yazilir. Hicbir dosyaya,
 * koda, log kaydina veya veritabanina acik metin olarak yazilmaz; veritabaninda
 * yalnizca Argon2id ozeti saklanir.
 *
 * Hesap mustChangePassword=true olarak olusturulur: patron ilk giriste kendi
 * parolasini belirlemeden panele giremez.
 * ============================================================================
 *
 * VARSAYIM YAPILMAYAN VERILER
 * Gercek isletme kurallari henuz kesinlesmediginden (docs/07) su veriler
 * BOS birakilir ve panelden girilir:
 *   - otopark tarifeleri (saatlik/gunluk ucret, ucretsiz sure, gece tarifesi)
 *   - otopark kapasitesi
 *   - oto yikama hizmet fiyatlari
 *   - abonman turleri ve fiyatlari
 * Yalnizca YAPISAL veriler (arac siniflari, gider kategorileri) olusturulur;
 * bunlarin da fiyat bilgisi yoktur.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword, generateSecurePassword, checkPasswordStrength } from "../src/server/auth/password";

const prisma = new PrismaClient();

/**
 * Arac siniflari - YAPISAL veri, fiyat icermez.
 * Gercek sinif listesi docs/07 S2'de soruldu; "Londra Camping" adi karavan ve
 * cekici park hizmeti de olabilecegini dusundurdugu icin bu siniflar da
 * eklendi ancak hepsi panelden duzenlenebilir/pasiflestirilebilir.
 */
const ARAC_SINIFLARI = [
  { code: "MOTOSIKLET", name: "Motosiklet", sortOrder: 10 },
  { code: "OTOMOBIL", name: "Otomobil", sortOrder: 20 },
  { code: "SUV", name: "SUV / Arazi", sortOrder: 30 },
  { code: "MINIBUS", name: "Minibüs", sortOrder: 40 },
  { code: "KAMYONET", name: "Kamyonet", sortOrder: 50 },
  { code: "KARAVAN", name: "Karavan", sortOrder: 60 },
  { code: "CEKICI", name: "Çekici / Römork", sortOrder: 70 },
];

/**
 * Gider kategorileri - docs/02'deki liste. isSystem olanlar silinemez.
 *
 * `aktif: false` olanlar olusturulur ama KULLANIM DISIDIR: patron gider
 * ekranindan secemez. Kategori silinmez cunku gecmis kayitlar kategorisini
 * kaybetmemelidir.
 */
const GIDER_KATEGORILERI = [
  { code: "MAAS", name: "Personel maaşı", isSystem: true, sortOrder: 10 },
  {
    code: "AVANS",
    name: "Personel avansı (kullanım dışı)",
    isSystem: true,
    sortOrder: 20,
    /**
     * KARAR (05.10.2026): personel avansi GIDER DEGIL, maastan dusulecek
     * ALACAKTIR. Avans "Yönetim → Personel → Avans" akisindan verilir;
     * kasadan para cikar ama gider yazilmaz, maas odemesinde mahsup edilir.
     *
     * Kategori acik kalirsa patron avansi elle gider olarak girebilir ve
     * tutar IKI KEZ sayilir. Bu yuzden pasif.
     */
    aktif: false,
  },
  { code: "PRIM", name: "Personel primi", isSystem: true, sortOrder: 30 },
  { code: "SGK", name: "Sigorta / SGK", isSystem: true, sortOrder: 40 },
  { code: "YEMEK", name: "Yemek", isSystem: true, sortOrder: 50 },
  { code: "ELEKTRIK", name: "Elektrik", isSystem: true, sortOrder: 60 },
  { code: "SU", name: "Su", isSystem: true, sortOrder: 70 },
  { code: "KIRA", name: "Kira", isSystem: true, sortOrder: 80 },
  { code: "YIKAMA_MALZEME", name: "Oto yıkama malzemesi", isSystem: true, sortOrder: 90 },
  { code: "TEMIZLIK_SARF", name: "Temizlik ve sarf malzemesi", isSystem: true, sortOrder: 100 },
  { code: "BAKIM_ONARIM", name: "Bakım ve onarım", isSystem: true, sortOrder: 110 },
  { code: "VERGI", name: "Vergi ve resmî ödemeler", isSystem: true, sortOrder: 120 },
  { code: "DIGER", name: "Diğer işletme gideri", isSystem: true, sortOrder: 999 },
] as { code: string; name: string; isSystem: boolean; sortOrder: number; aktif?: boolean }[];

async function main() {
  const satirlar: string[] = [];

  // --- Arac siniflari ---
  for (const s of ARAC_SINIFLARI) {
    await prisma.vehicleClass.upsert({
      where: { code: s.code },
      update: { name: s.name, sortOrder: s.sortOrder },
      create: s,
    });
  }
  satirlar.push(`Araç sınıfı: ${ARAC_SINIFLARI.length} kayıt`);

  // --- Gider kategorileri ---
  for (const k of GIDER_KATEGORILERI) {
    const { aktif, ...alanlar } = k;
    await prisma.expenseCategory.upsert({
      where: { code: k.code },
      update: { name: k.name, sortOrder: k.sortOrder, isSystem: k.isSystem, isActive: aktif ?? true },
      create: { ...alanlar, isActive: aktif ?? true },
    });
  }
  satirlar.push(`Gider kategorisi: ${GIDER_KATEGORILERI.length} kayıt`);

  // --- Isletme ayarlari (tek satir) ---
  // Gercek isletme bilgileri docs/07 S18'de soruldu; varsayim yapilmaz.
  await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName: "Londra Camping Otopark",
      addressText: "",
      phone: "",
      workingHoursText: "",
      timezone: "Europe/Istanbul",
      businessDayStartHour: 0, // karar 02.10.2026: takvim günü
      currency: "TRY",
    },
  });
  satirlar.push("İşletme ayarı: oluşturuldu (bilgiler panelden girilecek)");

  // --- Kapasite ayari ---
  // Gercek kapasite docs/07 S3'te soruldu; 0 = "henuz girilmedi".
  await prisma.parkingCapacitySetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", totalCapacity: 0, warnThresholdPercent: 90 },
  });
  satirlar.push("Kapasite ayarı: oluşturuldu (kapasite henüz girilmedi)");

  // --- Ilk patron hesabi ---
  const username = (process.env.OWNER_USERNAME || "patron").trim().toLowerCase();
  const fullName = process.env.OWNER_FULLNAME || "İşletme Sahibi";

  const mevcut = await prisma.user.findUnique({ where: { username } });

  let uretilenParola: string | null = null;

  if (mevcut) {
    satirlar.push(`Patron hesabı: "${username}" zaten var, dokunulmadı`);
  } else {
    const verilen = process.env.OWNER_INITIAL_PASSWORD?.trim();

    if (verilen) {
      const guc = checkPasswordStrength(verilen);
      if (!guc.ok) {
        console.error("\n✖ OWNER_INITIAL_PASSWORD yeterince güçlü değil:");
        for (const e of guc.errors) console.error(`  - ${e}`);
        console.error("\nDeğişkeni boş bırakırsanız güvenli bir parola otomatik üretilir.\n");
        process.exit(1);
      }
    } else {
      uretilenParola = generateSecurePassword(16);
    }

    const parola = verilen || uretilenParola!;

    await prisma.user.create({
      data: {
        username,
        passwordHash: await hashPassword(parola),
        fullName,
        role: "OWNER",
        jobTitle: "İşletme Sahibi",
        isActive: true,
        // Ilk giriste parola degistirme ZORUNLU.
        mustChangePassword: true,
      },
    });
    satirlar.push(`Patron hesabı: "${username}" oluşturuldu (OWNER)`);
  }

  // --- Ozet ---
  console.log("\n✔ Kurulum verisi hazır:\n");
  for (const s of satirlar) console.log(`  · ${s}`);

  if (uretilenParola) {
    console.log(`
┌──────────────────────────────────────────────────────────────┐
│  BAŞLANGIÇ PAROLASI - BU EKRANDA BİR KEZ GÖSTERİLİYOR        │
├──────────────────────────────────────────────────────────────┤
│  Kullanıcı adı : ${username.padEnd(44)}│
│  Parola        : ${uretilenParola.padEnd(44)}│
├──────────────────────────────────────────────────────────────┤
│  Bu parola hiçbir dosyaya kaydedilmedi. Şimdi not alın.      │
│  İlk girişte kendi parolanızı belirlemeniz ZORUNLUDUR.       │
│  Terminal geçmişinizi başkasıyla paylaşmayın.                │
└──────────────────────────────────────────────────────────────┘
`);
  }

  console.log(`
Not: Gerçek işletme kuralları henüz kesinleşmediği için (docs/07) otopark
tarifeleri, kapasite, yıkama fiyatları ve abonman türleri BOŞ bırakıldı.
Bunlar varsayılmaz; panelden girilecek.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
