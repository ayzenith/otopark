/**
 * OTO YIKAMA TESTLERI (Asama 4)
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki fiyatlar YALNIZCA TEST icindir. Londra Camping
 * Otopark'in gercek yikama fiyatlari DEGILDIR ve hicbir yere isletme verisi
 * olarak yazilmaz. Testler fiyatlandirma MEKANIZMASINI dogrular.
 * ============================================================================
 *
 * Dogrulanan isletme kararlari (04.10.2026):
 *   - Arac tipine gore fiyat farki YALNIZCA yikamada vardir.
 *   - Otopark ve yikama fiyatlandirmasi TAMAMEN AYRIDIR.
 *   - Abonmanin yikamada indirimi YOKTUR.
 *   - Hizmetler ve fiyatlar panelden yonetilir; kodda sabit fiyat yoktur.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
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
import {
  cozumleYikamaFiyati,
  sinifIcinFiyatListesi,
  yikamaFiyatTablosu,
} from "@/server/wash/pricing";
import {
  yikamaFiyatiGuncelle,
  yikamaHizmetiOlustur,
  yikamaHizmetiGuncelle,
  aracSinifiOlustur,
} from "@/server/wash/admin";
import {
  yikamaDurumDegistir,
  yikamaOlustur,
  yikamaSatirCikar,
  yikamaSatirEkle,
} from "@/server/wash/job";
import {
  yikamaIptal,
  yikamaTahsilat,
  yikamaTahsilatsizTamamla,
} from "@/server/wash/payment";
import {
  hizmetBazliCiro,
  personelYikamaSayisi,
  tahsilEdilmeyenYikamalar,
  yikamaDetay,
  yikamaKuyrugu,
  yikamaOzeti,
} from "@/server/wash/queries";
import { abonmanOlustur } from "@/server/subscription/manage";
import { musteriOlustur, musteriyeAracBagla } from "@/server/subscription/customer";
import { aracGirisi } from "@/server/parking/entry";
import { cikisOnizleme } from "@/server/parking/exit";
import { toKurus } from "@/lib/money";
import { PERMISSIONS } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;

let otomobilId: string;
let suvId: string;
let motosikletId: string;
let patron: SessionUser;
let personel: SessionUser;

let sayac = 0;
const anahtar = () => `yikama-test-${Date.now()}-${++sayac}`;

beforeEach(async () => {
  await temizle();

  otomobilId = (await aracSinifiGetir("OTOMOBIL")).id;
  suvId = (await sinifGetir("SUV", "SUV / Arazi")).id;
  motosikletId = (await sinifGetir("MOTOSIKLET", "Motosiklet")).id;

  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  await vardiyaOlustur(o.id);
  patron = oturum(o);

  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);

  await kapasiteAyarla(0);
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

// ===========================================================================
// FIYAT COZUMLEME: ARAC TIPINE GORE
// ===========================================================================

describe("yıkama fiyatı araç tipine göre çözümlenir", () => {
  it("her araç tipi KENDİ fiyatını alır", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış Yıkama",
      sinifFiyatlari: { [otomobilId]: 600 * TL, [suvId]: 700 * TL, [motosikletId]: 400 * TL },
    });

    const otomobil = await cozumleYikamaFiyati(hizmet.id, otomobilId);
    const suv = await cozumleYikamaFiyati(hizmet.id, suvId);
    const motosiklet = await cozumleYikamaFiyati(hizmet.id, motosikletId);

    expect(otomobil!.fiyatKurus).toBe(600 * TL);
    expect(suv!.fiyatKurus).toBe(700 * TL);
    expect(motosiklet!.fiyatKurus).toBe(400 * TL);
    expect(otomobil!.sinifaOzelMi).toBe(true);
  });

  it("tipe özel fiyat GENEL fiyatı ezer", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      genelFiyat: 500 * TL,
      sinifFiyatlari: { [suvId]: 700 * TL },
    });

    // SUV'un kendi fiyati var: 700.
    expect((await cozumleYikamaFiyati(hizmet.id, suvId))!.fiyatKurus).toBe(700 * TL);
    // Otomobilin kendi fiyati yok: genel fiyat 500.
    const otomobil = await cozumleYikamaFiyati(hizmet.id, otomobilId);
    expect(otomobil!.fiyatKurus).toBe(500 * TL);
    expect(otomobil!.sinifaOzelMi).toBe(false);
  });

  it("fiyat tanımlı değilse null döner; BAŞKA tipin fiyatı kullanılmaz", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    // SUV icin ne ozel ne genel fiyat var: sessizce 600 kullanilmaz.
    expect(await cozumleYikamaFiyati(hizmet.id, suvId)).toBeNull();
  });

  it("pasif hizmetin fiyatı çözümlenmez", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    await prisma.washServiceCatalog.update({
      where: { id: hizmet.id },
      data: { isActive: false },
    });
    expect(await cozumleYikamaFiyati(hizmet.id, otomobilId)).toBeNull();
  });

  it("fiyat listesi, fiyatı olmayan hizmeti de gösterir ama null ile işaretler", async () => {
    await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    await yikamaHizmetiKur({ kod: "MOTOR", ad: "Motor Yıkama" });

    const liste = await sinifIcinFiyatListesi(otomobilId);
    expect(liste).toHaveLength(2);
    expect(liste.find((h) => h.kod === "IC_DIS")!.fiyatKurus).toBe(600 * TL);
    // Fiyati girilmemis hizmet 0 degil NULL doner: "bedava" ile karismaz.
    expect(liste.find((h) => h.kod === "MOTOR")!.fiyatKurus).toBeNull();
  });

  it("yeni araç tipi eklenip fiyatı girilebilir", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    const ticari = await aracSinifiOlustur(patron, {
      kod: "TICARI",
      ad: "Ticari",
      siraNo: 40,
      standartTarifeDisi: false,
    });

    // Henuz fiyati yok.
    expect(await cozumleYikamaFiyati(hizmet.id, ticari.id)).toBeNull();

    await yikamaFiyatiGuncelle(patron, {
      washServiceId: hizmet.id,
      vehicleClassId: ticari.id,
      ucretKurus: 900 * TL,
    });

    expect((await cozumleYikamaFiyati(hizmet.id, ticari.id))!.fiyatKurus).toBe(900 * TL);
  });
});

// ===========================================================================
// FIYAT DEGISIKLIGI VE TARIHSEL DEGISMEZLIK
// ===========================================================================

describe("yıkama fiyatı değişikliği", () => {
  it("yeni fiyat SÜRÜM açar, eski sürümün fiyatı değişmez", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    await yikamaFiyatiGuncelle(patron, {
      washServiceId: hizmet.id,
      vehicleClassId: otomobilId,
      ucretKurus: 750 * TL,
      not: "Zam",
    });

    const surumler = await prisma.washServicePriceVersion.findMany({
      where: { washServiceId: hizmet.id, vehicleClassId: otomobilId },
      orderBy: { effectiveFrom: "asc" },
    });

    expect(surumler).toHaveLength(2);
    expect(toKurus(surumler[0]!.price)).toBe(600 * TL); // ESKI DEGISMEDI
    expect(surumler[0]!.effectiveTo).not.toBeNull(); // kapatildi
    expect(toKurus(surumler[1]!.price)).toBe(750 * TL);
    expect(surumler[1]!.effectiveTo).toBeNull();

    expect((await cozumleYikamaFiyati(hizmet.id, otomobilId))!.fiyatKurus).toBe(750 * TL);
  });

  it("aynı fiyat tekrar girilirse yeni sürüm üretilmez", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    const sonuc = await yikamaFiyatiGuncelle(patron, {
      washServiceId: hizmet.id,
      vehicleClassId: otomobilId,
      ucretKurus: 600 * TL,
    });

    expect(sonuc.degisti).toBe(false);
    expect(
      await prisma.washServicePriceVersion.count({ where: { washServiceId: hizmet.id } }),
    ).toBe(1);
  });

  it("fiyat GEÇMİŞ tarihten başlatılamaz", async () => {
    const hizmet = await yikamaHizmetiKur({ kod: "IC_DIS" });
    await expect(
      yikamaFiyatiGuncelle(patron, {
        washServiceId: hizmet.id,
        vehicleClassId: otomobilId,
        ucretKurus: 600 * TL,
        gecerlilikBaslangici: new Date(Date.now() - 86_400_000),
      }),
    ).rejects.toThrow(/geçmiş bir tarihten/i);
  });

  it("FİYAT DEĞİŞİKLİĞİ GEÇMİŞ İŞ EMRİNİ ETKİLEMEZ", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış Yıkama",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    expect(is.toplamKurus).toBe(600 * TL);

    // Fiyat zamlanir.
    await yikamaFiyatiGuncelle(patron, {
      washServiceId: hizmet.id,
      vehicleClassId: otomobilId,
      ucretKurus: 900 * TL,
    });

    // Gecmis is emrinin tutari AYNI kalir.
    const detay = await yikamaDetay(is.washJobId);
    expect(detay!.toplamKurus).toBe(600 * TL);
    expect(detay!.satirlar[0]!.birimKurus).toBe(600 * TL);
  });

  it("hizmet adı değişse bile geçmiş iş emrinde eski ad kalır", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış Yıkama",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });

    await yikamaHizmetiGuncelle(patron, hizmet.id, {
      ad: "Komple Yıkama",
      aciklama: null,
      tahminiDakika: null,
      siteGorunur: false,
      siraNo: 0,
    });

    const detay = await yikamaDetay(is.washJobId);
    expect(detay!.satirlar[0]!.ad).toBe("İç Dış Yıkama");
  });

  it("hizmet SİLİNMEZ, pasife alınır", async () => {
    const hizmet = await yikamaHizmetiOlustur(patron, {
      kod: "PASTA_CILA",
      ad: "Pasta Cila",
      aciklama: null,
      tahminiDakika: 90,
      siteGorunur: false,
      siraNo: 30,
    });
    await yikamaHizmetiGuncelle(patron, hizmet.id, {
      ad: "Pasta Cila",
      aciklama: null,
      tahminiDakika: 90,
      siteGorunur: false,
      siraNo: 30,
      aktif: false,
    });

    const guncel = await prisma.washServiceCatalog.findUniqueOrThrow({ where: { id: hizmet.id } });
    expect(guncel.isActive).toBe(false);
    // Kayit duruyor: gecmis is emirleri ve ciro raporlari bozulmaz.
    expect(await prisma.washServiceCatalog.count()).toBe(1);
  });

  it("aynı kodla ikinci hizmet oluşturulamaz", async () => {
    await yikamaHizmetiOlustur(patron, {
      kod: "IC_DIS",
      ad: "İç Dış",
      aciklama: null,
      tahminiDakika: null,
      siteGorunur: false,
      siraNo: 0,
    });
    await expect(
      yikamaHizmetiOlustur(patron, {
        kod: "IC_DIS",
        ad: "Başka",
        aciklama: null,
        tahminiDakika: null,
        siteGorunur: false,
        siraNo: 0,
      }),
    ).rejects.toThrow(/zaten kullanılıyor/);
  });
});

// ===========================================================================
// OTOPARK VE YIKAMA FIYATLANDIRMASI TAMAMEN AYRI
// ===========================================================================

describe("otopark ve yıkama fiyatlandırması birbirinden AYRI", () => {
  it("otopark tarifesi değişince yıkama fiyatı DEĞİŞMEZ", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });

    const once = (await cozumleYikamaFiyati(hizmet.id, otomobilId))!.fiyatKurus;

    // Yeni (ve cok farkli) bir otopark tarifesi devreye girer.
    await tarifeOlustur({
      ad: "Yeni Tarife",
      ilkBlokDakika: 60,
      ilkBlokUcret: 999 * TL,
      saatlikUcret: 999 * TL,
      oncelik: 500,
    });

    expect((await cozumleYikamaFiyati(hizmet.id, otomobilId))!.fiyatKurus).toBe(once);
  });

  it("yıkama fiyatı değişince OTOPARK ücreti DEĞİŞMEZ", async () => {
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    const giris = await aracGirisi(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 150 * 60_000) },
    });
    const once = (await cikisOnizleme("34ABC123")).tutar;

    await yikamaFiyatiGuncelle(patron, {
      washServiceId: hizmet.id,
      vehicleClassId: otomobilId,
      ucretKurus: 5000 * TL,
    });

    expect((await cikisOnizleme("34ABC123")).tutar).toBe(once);
  });

  it("OTOPARKTA araç tipine göre fiyat farkı yoktur: SUV ile otomobil aynı öder", async () => {
    // Genel kural (vehicleClassId = null): tum siniflar ayni.
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });

    const otomobilGiris = await aracGirisi(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });
    const suvGiris = await aracGirisi(personel, {
      plaka: "06XYZ45",
      aracSinifiId: suvId,
      idempotencyKey: anahtar(),
    });

    for (const id of [otomobilGiris.parkingSessionId, suvGiris.parkingSessionId]) {
      await prisma.parkingSession.update({
        where: { id },
        data: { entryAt: new Date(Date.now() - 150 * 60_000) },
      });
    }

    const otomobilUcret = (await cikisOnizleme("34ABC123")).tutar;
    const suvUcret = (await cikisOnizleme("06XYZ45")).tutar;
    expect(suvUcret).toBe(otomobilUcret);
  });

  it("YIKAMADA araç tipine göre fiyat farkı VARDIR: SUV daha pahalı", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL, [suvId]: 700 * TL },
    });

    const otomobil = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    const suv = await yikamaOlustur(personel, {
      plaka: "06XYZ45",
      aracSinifiId: suvId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });

    expect(otomobil.toplamKurus).toBe(600 * TL);
    expect(suv.toplamKurus).toBe(700 * TL);
  });

  it("yıkama tahsilatı PARK tahsilatından ayrı kaydedilir", async () => {
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const yikamaOdemeleri = await prisma.payment.findMany({ where: { sourceType: "WASH" } });
    const parkOdemeleri = await prisma.payment.findMany({ where: { sourceType: "PARKING" } });

    expect(yikamaOdemeleri).toHaveLength(1);
    expect(parkOdemeleri).toHaveLength(0);
    expect(yikamaOdemeleri[0]!.washJobId).toBe(is.washJobId);
    expect(yikamaOdemeleri[0]!.parkingSessionId).toBeNull();
  });
});

// ===========================================================================
// ABONMAN INDIRIMI YOKTUR
// ===========================================================================

describe("abonmanın yıkamada indirimi YOKTUR", () => {
  it("abonmanlı müşterinin yıkama ücreti abonmansızla AYNIDIR", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    // Abonmanli musteri ve araci.
    const musteri = await musteriOlustur(patron, {
      adSoyad: "Abonmanlı Müşteri",
      telefon: "05321112233",
    });
    await musteriyeAracBagla(patron, { musteriId: musteri.id, plaka: "34ABC123" });
    await abonmanOlustur(patron, {
      musteriId: musteri.id,
      planEtiketi: "Aylık",
      baslangic: new Date(Date.now() - 86_400_000),
      bitis: new Date(Date.now() + 29 * 86_400_000),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const abonmanli = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    const abonmansiz = await yikamaOlustur(personel, {
      plaka: "06XYZ45",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });

    expect(abonmanli.toplamKurus).toBe(600 * TL);
    expect(abonmansiz.toplamKurus).toBe(abonmanli.toplamKurus);
  });

  it("abonmanlı araçtan yıkama ücreti TAHSIL EDILIR", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const musteri = await musteriOlustur(patron, {
      adSoyad: "Abonmanlı Müşteri",
      telefon: "05321112233",
    });
    await musteriyeAracBagla(patron, { musteriId: musteri.id, plaka: "34ABC123" });
    await abonmanOlustur(patron, {
      musteriId: musteri.id,
      planEtiketi: "Aylık",
      baslangic: new Date(Date.now() - 86_400_000),
      bitis: new Date(Date.now() + 29 * 86_400_000),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    const tahsilat = await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    // Abonman PARK ucretini kaldirir, yikama ucretini KALDIRMAZ.
    expect(tahsilat.odenenKurus).toBe(600 * TL);
  });
});

// ===========================================================================
// IS EMRI
// ===========================================================================

describe("yıkama iş emri", () => {
  async function hizmetler() {
    const icDis = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış Yıkama",
      sinifFiyatlari: { [otomobilId]: 600 * TL, [suvId]: 700 * TL },
    });
    const motor = await yikamaHizmetiKur({
      kod: "MOTOR",
      ad: "Motor Yıkama",
      sinifFiyatlari: { [otomobilId]: 150 * TL },
    });
    return { icDis, motor };
  }

  it("çoklu hizmet satırı toplanır ve isim/fiyat kopyası saklanır", async () => {
    const { icDis, motor } = await hizmetler();

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }, { washServiceId: motor.id }],
      idempotencyKey: anahtar(),
    });

    expect(is.toplamKurus).toBe(750 * TL);
    expect(is.satirlar).toHaveLength(2);
    expect(is.durum).toBe("QUEUED");

    const satirlar = await prisma.washJobItem.findMany({ where: { washJobId: is.washJobId } });
    // Siralama onemli degil; iki hizmetin de KOPYALANMIS adiyla durmasi onemli.
    expect(new Set(satirlar.map((s) => s.serviceNameSnapshot))).toEqual(
      new Set(["İç Dış Yıkama", "Motor Yıkama"]),
    );
  });

  it("adet birden fazla olabilir", async () => {
    const { icDis } = await hizmetler();
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id, adet: 3 }],
      idempotencyKey: anahtar(),
    });
    expect(is.toplamKurus).toBe(1800 * TL);
  });

  it("FİYATI TANIMSIZ hizmet onay olmadan kaydedilmez", async () => {
    const motor = await yikamaHizmetiKur({ kod: "MOTOR", ad: "Motor Yıkama" });

    await expect(
      yikamaOlustur(personel, {
        plaka: "34ABC123",
        aracSinifiId: otomobilId,
        hizmetler: [{ washServiceId: motor.id }],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/fiyatı tanımlı değil/i);

    expect(await prisma.washJob.count()).toBe(0);
  });

  it("onay verilirse 0 ₺ kaydedilir, UYARI üretilir ve kayda NOT düşer", async () => {
    const motor = await yikamaHizmetiKur({ kod: "MOTOR", ad: "Motor Yıkama" });

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: motor.id }],
      fiyatsizDevam: true,
      idempotencyKey: anahtar(),
    });

    expect(is.toplamKurus).toBe(0);
    expect(is.fiyatTanimsiz).toBe(true);
    expect(is.uyarilar.join(" ")).toMatch(/Fiyatı tanımsız/);

    const kayit = await prisma.washJob.findUniqueOrThrow({ where: { id: is.washJobId } });
    expect(kayit.notes).toMatch(/FİYAT TANIMSIZ/);
  });

  it("araç sınıfı değiştirilince yıkama fiyatı o sınıftan hesaplanır", async () => {
    const { icDis } = await hizmetler();

    // Arac once otomobil olarak kaydedilir.
    await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });

    // Personel tipi SUV olarak duzeltir.
    const suvIs = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: suvId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });

    expect(suvIs.toplamKurus).toBe(700 * TL);
    expect(suvIs.aracSinifiAdi).toMatch(/SUV/);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci istek yeni iş emri açmaz", async () => {
    const { icDis } = await hizmetler();
    const key = anahtar();

    const birinci = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: key,
    });
    const ikinci = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: key,
    });

    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(ikinci.washJobId).toBe(birinci.washJobId);
    expect(await prisma.washJob.count()).toBe(1);
  });

  it("aynı araç aynı gün birden fazla yıkanabilir (park gibi engel YOK)", async () => {
    const { icDis } = await hizmetler();
    const birinci = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });
    const ikinci = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });
    expect(ikinci.washJobId).not.toBe(birinci.washJobId);
  });

  it("hizmet seçilmeden iş emri açılamaz", async () => {
    await expect(
      yikamaOlustur(personel, {
        plaka: "34ABC123",
        aracSinifiId: otomobilId,
        hizmetler: [],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/en az bir/i);
  });

  it("geçersiz plaka biçimi onay ister", async () => {
    const { icDis } = await hizmetler();
    await expect(
      yikamaOlustur(personel, {
        plaka: "99ZZZ999",
        aracSinifiId: otomobilId,
        hizmetler: [{ washServiceId: icDis.id }],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/plaka biçimine uymuyor/);
  });

  it("vardiya kapalıysa iş emri açılamaz", async () => {
    const { icDis } = await hizmetler();
    const vardiyasiz = oturum(
      await kullaniciOlustur({ username: "vardiyasiz", role: "STAFF" }),
    );
    await expect(
      yikamaOlustur(vardiyasiz, {
        plaka: "34ABC123",
        aracSinifiId: otomobilId,
        hizmetler: [{ washServiceId: icDis.id }],
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow();
  });
});

// ===========================================================================
// DURUM GECISLERI
// ===========================================================================

describe("yıkama durum geçişleri", () => {
  async function isEmriKur() {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    return { hizmet, is };
  }

  it("SIRADA → YIKAMADA → TAMAMLANDI", async () => {
    const { is } = await isEmriKur();

    const yikamada = await yikamaDurumDegistir(personel, {
      washJobId: is.washJobId,
      yeniDurum: "IN_PROGRESS",
    });
    expect(yikamada.status).toBe("IN_PROGRESS");
    expect(yikamada.startedAt).not.toBeNull();
    // Isi baslatan kisi otomatik atanir.
    expect(yikamada.assignedUserId).toBe(personel.id);

    const tamam = await yikamaDurumDegistir(personel, {
      washJobId: is.washJobId,
      yeniDurum: "COMPLETED",
    });
    expect(tamam.status).toBe("COMPLETED");
    expect(tamam.completedAt).not.toBeNull();
  });

  it("tamamlanmış iş geri alınamaz", async () => {
    const { is } = await isEmriKur();
    await yikamaDurumDegistir(personel, { washJobId: is.washJobId, yeniDurum: "COMPLETED" });
    await expect(
      yikamaDurumDegistir(personel, { washJobId: is.washJobId, yeniDurum: "IN_PROGRESS" }),
    ).rejects.toThrow(/geçilemez/);
  });

  it("durum değişimi denetim kaydına yazılır", async () => {
    const { is } = await isEmriKur();
    await yikamaDurumDegistir(personel, { washJobId: is.washJobId, yeniDurum: "IN_PROGRESS" });

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "WASH_STATUS_CHANGE", entityId: is.washJobId },
    });
    expect(denetim).not.toBeNull();
    expect(denetim!.actorLabel).toBe("personel1");
  });

  it("iptal, durum değiştirme yoluyla yapılamaz (gerekçe zorunlu)", async () => {
    const { is } = await isEmriKur();
    await expect(
      yikamaDurumDegistir(personel, {
        washJobId: is.washJobId,
        yeniDurum: "CANCELLED" as never,
      }),
    ).rejects.toThrow(/gerekçe/i);
  });

  it("kuyruk yalnızca sırada ve yıkamada olanları gösterir", async () => {
    const { is } = await isEmriKur();
    expect(await yikamaKuyrugu()).toHaveLength(1);

    await yikamaDurumDegistir(personel, { washJobId: is.washJobId, yeniDurum: "COMPLETED" });
    expect(await yikamaKuyrugu()).toHaveLength(0);
  });
});

// ===========================================================================
// SATIR EKLEME / CIKARMA
// ===========================================================================

describe("iş emrine hizmet ekleme ve çıkarma", () => {
  async function kur() {
    const icDis = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const motor = await yikamaHizmetiKur({
      kod: "MOTOR",
      ad: "Motor Yıkama",
      sinifFiyatlari: { [otomobilId]: 150 * TL },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });
    return { icDis, motor, is };
  }

  it("devam eden işe hizmet eklenir ve toplam güncellenir", async () => {
    const { motor, is } = await kur();
    const sonuc = await yikamaSatirEkle(personel, {
      washJobId: is.washJobId,
      washServiceId: motor.id,
    });
    expect(sonuc.toplamKurus).toBe(750 * TL);

    const detay = await yikamaDetay(is.washJobId);
    expect(detay!.satirlar).toHaveLength(2);
    expect(detay!.odenecekKurus).toBe(750 * TL);
  });

  it("hizmet çıkarılır ve toplam güncellenir", async () => {
    const { motor, is } = await kur();
    await yikamaSatirEkle(personel, { washJobId: is.washJobId, washServiceId: motor.id });

    const detay = await yikamaDetay(is.washJobId);
    const motorSatiri = detay!.satirlar.find((s) => s.ad === "Motor Yıkama")!;

    const sonuc = await yikamaSatirCikar(personel, {
      washJobId: is.washJobId,
      washJobItemId: motorSatiri.id,
    });
    expect(sonuc.toplamKurus).toBe(600 * TL);
  });

  it("son hizmet çıkarılamaz (iş emri boş kalmaz)", async () => {
    const { is } = await kur();
    const detay = await yikamaDetay(is.washJobId);
    await expect(
      yikamaSatirCikar(personel, {
        washJobId: is.washJobId,
        washJobItemId: detay!.satirlar[0]!.id,
      }),
    ).rejects.toThrow(/en az bir hizmet/i);
  });

  it("tahsilatı yapılmış işe hizmet eklenemez", async () => {
    const { motor, is } = await kur();
    // Tahsilat varsayilan olarak isi de TAMAMLAR; bu durumda once "kapanmis
    // is" kurali devreye girer. Her iki mesaj da personeli dogru yonlendirir.
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await expect(
      yikamaSatirEkle(personel, { washJobId: is.washJobId, washServiceId: motor.id }),
    ).rejects.toThrow(/durumundaki işe hizmet eklenemez/);
  });

  it("tahsil edilmiş ama HENÜZ TAMAMLANMAMIŞ işe de hizmet eklenemez", async () => {
    const { motor, is } = await kur();
    // tamamla: false -> is SIRADA kalir ama parasi alinmistir. Sonradan
    // hizmet eklenmesi, alinan paradan fazla hizmet verilmesi demek olurdu.
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      tamamla: false,
      idempotencyKey: anahtar(),
    });

    const kayit = await prisma.washJob.findUniqueOrThrow({ where: { id: is.washJobId } });
    expect(kayit.status).toBe("QUEUED");
    expect(kayit.paymentStatus).toBe("PAID");

    await expect(
      yikamaSatirEkle(personel, { washJobId: is.washJobId, washServiceId: motor.id }),
    ).rejects.toThrow(/Tahsilatı yapılmış/);
  });

  it("fiyatı tanımsız hizmet onay olmadan eklenemez", async () => {
    const { is } = await kur();
    const pasta = await yikamaHizmetiKur({ kod: "PASTA", ad: "Pasta Cila" });
    await expect(
      yikamaSatirEkle(personel, { washJobId: is.washJobId, washServiceId: pasta.id }),
    ).rejects.toThrow(/fiyatı tanımlı değil/i);

    const sonuc = await yikamaSatirEkle(personel, {
      washJobId: is.washJobId,
      washServiceId: pasta.id,
      fiyatsizDevam: true,
    });
    expect(sonuc.toplamKurus).toBe(600 * TL);
  });
});

// ===========================================================================
// TAHSILAT
// ===========================================================================

describe("yıkama tahsilatı", () => {
  async function kur(ucret = 600 * TL) {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: ucret },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    return { hizmet, is };
  }

  /** Kasadaki net tutar: iptal edilenler ve ters kayitlar dusulur. */
  async function netKasa(): Promise<number> {
    const kayitlar = await prisma.payment.findMany({ where: { status: "CONFIRMED" } });
    return kayitlar.reduce(
      (t, k) => t + (k.direction === "OUT" ? -toKurus(k.amount) : toKurus(k.amount)),
      0,
    );
  }

  it("TUTAR SUNUCUDA hesaplanır ve Payment kaydı üretilir", async () => {
    const { is } = await kur();
    const sonuc = await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(sonuc.odenenKurus).toBe(600 * TL);
    expect(sonuc.durum).toBe("COMPLETED");

    const odeme = await prisma.payment.findFirstOrThrow({ where: { washJobId: is.washJobId } });
    expect(odeme.sourceType).toBe("WASH");
    expect(odeme.collectedById).toBe(personel.id);
    expect(toKurus(odeme.amount)).toBe(600 * TL);
  });

  it("MÜKERRER TAHSILAT engellenir", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await expect(
      yikamaTahsilat(personel, {
        washJobId: is.washJobId,
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/tahsilatı yapılmış/i);

    expect(await prisma.payment.count({ where: { washJobId: is.washJobId } })).toBe(1);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci istek ikinci tahsilat üretmez", async () => {
    const { is } = await kur();
    const key = anahtar();
    const birinci = await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });
    const ikinci = await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });

    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(ikinci.tahsilatKodu).toBe(birinci.tahsilatKodu);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("indirim İZİN ister ve gerekçe zorunludur", async () => {
    const { is } = await kur();

    // Personelin indirim izni yok.
    await expect(
      yikamaTahsilat(personel, {
        washJobId: is.washJobId,
        odemeYontemi: "CASH",
        indirimKurus: 100 * TL,
        indirimSebebi: "Müşteri memnuniyeti",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yetkiniz yok/i);

    // Patronun var ama gerekce zorunlu.
    await expect(
      yikamaTahsilat(patron, {
        washJobId: is.washJobId,
        odemeYontemi: "CASH",
        indirimKurus: 100 * TL,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/gerekçesi zorunlu/i);

    const sonuc = await yikamaTahsilat(patron, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      indirimKurus: 100 * TL,
      indirimSebebi: "Müşteri memnuniyeti",
      idempotencyKey: anahtar(),
    });
    expect(sonuc.indirimKurus).toBe(100 * TL);
    expect(sonuc.odenenKurus).toBe(500 * TL);
  });

  it("indirim toplamı aşamaz (negatif tahsilat olmaz)", async () => {
    const { is } = await kur();
    const sonuc = await yikamaTahsilat(patron, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      indirimKurus: 9999 * TL,
      indirimSebebi: "Tamamen ücretsiz",
      idempotencyKey: anahtar(),
    });
    expect(sonuc.odenenKurus).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("kart notu yalnızca KART ödemesinde saklanır", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      kartNotu: "olmamalı",
      idempotencyKey: anahtar(),
    });
    const odeme = await prisma.payment.findFirstOrThrow({ where: { washJobId: is.washJobId } });
    expect(odeme.cardNote).toBeNull();
  });

  it("TAHSİLATSIZ TAMAMLAMA gerekçe ister ve takip listesine düşer", async () => {
    const { is } = await kur();

    await expect(
      yikamaTahsilatsizTamamla(personel, { washJobId: is.washJobId, sebep: "" }),
    ).rejects.toThrow(/gerekçe/i);

    await yikamaTahsilatsizTamamla(personel, {
      washJobId: is.washJobId,
      sebep: "Müşteri yarın ödeyecek",
    });

    const kayit = await prisma.washJob.findUniqueOrThrow({ where: { id: is.washJobId } });
    expect(kayit.status).toBe("COMPLETED");
    expect(kayit.paymentStatus).toBe("UNPAID");
    expect(kayit.notes).toMatch(/TAHSİLAT YAPILMADI/);

    const takip = await tahsilEdilmeyenYikamalar();
    expect(takip.map((t) => t.id)).toContain(is.washJobId);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("iptal edilmiş işin tahsilatı yapılamaz", async () => {
    const { is } = await kur();
    await yikamaIptal(patron, {
      washJobId: is.washJobId,
      sebep: "Müşteri vazgeçti",
      idempotencyKey: anahtar(),
    });
    await expect(
      yikamaTahsilat(personel, {
        washJobId: is.washJobId,
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/İptal edilmiş/);
  });

  // -------------------------------------------------------------------------
  // IPTAL: FINANSAL KAYIT SILINMEZ
  // -------------------------------------------------------------------------

  it("PARA İADE EDİLDİ: orijinal kayıt kalır, ters kayıt üretilir", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(await netKasa()).toBe(600 * TL);

    const sonuc = await yikamaIptal(patron, {
      washJobId: is.washJobId,
      sebep: "Yıkama hatalı yapıldı, para geri verildi",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.tersKayitKodu).not.toBeNull();
    expect(sonuc.iadeEdilenKurus).toBe(600 * TL);

    const orijinal = await prisma.payment.findFirstOrThrow({
      where: { washJobId: is.washJobId, direction: "IN" },
    });
    expect(orijinal.status).toBe("CONFIRMED");

    // Para IKI KEZ dusulmedi.
    expect(await netKasa()).toBe(0);
  });

  it("PARA EL DEĞİŞTİRMEDİ: kayıt VOIDED olur, ters kayıt üretilmez", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const sonuc = await yikamaIptal(patron, {
      washJobId: is.washJobId,
      sebep: "Yanlış araca işlendi",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.tersKayitKodu).toBeNull();
    const orijinal = await prisma.payment.findFirstOrThrow({ where: { washJobId: is.washJobId } });
    expect(orijinal.status).toBe("VOIDED");
    expect(orijinal.voidReason).toBe("Yanlış araca işlendi");
    expect(await prisma.payment.count()).toBe(1);
    expect(await netKasa()).toBe(0);
  });

  it("tahsilatı olan iş, iade bilgisi verilmeden iptal edilemez", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await expect(
      yikamaIptal(patron, {
        washJobId: is.washJobId,
        sebep: "Bir sebep",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/fiilen iade edilip/);
  });

  it("tahsilatı olmayan iş gerekçeyle iptal edilir", async () => {
    const { is } = await kur();
    const sonuc = await yikamaIptal(patron, {
      washJobId: is.washJobId,
      sebep: "Müşteri vazgeçti",
      idempotencyKey: anahtar(),
    });
    expect(sonuc.etkilenenTahsilatSayisi).toBe(0);

    const kayit = await prisma.washJob.findUniqueOrThrow({ where: { id: is.washJobId } });
    expect(kayit.status).toBe("CANCELLED");
    expect(kayit.cancelReason).toBe("Müşteri vazgeçti");
  });

  it("gerekçesiz iptal edilemez", async () => {
    const { is } = await kur();
    await expect(
      yikamaIptal(patron, { washJobId: is.washJobId, sebep: "", idempotencyKey: anahtar() }),
    ).rejects.toThrow(/gerekçesi zorunlu/i);
  });

  it("finansal kayıt SİLİNMEZ: veritabanı DELETE'i reddeder", async () => {
    const { is } = await kur();
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    const odeme = await prisma.payment.findFirstOrThrow({ where: { washJobId: is.washJobId } });
    await expect(prisma.payment.delete({ where: { id: odeme.id } })).rejects.toThrow();
  });
});

// ===========================================================================
// RAPORLAR
// ===========================================================================

describe("yıkama raporları", () => {
  it("hizmet bazlı ciro, iş anındaki fiyattan hesaplanır", async () => {
    const icDis = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const motor = await yikamaHizmetiKur({
      kod: "MOTOR",
      ad: "Motor Yıkama",
      sinifFiyatlari: { [otomobilId]: 150 * TL },
    });

    await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }, { washServiceId: motor.id }],
      idempotencyKey: anahtar(),
    });
    await yikamaOlustur(personel, {
      plaka: "06XYZ45",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: icDis.id }],
      idempotencyKey: anahtar(),
    });

    // Fiyat sonradan degisse bile ciro degismemeli.
    await yikamaFiyatiGuncelle(patron, {
      washServiceId: icDis.id,
      vehicleClassId: otomobilId,
      ucretKurus: 5000 * TL,
    });

    const ciro = await hizmetBazliCiro(
      new Date(Date.now() - 3600_000),
      new Date(Date.now() + 3600_000),
    );
    const icDisSatiri = ciro.find((c) => c.ad === "İç Dış")!;
    expect(icDisSatiri.adet).toBe(2);
    expect(icDisSatiri.tutarKurus).toBe(1200 * TL);
    expect(ciro.find((c) => c.ad === "Motor Yıkama")!.tutarKurus).toBe(150 * TL);
  });

  it("iptal edilen iş ciroya girmez", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    await yikamaIptal(patron, {
      washJobId: is.washJobId,
      sebep: "Müşteri vazgeçti",
      idempotencyKey: anahtar(),
    });

    const ciro = await hizmetBazliCiro(
      new Date(Date.now() - 3600_000),
      new Date(Date.now() + 3600_000),
    );
    expect(ciro).toHaveLength(0);
  });

  it("personel işlem sayısı işi YAPAN kişiye yazılır", async () => {
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });
    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });

    // Isi patron baslatirsa atanan kisi patron olur.
    await yikamaDurumDegistir(patron, { washJobId: is.washJobId, yeniDurum: "IN_PROGRESS" });

    const sayilar = await personelYikamaSayisi(
      new Date(Date.now() - 3600_000),
      new Date(Date.now() + 3600_000),
    );
    expect(sayilar).toHaveLength(1);
    expect(sayilar[0]!.userId).toBe(patron.id);
    expect(sayilar[0]!.adet).toBe(1);
  });

  it("özet sayaçları ve YALNIZCA yıkama cirosunu döndürür", async () => {
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [otomobilId]: 600 * TL },
    });

    // Bir park tahsilati: yikama cirosuna GIRMEMELI.
    const giris = await aracGirisi(personel, {
      plaka: "35KLM678",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 150 * 60_000) },
    });
    const { aracCikisi } = await import("@/server/parking/exit");
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const is = await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: hizmet.id }],
      idempotencyKey: anahtar(),
    });
    await yikamaTahsilat(personel, {
      washJobId: is.washJobId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const ozet = await yikamaOzeti();
    expect(ozet.tamamlanan).toBe(1);
    // YALNIZCA yikama: park tahsilati dahil DEGIL.
    expect(ozet.ciroKurus).toBe(600 * TL);
    expect(ozet.nakitKurus).toBe(600 * TL);
  });

  it("fiyatı tanımsız iş sayacı patronu uyarır", async () => {
    const motor = await yikamaHizmetiKur({ kod: "MOTOR", ad: "Motor Yıkama" });
    await yikamaOlustur(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      hizmetler: [{ washServiceId: motor.id }],
      fiyatsizDevam: true,
      idempotencyKey: anahtar(),
    });

    const ozet = await yikamaOzeti();
    expect(ozet.fiyatsizIsSayisi).toBe(1);
  });

  it("fiyat tablosu satır=hizmet, kolon=araç tipi olarak döner", async () => {
    await yikamaHizmetiKur({
      kod: "IC_DIS",
      ad: "İç Dış",
      sinifFiyatlari: { [otomobilId]: 600 * TL, [suvId]: 700 * TL },
    });

    const tablo = await yikamaFiyatTablosu();
    const satir = tablo.hizmetler.find((h) => h.kod === "IC_DIS")!;
    expect(satir.sinifFiyatlari[otomobilId]).toBe(600 * TL);
    expect(satir.sinifFiyatlari[suvId]).toBe(700 * TL);
    expect(satir.sinifFiyatlari[motosikletId]).toBeNull();
    expect(satir.genelFiyatKurus).toBeNull();
  });
});

// ===========================================================================
// KARAVAN: STANDART OTOPARK TARIFESI DISINDA
// ===========================================================================

describe("karavan standart otopark tarifesinin DIŞINDA", () => {
  it("genel tarife olsa bile karavana UYGULANMAZ", async () => {
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    const karavanId = (await sinifGetir("KARAVAN", "Karavan", true)).id;

    const giris = await aracGirisi(personel, {
      plaka: "34KRV01",
      aracSinifiId: karavanId,
      bicimiZorla: true,
      idempotencyKey: anahtar(),
    });

    // Tarife cozumlenemedi: snapshot yazilmadi.
    expect(giris.tarifeTanimsiz).toBe(true);
    expect(giris.uyarilar.join(" ")).toMatch(/normal otopark tarifesine dahil değil/);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.tariffSnapshot).toBeNull();
  });

  it("karavan çıkışında ücret 0 ama AÇIKÇA tarife tanımsız işaretlenir", async () => {
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    const karavanId = (await sinifGetir("KARAVAN", "Karavan", true)).id;

    const giris = await aracGirisi(personel, {
      plaka: "34KRV01",
      aracSinifiId: karavanId,
      bicimiZorla: true,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 300 * 60_000) },
    });

    const onizleme = await cikisOnizleme("34KRV01");
    expect(onizleme.tutar).toBe(0);
    expect(onizleme.tarifeTanimsiz).toBe(true);
    expect(onizleme.dokum[0]!.aciklama).toMatch(/normal otopark tarifesine dahil değil/);
  });

  it("karavana ÖZEL kural girilirse o kural uygulanır", async () => {
    const karavanId = (await sinifGetir("KARAVAN", "Karavan", true)).id;
    // Genel kural + karavana ozel kural ayni surumde.
    await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
    await tarifeOlustur({
      ad: "Karavan Tarifesi",
      aracSinifiId: karavanId,
      ilkBlokDakika: 60,
      ilkBlokUcret: 300 * TL,
      saatlikUcret: 100 * TL,
      oncelik: 200,
      varsayilan: false,
    });

    const giris = await aracGirisi(personel, {
      plaka: "34KRV01",
      aracSinifiId: karavanId,
      bicimiZorla: true,
      idempotencyKey: anahtar(),
    });
    expect(giris.tarifeTanimsiz).toBe(false);

    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 150 * 60_000) },
    });
    const onizleme = await cikisOnizleme("34KRV01");
    // 2 sa 30 dk: ilk blok 300 + 2 saat × 100 = 500
    expect(onizleme.tutar).toBe(500 * TL);
  });

  it("karavan YIKAMA fiyatı normal şekilde tanımlanabilir", async () => {
    // Karavan otopark tarifesinin disinda olsa da yikama fiyati girilebilir:
    // iki fiyatlandirma birbirinden bagimsizdir.
    const karavanId = (await sinifGetir("KARAVAN", "Karavan", true)).id;
    const hizmet = await yikamaHizmetiKur({
      kod: "IC_DIS",
      sinifFiyatlari: { [karavanId]: 1500 * TL },
    });

    expect((await cozumleYikamaFiyati(hizmet.id, karavanId))!.fiyatKurus).toBe(1500 * TL);
  });
});

// ===========================================================================
// GERCEK TARIFENIN VERITABANI UZERINDEN DOGRULANMASI
// ===========================================================================

describe("işletmenin gerçek otopark tarifesi (veritabanı üzerinden)", () => {
  it("24 saat 500 ₺, 25 saat 1.100 ₺ olarak tahsil edilir", async () => {
    // Patronun verdigi tarife panelden girilmis gibi kurulur.
    await tarifeOlustur({
      ad: "Standart Otopark Tarifesi",
      ilkBlokDakika: 60,
      ilkBlokUcret: 100 * TL,
      saatlikUcret: 50 * TL,
      gunlukUstLimit: 500 * TL,
      ekGunBlokUcret: 600 * TL,
    });

    const birGun = await aracGirisi(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: birGun.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 1440 * 60_000) },
    });
    expect((await cikisOnizleme("34ABC123")).tutar).toBe(500 * TL);

    const birGunArti = await aracGirisi(personel, {
      plaka: "06XYZ45",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: birGunArti.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 1500 * 60_000) },
    });
    expect((await cikisOnizleme("06XYZ45")).tutar).toBe(1100 * TL);
  });

  it("snapshot ek gün bloğunu taşır: sonradan tarife değişse bile değişmez", async () => {
    await tarifeOlustur({
      ilkBlokDakika: 60,
      ilkBlokUcret: 100 * TL,
      saatlikUcret: 50 * TL,
      gunlukUstLimit: 500 * TL,
      ekGunBlokUcret: 600 * TL,
    });

    const giris = await aracGirisi(personel, {
      plaka: "34ABC123",
      aracSinifiId: otomobilId,
      idempotencyKey: anahtar(),
    });

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    const snapshot = kayit.tariffSnapshot as Record<string, unknown>;
    expect(snapshot.ekGunBlokUcret).toBe(600 * TL);
    expect(snapshot.gunlukUstLimit).toBe(500 * TL);
  });
});
