/**
 * ARAC GIRIS-CIKIS VE TAHSILAT TESTLERI
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki fiyatlar ve kapasite degerleri YALNIZCA TEST icindir.
 * Londra Camping Otopark'in gercek tarifesi veya kapasitesi DEGILDIR.
 * ============================================================================
 *
 * Asama 2 tamamlanma kriterleri (docs/06):
 *  - Mukerrer giris DB seviyesinde engellenir
 *  - Esszamanli cikis: tek tahsilat olusur
 *  - Idempotency: ayni istek tek kayit uretir
 *  - Gun ici tarife degisikliginde iceridek aracin fiyati degismez
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  abonmanOlustur,
  aracSinifiGetir,
  kapasiteAyarla,
  kullaniciOlustur,
  oturum,
  prisma,
  tarifeOlustur,
  temizle,
  vardiyaOlustur,
} from "./helpers";
import { aracGirisi, kapasiteDurumu } from "@/server/parking/entry";
import { aracCikisi, cikisOnizleme } from "@/server/parking/exit";
import { parkIptal } from "@/server/parking/void";
import { PERMISSIONS } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/session";

let sinifId: string;
let personel: SessionUser;
let patron: SessionUser;

let sayac = 0;
const anahtar = () => `test-${Date.now()}-${++sayac}`;

beforeEach(async () => {
  await temizle();
  sinifId = (await aracSinifiGetir()).id;

  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);

  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  await vardiyaOlustur(o.id);
  patron = oturum(o);

  await kapasiteAyarla(0); // kapasite tanımlı değil
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// ARAC GIRISI
// ---------------------------------------------------------------------------
describe("araç girişi", () => {
  it("plaka normalize edilerek kaydedilir", async () => {
    const sonuc = await aracGirisi(personel, { plaka: "34 abc 123", idempotencyKey: anahtar() });

    expect(sonuc.plakaGosterim).toBe("34 ABC 123");
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: sonuc.parkingSessionId },
    });
    expect(kayit.plateNormalized).toBe("34ABC123");
    expect(kayit.status).toBe("ACTIVE");
  });

  it("Türkçe karakterli plaka da normalize edilir", async () => {
    const sonuc = await aracGirisi(personel, { plaka: "34 abç 123", idempotencyKey: anahtar() });
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: sonuc.parkingSessionId },
    });
    expect(kayit.plateNormalized).toBe("34ABC123");
  });

  it("yeni plaka için araç kaydı oluşturulur", async () => {
    await aracGirisi(personel, { plaka: "34YEN111", idempotencyKey: anahtar() });
    const arac = await prisma.vehicle.findUnique({ where: { plateNormalized: "34YEN111" } });
    expect(arac).not.toBeNull();
    expect(arac?.vehicleClassId).toBe(sinifId);
  });

  it("MÜKERRER AKTİF GİRİŞ engellenir", async () => {
    await aracGirisi(personel, { plaka: "34MUK111", idempotencyKey: anahtar() });
    await expect(
      aracGirisi(personel, { plaka: "34MUK111", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/otoparkta/i);
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("farklı yazımla da mükerrer giriş engellenir", async () => {
    await aracGirisi(personel, { plaka: "34MUK222", idempotencyKey: anahtar() });
    // Normalizasyon sayesinde "34 muk 222" ayni araca iner.
    await expect(
      aracGirisi(personel, { plaka: "34 muk 222", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/otoparkta/i);
  });

  it("çıkış sonrası aynı plaka tekrar giriş yapabilir", async () => {
    const giris = await aracGirisi(personel, { plaka: "34TEK111", idempotencyKey: anahtar() });
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    const ikinci = await aracGirisi(personel, { plaka: "34TEK111", idempotencyKey: anahtar() });
    expect(ikinci.parkingSessionId).not.toBe(giris.parkingSessionId);
  });

  it("geçersiz plaka biçimi onay ister, zorlanınca kaydedilir", async () => {
    await expect(
      aracGirisi(personel, { plaka: "XYZ999", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/biçimine uymuyor/i);

    const sonuc = await aracGirisi(personel, {
      plaka: "XYZ999",
      bicimiZorla: true,
      idempotencyKey: anahtar(),
    });
    expect(sonuc.uyarilar.join(" ")).toContain("standart dışı");
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: sonuc.parkingSessionId },
    });
    expect(kayit.entryNote).toContain("standart dışı");
  });

  it("çok kısa plaka reddedilir", async () => {
    await expect(aracGirisi(personel, { plaka: "34A", idempotencyKey: anahtar() })).rejects.toThrow(
      /çok kısa/i,
    );
  });

  it("açık vardiya yoksa giriş yapılamaz", async () => {
    const yeni = await kullaniciOlustur({ username: "vardiyasiz", role: "STAFF" });
    await expect(
      aracGirisi(oturum(yeni), { plaka: "34VAR111", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/vardiya/i);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci istek yeni kayıt oluşturmaz", async () => {
    const key = anahtar();
    const birinci = await aracGirisi(personel, { plaka: "34IDM111", idempotencyKey: key });
    // Yavas hatta personel butona iki kez basti.
    const ikinci = await aracGirisi(personel, { plaka: "34IDM111", idempotencyKey: key });
    expect(ikinci.parkingSessionId).toBe(birinci.parkingSessionId);
    expect(await prisma.parkingSession.count()).toBe(1);
  });

  it("EŞZAMANLI iki giriş denemesinde yalnızca biri başarılı olur", async () => {
    const sonuclar = await Promise.allSettled([
      aracGirisi(personel, { plaka: "35ESZ999", idempotencyKey: anahtar() }),
      aracGirisi(personel, { plaka: "35ESZ999", idempotencyKey: anahtar() }),
    ]);
    expect(sonuclar.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(1);
  });

  it("giriş denetim kaydına yazılır", async () => {
    await aracGirisi(personel, { plaka: "34DEN111", idempotencyKey: anahtar() });
    const kayit = await prisma.auditLog.findFirst({ where: { action: "PARKING_ENTRY" } });
    expect(kayit).not.toBeNull();
    expect(kayit?.actorLabel).toBe("personel1");
  });
});

// ---------------------------------------------------------------------------
// KAPASITE
// ---------------------------------------------------------------------------
describe("kapasite", () => {
  it("KAPASİTE TANIMLI DEĞİLSE giriş engellenmez", async () => {
    // Patron henuz kapasite girmemis: sistem kullanilabilir olmali.
    await kapasiteAyarla(0);
    for (let i = 1; i <= 5; i++) {
      await aracGirisi(personel, { plaka: `34KAP00${i}`, idempotencyKey: anahtar() });
    }
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(5);

    const durum = await kapasiteDurumu();
    expect(durum.tanimli).toBe(false);
    expect(durum.doluMu).toBe(false);
    expect(durum.yuzde).toBeNull();
  });

  it("kapasite tanımlıysa dolduğunda onay ister", async () => {
    await kapasiteAyarla(2);
    await aracGirisi(personel, { plaka: "34KAP111", idempotencyKey: anahtar() });
    await aracGirisi(personel, { plaka: "34KAP222", idempotencyKey: anahtar() });

    await expect(
      aracGirisi(personel, { plaka: "34KAP333", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/dolu/i);
  });

  it("kapasite aşımı zorlanabilir ve uyarı kaydedilir", async () => {
    await kapasiteAyarla(1);
    await aracGirisi(personel, { plaka: "34KAP444", idempotencyKey: anahtar() });
    const sonuc = await aracGirisi(personel, {
      plaka: "34KAP555",
      kapasiteyiZorla: true,
      idempotencyKey: anahtar(),
    });
    expect(sonuc.uyarilar.join(" ")).toContain("Kapasite aşıldı");
  });

  it("doluluk yüzdesi hesaplanır", async () => {
    await kapasiteAyarla(4);
    await aracGirisi(personel, { plaka: "34YUZ111", idempotencyKey: anahtar() });
    const durum = await kapasiteDurumu();
    expect(durum.yuzde).toBe(25);
    expect(durum.tanimli).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TARIFE TANIMSIZ
// ---------------------------------------------------------------------------
describe("tarife tanımlı değilken", () => {
  it("giriş alınır ve uyarı verilir", async () => {
    const sonuc = await aracGirisi(personel, { plaka: "34TRF111", idempotencyKey: anahtar() });
    expect(sonuc.tarifeTanimsiz).toBe(true);
    expect(sonuc.uyarilar.join(" ")).toContain("Tarife tanımlı değil");

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: sonuc.parkingSessionId },
    });
    expect(kayit.tariffSnapshot).toBeNull();
  });

  it("çıkışta ücret 0 çıkar ama tarifeTanimsiz işaretlenir", async () => {
    const giris = await aracGirisi(personel, { plaka: "34TRF222", idempotencyKey: anahtar() });
    const onizleme = await cikisOnizleme("34TRF222");
    expect(onizleme.tarifeTanimsiz).toBe(true);
    expect(onizleme.tutar).toBe(0);

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.tarifeTanimsiz).toBe(true);
    expect(cikis.odenenTutar).toBe(0);

    // Durum islem notuna yazilir ki patron sonradan gorebilsin.
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.entryNote).toContain("TARİFE TANIMLI DEĞİLDİ");

    // Tutar 0 oldugu icin tahsilat kaydi olusmaz.
    expect(await prisma.payment.count()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CIKIS VE TAHSILAT
// ---------------------------------------------------------------------------
describe("araç çıkışı ve tahsilat", () => {
  beforeEach(async () => {
    // TEST tarifesi: ilk 60 dk 40 ₺, sonra saatlik 25 ₺
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 4000, saatlikUcret: 2500 });
  });

  /** Girisi gecmise alarak belirli bir sure park etmis arac uretir. */
  async function gecmisGiris(plaka: string, dakikaOnce: number) {
    const giris = await aracGirisi(personel, { plaka, idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - dakikaOnce * 60000) },
    });
    return giris;
  }

  it("ücret SUNUCUDA hesaplanır ve tahsilat kaydedilir", async () => {
    const giris = await gecmisGiris("34CIK111", 192); // 3 sa 12 dk

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    // 40 ₺ + 3 × 25 ₺ = 115 ₺
    expect(cikis.hesaplananTutar).toBe(11500);
    expect(cikis.odenenTutar).toBe(11500);
    expect(cikis.odemeYontemi).toBe("CASH");
    expect(cikis.tahsilatKodu).toMatch(/^T-\d{6}-\d{4}$/);

    const odeme = await prisma.payment.findFirstOrThrow({
      where: { parkingSessionId: giris.parkingSessionId },
    });
    expect(odeme.amount.toString()).toBe("115");
    expect(odeme.method).toBe("CASH");
    expect(odeme.sourceType).toBe("PARKING");
    expect(odeme.direction).toBe("IN");
    expect(odeme.status).toBe("CONFIRMED");
  });

  it("İSTEMCİDEN GELEN TUTAR BİLGİSİNE GÜVENİLMEZ", async () => {
    const giris = await gecmisGiris("34GUV111", 192);

    // Istemci "tutar 1 kurus" diye gondermeye calissa bile tip sisteminde
    // boyle bir alan YOK; servis yalnizca odeme yontemini kabul eder.
    // Yetkisi olmayan kullanici elleTutarKurus gonderirse reddedilir.
    await expect(
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        elleTutarKurus: 1,
        elleTutarSebebi: "deneme",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yetkiniz yok/i);

    // Kayit hala aktif: hicbir sey yazilmadi.
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.status).toBe("ACTIVE");

    // Yetkisiz kullanicinin cikisinda tutar sunucunun hesapladigi degerdir.
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(11500);
  });

  it("kart ödemesi kaydedilir, POS entegrasyonu iddia edilmez", async () => {
    const giris = await gecmisGiris("34KRT111", 70);
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CARD",
      kartNotu: "Dekont 4455",
      idempotencyKey: anahtar(),
    });

    const odeme = await prisma.payment.findFirstOrThrow({
      where: { parkingSessionId: giris.parkingSessionId },
    });
    expect(odeme.method).toBe("CARD");
    expect(odeme.cardNote).toBe("Dekont 4455");
    expect(cikis.odenenTutar).toBe(6500);
  });

  it("nakit ödemede kart notu yazılmaz", async () => {
    const giris = await gecmisGiris("34NKT111", 70);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      kartNotu: "olmamalı",
      idempotencyKey: anahtar(),
    });
    const odeme = await prisma.payment.findFirstOrThrow({});
    expect(odeme.cardNote).toBeNull();
  });

  it("önizleme ile gerçek çıkış aynı tutarı verir", async () => {
    const giris = await gecmisGiris("34ONZ111", 192);
    const onizleme = await cikisOnizleme("34ONZ111");
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.hesaplananTutar).toBe(onizleme.tutar);
  });

  it("önizleme hiçbir şey yazmaz", async () => {
    await gecmisGiris("34ONZ222", 192);
    await cikisOnizleme("34ONZ222");
    await cikisOnizleme("34ONZ222");

    const kayit = await prisma.parkingSession.findFirstOrThrow({
      where: { plateNormalized: "34ONZ222" },
    });
    expect(kayit.status).toBe("ACTIVE");
    expect(kayit.exitAt).toBeNull();
    expect(await prisma.payment.count()).toBe(0);
  });

  it("çıkış dökümü personele gösterilecek satırları içerir", async () => {
    await gecmisGiris("34DKM111", 192);
    const onizleme = await cikisOnizleme("34DKM111");
    expect(onizleme.dokum.length).toBeGreaterThan(0);
    expect(onizleme.dokum.reduce((t, d) => t + d.tutar, 0)).toBe(onizleme.tutar);
    expect(onizleme.sureDakika).toBeGreaterThanOrEqual(192);
    expect(onizleme.tarifeAdi).toBe("Test Tarifesi");
    expect(onizleme.tarifeSurumNo).toBe(1);
  });

  it("ZATEN ÇIKMIŞ araç ikinci kez tahsil edilemez", async () => {
    const giris = await gecmisGiris("34CFT111", 192);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    await expect(
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/çıkışı yapılmış|mükerrer/i);

    expect(await prisma.payment.count()).toBe(1);
  });

  it("çıkış yapmış araç sorgulanınca bilgilendirici hata verir", async () => {
    const giris = await gecmisGiris("34SRG111", 192);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await expect(cikisOnizleme("34SRG111")).rejects.toThrow(/çıkış yapmış/i);
  });

  it("otoparkta olmayan plaka sorgulanınca hata verir", async () => {
    await expect(cikisOnizleme("34YOK999")).rejects.toThrow(/bulunamadı/i);
  });

  it("EŞZAMANLI iki çıkış denemesinde TEK tahsilat oluşur", async () => {
    const giris = await gecmisGiris("34ESZ111", 192);

    const sonuclar = await Promise.allSettled([
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CARD",
        idempotencyKey: anahtar(),
      }),
    ]);

    expect(sonuclar.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.payment.count()).toBe(1);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.status).toBe("COMPLETED");
  });

  it("IDEMPOTENCY: aynı çıkış isteği iki kez gelirse tek tahsilat olur", async () => {
    const giris = await gecmisGiris("34IDC111", 192);
    const key = anahtar();

    const birinci = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });
    const ikinci = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });

    expect(ikinci.tahsilatKodu).toBe(birinci.tahsilatKodu);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("ücretsiz süre içinde çıkışta tahsilat kaydı oluşmaz", async () => {
    await temizle();
    sinifId = (await aracSinifiGetir()).id;
    const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
    await vardiyaOlustur(p.id);
    personel = oturum(p);
    await tarifeOlustur({ ucretsizDakika: 15, saatlikUcret: 2500 });

    const giris = await gecmisGiris("34UCR111", 10);
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(cikis.odenenTutar).toBe(0);
    expect(cikis.ucretsizMi).toBe(true);
    expect(cikis.odemeYontemi).toBeNull();
    expect(await prisma.payment.count()).toBe(0);
  });

  it("çıkış ve tahsilat denetim kaydına yazılır", async () => {
    const giris = await gecmisGiris("34DEN222", 192);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(await prisma.auditLog.count({ where: { action: "PARKING_EXIT" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "PAYMENT_CREATE" } })).toBe(1);

    const cikisKaydi = await prisma.auditLog.findFirstOrThrow({
      where: { action: "PARKING_EXIT" },
    });
    const sonra = cikisKaydi.after as Record<string, unknown>;
    expect(sonra.odenenKurus).toBe(11500);
    expect(sonra.odemeYontemi).toBe("CASH");
  });

  it("tahsilat vardiyaya bağlanır", async () => {
    const giris = await gecmisGiris("34VRD111", 192);
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const vardiya = await prisma.shift.findFirstOrThrow({ where: { userId: personel.id } });
    const odeme = await prisma.payment.findFirstOrThrow({});
    expect(odeme.shiftId).toBe(vardiya.id);
    expect(odeme.collectedById).toBe(personel.id);
  });
});

// ---------------------------------------------------------------------------
// TARIFE SNAPSHOT - gecmis degismez
// ---------------------------------------------------------------------------
describe("tarife snapshot (geçmiş değişmez)", () => {
  it("snapshot GİRİŞTE yazılır", async () => {
    await tarifeOlustur({ saatlikUcret: 2500 });
    const giris = await aracGirisi(personel, { plaka: "34SNP111", idempotencyKey: anahtar() });

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    const snap = kayit.tariffSnapshot as Record<string, unknown>;
    expect(snap).not.toBeNull();
    expect(snap.saatlikUcret).toBe(2500);
    expect(snap.surumNo).toBe(1);
    expect(kayit.tariffVersionId).not.toBeNull();
    expect(kayit.tariffRuleId).not.toBeNull();
  });

  it("GÜN İÇİ TARİFE DEĞİŞİKLİĞİ içerideki aracı etkilemez", async () => {
    // Bu, S5 kararinin (giris anindaki tarife) teknik garantisidir.
    const { plan } = await tarifeOlustur({ saatlikUcret: 2500 });

    const giris = await aracGirisi(personel, { plaka: "34DGS111", idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 120 * 60000) }, // 2 saat önce
    });

    // Patron fiyati iki katina cikarir (yeni surum).
    const { kurusToDecimalString } = await import("@/lib/money");
    const yeniSurumBaslangici = new Date();
    await prisma.tariffVersion.updateMany({
      where: { tariffPlanId: plan.id, effectiveTo: null },
      data: { effectiveTo: yeniSurumBaslangici },
    });
    await prisma.tariffVersion.create({
      data: {
        tariffPlanId: plan.id,
        versionNo: 2,
        effectiveFrom: yeniSurumBaslangici,
        isActive: true,
        changeNote: "Fiyat artışı",
        rules: {
          create: [
            {
              vehicleClassId: null,
              hourlyPrice: kurusToDecimalString(5000),
              hourlyRoundingMinutes: 60,
            },
          ],
        },
      },
    });

    // Icerideki arac ESKI fiyatla cikar: 2 × 25 ₺ = 50 ₺
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.hesaplananTutar).toBe(5000);

    // Yeni giren arac YENI fiyatla ucretlendirilir.
    const yeniGiris = await aracGirisi(personel, { plaka: "34DGS222", idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: yeniGiris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 120 * 60000) },
    });
    const yeniCikis = await aracCikisi(personel, {
      parkingSessionId: yeniGiris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(yeniCikis.hesaplananTutar).toBe(10000);
  });

  it("araç sınıfına özel kural genel kuraldan önce gelir", async () => {
    const suv = await prisma.vehicleClass.upsert({
      where: { code: "SUV" },
      update: {},
      create: { code: "SUV", name: "SUV", sortOrder: 30 },
    });
    const { kurusToDecimalString } = await import("@/lib/money");

    const plan = await prisma.tariffPlan.create({
      data: { name: "Sınıflı Tarife", isActive: true, isDefault: true },
    });
    await prisma.tariffVersion.create({
      data: {
        tariffPlanId: plan.id,
        versionNo: 1,
        effectiveFrom: new Date(Date.now() - 3600_000),
        isActive: true,
        rules: {
          create: [
            { vehicleClassId: null, hourlyPrice: kurusToDecimalString(2500), hourlyRoundingMinutes: 60 },
            { vehicleClassId: suv.id, hourlyPrice: kurusToDecimalString(4000), hourlyRoundingMinutes: 60 },
          ],
        },
      },
    });

    const giris = await aracGirisi(personel, {
      plaka: "34SUV111",
      aracSinifiId: suv.id,
      idempotencyKey: anahtar(),
    });
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    const snap = kayit.tariffSnapshot as Record<string, unknown>;
    expect(snap.saatlikUcret).toBe(4000);
    expect(snap.aracSinifiAdi).toBe("SUV");
  });

  it("yüksek öncelikli plan kazanır", async () => {
    await tarifeOlustur({ ad: "Standart", saatlikUcret: 2500, oncelik: 0, varsayilan: true });
    await tarifeOlustur({ ad: "Kampanya", saatlikUcret: 1000, oncelik: 10, varsayilan: false });

    const giris = await aracGirisi(personel, { plaka: "34ONC111", idempotencyKey: anahtar() });
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    const snap = kayit.tariffSnapshot as Record<string, unknown>;
    expect(snap.planAdi).toBe("Kampanya");
  });

  it("pasif plan kullanılmaz", async () => {
    const { plan } = await tarifeOlustur({ saatlikUcret: 2500 });
    await prisma.tariffPlan.update({ where: { id: plan.id }, data: { isActive: false } });

    const giris = await aracGirisi(personel, { plaka: "34PSF111", idempotencyKey: anahtar() });
    expect(giris.tarifeTanimsiz).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ABONMAN - ucretsiz cikis
// ---------------------------------------------------------------------------
describe("abonmanlı araç", () => {
  beforeEach(async () => {
    await tarifeOlustur({ saatlikUcret: 2500 });
  });

  it("aktif abonmanlı araç girişte tanınır", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN111",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 10 * 86400_000),
      bitis: new Date(Date.now() + 20 * 86400_000),
      ucretKurus: 300_000,
      musteriAdi: "Mehmet Yılmaz",
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN111", idempotencyKey: anahtar() });
    expect(giris.abonman.durum).toBe("AKTIF");
    expect(giris.abonman.musteriAdi).toBe("Mehmet Yılmaz");
    expect(giris.abonman.ucretsizMi).toBe(true);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.billingMode).toBe("SUBSCRIPTION");
    expect(kayit.subscriptionId).not.toBeNull();
  });

  it("ABONMANLI ARAÇ ÜCRETSİZ ÇIKAR", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN222",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 10 * 86400_000),
      bitis: new Date(Date.now() + 20 * 86400_000),
      ucretKurus: 300_000,
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN222", idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 600 * 60000) }, // 10 saat
    });

    const onizleme = await cikisOnizleme("34ABN222");
    expect(onizleme.abonmanKapsaminda).toBe(true);
    expect(onizleme.tutar).toBe(0);

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(0);
    expect(cikis.abonmanKapsaminda).toBe(true);
    expect(await prisma.payment.count()).toBe(0);

    // Park kaydi yine olusur: abonmanli araclarin kullanim yogunlugu raporlanabilsin.
    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.status).toBe("COMPLETED");
    expect(kayit.durationMinutes).toBeGreaterThanOrEqual(600);
  });

  it("S10: ABONMAN PARK SIRASINDA BİTERSE o park ücretsiz tamamlanır", async () => {
    const { abonman } = await abonmanOlustur({
      plateNormalized: "34ABN333",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 10 * 86400_000),
      bitis: new Date(Date.now() + 86400_000),
      ucretKurus: 300_000,
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN333", idempotencyKey: anahtar() });
    expect(giris.abonman.ucretsizMi).toBe(true);

    // Arac iceride iken abonman biter.
    await prisma.subscription.update({
      where: { id: abonman.id },
      data: { endDate: new Date(Date.now() - 1000), status: "EXPIRED" },
    });

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    // Giriste abonman gecerliydi: park UCRETSIZ tamamlanir.
    expect(cikis.odenenTutar).toBe(0);
    expect(cikis.abonmanKapsaminda).toBe(true);
  });

  it("süresi dolmuş abonmanlı araç NORMAL TARİFEYE geçer ve personel uyarılır", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN444",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 60 * 86400_000),
      bitis: new Date(Date.now() - 5 * 86400_000),
      ucretKurus: 300_000,
      durum: "EXPIRED",
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN444", idempotencyKey: anahtar() });
    expect(giris.abonman.durum).toBe("SURESI_DOLMUS");
    expect(giris.abonman.ucretsizMi).toBe(false);
    expect(giris.abonman.uyari).toContain("NORMAL TARİFE");

    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 120 * 60000) },
    });
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(5000); // 2 saat × 25 ₺
  });

  it("S9: ödemesi alınmamış abonman GEÇERLİ sayılır, uyarı verilir", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN555",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 5 * 86400_000),
      bitis: new Date(Date.now() + 25 * 86400_000),
      ucretKurus: 300_000,
      odemeDurumu: "UNPAID",
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN555", idempotencyKey: anahtar() });
    expect(giris.abonman.durum).toBe("AKTIF_ODENMEMIS");
    expect(giris.abonman.ucretsizMi).toBe(true);
    expect(giris.abonman.uyari).toContain("ödemesi alınmamış");
    expect(giris.abonman.yoneticiyeBildir).toBe(true);
  });

  it("bitişe 7 gün kalan abonmanda uyarı gösterilir", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN666",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 23 * 86400_000),
      bitis: new Date(Date.now() + 5 * 86400_000),
      ucretKurus: 300_000,
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN666", idempotencyKey: anahtar() });
    expect(giris.abonman.durum).toBe("AKTIF_BITIYOR");
    expect(giris.abonman.ucretsizMi).toBe(true);
    expect(giris.abonman.uyari).toContain("gün sonra doluyor");
  });

  it("iptal edilmiş abonman normal tarifeye tabidir", async () => {
    await abonmanOlustur({
      plateNormalized: "34ABN777",
      vehicleClassId: sinifId,
      baslangic: new Date(Date.now() - 5 * 86400_000),
      bitis: new Date(Date.now() + 25 * 86400_000),
      ucretKurus: 300_000,
      durum: "CANCELLED",
    });

    const giris = await aracGirisi(personel, { plaka: "34ABN777", idempotencyKey: anahtar() });
    expect(giris.abonman.ucretsizMi).toBe(false);
    expect(giris.abonman.durum).toBe("IPTAL_VEYA_ASKIDA");
  });
});

// ---------------------------------------------------------------------------
// INDIRIM VE ELLE TUTAR
// ---------------------------------------------------------------------------
describe("indirim ve elle tutar", () => {
  beforeEach(async () => {
    await tarifeOlustur({ saatlikUcret: 2500 });
  });

  async function gecmisGiris(plaka: string, dakikaOnce: number, actor = personel) {
    const giris = await aracGirisi(actor, { plaka, idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - dakikaOnce * 60000) },
    });
    return giris;
  }

  it("yetkisiz personel indirim uygulayamaz", async () => {
    const giris = await gecmisGiris("34IND111", 120);
    await expect(
      aracCikisi(personel, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        indirimKurus: 2000,
        indirimSebebi: "müşteri tanıdık",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yetkiniz yok/i);
  });

  it("yetkili kullanıcı indirim uygulayabilir, gerekçe zorunludur", async () => {
    const giris = await gecmisGiris("34IND222", 120, patron);

    await expect(
      aracCikisi(patron, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        indirimKurus: 2000,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/gerekçe/i);

    const cikis = await aracCikisi(patron, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      indirimKurus: 2000,
      indirimSebebi: "Esnaf indirimi",
      idempotencyKey: anahtar(),
    });

    expect(cikis.hesaplananTutar).toBe(5000);
    expect(cikis.indirimTutari).toBe(2000);
    expect(cikis.odenenTutar).toBe(3000);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.discountReason).toBe("Esnaf indirimi");
    expect(kayit.discountById).toBe(patron.id);
    expect(await prisma.auditLog.count({ where: { action: "PARKING_DISCOUNT" } })).toBe(1);
  });

  it("indirim tutardan büyükse ödenecek 0 olur, negatife inmez", async () => {
    const giris = await gecmisGiris("34IND333", 60, patron);
    const cikis = await aracCikisi(patron, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      indirimKurus: 99_999,
      indirimSebebi: "tam indirim",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("patron tutarı elle değiştirebilir, denetime yazılır", async () => {
    const giris = await gecmisGiris("34ELL111", 120, patron);
    const cikis = await aracCikisi(patron, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      elleTutarKurus: 3000,
      elleTutarSebebi: "Müşteri şikayeti üzerine düzeltme",
      idempotencyKey: anahtar(),
    });

    expect(cikis.hesaplananTutar).toBe(5000);
    expect(cikis.odenenTutar).toBe(3000);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.billingMode).toBe("MANUAL_OVERRIDE");
    expect(await prisma.auditLog.count({ where: { action: "PARKING_PRICE_OVERRIDE" } })).toBe(1);
  });

  it("vardiya sorumlusu indirim yapabilir ama tutarı elle değiştiremez", async () => {
    const m = await kullaniciOlustur({ username: "sorumlu1", role: "MANAGER" });
    await vardiyaOlustur(m.id);
    const sorumlu = oturum(m);

    const giris = await gecmisGiris("34MGR111", 120, sorumlu);
    await expect(
      aracCikisi(sorumlu, {
        parkingSessionId: giris.parkingSessionId,
        odemeYontemi: "CASH",
        elleTutarKurus: 1,
        elleTutarSebebi: "deneme",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yetkiniz yok/i);

    const cikis = await aracCikisi(sorumlu, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      indirimKurus: 1000,
      indirimSebebi: "Vardiya sorumlusu indirimi",
      idempotencyKey: anahtar(),
    });
    expect(cikis.indirimTutari).toBe(1000);
  });

  it("kullanıcıya özel izinle personel de indirim yapabilir", async () => {
    const p = await kullaniciOlustur({ username: "personel2", role: "STAFF" });
    await vardiyaOlustur(p.id);
    const yetkili = oturum(p, [{ permission: PERMISSIONS.PARKING_DISCOUNT, granted: true }]);

    const giris = await gecmisGiris("34OZL111", 120, yetkili);
    const cikis = await aracCikisi(yetkili, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      indirimKurus: 500,
      indirimSebebi: "Özel izinle indirim",
      idempotencyKey: anahtar(),
    });
    expect(cikis.indirimTutari).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// IPTAL - finansal kayit silinmez
// ---------------------------------------------------------------------------
describe("işlem iptali (VOIDED)", () => {
  beforeEach(async () => {
    await tarifeOlustur({ saatlikUcret: 2500 });
  });

  async function tamamlanmisIslem(plaka: string) {
    const giris = await aracGirisi(patron, { plaka, idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 120 * 60000) },
    });
    await aracCikisi(patron, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    return giris.parkingSessionId;
  }

  /** Kasadaki net tutar: onaylı girişler eksi onaylı çıkışlar. */
  async function netKasa(): Promise<number> {
    const giren = await prisma.payment.aggregate({
      where: { status: "CONFIRMED", direction: "IN" },
      _sum: { amount: true },
    });
    const cikan = await prisma.payment.aggregate({
      where: { status: "CONFIRMED", direction: "OUT" },
      _sum: { amount: true },
    });
    return (Number(giren._sum.amount ?? 0) - Number(cikan._sum.amount ?? 0)) * 100;
  }

  it("iptal KAYIT SİLMEZ, VOIDED yapar ve gerekçe saklar", async () => {
    const id = await tamamlanmisIslem("34IPT111");

    const sonuc = await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Yanlış plaka girilmiş",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.etkilenenTahsilatSayisi).toBe(1);
    expect(sonuc.iadeEdilenKurus).toBe(5000);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({ where: { id } });
    expect(kayit.status).toBe("VOIDED");
    expect(kayit.voidReason).toBe("Yanlış plaka girilmiş");
    expect(kayit.voidedById).toBe(patron.id);
    // Cikis bilgileri KORUNUR.
    expect(kayit.exitAt).not.toBeNull();
    expect(kayit.collectedAmount?.toString()).toBe("50");
  });

  it("PARA İADE EDİLDİYSE ters kayıt üretilir, orijinal CONFIRMED kalır", async () => {
    // Fiziksel gerceklik: para kasaya girdi, sonra geri verildi.
    // Orijinali VOIDED yapmak + ters kayit uretmek parayi IKI KEZ duserdi.
    const id = await tamamlanmisIslem("34IPT222");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Hatalı tahsilat, para iade edildi",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    const odemeler = await prisma.payment.findMany({ orderBy: { createdAt: "asc" } });
    expect(odemeler).toHaveLength(2);

    const [orijinal, ters] = odemeler;
    expect(orijinal!.status).toBe("CONFIRMED"); // gerçekten oldu
    expect(orijinal!.direction).toBe("IN");
    expect(ters!.direction).toBe("OUT");
    expect(ters!.sourceType).toBe("REFUND");
    expect(ters!.reversalOfId).toBe(orijinal!.id);
    expect(ters!.status).toBe("CONFIRMED");
  });

  it("PARA EL DEĞİŞTİRMEDİYSE tahsilat VOIDED olur, ters kayıt üretilmez", async () => {
    const id = await tamamlanmisIslem("34IPT999");
    const sonuc = await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Yanlış kayıt, para alınmamıştı",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.iadeEdilenKurus).toBe(0);
    expect(sonuc.iptalEdilenKurus).toBe(5000);
    expect(sonuc.tersKayitKodu).toBeNull();

    const odemeler = await prisma.payment.findMany();
    expect(odemeler).toHaveLength(1);
    expect(odemeler[0]!.status).toBe("VOIDED");
    expect(odemeler[0]!.voidReason).toContain("para alınmamıştı");
  });

  it("tahsilatı olan kayıt iade bilgisi verilmeden iptal edilemez", async () => {
    const id = await tamamlanmisIslem("34IPT101");
    await expect(
      parkIptal(patron, { parkingSessionId: id, sebep: "Gerekçe var", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/iade edilip edilmediğini/i);
  });

  it("İADE SENARYOSUNDA net kasa tutarı 0 olur", async () => {
    const id = await tamamlanmisIslem("34IPT333");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "İade",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    const net = await netKasa();
    expect(net).toBe(0);
  });

  it("İADE EDİLMEMİŞ SENARYODA da net kasa tutarı 0 olur", async () => {
    const id = await tamamlanmisIslem("34IPT334");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Para alınmamıştı",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });

    const net = await netKasa();
    expect(net).toBe(0);
  });

  it("iptal edilmeyen tahsilat kasada görünmeye devam eder", async () => {
    await tamamlanmisIslem("34IPT335");
    expect(await netKasa()).toBe(5000);
  });

  it("gerekçesiz iptal reddedilir", async () => {
    const id = await tamamlanmisIslem("34IPT444");
    await expect(
      parkIptal(patron, { parkingSessionId: id, sebep: "x", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/gerekçe/i);
  });

  it("iki kez iptal edilemez", async () => {
    const id = await tamamlanmisIslem("34IPT555");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "İlk iptal",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });
    await expect(
      parkIptal(patron, {
        parkingSessionId: id,
        sebep: "İkinci iptal",
        iadeEdildi: true,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/daha önce iptal/i);
  });

  it("iptal edilen araç tekrar giriş yapabilir", async () => {
    const id = await tamamlanmisIslem("34IPT666");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Hata",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });
    const yeni = await aracGirisi(patron, { plaka: "34IPT666", idempotencyKey: anahtar() });
    expect(yeni.parkingSessionId).not.toBe(id);
  });

  it("aktif araç da iptal edilebilir (yanlış giriş)", async () => {
    const giris = await aracGirisi(patron, { plaka: "34IPT777", idempotencyKey: anahtar() });
    const sonuc = await parkIptal(patron, {
      parkingSessionId: giris.parkingSessionId,
      sebep: "Yanlışlıkla giriş yapıldı",
      idempotencyKey: anahtar(),
    });
    expect(sonuc.etkilenenTahsilatSayisi).toBe(0);
    expect(sonuc.iadeEdilenKurus).toBe(0);
    expect(await prisma.parkingSession.count({ where: { status: "ACTIVE" } })).toBe(0);
  });

  it("iptal denetim kaydına yazılır", async () => {
    const id = await tamamlanmisIslem("34IPT888");
    await parkIptal(patron, {
      parkingSessionId: id,
      sebep: "Denetim testi",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });
    expect(await prisma.auditLog.count({ where: { action: "PARKING_VOID" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "PAYMENT_VOID" } })).toBe(1);
  });
});
