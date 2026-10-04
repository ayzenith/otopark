/**
 * TARIFE YONETIMI TESTLERI
 *
 * DIKKAT: Buradaki fiyatlar YALNIZCA TEST icindir; isletmenin gercek tarifesi
 * DEGILDIR. Gercek fiyatlar patron tarafindan panelden girilecek (docs/07 S1).
 *
 * Dogrulanan temel kural: AKTIF SURUM DOGRUDAN DUZENLENMEZ. Her fiyat
 * degisikligi yeni surum uretir ve gecmis park ucretleri degismez.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { aracSinifiGetir, kullaniciOlustur, oturum, prisma, temizle, vardiyaOlustur } from "./helpers";
import {
  gecerliSurum,
  gecerliTarifeler,
  kapasiteGuncelle,
  planDurumDegistir,
  planOlustur,
  surumOlustur,
  tarifeOnizleme,
  tarifePlanlari,
} from "@/server/pricing/admin";
import { cozumleTarife } from "@/server/pricing/resolve";
import type { KuralGirdi } from "@/server/pricing/admin";
import type { SessionUser } from "@/server/auth/session";

let patron: SessionUser;
let sinifId: string;

/** Tum alanlari sifir olan kural - patron hangi alani doldurursa o gecerli. */
function bosKural(ek: Partial<KuralGirdi> = {}): KuralGirdi {
  return {
    vehicleClassId: null,
    ucretsizDakika: 0,
    ucretsizDusulur: false,
    ilkBlokDakika: 0,
    ilkBlokUcret: 0,
    saatlikUcret: 0,
    saatYuvarlamaDakika: 60,
    gunlukUcret: 0,
    gunlukUstLimit: 0,
    geceSabitUcret: null,
    geceBaslangicDakika: null,
    geceBitisDakika: null,
    haftaSonuKatsayisi: null,
    asgariUcret: 0,
    ...ek,
  };
}

beforeEach(async () => {
  await temizle();
  sinifId = (await aracSinifiGetir()).id;
  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  await vardiyaOlustur(o.id);
  patron = oturum(o);
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

describe("plan oluşturma", () => {
  it("plan oluşturulur ve denetime yazılır", async () => {
    const plan = await planOlustur(patron, { ad: "Standart 2026", varsayilan: true });
    expect(plan.name).toBe("Standart 2026");
    expect(plan.isDefault).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityType: "TariffPlan" } })).toBe(1);
  });

  it("yeni varsayılan plan eskisinin varsayılanlığını kaldırır", async () => {
    const ilk = await planOlustur(patron, { ad: "Eski", varsayilan: true });
    await planOlustur(patron, { ad: "Yeni", varsayilan: true });
    const guncel = await prisma.tariffPlan.findUniqueOrThrow({ where: { id: ilk.id } });
    expect(guncel.isDefault).toBe(false);
  });

  it("çok kısa plan adı reddedilir", async () => {
    await expect(planOlustur(patron, { ad: "X" })).rejects.toThrow(/en az 2 karakter/i);
  });
});

describe("sürüm oluşturma", () => {
  it("ilk sürüm oluşturulur", async () => {
    const plan = await planOlustur(patron, { ad: "Standart", varsayilan: true });
    const surum = await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(),
      degisiklikNotu: "İlk tarife girişi",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });

    expect(surum.versionNo).toBe(1);
    expect(surum.effectiveTo).toBeNull();
    expect(surum.rules).toHaveLength(1);
    expect(surum.rules[0]!.hourlyPrice.toString()).toBe("25");
  });

  it("FİYAT DEĞİŞİKLİĞİ YENİ SÜRÜM ÜRETİR, eskisine dokunulmaz", async () => {
    const plan = await planOlustur(patron, { ad: "Standart", varsayilan: true });
    const v1 = await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(),
      degisiklikNotu: "İlk tarife",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });

    const v2Baslangic = new Date(Date.now() + 1000);
    const v2 = await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: v2Baslangic,
      degisiklikNotu: "Fiyat artışı",
      kurallar: [bosKural({ saatlikUcret: 3000 })],
    });

    expect(v2.versionNo).toBe(2);

    // v1'in FIYATI DEGISMEDI, yalnizca effectiveTo kapandi.
    const v1Guncel = await prisma.tariffVersion.findUniqueOrThrow({
      where: { id: v1.id },
      include: { rules: true },
    });
    expect(v1Guncel.rules[0]!.hourlyPrice.toString()).toBe("25");
    expect(v1Guncel.effectiveTo?.getTime()).toBe(v2Baslangic.getTime());
  });

  it("değişiklik tarihçesi tutulur", async () => {
    const plan = await planOlustur(patron, { ad: "Standart", varsayilan: true });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(),
      degisiklikNotu: "İlk",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(Date.now() + 1000),
      degisiklikNotu: "Zam",
      kurallar: [bosKural({ saatlikUcret: 3000 })],
    });

    const tarihce = await prisma.tariffChangeLog.findMany({ orderBy: { changedAt: "asc" } });
    expect(tarihce).toHaveLength(2);
    expect(tarihce[1]!.note).toBe("Zam");
    expect(tarihce[1]!.fromVersionId).not.toBeNull();
    expect(tarihce[1]!.changedById).toBe(patron.id);
  });

  it("değişiklik notu zorunludur", async () => {
    const plan = await planOlustur(patron, { ad: "Standart" });
    await expect(
      surumOlustur(patron, {
        planId: plan.id,
        gecerlilikBaslangici: new Date(),
        degisiklikNotu: "",
        kurallar: [bosKural({ saatlikUcret: 2500 })],
      }),
    ).rejects.toThrow(/notu girilmesi zorunlu/i);
  });

  it("GEÇMİŞE TARİHLİ sürüm reddedilir", async () => {
    // Gecmise tarihli surum, gecmis park kayitlarinin tarifesini belirsiz yapar.
    const plan = await planOlustur(patron, { ad: "Standart" });
    await expect(
      surumOlustur(patron, {
        planId: plan.id,
        gecerlilikBaslangici: new Date(Date.now() - 86400_000),
        degisiklikNotu: "Geçmişe tarihli",
        kurallar: [bosKural({ saatlikUcret: 2500 })],
      }),
    ).rejects.toThrow(/geçmişe tarihlenemez/i);
  });

  it("kural listesi boş olamaz", async () => {
    const plan = await planOlustur(patron, { ad: "Standart" });
    await expect(
      surumOlustur(patron, {
        planId: plan.id,
        gecerlilikBaslangici: new Date(),
        degisiklikNotu: "Boş",
        kurallar: [],
      }),
    ).rejects.toThrow(/en az bir tarife kuralı/i);
  });

  it("aynı araç sınıfı için iki kural girilemez", async () => {
    const plan = await planOlustur(patron, { ad: "Standart" });
    await expect(
      surumOlustur(patron, {
        planId: plan.id,
        gecerlilikBaslangici: new Date(),
        degisiklikNotu: "Tekrar",
        kurallar: [
          bosKural({ vehicleClassId: sinifId, saatlikUcret: 2500 }),
          bosKural({ vehicleClassId: sinifId, saatlikUcret: 3000 }),
        ],
      }),
    ).rejects.toThrow(/birden fazla kural/i);
  });

  it("araç sınıfı başına ayrı kural girilebilir", async () => {
    const suv = await prisma.vehicleClass.upsert({
      where: { code: "SUV" },
      update: {},
      create: { code: "SUV", name: "SUV", sortOrder: 30 },
    });
    const plan = await planOlustur(patron, { ad: "Sınıflı", varsayilan: true });
    const surum = await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(),
      degisiklikNotu: "Sınıf bazlı",
      kurallar: [
        bosKural({ vehicleClassId: null, saatlikUcret: 2500 }),
        bosKural({ vehicleClassId: suv.id, saatlikUcret: 4000 }),
      ],
    });
    expect(surum.rules).toHaveLength(2);
  });
});

describe("kural doğrulama", () => {
  let planId: string;

  beforeEach(async () => {
    planId = (await planOlustur(patron, { ad: "Doğrulama" })).id;
  });

  async function dene(kural: Partial<KuralGirdi>) {
    return surumOlustur(patron, {
      planId,
      gecerlilikBaslangici: new Date(),
      degisiklikNotu: "Doğrulama testi",
      kurallar: [bosKural(kural)],
    });
  }

  it("gece tarifesinin üç alanı birlikte girilmelidir", async () => {
    await expect(dene({ geceSabitUcret: 15000 })).rejects.toThrow(/üçü birlikte/i);
    await expect(
      dene({ geceSabitUcret: 15000, geceBaslangicDakika: 1200 }),
    ).rejects.toThrow(/üçü birlikte/i);

    const ok = await dene({
      geceSabitUcret: 15000,
      geceBaslangicDakika: 1200,
      geceBitisDakika: 480,
    });
    expect(ok.rules[0]!.nightFlatPrice?.toString()).toBe("150");
  });

  it("gece başlangıcı ve bitişi aynı olamaz", async () => {
    await expect(
      dene({ geceSabitUcret: 15000, geceBaslangicDakika: 600, geceBitisDakika: 600 }),
    ).rejects.toThrow(/aynı olamaz/i);
  });

  it("ilk blok süresi ve ücreti birlikte girilmelidir", async () => {
    await expect(dene({ ilkBlokDakika: 60 })).rejects.toThrow(/ücreti girilmedi/i);
    await expect(dene({ ilkBlokUcret: 4000 })).rejects.toThrow(/süresi girilmedi/i);
  });

  it("günlük üst limit günlük ücretten küçük olamaz", async () => {
    await expect(dene({ gunlukUcret: 20000, gunlukUstLimit: 15000 })).rejects.toThrow(
      /küçük olamaz/i,
    );
    const ok = await dene({ gunlukUcret: 20000, gunlukUstLimit: 25000 });
    expect(ok.rules[0]!.dailyCapPrice.toString()).toBe("250");
  });

  it("TAMAMEN BOŞ kural kabul edilir (patron henüz fiyat girmedi)", async () => {
    // Fiyat uydurmamak icin: bos tarife gecerli bir durumdur.
    const surum = await dene({});
    expect(surum.rules[0]!.hourlyPrice.toString()).toBe("0");
  });
});

describe("tarife çözümleme", () => {
  it("geçerli sürüm bulunur", async () => {
    const plan = await planOlustur(patron, { ad: "Standart", varsayilan: true });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(Date.now() - 1000),
      degisiklikNotu: "Aktif",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });

    const sonuc = await cozumleTarife(sinifId, new Date());
    expect(sonuc).not.toBeNull();
    expect(sonuc!.snapshot.saatlikUcret).toBe(2500);
    expect(sonuc!.snapshot.surum).toBe(1);
  });

  it("hiç tarife yoksa null döner (hata değil)", async () => {
    expect(await cozumleTarife(sinifId, new Date())).toBeNull();
  });

  it("ileri tarihli sürüm henüz geçerli değildir", async () => {
    const plan = await planOlustur(patron, { ad: "Gelecek", varsayilan: true });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(Date.now() + 86400_000),
      degisiklikNotu: "Yarından geçerli",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });
    expect(await cozumleTarife(sinifId, new Date())).toBeNull();
    // Yarin gecerli olur.
    const yarin = new Date(Date.now() + 86400_000 + 1000);
    expect(await cozumleTarife(sinifId, yarin)).not.toBeNull();
  });

  it("pasif plan çözümlenmez", async () => {
    const plan = await planOlustur(patron, { ad: "Pasif", varsayilan: true });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(Date.now() - 1000),
      degisiklikNotu: "Aktif",
      kurallar: [bosKural({ saatlikUcret: 2500 })],
    });
    await planDurumDegistir(patron, plan.id, false);
    expect(await cozumleTarife(sinifId, new Date())).toBeNull();
  });

  it("gecerliSurum ve gecerliTarifeler okuma fonksiyonları çalışır", async () => {
    const plan = await planOlustur(patron, { ad: "Standart", varsayilan: true });
    await surumOlustur(patron, {
      planId: plan.id,
      gecerlilikBaslangici: new Date(Date.now() - 1000),
      degisiklikNotu: "Aktif",
      kurallar: [bosKural({ saatlikUcret: 2500, ucretsizDakika: 15 })],
    });

    const surum = await gecerliSurum(plan.id);
    expect(surum?.versionNo).toBe(1);

    const liste = await gecerliTarifeler();
    expect(liste).toHaveLength(1);
    expect(liste[0]!.kurallar[0]!.saatlikUcret).toBe(2500);
    expect(liste[0]!.kurallar[0]!.aracSinifi).toBe("Tüm araçlar");

    const planlar = await tarifePlanlari();
    expect(planlar).toHaveLength(1);
    expect(planlar[0]!.versions).toHaveLength(1);
  });
});

describe("tarife önizlemesi", () => {
  it("patron fiyat değişikliğinin etkisini görebilir", async () => {
    const eski = tarifeOnizleme(bosKural({ ilkBlokDakika: 60, ilkBlokUcret: 4000, saatlikUcret: 2500 }));
    const yeni = tarifeOnizleme(bosKural({ ilkBlokDakika: 60, ilkBlokUcret: 5000, saatlikUcret: 3000 }));

    const eski3Saat = eski.find((o) => o.dakika === 192)!;
    const yeni3Saat = yeni.find((o) => o.dakika === 192)!;

    expect(eski3Saat.kurus).toBe(11500); // 40 + 3×25
    expect(yeni3Saat.kurus).toBe(14000); // 50 + 3×30
    expect(yeni3Saat.kurus).toBeGreaterThan(eski3Saat.kurus);
  });

  it("boş tarifede önizleme 0 gösterir", async () => {
    const onizleme = tarifeOnizleme(bosKural());
    expect(onizleme.every((o) => o.kurus === 0)).toBe(true);
  });
});

describe("kapasite ayarı", () => {
  it("kapasite girilir ve denetime yazılır", async () => {
    const ayar = await kapasiteGuncelle(patron, { kapasite: 80 });
    expect(ayar.totalCapacity).toBe(80);
    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: "ParkingCapacitySetting" },
    });
    expect((kayit.after as Record<string, unknown>).kapasite).toBe(80);
  });

  it("kapasite 0 girilebilir (tanım kaldırılır, giriş engellenmez)", async () => {
    await kapasiteGuncelle(patron, { kapasite: 80 });
    const ayar = await kapasiteGuncelle(patron, { kapasite: 0 });
    expect(ayar.totalCapacity).toBe(0);
    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: "ParkingCapacitySetting" },
      orderBy: { at: "desc" },
    });
    expect(kayit.note).toContain("giriş engellenmez");
  });

  it("negatif kapasite reddedilir", async () => {
    await expect(kapasiteGuncelle(patron, { kapasite: -5 })).rejects.toThrow(/pozitif/i);
  });

  it("ondalıklı kapasite reddedilir", async () => {
    await expect(kapasiteGuncelle(patron, { kapasite: 12.5 })).rejects.toThrow(/tam sayı/i);
  });
});
