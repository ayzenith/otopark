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
import {
  surumOlustur,
  gecerliTarifeler,
  gecerliSurum,
  type KuralGirdi,
} from "../src/server/pricing/admin";
import { toKurus } from "../src/lib/money";
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
 * KARAVAN OTOPARK TARIFESI (karar 04.10.2026)
 *
 *   24 saate kadar                  700 TL
 *   24 saatten sonra baslayan her 24 saat  +700 TL
 *
 * Isletme yalnizca 24 SAATLIK fiyat verdi; karavan icin saatlik kademe
 * BELIRTILMEDI ve UYDURULMADI. Bu yuzden motor parametreleri 24 saatlik tek
 * blok olarak girilir: ilk blok 1440 dk / 700 TL, saatlik ucret YOK.
 * Boylece 1 saatlik karavan parki da 24 saatlik gibi 700 TL olur. Patron
 * karavan icin saatlik kademe isterse panelden girer.
 *
 * Ek blok orantili bolunmez - normal tarifedeki kararin aynisi:
 *   24 sa = 700 · 24 sa 1 dk = 1.400 · 48 sa = 1.400 · 48 sa 1 dk = 2.100
 */
const KARAVAN = {
  aracSinifiKodu: "KARAVAN",
  ilkBlokDakika: 1440,
  ilkBlokUcret: 700 * TL,
  saatlikUcret: 0,
  gunlukUstLimit: 700 * TL,
  ekGunBlokUcret: 700 * TL,
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

/**
 * Veritabanindaki tarife kuralini surumOlustur'un bekledigi girdi bicimine
 * birebir cevirir. Yeni surum acarken MEVCUT kurallarin aynen tasinmasi icin
 * kullanilir: hicbir fiyat degismez, yalnizca eksik kural eklenir.
 */
function kuralaCevir(r: {
  vehicleClassId: string | null;
  freeMinutes: number;
  freeMinutesDeductible: boolean;
  firstPeriodMinutes: number;
  firstPeriodPrice: unknown;
  hourlyPrice: unknown;
  hourlyRoundingMinutes: number;
  dailyPrice: unknown;
  dailyCapPrice: unknown;
  extraDayBlockPrice: unknown;
  nightFlatPrice: unknown;
  nightStartMinute: number | null;
  nightEndMinute: number | null;
  weekendMultiplier: unknown;
  minCharge: unknown;
}): KuralGirdi {
  return {
    vehicleClassId: r.vehicleClassId,
    ucretsizDakika: r.freeMinutes,
    ucretsizDusulur: r.freeMinutesDeductible,
    ilkBlokDakika: r.firstPeriodMinutes,
    ilkBlokUcret: toKurus(r.firstPeriodPrice as string),
    saatlikUcret: toKurus(r.hourlyPrice as string),
    saatYuvarlamaDakika: Math.max(1, r.hourlyRoundingMinutes),
    gunlukUcret: toKurus(r.dailyPrice as string),
    gunlukUstLimit: toKurus(r.dailyCapPrice as string),
    ekGunBlokUcret: toKurus(r.extraDayBlockPrice as string),
    geceSabitUcret: r.nightFlatPrice === null ? null : toKurus(r.nightFlatPrice as string),
    geceBaslangicDakika: r.nightStartMinute,
    geceBitisDakika: r.nightEndMinute,
    haftaSonuKatsayisi:
      r.weekendMultiplier === null ? null : Number(String(r.weekendMultiplier)),
    asgariUcret: toKurus(r.minCharge as string),
  };
}

/**
 * Karavan kuralini YURURLUKTEKI plana ekler - yalnizca EKSIKSE.
 *
 * Neden yeni surum: yururlukteki surumun kural satirlarini duzenlemek,
 * o surumle ucretlendirilmis gecmis park kayitlarinin dayanagini degistirir.
 * Mimari kural 3 (tarihsel degismezlik) bunu yasaklar. Bu yuzden mevcut
 * kurallarin BIREBIR kopyasi + karavan kurali ile yeni surum acilir.
 */
async function karavanKuraliniKur(
  actor: SessionUser,
  karavanKurali: KuralGirdi | null,
): Promise<string[]> {
  if (!karavanKurali) {
    return ["ATLANDI  karavan tarifesi — KARAVAN araç sınıfı yok (`npm run db:seed`)"];
  }

  // Varsayilan plan yoksa en yuksek oncelikli aktif plan.
  const plan = await prisma.tariffPlan.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { priority: "desc" }],
  });
  if (!plan) {
    return ["ATLANDI  karavan tarifesi — aktif tarife planı yok"];
  }

  const surum = await gecerliSurum(plan.id);
  if (!surum) {
    return [`ATLANDI  karavan tarifesi — ${plan.name} planının yürürlükteki sürümü yok`];
  }

  const varOlan = surum.rules.find((r) => r.vehicleClassId === karavanKurali.vehicleClassId);
  if (varOlan) {
    const ucret = toKurus(varOlan.firstPeriodPrice as unknown as string);
    return [
      `ATLANDI  karavan tarifesi — zaten tanımlı ` +
        `(${(ucret / 100).toLocaleString("tr-TR")} ₺ / ilk ${varOlan.firstPeriodMinutes} dk)`,
    ];
  }

  await surumOlustur(actor, {
    planId: plan.id,
    // 60_000 degil: bkz. yukaridaki DIKKAT notu.
    gecerlilikBaslangici: new Date(Date.now() - 30_000),
    degisiklikNotu:
      "Karavan tarifesi eklendi (700 ₺ / 24 saat, her ek 24 saat +700 ₺ — karar 04.10.2026). " +
      "Diğer kurallar aynen taşındı.",
    // ONEMLI: mevcut kurallar AYNEN tasinir, yalnizca karavan eklenir.
    kurallar: [...surum.rules.map(kuralaCevir), karavanKurali],
  });

  return [
    `YAZILDI  karavan tarifesi — 700 ₺ / 24 saat, her ek 24 saat +700 ₺ ` +
      `(${plan.name} s.${surum.versionNo + 1})`,
  ];
}

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
  // 1. OTOPARK TARIFESI (genel kural + karavan kurali)
  // -------------------------------------------------------------------------
  const karavanSinifi = await prisma.vehicleClass.findUnique({
    where: { code: KARAVAN.aracSinifiKodu },
  });

  /** Karavana ozel tarife kurali. Sinif yoksa kural da yazilmaz. */
  const karavanKurali: KuralGirdi | null = karavanSinifi
    ? {
        vehicleClassId: karavanSinifi.id,
        ucretsizDakika: 0,
        ucretsizDusulur: false,
        ilkBlokDakika: KARAVAN.ilkBlokDakika,
        ilkBlokUcret: KARAVAN.ilkBlokUcret,
        saatlikUcret: KARAVAN.saatlikUcret,
        saatYuvarlamaDakika: 60,
        gunlukUcret: 0,
        gunlukUstLimit: KARAVAN.gunlukUstLimit,
        ekGunBlokUcret: KARAVAN.ekGunBlokUcret,
        geceSabitUcret: null,
        geceBaslangicDakika: null,
        geceBitisDakika: null,
        haftaSonuKatsayisi: null,
        asgariUcret: 0,
      }
    : null;

  const genelKural: KuralGirdi = {
    // Normal otoparkta arac sinifina gore fiyat farki YOK: genel kural.
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
  };

  const mevcutTarifeler = await gecerliTarifeler();
  if (mevcutTarifeler.length === 0) {
    // --- ILK KURULUM: plan + ilk surum, iki kuralla birlikte ---
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
      // Hemen gecerli olsun: biraz geriden baslatilir ki "gelecek tarih"
      // kontrolune takilmadan aninda devreye girsin.
      //
      // DIKKAT: tam 60_000 KULLANILMAZ. surumOlustur gecmise tarihlemeyi
      // 60 saniye toleransla reddeder ve araya giren birkac milisaniye
      // siniri asirip betigi hataya dusurur (yasandi). 30 saniye guvenli.
      gecerlilikBaslangici: new Date(Date.now() - 30_000),
      degisiklikNotu: "Başlangıç tarifesi (işletme sahibinin verdiği değerler, 04.10.2026)",
      kurallar: karavanKurali ? [genelKural, karavanKurali] : [genelKural],
    });
    satirlar.push(`YAZILDI  otopark tarifesi — ${OTOPARK.planAdi}`);
    satirlar.push(
      karavanKurali
        ? `YAZILDI  karavan tarifesi — 700 ₺ / 24 saat, her ek 24 saat +700 ₺`
        : "ATLANDI  karavan tarifesi — KARAVAN araç sınıfı yok (`npm run db:seed`)",
    );
  } else {
    satirlar.push(
      `ATLANDI  otopark tarifesi — zaten tanımlı (${mevcutTarifeler
        .map((t) => `${t.planAdi} s.${t.surumNo}`)
        .join(", ")})`,
    );

    // --- MEVCUT KURULUM: yalnizca EKSIK olan karavan kurali eklenir ---
    //
    // TARIHSEL DEGISMEZLIK: yururlukteki surumun satirlarina DOKUNULMAZ.
    // Karavan kurali eksikse mevcut kurallarin birebir kopyasi + karavan
    // kuraliyla YENI SURUM acilir; eski surum oldugu gibi kapanir ve o
    // surumle ucretlendirilmis gecmis park kayitlari izlenebilir kalir.
    satirlar.push(...(await karavanKuraliniKur(actor, karavanKurali)));
  }

  // Karavan standart tarife disidir: cozumleyici bu sinifta GENEL kurala
  // dusmez, yalnizca yukaridaki karavan kurali gecerlidir.
  if (karavanSinifi && !karavanSinifi.excludeFromStandardTariff) {
    await prisma.vehicleClass.update({
      where: { id: karavanSinifi.id },
      data: { excludeFromStandardTariff: true },
    });
    satirlar.push("YAZILDI  karavan standart tarife dışına alındı");
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
  console.log("    · Motor yıkama (ek hizmet) ücreti");
  console.log("    · Diğer yıkama hizmetleri (iç temizlik, pasta cila…)");
  console.log("    · Karavan YIKAMA ücreti (otopark ücreti girildi, yıkama değil)");
  console.log(cizgi);
  console.log("  OTOPARK KAPASİTESİ: karar 04.10.2026 — KAPASİTE SINIRI YOK.");
  console.log("    Kapasite 0 bırakıldı; araç girişi doluluk yüzünden engellenmez.");
  console.log(`${cizgi}\n`);
}

main()
  .catch((hata) => {
    console.error("\nBaşlangıç fiyatları yazılamadı:", hata);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
