/**
 * KURUM ANLAŞMASI TESTLERİ (11.10.2026)
 *
 * ============================================================================
 * DİKKAT: Buradaki tarife ve anlaşma fiyatları YALNIZCA TEST içindir.
 * ============================================================================
 *
 * İşletme kararı: otoparkın kurumlarla SABİT FİYAT anlaşması var. Personel
 * çıkışta anlaşmayı seçer; ücret KALIŞ SÜRESİNDEN BAĞIMSIZ anlaşmanın
 * fiyatıdır. Patron adı ve fiyatı değiştirir; geçmiş tahsilat değişmez.
 * Ayrıca: karavan yıkaması yapılmıyor (yıkamada karavan reddedilir).
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  abonmanOlustur,
  aracSinifiGetir,
  kapasiteAyarla,
  kullaniciOlustur,
  oturum,
  prisma,
  sinifGetir,
  tarifeOlustur,
  temizle,
  vardiyaOlustur,
  yikamaHizmetiKur,
} from "./helpers";
import { aracGirisi } from "@/server/parking/entry";
import { aracCikisi } from "@/server/parking/exit";
import {
  anlasmaFiyatiGuncelle,
  anlasmaGuncelle,
  anlasmaListesi,
  anlasmaOlustur,
  cikistaSecilebilirAnlasmalar,
} from "@/server/parking/agreement";
import { yikamaOlustur } from "@/server/wash/job";
import { PERMISSIONS } from "@/lib/permissions";
import { toKurus } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;
let sinifId: string;
let personel: SessionUser;
let patron: SessionUser;

let sayac = 0;
const anahtar = () => `anlasma-${Date.now()}-${++sayac}`;

beforeEach(async () => {
  await temizle();
  sinifId = (await aracSinifiGetir()).id;

  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);

  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  await vardiyaOlustur(o.id);
  patron = oturum(o);

  await kapasiteAyarla(0);
  // 1. saat 100 TL, sonra saatlik 50 TL (yalnızca test).
  await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

/** Girişi geçmişe alarak belirli süre park etmiş araç üretir. */
async function gecmisGiris(plaka: string, dakikaOnce: number) {
  const giris = await aracGirisi(personel, { plaka, idempotencyKey: anahtar() });
  await prisma.parkingSession.update({
    where: { id: giris.parkingSessionId },
    data: { entryAt: new Date(Date.now() - dakikaOnce * 60000) },
  });
  return giris;
}

describe("çıkışta kurum anlaşması", () => {
  it("ücret süreden bağımsız SABİT anlaşma fiyatıdır (3 gün kalan araç da 200 ₺)", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const giris = await gecmisGiris("34ANL001", 3 * 24 * 60);

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });

    expect(cikis.odenenTutar).toBe(200 * TL);
    expect(cikis.anlasmaAdi).toBe("AYJET");
    // Normal tarife bu süre için çok daha yüksek: anlaşma onu ezmiş olmalı.
    expect(cikis.hesaplananTutar).toBeGreaterThan(200 * TL);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
      include: { payments: true },
    });
    expect(kayit.billingMode).toBe("AGREEMENT");
    expect(kayit.agreementId).toBe(anlasma.id);
    expect(toKurus(kayit.payableAmount)).toBe(200 * TL);
    expect(kayit.payments).toHaveLength(1);
    expect(toKurus(kayit.payments[0]!.amount)).toBe(200 * TL);
    expect(kayit.agreementSnapshot).toMatchObject({ ad: "AYJET", fiyatKurus: 200 * TL });
  });

  it("10 dakika kalan araç da anlaşma fiyatını öder (tarifeden ucuz olsa bile)", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "Üniversite öğrencisi", fiyatKurus: 200 * TL });
    const giris = await gecmisGiris("34ANL002", 10);

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CARD",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });
    expect(cikis.hesaplananTutar).toBe(100 * TL);
    expect(cikis.odenenTutar).toBe(200 * TL);
  });

  it("fiyat sonradan değişse de geçmiş çıkışın tutarı ve kopyası değişmez", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "Diğer", fiyatKurus: 200 * TL });
    const giris = await gecmisGiris("34ANL003", 30);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });

    await anlasmaFiyatiGuncelle(patron, anlasma.id, { fiyatKurus: 250 * TL, not: "zam" });
    await anlasmaGuncelle(patron, anlasma.id, { ad: "Diğer kurumlar" });

    const kayit = await prisma.parkingSession.findUniqueOrThrow({ where: { id: giris.parkingSessionId } });
    expect(toKurus(kayit.collectedAmount)).toBe(200 * TL);
    expect(kayit.agreementSnapshot).toMatchObject({ ad: "Diğer", fiyatKurus: 200 * TL });

    // Yeni çıkış yeni fiyatı kullanır.
    const giris2 = await gecmisGiris("34ANL004", 30);
    const cikis2 = await aracCikisi(personel, {
      parkingSessionId: giris2.parkingSessionId,
      odemeYontemi: "CASH",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });
    expect(cikis2.odenenTutar).toBe(250 * TL);
    expect(cikis2.anlasmaAdi).toBe("Diğer kurumlar");
  });

  it("denetim kaydı yazılır (PARKING_AGREEMENT)", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const giris = await gecmisGiris("34ANL005", 30);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });
    const denetim = await prisma.auditLog.findFirst({
      where: { action: "PARKING_AGREEMENT", entityId: giris.parkingSessionId },
    });
    expect(denetim).not.toBeNull();
    expect(denetim!.userId).toBe(personel.id);
  });

  it("izni olmayan kullanıcı anlaşma uygulayamaz", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const k = await kullaniciOlustur({ username: "izinsiz", role: "STAFF" });
    await vardiyaOlustur(k.id);
    const izinsiz = oturum(k, [{ permission: PERMISSIONS.PARKING_AGREEMENT, granted: false }]);
    const giris = await gecmisGiris("34ANL006", 30);

    await expect(
      aracCikisi(izinsiz, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        anlasmaId: anlasma.id,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toMatchObject({ code: "YETKISIZ_ANLASMA" });
  });

  it("indirim ya da elle tutarla birlikte uygulanamaz", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const giris = await gecmisGiris("34ANL007", 30);
    await expect(
      aracCikisi(patron, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        anlasmaId: anlasma.id,
        indirimKurus: 50 * TL,
        indirimSebebi: "deneme",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toMatchObject({ code: "ANLASMA_BIRLIKTE_OLMAZ" });

    // Araç hâlâ içeride: reddedilen istek hiçbir şey yazmadı.
    const kayit = await prisma.parkingSession.findUniqueOrThrow({ where: { id: giris.parkingSessionId } });
    expect(kayit.status).toBe("ACTIVE");
  });

  it("pasif anlaşma uygulanamaz ve çıkış listesinde görünmez", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    await anlasmaGuncelle(patron, anlasma.id, { aktif: false });
    expect(await cikistaSecilebilirAnlasmalar()).toHaveLength(0);

    const giris = await gecmisGiris("34ANL008", 30);
    await expect(
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        anlasmaId: anlasma.id,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toMatchObject({ code: "ANLASMA_PASIF" });
  });

  it("abonmanlı araçta anlaşma uygulanmaz (çıkış zaten ücretsiz)", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    await abonmanOlustur({
      plateNormalized: "34ANL009",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 86400_000),
      bitis: new Date(Date.now() + 20 * 86400_000),
      ucretKurus: 3000 * TL,
      musteriAdi: "Test Müşteri",
    });
    const giris = await aracGirisi(personel, { plaka: "34ANL009", idempotencyKey: anahtar() });
    await expect(
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        anlasmaId: anlasma.id,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toMatchObject({ code: "ANLASMA_UYGULANAMAZ" });
  });

  it("tarifesi tanımsız araçta (karavan) anlaşma fiyatı alınır, 0 ₺ değil", async () => {
    const karavan = await sinifGetir("KARAVAN", "Karavan", true);
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const giris = await aracGirisi(personel, {
      plaka: "34ANL010",
      aracSinifiId: karavan.id,
      idempotencyKey: anahtar(),
    });
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      anlasmaId: anlasma.id,
      idempotencyKey: anahtar(),
    });
    expect(cikis.tarifeTanimsiz).toBe(true);
    expect(cikis.odenenTutar).toBe(200 * TL);
  });
});

describe("anlaşma yönetimi (patron)", () => {
  it("fiyat değişince eski sürüm kapanır, yeni sürüm açılır; aynı fiyat sürüm üretmez", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    const ayni = await anlasmaFiyatiGuncelle(patron, anlasma.id, { fiyatKurus: 200 * TL });
    expect(ayni.degisti).toBe(false);

    await anlasmaFiyatiGuncelle(patron, anlasma.id, { fiyatKurus: 220 * TL });
    const surumler = await prisma.parkingAgreementPriceVersion.findMany({
      where: { agreementId: anlasma.id },
      orderBy: { createdAt: "asc" },
    });
    expect(surumler).toHaveLength(2);
    expect(surumler[0]!.effectiveTo).not.toBeNull();
    expect(toKurus(surumler[0]!.price)).toBe(200 * TL);
    expect(surumler[1]!.effectiveTo).toBeNull();
    expect((await anlasmaListesi())[0]!.fiyatKurus).toBe(220 * TL);
  });

  it("0 ₺ fiyat kabul edilmez", async () => {
    await expect(anlasmaOlustur(patron, { ad: "Bedava", fiyatKurus: 0 })).rejects.toMatchObject({
      code: "UCRET_GECERSIZ",
    });
  });

  it("aynı ad Türkçe harf farkıyla bile ikinci kez açılamaz", async () => {
    await anlasmaOlustur(patron, { ad: "Üniversite öğrencisi", fiyatKurus: 200 * TL });
    await expect(
      anlasmaOlustur(patron, { ad: "ÜNİVERSİTE ÖĞRENCİSİ", fiyatKurus: 200 * TL }),
    ).rejects.toMatchObject({ code: "AD_KULLANIMDA" });
  });

  it("veritabanı 0 ₺ fiyat sürümünü reddeder (CHECK)", async () => {
    const anlasma = await anlasmaOlustur(patron, { ad: "AYJET", fiyatKurus: 200 * TL });
    await expect(
      prisma.parkingAgreementPriceVersion.create({
        data: { agreementId: anlasma.id, price: "0", effectiveFrom: new Date(Date.now() + 1000) },
      }),
    ).rejects.toThrow();
  });
});

describe("karavan yıkama kapalı", () => {
  it("yıkamaya kapalı sınıfa yıkama kaydı açılamaz ve araç kaydı oluşmaz", async () => {
    const karavan = await prisma.vehicleClass.create({
      data: { code: "KARAVAN", name: "Karavan", excludeFromStandardTariff: true, washEnabled: false },
    });
    const hizmet = await yikamaHizmetiKur({ kod: "IC_DIS", genelFiyat: 600 * TL });

    await expect(
      yikamaOlustur(personel, {
        plaka: "34KRV001",
        aracSinifiId: karavan.id,
        hizmetler: [{ washServiceId: hizmet.id }],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toMatchObject({ code: "YIKAMA_SINIF_KAPALI" });

    expect(await prisma.vehicle.count({ where: { plateNormalized: "34KRV001" } })).toBe(0);
  });
});
