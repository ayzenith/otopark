/**
 * ABONMAN VE MUSTERI TESTLERI (Asama 3)
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki tutarlar YALNIZCA TEST icindir. Londra Camping
 * Otopark'in gercek abonman ucretleri DEGILDIR. Sistemde genel bir abonman
 * fiyati YOKTUR; her abonmanin ucreti patron tarafindan o musteri icin
 * girilir. Testler bu "musteriye ozel fiyat" davranisinin kendisini
 * dogrular - belirli bir fiyatin dogrulugunu degil.
 * ============================================================================
 *
 * Dogrulanan kurallar (Asama 3 kapsami):
 *   1. Abonman olusturmak tahsilat olusturmaz
 *   2. Tahsilat ayri islemdir ve tahsil edeni kaydeder
 *   3. Odemesi alinmamis abonman gecerli sayilir (S9)
 *   4. Park sirasinda abonman bitse o park ucretsiz tamamlanir (S10)
 *   5. Fiyat musteriye ozeldir
 *   6. Gecmis donemlerin fiyati degismez
 *   8. Ayni plaka iki aktif abonmana baglanamaz (uygulama + VERITABANI)
 *   9. Bir musteri birden fazla araca sahip olabilir
 *  10. Arac el degistirse gecmis kayitlar bozulmaz
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
import {
  musteriDetay,
  musteriAra,
  musteriOlustur,
  musteridenAracCoz,
  musteriyeAracBagla,
} from "@/server/subscription/customer";
import {
  abonmanDurumlariniTazele,
  abonmanIptal,
  abonmanOlustur,
  abonmanYenile,
  abonmanaAracEkle,
  abonmandanAracCikar,
  donemFiyatiDuzelt,
} from "@/server/subscription/manage";
import {
  abonmanTahsilatIptal,
  abonmanTahsilatiKaydet,
} from "@/server/subscription/payment";
import {
  abonmanListesi,
  abonmanOdemeGecmisi,
  abonmanSayaclari,
  abonmanliAraclar,
  plakaAbonmanSorgu,
} from "@/server/subscription/queries";
import { cozumleAbonman } from "@/server/subscription/resolve";
import { aracGirisi } from "@/server/parking/entry";
import { aracCikisi, cikisOnizleme } from "@/server/parking/exit";
import { toKurus } from "@/lib/money";
import type { SessionUser } from "@/server/auth/session";

let sinifId: string;
let patron: SessionUser;
let personel: SessionUser;

let sayac = 0;
const anahtar = () => `abonman-test-${Date.now()}-${++sayac}`;

/** Gun cinsinden gecmis/gelecek tarih. */
function gun(fark: number): Date {
  return new Date(Date.now() + fark * 86_400_000);
}

async function musteri(ad = "Test Müşteri", telefon = "0532 111 22 33") {
  return musteriOlustur(patron, { adSoyad: ad, telefon });
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
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

// ===========================================================================
// MUSTERI VE ARAC BAGLAMA (kural 9 ve 10)
// ===========================================================================

describe("müşteri kayıtları", () => {
  it("müşteri oluşturur ve denetim kaydı yazar", async () => {
    const m = await musteri("Ahmet Yılmaz", "0532 111 22 33");
    expect(m.fullName).toBe("Ahmet Yılmaz");

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "CUSTOMER_CREATE", entityId: m.id },
    });
    expect(denetim).not.toBeNull();
    expect(denetim!.actorLabel).toBe("patron1");
  });

  it("ad en az 2 karakter olmalıdır", async () => {
    await expect(musteriOlustur(patron, { adSoyad: "A", telefon: "05321112233" })).rejects.toThrow(
      /en az 2 karakter/,
    );
  });

  it("eksik telefon reddedilir", async () => {
    await expect(musteriOlustur(patron, { adSoyad: "Ahmet Yılmaz", telefon: "123" })).rejects.toThrow(
      /Telefon/,
    );
  });

  it("kurumsal müşteride firma adı zorunludur", async () => {
    await expect(
      musteriOlustur(patron, {
        adSoyad: "Ahmet Yılmaz",
        telefon: "05321112233",
        kurumsalMi: true,
      }),
    ).rejects.toThrow(/firma adı/i);
  });

  it("KURAL 9: bir müşteriye birden fazla araç bağlanabilir", async () => {
    const m = await musteri();
    await musteriyeAracBagla(patron, { musteriId: m.id, plaka: "34 ABC 123" });
    await musteriyeAracBagla(patron, { musteriId: m.id, plaka: "06 XYZ 45" });
    await musteriyeAracBagla(patron, { musteriId: m.id, plaka: "35 KLM 678" });

    const detay = await musteriDetay(m.id);
    expect(detay.vehicles).toHaveLength(3);
    expect(detay.vehicles.map((a) => a.plateNormalized).sort()).toEqual([
      "06XYZ45",
      "34ABC123",
      "35KLM678",
    ]);
  });

  it("plaka normalize edilerek bağlanır", async () => {
    const m = await musteri();
    const arac = await musteriyeAracBagla(patron, { musteriId: m.id, plaka: " 34abc123 " });
    expect(arac.plateNormalized).toBe("34ABC123");
    expect(arac.plateDisplay).toBe("34 ABC 123");
  });

  it("geçersiz plaka biçimi onay ister, zorlanırsa kaydedilir", async () => {
    const m = await musteri();
    await expect(
      musteriyeAracBagla(patron, { musteriId: m.id, plaka: "99ZZZ999" }),
    ).rejects.toThrow(/plaka biçimine uymuyor/);

    const arac = await musteriyeAracBagla(patron, {
      musteriId: m.id,
      plaka: "99ZZZ999",
      bicimiZorla: true,
    });
    expect(arac.plateNormalized).toBe("99ZZZ999");
  });

  it("araç başka müşteriye kayıtlıysa onay olmadan devredilmez", async () => {
    const a = await musteri("Ahmet Yılmaz", "05321112233");
    const b = await musteri("Ayşe Demir", "05339998877");
    await musteriyeAracBagla(patron, { musteriId: a.id, plaka: "34ABC123" });

    await expect(
      musteriyeAracBagla(patron, { musteriId: b.id, plaka: "34ABC123" }),
    ).rejects.toThrow(/Ahmet Yılmaz/);
  });

  it("KURAL 10: araç el değiştirse geçmiş park kayıtları bozulmaz", async () => {
    const a = await musteri("Ahmet Yılmaz", "05321112233");
    const b = await musteri("Ayşe Demir", "05339998877");
    await musteriyeAracBagla(patron, { musteriId: a.id, plaka: "34ABC123" });

    // Ahmet'in doneminde bir park kaydi olusur.
    await tarifeOlustur({ saatlikUcret: 2000 });
    const giris = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    // Arac Ayse'ye devredilir.
    await musteriyeAracBagla(patron, {
      musteriId: b.id,
      plaka: "34ABC123",
      devralmayiOnayla: true,
    });

    // Gecmis park kaydi yerinde ve plakasi degismemis.
    const parklar = await prisma.parkingSession.findMany({ where: { plateNormalized: "34ABC123" } });
    expect(parklar).toHaveLength(1);
    expect(parklar[0]!.status).toBe("COMPLETED");

    // Devir denetim kaydinda eski sahip gorunur.
    const denetim = await prisma.auditLog.findFirst({
      where: { action: "CUSTOMER_VEHICLE_LINK", note: "Araç devredildi" },
    });
    expect(denetim).not.toBeNull();
    expect(JSON.stringify(denetim!.before)).toContain("Ahmet Yılmaz");
  });

  it("müşteri; ad, telefon ve plaka ile aranabilir", async () => {
    const m = await musteri("Ahmet Yılmaz", "0532 111 22 33");
    await musteriyeAracBagla(patron, { musteriId: m.id, plaka: "34ABC123" });

    expect((await musteriAra("yılmaz")).map((x) => x.id)).toContain(m.id);
    // Telefon yazimi serbesttir: bosluklu, bosluksuz ve +90'li yazimlarin
    // hepsi ayni musteriyi bulmalidir.
    expect((await musteriAra("5321112233")).map((x) => x.id)).toContain(m.id);
    expect((await musteriAra("0532 111 22 33")).map((x) => x.id)).toContain(m.id);
    expect((await musteriAra("+90 532 111 22 33")).map((x) => x.id)).toContain(m.id);
    expect((await musteriAra("34 ABC 123")).map((x) => x.id)).toContain(m.id);
    expect(await musteriAra("bulunmayan-kayit")).toHaveLength(0);
  });

  it("aktif abonmandaki araç müşteriden ayrılamaz", async () => {
    const m = await musteri();
    await musteriyeAracBagla(patron, { musteriId: m.id, plaka: "34ABC123" });
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const arac = await prisma.vehicle.findUniqueOrThrow({ where: { plateNormalized: "34ABC123" } });
    await expect(musteridenAracCoz(patron, arac.id)).rejects.toThrow(/abonmanında aktif/);
  });
});

// ===========================================================================
// ABONMAN OLUSTURMA (kural 1 ve 5)
// ===========================================================================

describe("abonman oluşturma", () => {
  it("KURAL 1: abonman oluşturmak tahsilat oluşturmaz ve ÖDENMEDİ başlar", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    expect(a.paymentStatus).toBe("UNPAID");
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.subscriptionPayment.count()).toBe(0);
  });

  it("KURAL 5: iki müşteri aynı planda FARKLI ücret ödeyebilir", async () => {
    const a = await musteri("Ahmet Yılmaz", "05321112233");
    const b = await musteri("Ayşe Demir", "05339998877");

    const ab1 = await abonmanOlustur(patron, {
      musteriId: a.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    const ab2 = await abonmanOlustur(patron, {
      musteriId: b.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 400_000,
      plakalar: ["06XYZ45"],
    });

    // Ayni plan etiketi, FARKLI ucret: sistemde genel fiyat yok.
    expect(ab1.planLabel).toBe(ab2.planLabel);
    expect(toKurus(ab1.agreedPrice)).toBe(300_000);
    expect(toKurus(ab2.agreedPrice)).toBe(400_000);

    const d1 = await prisma.subscriptionPeriod.findFirstOrThrow({
      where: { subscriptionId: ab1.id },
    });
    const d2 = await prisma.subscriptionPeriod.findFirstOrThrow({
      where: { subscriptionId: ab2.id },
    });
    expect(toKurus(d1.price)).toBe(300_000);
    expect(toKurus(d2.price)).toBe(400_000);
  });

  it("1. dönem abonmanla birlikte oluşur ve fiyatı dondurulur", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 350_000,
      plakalar: ["34ABC123"],
    });

    const donemler = await prisma.subscriptionPeriod.findMany({ where: { subscriptionId: a.id } });
    expect(donemler).toHaveLength(1);
    expect(donemler[0]!.periodNo).toBe(1);
    expect(toKurus(donemler[0]!.price)).toBe(350_000);
    expect(donemler[0]!.accessRuleKind).toBe("UNLIMITED_7_24");
  });

  it("standart abonman 7/24 sınırsızdır (S11)", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
    });
    expect(a.accessRuleKind).toBe("UNLIMITED_7_24");
    expect(a.accessRule).toBeNull();
  });

  it("farklı abonman kuralı patron onayı olmadan tanımlanamaz", async () => {
    const m = await musteri();
    await expect(
      abonmanOlustur(patron, {
        musteriId: m.id,
        planEtiketi: "Gündüz",
        baslangic: gun(-1),
        bitis: gun(29),
        ucretKurus: 300_000,
        kuralTuru: "TIME_WINDOW",
        kuralParametresi: { baslangicDakika: 480, bitisDakika: 1200 },
      }),
    ).rejects.toThrow(/yalnızca 7\/24/);
  });

  it("bitiş tarihi başlangıçtan önce olamaz", async () => {
    const m = await musteri();
    await expect(
      abonmanOlustur(patron, {
        musteriId: m.id,
        planEtiketi: "Aylık",
        baslangic: gun(10),
        bitis: gun(5),
        ucretKurus: 300_000,
      }),
    ).rejects.toThrow(/sonra olmalı/);
  });

  it("araç sayısından fazla plaka girilemez", async () => {
    const m = await musteri();
    await expect(
      abonmanOlustur(patron, {
        musteriId: m.id,
        planEtiketi: "Aylık",
        baslangic: gun(-1),
        bitis: gun(29),
        ucretKurus: 300_000,
        aracSayisi: 1,
        plakalar: ["34ABC123", "06XYZ45"],
      }),
    ).rejects.toThrow(/Araç sayısını yükseltin/);
  });

  it("gelecekte başlayan abonman BEKLEMEDE olur, tarihi gelince aktifleşir", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(5),
      bitis: gun(35),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    expect(a.status).toBe("PENDING");

    // Henuz kapsam vermez.
    expect((await cozumleAbonman("34ABC123", new Date())).ucretsizMi).toBe(false);

    // Baslangic tarihi geldiginde tazeleme aktif eder.
    const sonuc = await abonmanDurumlariniTazele(gun(6));
    expect(sonuc.baslatilan).toBe(1);
    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(guncel.status).toBe("ACTIVE");
  });
});

// ===========================================================================
// KURAL 8: AYNI PLAKA IKI AKTIF ABONMANA BAGLANAMAZ
// ===========================================================================

describe("KURAL 8: aynı plaka iki aktif abonmana bağlanamaz", () => {
  async function ilkAbonman(plaka = "34ABC123") {
    const m = await musteri("Ahmet Yılmaz", "05321112233");
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: [plaka],
    });
    return { musteri: m, abonman: a };
  }

  it("başka müşterinin aktif abonmanına bağlı plaka ikinci abonmana eklenemez", async () => {
    await ilkAbonman();
    const b = await musteriOlustur(patron, { adSoyad: "Ayşe Demir", telefon: "05339998877" });

    await expect(
      abonmanOlustur(patron, {
        musteriId: b.id,
        planEtiketi: "Aylık",
        baslangic: gun(-1),
        bitis: gun(29),
        ucretKurus: 400_000,
        plakalar: ["34ABC123"],
      }),
    ).rejects.toThrow(/yalnızca tek abonmanda olabilir/);

    // Ikinci abonman OLUSMAZ: transaction geri alinir.
    expect(await prisma.subscription.count()).toBe(1);
  });

  it("var olan abonmana ikinci kez eklemek hata vermez (idempotent)", async () => {
    const { abonman } = await ilkAbonman();
    await prisma.subscription.update({
      where: { id: abonman.id },
      data: { includedVehicleCount: 2 },
    });
    await expect(
      abonmanaAracEkle(patron, { subscriptionId: abonman.id, plaka: "34ABC123" }),
    ).resolves.toBeDefined();

    const baglar = await prisma.subscriptionVehicle.findMany({
      where: { subscriptionId: abonman.id, removedAt: null },
    });
    expect(baglar).toHaveLength(1);
  });

  it("VERİTABANI SEVİYESİNDE engellenir: uygulama atlanarak yazılamaz", async () => {
    const { abonman } = await ilkAbonman();
    const arac = await prisma.vehicle.findUniqueOrThrow({
      where: { plateNormalized: "34ABC123" },
    });
    const b = await musteriOlustur(patron, { adSoyad: "Ayşe Demir", telefon: "05339998877" });
    const ikinci = await abonmanOlustur(patron, {
      musteriId: b.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 400_000,
    });

    // Uygulama katmanini TAMAMEN atlayarak dogrudan bag yazmayi dene.
    await expect(
      prisma.subscriptionVehicle.create({
        data: { subscriptionId: ikinci.id, vehicleId: arac.id },
      }),
    ).rejects.toThrow();

    expect(
      await prisma.subscriptionVehicle.count({ where: { subscriptionId: ikinci.id } }),
    ).toBe(0);
    expect(abonman.id).not.toBe(ikinci.id);
  });

  it("süresi dolmuş abonmanın bağı otomatik kapatılır, SİLİNMEZ", async () => {
    const m = await musteri("Ahmet Yılmaz", "05321112233");
    const eski = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-30),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    expect(eski.status).toBe("EXPIRED");

    const b = await musteriOlustur(patron, { adSoyad: "Ayşe Demir", telefon: "05339998877" });
    await abonmanOlustur(patron, {
      musteriId: b.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 400_000,
      plakalar: ["34ABC123"],
    });

    // Eski bag kaydi DURUYOR, yalnizca removedAt dolduruldu.
    const eskiBag = await prisma.subscriptionVehicle.findFirstOrThrow({
      where: { subscriptionId: eski.id },
    });
    expect(eskiBag.removedAt).not.toBeNull();

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "SUBSCRIPTION_VEHICLE_REMOVE" },
    });
    expect(denetim!.note).toMatch(/kayıt korundu/);
  });

  it("gelecek dönem için İKİNCİ abonman da açılamaz; doğru yol YENİLEMEdir", async () => {
    // Kuralin tam tanimi: bir aracin ayni anda tek ACIK abonman bagi olur -
    // tarihleri cakismasa bile. Boylece "bu plaka hangi abonmanda?" sorusunun
    // tek yaniti olur. Sureyi uzatmanin yolu ayni abonmana yeni donem
    // eklemektir.
    const m = await musteri("Ahmet Yılmaz", "05321112233");
    const ilk = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Ekim",
      baslangic: gun(-1),
      bitis: gun(9),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    await expect(
      abonmanOlustur(patron, {
        musteriId: m.id,
        planEtiketi: "Kasım",
        baslangic: gun(10),
        bitis: gun(40),
        ucretKurus: 320_000,
        plakalar: ["34ABC123"],
      }),
    ).rejects.toThrow(/Yeni dönem/);

    expect(await prisma.subscription.count()).toBe(1);

    // Dogru yol: yenileme. Plaka bagi degismez, yeni donem eklenir.
    const { donem } = await abonmanYenile(patron, {
      subscriptionId: ilk.id,
      baslangic: gun(9),
      bitis: gun(39),
      ucretKurus: 320_000,
    });
    expect(donem.periodNo).toBe(2);
    expect(
      await prisma.subscriptionVehicle.count({ where: { subscriptionId: ilk.id, removedAt: null } }),
    ).toBe(1);
  });

  it("abonmana dahil araç sayısı aşılamaz", async () => {
    const { abonman } = await ilkAbonman();
    await expect(
      abonmanaAracEkle(patron, { subscriptionId: abonman.id, plaka: "06XYZ45" }),
    ).rejects.toThrow(/araç sayısını yükseltin/i);
  });

  it("abonmandan çıkarılan araç kaydı silinmez, plaka serbest kalır", async () => {
    const { abonman } = await ilkAbonman();
    const arac = await prisma.vehicle.findUniqueOrThrow({
      where: { plateNormalized: "34ABC123" },
    });

    await abonmandanAracCikar(patron, {
      subscriptionId: abonman.id,
      vehicleId: arac.id,
      sebep: "Araç satıldı",
    });

    const bag = await prisma.subscriptionVehicle.findFirstOrThrow({
      where: { subscriptionId: abonman.id },
    });
    expect(bag.removedAt).not.toBeNull();

    // Plaka artik kapsam vermez.
    expect((await cozumleAbonman("34ABC123", new Date())).ucretsizMi).toBe(false);

    // Baska bir abonmana baglanabilir.
    const b = await musteriOlustur(patron, { adSoyad: "Ayşe Demir", telefon: "05339998877" });
    const yeni = await abonmanOlustur(patron, {
      musteriId: b.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 400_000,
      plakalar: ["34ABC123"],
    });
    expect((await cozumleAbonman("34ABC123", new Date())).subscriptionId).toBe(yeni.id);
  });
});

// ===========================================================================
// ABONMAN BITISI VE OTOMATIK NORMAL TARIFEYE DUSME
// ===========================================================================

describe("abonman bitişi", () => {
  it("süresi dolmuş abonman kapsam VERMEZ ve açık uyarı üretir", async () => {
    const m = await musteri("Ahmet Yılmaz", "05321112233");
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-1),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const sonuc = await cozumleAbonman("34ABC123", new Date());
    expect(sonuc.ucretsizMi).toBe(false);
    expect(sonuc.durum).toBe("SURESI_DOLMUS");
    expect(sonuc.uyari).toMatch(/SÜRESİ DOLMUŞ/);
    expect(sonuc.uyari).toMatch(/NORMAL TARİFE/);
    expect(sonuc.musteriAdi).toBe("Ahmet Yılmaz");
  });

  it("durum alanı güncellenmemişse bile kapsam vermez (tarihe bakılır)", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-1),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    // Durum alanini ELLE yanlis yap: hala ACTIVE gorunsun.
    await prisma.subscription.update({ where: { id: a.id }, data: { status: "ACTIVE" } });

    // Yine de kapsam vermez; ucret hesabi status alanina guvenmez.
    const sonuc = await cozumleAbonman("34ABC123", new Date());
    expect(sonuc.ucretsizMi).toBe(false);
  });

  it("süresi dolan abonman otomatik EXPIRED'a düşer ve denetime yazılır", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-1),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    await prisma.subscription.update({ where: { id: a.id }, data: { status: "ACTIVE" } });

    const sonuc = await abonmanDurumlariniTazele();
    expect(sonuc.suresiDolan).toBe(1);

    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(guncel.status).toBe("EXPIRED");

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "SUBSCRIPTION_EXPIRE", entityId: a.id },
    });
    expect(denetim).not.toBeNull();
    expect(denetim!.actorLabel).toBe("sistem");
  });

  it("süresi dolmuş abonmanlı araç girişi NORMAL TARİFEden ücretlendirilir", async () => {
    await tarifeOlustur({ saatlikUcret: 2000, saatYuvarlama: undefined } as never);
    const m = await musteri();
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-1),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const giris = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    expect(giris.abonman.ucretsizMi).toBe(false);
    expect(giris.tarifeTanimsiz).toBe(false);

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(kayit.billingMode).toBe("TARIFF");
    expect(kayit.tariffSnapshot).not.toBeNull();
  });

  it("bitişi yaklaşan abonman uyarı üretir ama kapsam verir", async () => {
    const m = await musteri();
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-25),
      bitis: gun(3),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    // Odemesi alinmis olsun ki "bitiyor" uyarisi gorunsun.
    await prisma.subscription.updateMany({ data: { paymentStatus: "PAID" } });

    const sonuc = await cozumleAbonman("34ABC123", new Date());
    expect(sonuc.ucretsizMi).toBe(true);
    expect(sonuc.durum).toBe("AKTIF_BITIYOR");
    expect(sonuc.uyari).toMatch(/gün sonra doluyor/);
  });

  it("iptal edilmiş abonman kapsam vermez", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    await abonmanIptal(patron, { subscriptionId: a.id, sebep: "Müşteri vazgeçti" });

    const sonuc = await cozumleAbonman("34ABC123", new Date());
    expect(sonuc.ucretsizMi).toBe(false);
    expect(sonuc.uyari).toMatch(/iptal/i);
  });
});

// ===========================================================================
// S10: PARK SIRASINDA ABONMAN BITISI
// ===========================================================================

describe("S10: park sırasında abonman bitişi", () => {
  it("girişte abonmanlıysa, abonman park sırasında bitse bile ÇIKIŞ ÜCRETSİZDİR", async () => {
    await tarifeOlustur({ saatlikUcret: 2000 });
    const m = await musteri();

    // Abonman BUGUN bitiyor; giris simdi aliniyor.
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-30),
      bitis: new Date(Date.now() + 60_000),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const giris = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    expect(giris.abonman.ucretsizMi).toBe(true);

    // Abonman park SIRASINDA bitiyor.
    await prisma.subscription.update({
      where: { id: a.id },
      data: { endDate: gun(-0.001), status: "EXPIRED" },
    });
    // Arac 3 saat icerideymis gibi davran.
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 3 * 3600_000) },
    });

    const onizleme = await cikisOnizleme("34ABC123");
    expect(onizleme.ucretsizMi).toBe(true);
    expect(onizleme.tutar).toBe(0);
    expect(onizleme.abonmanKapsaminda).toBe(true);
    expect(onizleme.abonman?.parkSirasindaBittiMi).toBe(true);

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(0);
    // Tahsilat kaydi olusmaz: tahsil edilecek tutar yok.
    expect(await prisma.payment.count()).toBe(0);
  });

  it("SONRAKİ giriş normal tarifeden hesaplanır", async () => {
    await tarifeOlustur({ saatlikUcret: 2000 });
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-30),
      bitis: new Date(Date.now() + 60_000),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const birinci = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    await aracCikisi(personel, {
      parkingSessionId: birinci.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    // Abonman bitti.
    await prisma.subscription.update({
      where: { id: a.id },
      data: { endDate: gun(-0.001), status: "EXPIRED" },
    });

    const ikinci = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    expect(ikinci.abonman.ucretsizMi).toBe(false);
    expect(ikinci.abonman.durum).toBe("SURESI_DOLMUS");

    const kayit = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: ikinci.parkingSessionId },
    });
    expect(kayit.billingMode).toBe("TARIFF");

    // 2 saat sonra cikis: ucret tahakkuk eder.
    await prisma.parkingSession.update({
      where: { id: ikinci.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 2 * 3600_000) },
    });
    const onizleme = await cikisOnizleme("34ABC123");
    expect(onizleme.ucretsizMi).toBe(false);
    expect(onizleme.tutar).toBeGreaterThan(0);
  });
});

// ===========================================================================
// S9: ODENMEMIS ABONMAN GECERLIDIR
// ===========================================================================

describe("S9: ödenmemiş abonman geçerli sayılır", () => {
  it("ödenmemiş abonman kapsam VERİR, uyarı üretir, patrona bildirilir", async () => {
    const m = await musteri();
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const sonuc = await cozumleAbonman("34ABC123", new Date());
    expect(sonuc.ucretsizMi).toBe(true);
    expect(sonuc.durum).toBe("AKTIF_ODENMEMIS");
    expect(sonuc.uyari).toMatch(/ödemesi alınmamış/i);
    expect(sonuc.uyari).toMatch(/engellenmez/);
    expect(sonuc.yoneticiyeBildir).toBe(true);
  });

  it("ödenmemiş abonmanlı araç girişi ENGELLENMEZ ve ücretsiz çıkar", async () => {
    await tarifeOlustur({ saatlikUcret: 2000 });
    const m = await musteri();
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const giris = await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    expect(giris.abonman.ucretsizMi).toBe(true);

    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 5 * 3600_000) },
    });

    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(cikis.odenenTutar).toBe(0);
  });

  it("ödenmemiş abonmanlar patron sayacında ve listesinde görünür", async () => {
    const m = await musteri();
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const sayaclar = await abonmanSayaclari();
    expect(sayaclar.odenmemis).toBe(1);
    expect(sayaclar.aktif).toBe(1);

    const liste = await abonmanListesi("odenmemis");
    expect(liste).toHaveLength(1);
    expect(liste[0]!.odemeDurumu).toBe("UNPAID");
  });
});

// ===========================================================================
// KURAL 6: YENILEMEDE ESKI FIYAT KORUNUR
// ===========================================================================

describe("KURAL 6: yenilemede eski dönemin fiyatı korunur", () => {
  async function abonmanKur(ucret: number) {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-30),
      bitis: gun(1),
      ucretKurus: ucret,
      plakalar: ["34ABC123"],
    });
    return a;
  }

  it("yenileme YENİ dönem açar; eski dönemin fiyatı DEĞİŞMEZ", async () => {
    const a = await abonmanKur(300_000);

    await abonmanYenile(patron, {
      subscriptionId: a.id,
      baslangic: gun(1),
      bitis: gun(31),
      ucretKurus: 400_000,
      not: "Zam",
    });

    const donemler = await prisma.subscriptionPeriod.findMany({
      where: { subscriptionId: a.id },
      orderBy: { periodNo: "asc" },
    });
    expect(donemler).toHaveLength(2);
    // ESKI DONEM AYNI KALDI:
    expect(toKurus(donemler[0]!.price)).toBe(300_000);
    // YENI DONEM YENI FIYAT:
    expect(toKurus(donemler[1]!.price)).toBe(400_000);

    // Abonmanin "guncel ucreti" yeni donemin ucretidir.
    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(toKurus(guncel.agreedPrice)).toBe(400_000);
    expect(guncel.endDate.getTime()).toBeGreaterThan(a.endDate.getTime());
  });

  it("yenileme sonrası abonman yeniden ÖDENMEDİ olur (kural 1)", async () => {
    const a = await abonmanKur(300_000);
    await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(
      (await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } })).paymentStatus,
    ).toBe("PAID");

    await abonmanYenile(patron, {
      subscriptionId: a.id,
      baslangic: gun(1),
      bitis: gun(31),
      ucretKurus: 400_000,
    });

    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(guncel.paymentStatus).toBe("UNPAID");

    // Eski donemin tahsilati yerinde duruyor.
    expect(await prisma.subscriptionPayment.count({ where: { subscriptionId: a.id } })).toBe(1);
  });

  it("yenileme dönemleri çakıştıramaz", async () => {
    const a = await abonmanKur(300_000);
    await expect(
      abonmanYenile(patron, {
        subscriptionId: a.id,
        baslangic: gun(-10),
        bitis: gun(31),
        ucretKurus: 400_000,
      }),
    ).rejects.toThrow(/çakışıyor/i);
  });

  it("yenileme kapsamı kısaltamaz", async () => {
    const a = await abonmanKur(300_000);
    await expect(
      abonmanYenile(patron, {
        subscriptionId: a.id,
        baslangic: gun(1),
        bitis: gun(0.5),
        ucretKurus: 400_000,
      }),
    ).rejects.toThrow();
  });

  it("iptal edilmiş abonman yenilenemez", async () => {
    const a = await abonmanKur(300_000);
    await abonmanIptal(patron, { subscriptionId: a.id, sebep: "Müşteri ayrıldı" });
    await expect(
      abonmanYenile(patron, {
        subscriptionId: a.id,
        baslangic: gun(1),
        bitis: gun(31),
        ucretKurus: 400_000,
      }),
    ).rejects.toThrow(/yenilenemez/);
  });

  it("GEÇMİŞ dönemin fiyatı düzeltilemez, son dönem düzeltilebilir", async () => {
    const a = await abonmanKur(300_000);
    const { donem: ikinciDonem } = await abonmanYenile(patron, {
      subscriptionId: a.id,
      baslangic: gun(1),
      bitis: gun(31),
      ucretKurus: 400_000,
    });

    const birinciDonem = await prisma.subscriptionPeriod.findFirstOrThrow({
      where: { subscriptionId: a.id, periodNo: 1 },
    });

    await expect(
      donemFiyatiDuzelt(patron, {
        periodId: birinciDonem.id,
        ucretKurus: 500_000,
        sebep: "Deneme",
      }),
    ).rejects.toThrow(/kapanmış bir kayıt/);

    // Son donem duzeltilebilir ve denetime yazilir.
    await donemFiyatiDuzelt(patron, {
      periodId: ikinciDonem.id,
      ucretKurus: 420_000,
      sebep: "Yanlış yazılmış",
    });
    const guncel = await prisma.subscriptionPeriod.findUniqueOrThrow({
      where: { id: ikinciDonem.id },
    });
    expect(toKurus(guncel.price)).toBe(420_000);

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "SUBSCRIPTION_PRICE_CHANGE" },
    });
    expect(denetim!.note).toBe("Yanlış yazılmış");
  });

  it("fiyat düzeltmesi gerekçesiz yapılamaz", async () => {
    const a = await abonmanKur(300_000);
    const donem = await prisma.subscriptionPeriod.findFirstOrThrow({
      where: { subscriptionId: a.id },
    });
    await expect(
      donemFiyatiDuzelt(patron, { periodId: donem.id, ucretKurus: 1, sebep: "" }),
    ).rejects.toThrow(/gerekçesi zorunlu/i);
  });
});

// ===========================================================================
// KURAL 2: TAHSILAT AYRI ISLEMDIR VE TAHSIL EDENI KAYDEDER
// ===========================================================================

describe("KURAL 2: abonman tahsilatı", () => {
  async function abonmanKur(ucret = 300_000) {
    const m = await musteri();
    return abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: ucret,
      plakalar: ["34ABC123"],
    });
  }

  it("tahsilat Payment kaydı üretir ve TAHSİL EDENİ yazar", async () => {
    const a = await abonmanKur();
    const sonuc = await abonmanTahsilatiKaydet(personel, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(sonuc.odemeDurumu).toBe("PAID");
    expect(sonuc.kalanKurus).toBe(0);

    const odeme = await prisma.payment.findUniqueOrThrow({ where: { id: sonuc.paymentId } });
    expect(odeme.sourceType).toBe("SUBSCRIPTION");
    expect(odeme.direction).toBe("IN");
    expect(odeme.collectedById).toBe(personel.id);
    expect(toKurus(odeme.amount)).toBe(300_000);

    const denetim = await prisma.auditLog.findFirst({
      where: { action: "SUBSCRIPTION_PAYMENT" },
    });
    expect(JSON.stringify(denetim!.after)).toContain("personel1");
  });

  it("kısmi tahsilat PARTIAL, tamamlanınca PAID olur", async () => {
    const a = await abonmanKur(300_000);
    const birinci = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 100_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(birinci.odemeDurumu).toBe("PARTIAL");
    expect(birinci.kalanKurus).toBe(200_000);

    const ikinci = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 200_000,
      odemeYontemi: "CARD",
      kartNotu: "son 4: 1234",
      idempotencyKey: anahtar(),
    });
    expect(ikinci.odemeDurumu).toBe("PAID");
    expect(ikinci.kalanKurus).toBe(0);
  });

  it("fazla tahsilat PAID yapar ve fazlayı bildirir", async () => {
    const a = await abonmanKur(300_000);
    const sonuc = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 350_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    expect(sonuc.odemeDurumu).toBe("PAID");
    expect(sonuc.fazlaOdemeKurus).toBe(50_000);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci istek ikinci tahsilat üretmez", async () => {
    const a = await abonmanKur();
    const key = anahtar();
    const birinci = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });
    const ikinci = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: key,
    });

    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(ikinci.paymentId).toBe(birinci.paymentId);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("sıfır veya negatif tutar reddedilir", async () => {
    const a = await abonmanKur();
    await expect(
      abonmanTahsilatiKaydet(patron, {
        subscriptionId: a.id,
        tutarKurus: 0,
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/sıfırdan büyük/);
  });

  it("kart notu yalnızca KART ödemesinde saklanır", async () => {
    const a = await abonmanKur();
    const sonuc = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      kartNotu: "olmamalı",
      idempotencyKey: anahtar(),
    });
    const odeme = await prisma.payment.findUniqueOrThrow({ where: { id: sonuc.paymentId } });
    expect(odeme.cardNote).toBeNull();
  });

  it("ödeme geçmişi tahsil edeni ve dönemi gösterir", async () => {
    const a = await abonmanKur();
    await abonmanTahsilatiKaydet(personel, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const gecmis = await abonmanOdemeGecmisi();
    expect(gecmis).toHaveLength(1);
    expect(gecmis[0]!.donemNo).toBe(1);
    expect(gecmis[0]!.tahsilEden).toContain("personel1");
    expect(gecmis[0]!.tutarKurus).toBe(300_000);
  });
});

// ===========================================================================
// TAHSILAT IPTALI: FINANSAL KAYIT SILINMEZ
// ===========================================================================

describe("tahsilat iptali", () => {
  async function tahsilatliAbonman() {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    const t = await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    return { abonman: a, tahsilat: t };
  }

  /** Kasadaki net tutar: iptal edilenler ve ters kayitlar dusulur. */
  async function netKasa(): Promise<number> {
    const kayitlar = await prisma.payment.findMany({ where: { status: "CONFIRMED" } });
    return kayitlar.reduce(
      (t, k) => t + (k.direction === "OUT" ? -toKurus(k.amount) : toKurus(k.amount)),
      0,
    );
  }

  it("PARA İADE EDİLDİ: orijinal kayıt kalır, TERS KAYIT üretilir", async () => {
    const { abonman, tahsilat } = await tahsilatliAbonman();
    expect(await netKasa()).toBe(300_000);

    const sonuc = await abonmanTahsilatIptal(patron, {
      paymentId: tahsilat.paymentId,
      sebep: "Müşteri vazgeçti, para geri verildi",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.tersKayitKodu).not.toBeNull();
    const orijinal = await prisma.payment.findUniqueOrThrow({
      where: { id: tahsilat.paymentId },
    });
    expect(orijinal.status).toBe("CONFIRMED");

    // Para iki kez dusulmedi: net 0.
    expect(await netKasa()).toBe(0);

    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: abonman.id } });
    expect(guncel.paymentStatus).toBe("UNPAID");
  });

  it("PARA EL DEĞİŞTİRMEDİ: kayıt VOIDED olur, ters kayıt ÜRETİLMEZ", async () => {
    const { tahsilat } = await tahsilatliAbonman();

    const sonuc = await abonmanTahsilatIptal(patron, {
      paymentId: tahsilat.paymentId,
      sebep: "Yanlış abonmana işlendi",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.tersKayitKodu).toBeNull();
    const orijinal = await prisma.payment.findUniqueOrThrow({
      where: { id: tahsilat.paymentId },
    });
    expect(orijinal.status).toBe("VOIDED");
    expect(orijinal.voidReason).toBe("Yanlış abonmana işlendi");
    expect(orijinal.voidedById).toBe(patron.id);

    // Tek kayit var; ters kayit uretilmedi.
    expect(await prisma.payment.count()).toBe(1);
    expect(await netKasa()).toBe(0);
  });

  it("finansal kayıt SİLİNMEZ: veritabanı DELETE'i reddeder", async () => {
    const { tahsilat } = await tahsilatliAbonman();
    await expect(
      prisma.payment.delete({ where: { id: tahsilat.paymentId } }),
    ).rejects.toThrow();
  });

  it("gerekçesiz iptal yapılamaz", async () => {
    const { tahsilat } = await tahsilatliAbonman();
    await expect(
      abonmanTahsilatIptal(patron, {
        paymentId: tahsilat.paymentId,
        sebep: "",
        iadeEdildi: false,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/gerekçe/i);
  });

  it("aynı tahsilat iki kez iptal edilemez", async () => {
    const { tahsilat } = await tahsilatliAbonman();
    await abonmanTahsilatIptal(patron, {
      paymentId: tahsilat.paymentId,
      sebep: "Hatalı kayıt",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });
    await expect(
      abonmanTahsilatIptal(patron, {
        paymentId: tahsilat.paymentId,
        sebep: "Tekrar",
        iadeEdildi: false,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/daha önce iptal/);
  });
});

// ===========================================================================
// ABONMAN IPTALI
// ===========================================================================

describe("abonman iptali", () => {
  it("iptal dönem ve tahsilat kayıtlarını KORUR", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });
    await abonmanTahsilatiKaydet(patron, {
      subscriptionId: a.id,
      tutarKurus: 300_000,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    await abonmanIptal(patron, { subscriptionId: a.id, sebep: "Müşteri taşındı" });

    const guncel = await prisma.subscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(guncel.status).toBe("CANCELLED");
    expect(guncel.cancelReason).toBe("Müşteri taşındı");
    expect(guncel.cancelledById).toBe(patron.id);

    // Donem ve tahsilat kayitlari yerinde.
    expect(await prisma.subscriptionPeriod.count({ where: { subscriptionId: a.id } })).toBe(1);
    expect(await prisma.payment.count({ where: { status: "CONFIRMED" } })).toBe(1);

    // Arac baglari kapatildi ama silinmedi.
    const bag = await prisma.subscriptionVehicle.findFirstOrThrow({
      where: { subscriptionId: a.id },
    });
    expect(bag.removedAt).not.toBeNull();
  });

  it("gerekçesiz iptal edilemez", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
    });
    await expect(abonmanIptal(patron, { subscriptionId: a.id, sebep: "" })).rejects.toThrow(
      /gerekçesi zorunlu/i,
    );
  });

  it("iptal edilmiş abonmana araç eklenemez", async () => {
    const m = await musteri();
    const a = await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-1),
      bitis: gun(29),
      ucretKurus: 300_000,
      aracSayisi: 3,
    });
    await abonmanIptal(patron, { subscriptionId: a.id, sebep: "Vazgeçildi" });
    await expect(
      abonmanaAracEkle(patron, { subscriptionId: a.id, plaka: "34ABC123" }),
    ).rejects.toThrow(/İptal edilmiş/);
  });
});

// ===========================================================================
// PERSONEL SORGUSU VE LISTELER
// ===========================================================================

describe("plaka ile abonman sorgusu (personel ekranı)", () => {
  it("aktif abonmanı müşteri, tarih ve kalan günle döndürür", async () => {
    // Kalan gun hesabi tam gun sayar (Math.floor). Testin saat kaymasina
    // takilmamasi icin degerlendirme ani acikca verilir.
    const simdi = new Date();
    const m = await musteriOlustur(patron, {
      adSoyad: "Ahmet Yılmaz",
      telefon: "0532 111 22 33",
    });
    await musteriyeAracBagla(patron, {
      musteriId: m.id,
      plaka: "34ABC123",
      markaModel: "Renault Clio",
      renk: "Gri",
    });
    await abonmanOlustur(patron, {
      musteriId: m.id,
      planEtiketi: "Aylık",
      baslangic: gun(-10),
      bitis: new Date(simdi.getTime() + 20 * 86_400_000),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const sonuc = await plakaAbonmanSorgu("34abc123", simdi);
    expect(sonuc.bulunduMu).toBe(true);
    expect(sonuc.plakaGosterim).toBe("34 ABC 123");
    expect(sonuc.markaModel).toBe("Renault Clio");
    expect(sonuc.renk).toBe("Gri");
    expect(sonuc.sahipAdi).toBe("Ahmet Yılmaz");
    expect(sonuc.otoparktaMi).toBe(false);
    expect(sonuc.abonman.ucretsizMi).toBe(true);
    expect(sonuc.abonman.kalanGun).toBe(20);
    expect(sonuc.abonman.musteriTelefonu).toBe("0532 111 22 33");
    expect(sonuc.abonman.kuralAdi).toMatch(/7\/24/);
  });

  it("sorgu HİÇBİR ŞEY YAZMAZ", async () => {
    const oncekiKayitSayisi = await prisma.auditLog.count();
    await plakaAbonmanSorgu("34ABC123");
    expect(await prisma.auditLog.count()).toBe(oncekiKayitSayisi);
    expect(await prisma.vehicle.count()).toBe(0);
  });

  it("abonmanı olmayan plaka için ABONMAN YOK döner", async () => {
    const sonuc = await plakaAbonmanSorgu("34ZZZ999");
    expect(sonuc.abonman.durum).toBe("YOK");
    expect(sonuc.abonman.ucretsizMi).toBe(false);
  });

  it("araç otoparktaysa bildirir", async () => {
    await tarifeOlustur({ saatlikUcret: 2000 });
    await aracGirisi(personel, { plaka: "34ABC123", idempotencyKey: anahtar() });
    const sonuc = await plakaAbonmanSorgu("34ABC123");
    expect(sonuc.otoparktaMi).toBe(true);
  });
});

describe("abonman listeleri", () => {
  beforeEach(async () => {
    const a = await musteriOlustur(patron, { adSoyad: "Aktif Müşteri", telefon: "05321112233" });
    await abonmanOlustur(patron, {
      musteriId: a.id,
      planEtiketi: "Aylık",
      baslangic: gun(-10),
      bitis: gun(20),
      ucretKurus: 300_000,
      plakalar: ["34ABC123"],
    });

    const b = await musteriOlustur(patron, { adSoyad: "Yaklaşan Müşteri", telefon: "05331112233" });
    await abonmanOlustur(patron, {
      musteriId: b.id,
      planEtiketi: "Aylık",
      baslangic: gun(-27),
      bitis: gun(3),
      ucretKurus: 350_000,
      plakalar: ["06XYZ45"],
    });

    const c = await musteriOlustur(patron, { adSoyad: "Dolmuş Müşteri", telefon: "05341112233" });
    await abonmanOlustur(patron, {
      musteriId: c.id,
      planEtiketi: "Aylık",
      baslangic: gun(-60),
      bitis: gun(-5),
      ucretKurus: 280_000,
      plakalar: ["35KLM678"],
    });
  });

  it("filtreler doğru kayıtları döndürür", async () => {
    expect(await abonmanListesi("tumu")).toHaveLength(3);
    expect(await abonmanListesi("aktif")).toHaveLength(2);
    expect((await abonmanListesi("yaklasan")).map((a) => a.musteriAdi)).toEqual([
      "Yaklaşan Müşteri",
    ]);
    expect((await abonmanListesi("dolmus")).map((a) => a.musteriAdi)).toEqual(["Dolmuş Müşteri"]);
    expect(await abonmanListesi("iptal")).toHaveLength(0);
  });

  it("abonmanlı araçlar listesi yalnızca geçerli kapsamı gösterir", async () => {
    const liste = await abonmanliAraclar();
    expect(liste.map((a) => a.plaka).sort()).toEqual(["06 XYZ 45", "34 ABC 123"]);
    // Suresi dolan abonmanin araci listede YOK.
    expect(liste.find((a) => a.plaka === "35 KLM 678")).toBeUndefined();
  });

  it("sayaçlar patron panelini besler", async () => {
    const s = await abonmanSayaclari();
    expect(s.aktif).toBe(2);
    expect(s.yaklasan).toBe(1);
    expect(s.dolmus).toBe(1);
    expect(s.abonmanliArac).toBe(2);
    expect(s.musteri).toBe(3);
  });
});
