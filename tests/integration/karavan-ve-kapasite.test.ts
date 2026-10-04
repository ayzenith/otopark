/**
 * KARAVAN TARIFESI VE KAPASITE KARARI - UCTAN UCA VERITABANI TESTLERI
 *
 * ============================================================================
 * Burada test edilen degerler ISLETMENIN GERCEK KARARLARIDIR (04.10.2026):
 *
 *   · Karavan otoparki : 700 TL / 24 saat, 24 saatten sonra baslayan her
 *                        24 saat icin +700 TL (orantili bolunmez)
 *   · Kapasite         : SINIR YOK. Doluluk yuzunden arac girisi engellenmez
 *
 * Birim testler motoru dogrular (tests/unit/karavan-tarife.test.ts); bu dosya
 * GERCEK VERITABANI uzerinden akisi dogrular: karavan kuralinin cozumlenmesi,
 * snapshot'in park kaydina yazilmasi, cikista dogru tutarin tahsil edilmesi
 * ve karavan ile normal tarifenin birbirine karismamasi.
 * ============================================================================
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  aracSinifiGetir,
  kapasiteAyarla,
  kullaniciOlustur,
  oturum,
  prisma,
  sinifGetir,
  temizle,
  vardiyaOlustur,
} from "./helpers";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { aracGirisi, kapasiteDurumu } from "@/server/parking/entry";
import { aracCikisi } from "@/server/parking/exit";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;

let otomobilSinifi: string;
let karavanSinifi: string;
let personel: SessionUser;

let sayac = 0;
const anahtar = () => `karavan-${Date.now()}-${++sayac}`;

/**
 * Isletmenin gercek tarifesini (genel kural + karavan kurali) tek surumde
 * olusturur - `npm run fiyatlar:kur` betiginin yazdigi yapinin aynisi.
 */
async function gercekTarifeyiKur() {
  const plan = await prisma.tariffPlan.create({
    data: { name: "Standart Otopark Tarifesi", isActive: true, isDefault: true, priority: 100 },
  });

  return prisma.tariffVersion.create({
    data: {
      tariffPlanId: plan.id,
      versionNo: 1,
      effectiveFrom: new Date(Date.now() - 3600_000),
      isActive: true,
      changeNote: "Başlangıç tarifesi",
      rules: {
        create: [
          {
            // GENEL kural: normal otopark (0-1 sa 100, +50/saat, gün 500, ek gün 600)
            vehicleClassId: null,
            firstPeriodMinutes: 60,
            firstPeriodPrice: kurusToDecimalString(100 * TL),
            hourlyPrice: kurusToDecimalString(50 * TL),
            hourlyRoundingMinutes: 60,
            dailyCapPrice: kurusToDecimalString(500 * TL),
            extraDayBlockPrice: kurusToDecimalString(600 * TL),
            isActive: true,
          },
          {
            // KARAVAN kurali: 24 saatlik tek blok 700 TL, ek gün +700 TL
            vehicleClassId: karavanSinifi,
            firstPeriodMinutes: 1440,
            firstPeriodPrice: kurusToDecimalString(700 * TL),
            hourlyPrice: kurusToDecimalString(0),
            hourlyRoundingMinutes: 60,
            dailyCapPrice: kurusToDecimalString(700 * TL),
            extraDayBlockPrice: kurusToDecimalString(700 * TL),
            isActive: true,
          },
        ],
      },
    },
    include: { rules: true },
  });
}

/** Plakayi girer, girisini `dakikaOnce` kadar geriye alir ve kayit id'sini verir. */
async function gecmisGiris(plaka: string, dakikaOnce: number, aracSinifiId?: string) {
  const giris = await aracGirisi(personel, {
    plaka,
    aracSinifiId,
    idempotencyKey: anahtar(),
  });
  await prisma.parkingSession.update({
    where: { id: giris.parkingSessionId },
    data: { entryAt: new Date(Date.now() - dakikaOnce * 60_000) },
  });
  return giris.parkingSessionId;
}

async function cikisTutari(parkingSessionId: string): Promise<number> {
  const sonuc = await aracCikisi(personel, {
    parkingSessionId,
    odemeYontemi: "CASH",
    idempotencyKey: anahtar(),
  });
  return sonuc.odenenTutar;
}

beforeEach(async () => {
  await temizle();
  otomobilSinifi = (await aracSinifiGetir("OTOMOBIL")).id;
  // Karavan STANDART TARIFE DISIDIR: cozumleyici genel kurala dusmez.
  karavanSinifi = (await sinifGetir("KARAVAN", "Karavan", true)).id;

  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);

  // KARAR: kapasite sınırı yok.
  await kapasiteAyarla(0);

  await gercekTarifeyiKur();
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
describe("karavan tarifesi — çözümleme ve snapshot", () => {
  it("karavan girişinde KARAVANA ÖZEL kural çözümlenir, genel kurala düşmez", async () => {
    const giris = await aracGirisi(personel, {
      plaka: "34 KRV 001",
      aracSinifiId: karavanSinifi,
      idempotencyKey: anahtar(),
    });

    expect(giris.tarifeTanimsiz).toBe(false);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
      include: { tariffRule: true },
    });

    // Snapshot karavan kuralindan uretilmis olmali.
    expect(kayit.tariffRule?.vehicleClassId).toBe(karavanSinifi);
    const snapshot = kayit.tariffSnapshot as Record<string, unknown>;
    expect(snapshot.aracSinifiId).toBe(karavanSinifi);
    expect(snapshot.ilkBlokUcret).toBe(700 * TL);
    expect(snapshot.ilkBlokDakika).toBe(1440);
    expect(snapshot.ekGunBlokUcret).toBe(700 * TL);
  });

  it("karavan girişinde 'tarife tanımsız' uyarısı ARTIK çıkmaz", async () => {
    const giris = await aracGirisi(personel, {
      plaka: "34 KRV 002",
      aracSinifiId: karavanSinifi,
      idempotencyKey: anahtar(),
    });

    expect(giris.tarifeTanimsiz).toBe(false);
    expect(giris.uyarilar.join(" ")).not.toMatch(/fiyatı henüz tanımlanmadı/);
  });
});

// ---------------------------------------------------------------------------
describe("karavan tarifesi — çıkışta tahsil edilen tutar", () => {
  it("3 saatlik karavan parkı 700 TL (24 saatlik tek blok)", async () => {
    const id = await gecmisGiris("34 KRV 010", 180, karavanSinifi);
    expect(await cikisTutari(id)).toBe(700 * TL);
  });

  it("tam 24 saat 700 TL", async () => {
    const id = await gecmisGiris("34 KRV 011", 1440, karavanSinifi);
    expect(await cikisTutari(id)).toBe(700 * TL);
  });

  it("24 saat 10 dakika bir ek blok başlatır: 1.400 TL", async () => {
    const id = await gecmisGiris("34 KRV 012", 1450, karavanSinifi);
    expect(await cikisTutari(id)).toBe(1400 * TL);
  });

  it("48 saat hâlâ tek ek blok: 1.400 TL", async () => {
    const id = await gecmisGiris("34 KRV 013", 2880, karavanSinifi);
    expect(await cikisTutari(id)).toBe(1400 * TL);
  });

  it("48 saat 10 dakika ikinci bloğu başlatır: 2.100 TL", async () => {
    const id = await gecmisGiris("34 KRV 014", 2890, karavanSinifi);
    expect(await cikisTutari(id)).toBe(2100 * TL);
  });

  it("tahsilat kaydı tutarla birebir aynıdır", async () => {
    const id = await gecmisGiris("34 KRV 015", 1450, karavanSinifi);
    await cikisTutari(id);

    const odeme = await prisma.payment.findFirstOrThrow({
      where: { parkingSessionId: id, status: "CONFIRMED" },
    });
    expect(toKurus(odeme.amount)).toBe(1400 * TL);
    expect(odeme.sourceType).toBe("PARKING");
  });
});

// ---------------------------------------------------------------------------
describe("karavan ve normal tarife birbirine karışmaz", () => {
  it("aynı sürede otomobil ve karavan FARKLI ücretlendirilir", async () => {
    const otomobil = await gecmisGiris("34 ABC 100", 180, otomobilSinifi);
    const karavan = await gecmisGiris("34 KRV 100", 180, karavanSinifi);

    // 3 saat: normal tarife 200 TL (100 + 2×50), karavan 700 TL.
    expect(await cikisTutari(otomobil)).toBe(200 * TL);
    expect(await cikisTutari(karavan)).toBe(700 * TL);
  });

  it("karavan kuralı eklenmesi normal tarifeyi DEĞİŞTİRMEZ", async () => {
    // Normal tarifenin bantlari karavan kuralindan etkilenmemeli.
    const birSaat = await gecmisGiris("34 ABC 101", 60, otomobilSinifi);
    const dokuzSaat = await gecmisGiris("34 ABC 102", 540, otomobilSinifi);
    const birGunBirDk = await gecmisGiris("34 ABC 103", 1441, otomobilSinifi);

    expect(await cikisTutari(birSaat)).toBe(100 * TL);
    expect(await cikisTutari(dokuzSaat)).toBe(500 * TL);
    expect(await cikisTutari(birGunBirDk)).toBe(1100 * TL);
  });

  it("karavan kuralı SİLİNİRSE sessizce otomobil fiyatına düşülmez", async () => {
    // Kuralin kaldirildigi durum: cozumleyici genel kurala DUSMEZ, cunku
    // karavan sinifi excludeFromStandardTariff. Ucret hesaplanamaz ve
    // personele acik uyari cikar - yanlis fiyat tahsil edilmez.
    await prisma.tariffRule.deleteMany({ where: { vehicleClassId: karavanSinifi } });

    const giris = await aracGirisi(personel, {
      plaka: "34 KRV 200",
      aracSinifiId: karavanSinifi,
      idempotencyKey: anahtar(),
    });

    expect(giris.tarifeTanimsiz).toBe(true);
    expect(giris.uyarilar.join(" ")).toMatch(/Karavan/);
  });
});

// ---------------------------------------------------------------------------
describe("kapasite kararı — sınır yok", () => {
  it("kapasite tanımlı değildir ve doluluk hesaplanmaz", async () => {
    const durum = await kapasiteDurumu();
    expect(durum.tanimli).toBe(false);
    expect(durum.limit).toBe(0);
    expect(durum.doluMu).toBe(false);
    expect(durum.yuzde).toBeNull();
  });

  it("çok sayıda araç girişi doluluk yüzünden ENGELLENMEZ", async () => {
    // Kapasite 0 (sinir yok): 25 arac sorunsuz girer.
    for (let i = 0; i < 25; i++) {
      const plaka = `34 KAP ${String(100 + i)}`;
      await expect(
        aracGirisi(personel, { plaka, aracSinifiId: otomobilSinifi, idempotencyKey: anahtar() }),
      ).resolves.toMatchObject({ tarifeTanimsiz: false });
    }

    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(25);
    expect((await kapasiteDurumu()).doluMu).toBe(false);
  });

  it("girişte hiçbir kapasite uyarısı üretilmez", async () => {
    const giris = await aracGirisi(personel, {
      plaka: "34 KAP 999",
      aracSinifiId: otomobilSinifi,
      idempotencyKey: anahtar(),
    });
    expect(giris.uyarilar.join(" ")).not.toMatch(/[Kk]apasite/);
  });
});
