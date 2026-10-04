/**
 * BASLANGIC FIYATLARINI VERITABANINA YAZAR
 *
 * ============================================================================
 * BU BIR "KODA SABITLENMIS FIYAT" DEGILDIR
 * ----------------------------------------------------------------------------
 * Buradaki degerler isletme sahibinin 04.10.2026'da yazili olarak verdigi
 * fiyatlardir ve VERITABANINA VERI OLARAK yazilir. Uygulama kodu bu sayilari
 * hicbir yerde okumaz; daima veritabanindaki surumlu kayitlari kullanir.
 * Patron panelden fiyat degistirdiginde bu dosya ONEMSIZ hale gelir ve bir
 * daha calistirilmaz.
 *
 * Amaci: sistemi ilk kurarken patronun 20 alani elle doldurmak zorunda
 * kalmamasi. Tek komutla baslangic fiyatlari girilir, sonrasi panelden
 * yonetilir.
 *
 * GUVENLIK: Bu betik MEVCUT FIYATLARI EZMEZ. Zaten tanimli bir tarife veya
 * yikama fiyati varsa o kalem ATLANIR ve ekrana yazilir. Boylece canlida
 * kazara calistirilsa bile patronun girdigi fiyatlar bozulmaz.
 *
 * Kullanim:  npm run fiyatlar:kur
 * ============================================================================
 */

import { PrismaClient } from "@prisma/client";
import { resolvePermissions } from "../src/lib/permissions";
import { surumOlustur, gecerliTarifeler } from "../src/server/pricing/admin";
import { yikamaHizmetiOlustur, yikamaFiyatiGuncelle } from "../src/server/wash/admin";
import { yikamaFiyatTablosu } from "../src/server/wash/pricing";
import type { SessionUser } from "../src/server/auth/session";

const prisma = new PrismaClient();
const TL = 100; // 1 TL = 100 kurus

// ---------------------------------------------------------------------------
// ISLETMENIN VERDIGI DEGERLER (04.10.2026)
// ---------------------------------------------------------------------------

/**
 * OTOPARK TARIFESI
 *
 *   0–1 saat 100 · 1–2 saat 150 · 2–3 saat 200 · 3–4 saat 250 · 4–5 saat 300
 *   5–6 saat 350 · 6–7 saat 400 · 7–8 saat 450 · 8–9 saat 500 · 9–24 saat 500
 *   24 saatten sonra her ek 24 saat +600
 *
 * Motor parametrelerine donusumu: ilk 60 dk 100 TL, sonra saatlik 50 TL
 * (baslayan saat tam), gunluk ust limit 500 TL, 24 saat sonrasi ek gun 600 TL.
 * Gece tarifesi YOK, hafta sonu farki YOK, arac sinifina gore fark YOK.
 */
const OTOPARK = {
  planAdi: "Standart Otopark Tarifesi",
  ilkBlokDakika: 60,
  ilkBlokUcret: 100 * TL,
  saatlikUcret: 50 * TL,
  gunlukUstLimit: 500 * TL,
  ekGunBlokUcret: 600 * TL,
};

/**
 * OTO YIKAMA
 *
 * Fiyat ARAC TIPINE gore degisir (otoparkta degismez).
 * Isletmenin verdigi ornek fiyatlar: Otomobil 600, SUV 700, Motosiklet 400.
 *
 * Ek hizmetlerin (motor yikama gibi) fiyati BELIRLENMEDI: hizmet olusturulur
 * ama fiyati BOS birakilir. Patron panelden girecek.
 */
const YIKAMA_HIZMETLERI = [
  {
    kod: "IC_DIS_YIKAMA",
    ad: "İç Dış Yıkama",
    aciklama: "Standart iç ve dış yıkama",
    tahminiDakika: 40,
    siraNo: 10,
    /** Arac sinifi kodu -> kurus. Listede olmayan tip = fiyat tanimsiz. */
    sinifFiyatlari: {
      OTOMOBIL: 600 * TL,
      SUV: 700 * TL,
      MOTOSIKLET: 400 * TL,
    } as Record<string, number>,
  },
  {
    kod: "MOTOR_YIKAMA",
    ad: "Motor Yıkama",
    aciklama: "Ek hizmet — motor bölümü yıkama",
    tahminiDakika: 20,
    siraNo: 20,
    // FIYAT BELIRLENMEDI: bilerek bos. Patron panelden girecek.
    sinifFiyatlari: {} as Record<string, number>,
  },
];

async function main() {
  const patron = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (!patron) {
    throw new Error(
      "Patron hesabı bulunamadı. Önce `npm run db:seed` çalıştırın.",
    );
  }

  const actor: SessionUser = {
    id: patron.id,
    username: patron.username,
    fullName: patron.fullName,
    role: "OWNER",
    jobTitle: patron.jobTitle,
    mustChangePassword: patron.mustChangePassword,
    permissions: resolvePermissions("OWNER", []),
    sessionId: "baslangic-fiyatlari-betigi",
  };

  const satirlar: string[] = [];

  // -------------------------------------------------------------------------
  // 1. OTOPARK TARIFESI
  // -------------------------------------------------------------------------
  const mevcutTarifeler = await gecerliTarifeler();
  if (mevcutTarifeler.length > 0) {
    satirlar.push(
      `ATLANDI  otopark tarifesi — zaten tanımlı (${mevcutTarifeler
        .map((t) => `${t.planAdi} s.${t.surumNo}`)
        .join(", ")})`,
    );
  } else {
    const plan = await prisma.tariffPlan.create({
      data: {
        name: OTOPARK.planAdi,
        description: "İşletme sahibinin verdiği başlangıç tarifesi (04.10.2026)",
        isActive: true,
        isDefault: true,
        priority: 100,
        createdById: actor.id,
      },
    });

    await surumOlustur(actor, {
      planId: plan.id,
      // Hemen gecerli olsun: 1 dakika once baslatilir ki "gelecek tarih"
      // kontrolune takilmadan aninda devreye girsin.
      gecerlilikBaslangici: new Date(Date.now() - 60_000),
      degisiklikNotu: "Başlangıç tarifesi (işletme sahibinin verdiği değerler, 04.10.2026)",
      kurallar: [
        {
          // Arac sinifina gore fiyat farki YOK: genel kural.
          vehicleClassId: null,
          ucretsizDakika: 0,
          ucretsizDusulur: false,
          ilkBlokDakika: OTOPARK.ilkBlokDakika,
          ilkBlokUcret: OTOPARK.ilkBlokUcret,
          saatlikUcret: OTOPARK.saatlikUcret,
          saatYuvarlamaDakika: 60,
          gunlukUcret: 0,
          gunlukUstLimit: OTOPARK.gunlukUstLimit,
          ekGunBlokUcret: OTOPARK.ekGunBlokUcret,
          geceSabitUcret: null,
          geceBaslangicDakika: null,
          geceBitisDakika: null,
          haftaSonuKatsayisi: null,
          asgariUcret: 0,
        },
      ],
    });
    satirlar.push(`YAZILDI  otopark tarifesi — ${OTOPARK.planAdi}`);
  }

  // Karavan: standart tarife disi oldugu dogrulanir (migration ile isaretlenir).
  const karavan = await prisma.vehicleClass.findUnique({ where: { code: "KARAVAN" } });
  if (karavan) {
    if (!karavan.excludeFromStandardTariff) {
      await prisma.vehicleClass.update({
        where: { id: karavan.id },
        data: { excludeFromStandardTariff: true },
      });
      satirlar.push("YAZILDI  karavan standart tarife dışına alındı");
    } else {
      satirlar.push("TAMAM    karavan standart tarife dışında (fiyatı belirlenmedi)");
    }
  }

  // -------------------------------------------------------------------------
  // 2. OTO YIKAMA HIZMETLERI VE FIYATLARI
  // -------------------------------------------------------------------------
  const siniflar = await prisma.vehicleClass.findMany({ select: { id: true, code: true } });
  const sinifHaritasi = new Map(siniflar.map((s) => [s.code, s.id]));
  const tablo = await yikamaFiyatTablosu();

  for (const hizmet of YIKAMA_HIZMETLERI) {
    let mevcut = await prisma.washServiceCatalog.findUnique({ where: { code: hizmet.kod } });

    if (!mevcut) {
      mevcut = await yikamaHizmetiOlustur(actor, {
        kod: hizmet.kod,
        ad: hizmet.ad,
        aciklama: hizmet.aciklama,
        tahminiDakika: hizmet.tahminiDakika,
        siteGorunur: false,
        siraNo: hizmet.siraNo,
      });
      satirlar.push(`YAZILDI  yıkama hizmeti — ${hizmet.ad}`);
    } else {
      satirlar.push(`ATLANDI  yıkama hizmeti — ${hizmet.ad} (zaten var)`);
    }

    const mevcutSatir = tablo.hizmetler.find((h) => h.id === mevcut!.id);

    for (const [sinifKodu, ucret] of Object.entries(hizmet.sinifFiyatlari)) {
      const sinifId = sinifHaritasi.get(sinifKodu);
      if (!sinifId) {
        satirlar.push(`ATLANDI  ${hizmet.ad} / ${sinifKodu} — araç sınıfı yok`);
        continue;
      }

      // Zaten fiyat varsa EZILMEZ.
      if (mevcutSatir && mevcutSatir.sinifFiyatlari[sinifId] !== null) {
        satirlar.push(`ATLANDI  ${hizmet.ad} / ${sinifKodu} — fiyat zaten tanımlı`);
        continue;
      }

      await yikamaFiyatiGuncelle(actor, {
        washServiceId: mevcut.id,
        vehicleClassId: sinifId,
        ucretKurus: ucret,
        not: "Başlangıç fiyatı (işletme sahibinin verdiği değerler, 04.10.2026)",
      });
      satirlar.push(
        `YAZILDI  ${hizmet.ad} / ${sinifKodu} — ${(ucret / 100).toLocaleString("tr-TR")} ₺`,
      );
    }

    if (Object.keys(hizmet.sinifFiyatlari).length === 0) {
      satirlar.push(`BEKLIYOR ${hizmet.ad} — fiyatı belirlenmedi, panelden girilecek`);
    }
  }

  // -------------------------------------------------------------------------
  // RAPOR
  // -------------------------------------------------------------------------
  const cizgi = "═".repeat(66);
  console.log(`\n${cizgi}`);
  console.log("  BAŞLANGIÇ FİYATLARI");
  console.log(cizgi);
  for (const s of satirlar) console.log(`  ${s}`);
  console.log(cizgi);
  console.log("  Bundan sonraki tüm fiyat değişiklikleri PATRON PANELİNDEN yapılır:");
  console.log("    Otopark  : Yönetim → Tarifeler");
  console.log("    Yıkama   : Yönetim → Yıkama fiyatları");
  console.log(cizgi);
  console.log("  BELİRLENMEYEN FİYATLAR (kasıtlı olarak boş):");
  console.log("    · Karavan otopark ücreti — ayrı bölüm olarak tasarlanacak");
  console.log("    · Motor yıkama (ek hizmet) ücreti");
  console.log("    · Otopark kapasitesi (0 = sınırsız; giriş engellenmez)");
  console.log(`${cizgi}\n`);
}

main()
  .catch((hata) => {
    console.error("\nBaşlangıç fiyatları yazılamadı:", hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
