/**
 * ASAMA 5 ENTEGRASYON TESTLERI - KASA, GELIR/GIDER, MALZEME STOGU
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki tum tutarlar, malzeme adlari ve gider kalemleri
 * YALNIZCA TEST icindir. Londra Camping Otopark'in gercek fiyatlari,
 * malzemeleri veya giderleri DEGILDIR.
 * ============================================================================
 *
 * Asama 5 tamamlanma kriterleri (docs/06):
 *  - Beklenen nakit sunucuda hesaplanir; fark gerekcesiz kapatilamaz
 *  - Nakit gider kasadan BIR KEZ duser (cifte muhasebe tuzagi)
 *  - Ayni anda iki acik kasa olamaz (veritabani garantisi)
 *  - Finansal kayit silinmez: iptal = VOIDED + gerekce
 *  - Gelir iptalinde iade/ters kayit ayrimi dogru
 *  - Stok negatife dusmez; hareket defteri silinmez
 *  - Stok alisi gider kaydina baglanir
 *  - Her yazma islemi idempotency anahtari tasir
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
import { PERMISSIONS } from "@/lib/permissions";
import { aracGirisi } from "@/server/parking/entry";
import { aracCikisi } from "@/server/parking/exit";
import { acikKasaId, kasaAc, kasaDokumu, kasaKapat, kasaMutabakat } from "@/server/cash/drawer";
import { kasaHareketiEkle, kasaHareketiIptal } from "@/server/cash/movement";
import { acikKasaDurumu, kasaDisiTahsilat, kasaGecmisi } from "@/server/cash/queries";
import { giderIptal, giderKaydet, giderKategorisiOlustur } from "@/server/finance/expense";
import { digerGelirIptal, digerGelirKaydet } from "@/server/finance/income";
import { finansRaporu, giderListesi } from "@/server/finance/queries";
import { malzemeDurum, malzemeOlustur } from "@/server/inventory/items";
import { alisiGidereBagla, stokHareketiEkle } from "@/server/inventory/movement";
import { kritikStoklar, malzemeListesi, stokOzeti } from "@/server/inventory/queries";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;

let sinifId: string;
let personel: SessionUser;
let patron: SessionUser;
let kategoriId: string;

let sayac = 0;
const anahtar = () => `a5-${Date.now()}-${++sayac}`;

/** Bugunun ortasi - gelecege tarihleme kontrolune takilmayan guvenli tarih. */
const bugun = () => new Date();

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

  // TEST tarifesi: 1 saat 100 TL, sonra saatlik 100 TL.
  await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 100 * TL });

  const kategori = await prisma.expenseCategory.create({
    data: { code: `TEST_${++sayac}`, name: "Test gideri", sortOrder: 1 },
  });
  kategoriId = kategori.id;
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

/** Plakayi sokar, geriye alir ve nakit cikis yapar; tahsil edilen tutari verir. */
async function nakitTahsilat(plaka: string, dakikaOnce: number, actor = personel) {
  const giris = await aracGirisi(actor, { plaka, aracSinifiId: sinifId, idempotencyKey: anahtar() });
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

// ===========================================================================
describe("kasa oturumu — açma", () => {
  it("kasa açılır ve açılış nakdi kaydedilir", async () => {
    const oturumKaydi = await kasaAc(patron, { acilisNakdiKurus: 200 * TL, not: "Devreden" });

    expect(oturumKaydi.status).toBe("OPEN");
    expect(toKurus(oturumKaydi.openingFloat)).toBe(200 * TL);
    expect(await acikKasaId()).toBe(oturumKaydi.id);
  });

  it("ikinci kasa açılamaz: tek fiziki kasa vardır", async () => {
    await kasaAc(patron, { acilisNakdiKurus: 0 });
    await expect(kasaAc(patron, { acilisNakdiKurus: 0 })).rejects.toThrow(/Zaten açık bir kasa/);
  });

  it("VERİTABANI GARANTİSİ: eşzamanlı iki açılışta ikincisi reddedilir", async () => {
    // Uygulama kontrolu atlanirsa kismi unique indeks devreye girer.
    await prisma.cashDrawerSession.create({
      data: { openedById: patron.id, openingFloat: "0", status: "OPEN" },
    });
    await expect(
      prisma.cashDrawerSession.create({
        data: { openedById: patron.id, openingFloat: "0", status: "OPEN" },
      }),
    ).rejects.toThrow();
  });

  it("kasa kapatıldıktan sonra yenisi açılabilir", async () => {
    const birinci = await kasaAc(patron, { acilisNakdiKurus: 0 });
    await kasaKapat(patron, { cashDrawerSessionId: birinci.id, sayilanNakitKurus: 0 });
    const ikinci = await kasaAc(patron, { acilisNakdiKurus: 50 * TL });
    expect(ikinci.id).not.toBe(birinci.id);
  });

  it("açılış nakdi negatif olamaz", async () => {
    await expect(kasaAc(patron, { acilisNakdiKurus: -100 })).rejects.toThrow(/negatif/);
  });
});

// ===========================================================================
describe("beklenen nakit — sunucuda hesaplanır", () => {
  it("tahsilatlar açık kasaya bağlanır ve beklenen nakde girer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 200 * TL });

    const tutar = await nakitTahsilat("34 KSA 001", 90); // 2 saat bandı
    const dokum = await kasaDokumu(kasa.id);

    expect(dokum.acilisNakdi).toBe(200 * TL);
    expect(dokum.nakitTahsilat).toBe(tutar);
    expect(dokum.beklenenNakit).toBe(200 * TL + tutar);
  });

  it("kart tahsilatı NAKDE girmez, kart beklentisine girer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });

    const giris = await aracGirisi(personel, {
      plaka: "34 KSA 002",
      aracSinifiId: sinifId,
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: new Date(Date.now() - 90 * 60_000) },
    });
    const cikis = await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CARD",
      idempotencyKey: anahtar(),
    });

    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.nakitTahsilat).toBe(0);
    expect(dokum.beklenenNakit).toBe(0);
    expect(dokum.kartTahsilat).toBe(cikis.odenenTutar);
    expect(dokum.beklenenKart).toBe(cikis.odenenTutar);
  });

  it("kasa hareketleri beklenen nakdi doğru yönde değiştirir", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });

    await kasaHareketiEkle(patron, {
      cashDrawerSessionId: kasa.id,
      tip: "DEPOSIT",
      tutarKurus: 500 * TL,
      aciklama: "Bozuk para eklendi",
      idempotencyKey: anahtar(),
    });
    await kasaHareketiEkle(patron, {
      cashDrawerSessionId: kasa.id,
      tip: "BANK_TRANSFER",
      tutarKurus: 300 * TL,
      aciklama: "Bankaya yatırıldı — dekont 1",
      idempotencyKey: anahtar(),
    });

    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.kasaGirisi).toBe(500 * TL);
    expect(dokum.kasaCikisi).toBe(300 * TL);
    expect(dokum.beklenenNakit).toBe(1200 * TL);
  });

  it("iptal edilen kasa hareketi beklenen nakde GİRMEZ", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });
    const hareket = await kasaHareketiEkle(patron, {
      cashDrawerSessionId: kasa.id,
      tip: "WITHDRAWAL",
      tutarKurus: 400 * TL,
      aciklama: "Yanlış giriş",
      idempotencyKey: anahtar(),
    });

    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(600 * TL);

    await kasaHareketiIptal(patron, { cashMovementId: hareket.id, sebep: "Yanlış tutar girildi" });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1000 * TL);
  });

  it("nakit iade (ters kayıt) beklenen nakitten düşer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    const tutar = await nakitTahsilat("34 KSA 003", 90);

    // Ters kayit: parkin iptalinde para iade edildi.
    const odeme = await prisma.payment.findFirstOrThrow({
      where: { method: "CASH", direction: "IN", status: "CONFIRMED" },
    });
    await prisma.payment.create({
      data: {
        code: "T-TEST-IADE",
        amount: odeme.amount,
        method: "CASH",
        direction: "OUT",
        sourceType: "REFUND",
        shiftId: odeme.shiftId,
        cashDrawerSessionId: kasa.id,
        collectedById: patron.id,
        status: "CONFIRMED",
        idempotencyKey: anahtar(),
      },
    });

    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.nakitTahsilat).toBe(tutar);
    expect(dokum.nakitIade).toBe(tutar);
    expect(dokum.beklenenNakit).toBe(0);
  });
});

// ===========================================================================
describe("kasa kapanışı ve fark", () => {
  it("sayılan = beklenen ise fark yoktur ve gerekçe istenmez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });
    const tutar = await nakitTahsilat("34 KSA 010", 90);

    const sonuc = await kasaKapat(patron, {
      cashDrawerSessionId: kasa.id,
      sayilanNakitKurus: 100 * TL + tutar,
    });

    expect(sonuc.nakitFarki).toBe(0);
    expect(sonuc.farkVarMi).toBe(false);
  });

  it("FARK VARSA GEREKÇE ZORUNLUDUR", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });

    await expect(
      kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 50 * TL }),
    ).rejects.toThrow(/Gerekçe girmeniz zorunludur/);

    // Kasa hala acik: gerekcesiz kapanis uygulanmadi.
    expect(await acikKasaId()).toBe(kasa.id);
  });

  it("gerekçeyle fark kaydedilir ve kasa kapanır", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });

    const sonuc = await kasaKapat(patron, {
      cashDrawerSessionId: kasa.id,
      sayilanNakitKurus: 50 * TL,
      farkSebebi: "Müşteriye yanlış para üstü verildi",
    });

    expect(sonuc.nakitFarki).toBe(-50 * TL);

    const kayit = await prisma.cashDrawerSession.findUniqueOrThrow({ where: { id: kasa.id } });
    expect(kayit.status).toBe("CLOSED");
    expect(toKurus(kayit.expectedCash)).toBe(100 * TL);
    expect(toKurus(kayit.countedCash)).toBe(50 * TL);
    expect(kayit.differenceReason).toMatch(/para üstü/);
  });

  it("beklenen tutar İSTEMCİDEN ALINMAZ: kayda sunucunun hesabı yazılır", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 250 * TL });
    const tutar = await nakitTahsilat("34 KSA 011", 90);

    const sonuc = await kasaKapat(patron, {
      cashDrawerSessionId: kasa.id,
      sayilanNakitKurus: 250 * TL + tutar,
    });

    // Cagiran taraf beklenen tutari HIC gondermedi; sunucu hesapladi.
    expect(sonuc.dokum.beklenenNakit).toBe(250 * TL + tutar);
  });

  it("kart dekont farkı da gerekçe gerektirir", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    await expect(
      kasaKapat(patron, {
        cashDrawerSessionId: kasa.id,
        sayilanNakitKurus: 0,
        beyanEdilenKartKurus: 500 * TL, // sistemde kart tahsilatı yok
      }),
    ).rejects.toThrow(/Gerekçe/);
  });

  it("kapanmış kasa ikinci kez kapatılamaz", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    await kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 0 });
    await expect(
      kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 0 }),
    ).rejects.toThrow(/zaten kapatılmış/);
  });

  it("kapanmış kasaya hareket girilemez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    await kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 0 });
    await expect(
      kasaHareketiEkle(patron, {
        cashDrawerSessionId: kasa.id,
        tip: "DEPOSIT",
        tutarKurus: 100 * TL,
        aciklama: "Sonradan ekleme",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/Kapatılmış kasaya/);
  });

  it("mutabakat tutarlara DOKUNMAZ, yalnızca durumu değiştirir", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });
    await kasaKapat(patron, {
      cashDrawerSessionId: kasa.id,
      sayilanNakitKurus: 90 * TL,
      farkSebebi: "Bozuk para eksik",
    });

    const once = await prisma.cashDrawerSession.findUniqueOrThrow({ where: { id: kasa.id } });
    await kasaMutabakat(patron, { cashDrawerSessionId: kasa.id, not: "İncelendi" });
    const sonra = await prisma.cashDrawerSession.findUniqueOrThrow({ where: { id: kasa.id } });

    expect(sonra.status).toBe("RECONCILED");
    expect(toKurus(sonra.expectedCash)).toBe(toKurus(once.expectedCash));
    expect(toKurus(sonra.countedCash)).toBe(toKurus(once.countedCash));
  });

  it("açık kasa için mutabakat yapılamaz", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    await expect(kasaMutabakat(patron, { cashDrawerSessionId: kasa.id })).rejects.toThrow(
      /Açık kasa/,
    );
  });
});

// ===========================================================================
describe("kasa dışı tahsilat sessiz kalmaz", () => {
  it("kasa açık değilken yapılan nakit tahsilat engellenmez ama işaretlenir", async () => {
    // Kasa YOK: musteri kapida bekletilmez.
    const tutar = await nakitTahsilat("34 KSA 020", 90);

    const odeme = await prisma.payment.findFirstOrThrow({
      where: { method: "CASH", direction: "IN", status: "CONFIRMED" },
    });
    expect(odeme.cashDrawerSessionId).toBeNull();

    const disi = await kasaDisiTahsilat();
    expect(disi.adet).toBe(1);
    expect(disi.tutar).toBe(tutar);
  });

  it("kasa açıkken yapılan tahsilat kasa dışı sayılmaz", async () => {
    await kasaAc(patron, { acilisNakdiKurus: 0 });
    await nakitTahsilat("34 KSA 021", 90);
    expect((await kasaDisiTahsilat()).adet).toBe(0);
  });
});

// ===========================================================================
describe("gider kaydı", () => {
  it("gider kaydedilir ve kod üretilir", async () => {
    const sonuc = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 450 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Test gideri açıklaması",
      idempotencyKey: anahtar(),
    });

    expect(sonuc.kod).toMatch(/^G-\d{6}-\d{4}$/);
    expect(sonuc.tutarKurus).toBe(450 * TL);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci istek yeni gider ÜRETMEZ", async () => {
    const anah = anahtar();
    const birinci = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 450 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Çift tıklama testi",
      idempotencyKey: anah,
    });
    const ikinci = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 450 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Çift tıklama testi",
      idempotencyKey: anah,
    });

    expect(ikinci.expenseId).toBe(birinci.expenseId);
    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(await prisma.expense.count()).toBe(1);
  });

  it("NAKİT GİDER açık kasaya bağlanır ve beklenen nakitten BİR KEZ düşer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });

    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 300 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Kasadan ödenen test gideri",
      idempotencyKey: anahtar(),
    });

    expect(gider.kasaOturumuId).toBe(kasa.id);

    const dokum = await kasaDokumu(kasa.id);
    expect(dokum.nakitGider).toBe(300 * TL);
    // ÇİFTE MUHASEBE TUZAĞI: gider için ayrıca kasa hareketi üretilmez.
    expect(dokum.kasaCikisi).toBe(0);
    expect(dokum.beklenenNakit).toBe(700 * TL);
    expect(await prisma.cashMovement.count()).toBe(0);
  });

  it("KART gider kasayı etkilemez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 300 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CARD",
      aciklama: "Kartla ödenen test gideri",
      idempotencyKey: anahtar(),
    });

    expect(gider.kasaOturumuId).toBeNull();
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1000 * TL);
  });

  it("kasadanOdendi=false ise nakit gider de kasayı etkilemez", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });
    await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 300 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Patron cebinden ödedi",
      kasadanOdendi: false,
      idempotencyKey: anahtar(),
    });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1000 * TL);
  });

  it("açıklama zorunludur", async () => {
    await expect(
      giderKaydet(patron, {
        expenseCategoryId: kategoriId,
        tutarKurus: 100 * TL,
        giderTarihi: bugun(),
        odemeYontemi: "CASH",
        aciklama: "x",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/açıklaması zorunludur/);
  });

  it("gelecek tarihli gider kabul edilmez", async () => {
    await expect(
      giderKaydet(patron, {
        expenseCategoryId: kategoriId,
        tutarKurus: 100 * TL,
        giderTarihi: new Date(Date.now() + 5 * 86_400_000),
        odemeYontemi: "CASH",
        aciklama: "Gelecek tarihli gider",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/ileri bir güne/);
  });

  it("sıfır veya negatif tutar kabul edilmez", async () => {
    for (const tutar of [0, -100]) {
      await expect(
        giderKaydet(patron, {
          expenseCategoryId: kategoriId,
          tutarKurus: tutar,
          giderTarihi: bugun(),
          odemeYontemi: "CASH",
          aciklama: "Geçersiz tutar testi",
          idempotencyKey: anahtar(),
        }),
      ).rejects.toThrow(/sıfırdan büyük/);
    }
  });

  it("pasif kategoriye gider girilemez", async () => {
    const pasif = await prisma.expenseCategory.create({
      data: { code: `PASIF_${++sayac}`, name: "Pasif kategori", isActive: false },
    });
    await expect(
      giderKaydet(patron, {
        expenseCategoryId: pasif.id,
        tutarKurus: 100 * TL,
        giderTarihi: bugun(),
        odemeYontemi: "CASH",
        aciklama: "Pasif kategori testi",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/kullanım dışı/);
  });
});

// ===========================================================================
describe("gider iptali — kayıt SİLİNMEZ", () => {
  it("VERİTABANI TETİKLEYİCİSİ gider silmeyi reddeder", async () => {
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Silinemez gider",
      idempotencyKey: anahtar(),
    });

    await expect(
      prisma.expense.delete({ where: { id: gider.expenseId } }),
    ).rejects.toThrow();
  });

  it("iptal VOIDED + gerekçe yazar, satır listede kalır", async () => {
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "İptal edilecek gider",
      idempotencyKey: anahtar(),
    });

    await giderIptal(patron, { expenseId: gider.expenseId, sebep: "Yanlış kategoriye girildi" });

    const kayit = await prisma.expense.findUniqueOrThrow({ where: { id: gider.expenseId } });
    expect(kayit.status).toBe("VOIDED");
    expect(kayit.voidReason).toMatch(/Yanlış kategoriye/);

    // Liste iptalleri DE gosterir: gizlenmez.
    const liste = await giderListesi({});
    expect(liste).toHaveLength(1);
    expect(liste[0]!.iptal).toBe(true);
  });

  it("iptal gerekçesi zorunludur", async () => {
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Gerekçesiz iptal testi",
      idempotencyKey: anahtar(),
    });
    await expect(
      giderIptal(patron, { expenseId: gider.expenseId, sebep: "x" }),
    ).rejects.toThrow(/gerekçesi zorunludur/);
  });

  it("iptal edilen nakit gider beklenen nakitten DÜŞMEZ", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 300 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "İptal edilecek kasa gideri",
      idempotencyKey: anahtar(),
    });

    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(700 * TL);
    await giderIptal(patron, { expenseId: gider.expenseId, sebep: "Yanlış tutar" });
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(1000 * TL);
  });

  it("KAPANMIŞ kasanın gideri iptal edilemez: imzalanmış sayım bozulmaz", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 1000 * TL });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 300 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Kapanmış kasa gideri",
      idempotencyKey: anahtar(),
    });
    await kasaKapat(patron, { cashDrawerSessionId: kasa.id, sayilanNakitKurus: 700 * TL });

    await expect(
      giderIptal(patron, { expenseId: gider.expenseId, sebep: "Geriye dönük düzeltme" }),
    ).rejects.toThrow(/kasa sayımını/);
  });

  it("aynı gider iki kez iptal edilemez", async () => {
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "TRANSFER",
      aciklama: "Çift iptal testi",
      idempotencyKey: anahtar(),
    });
    await giderIptal(patron, { expenseId: gider.expenseId, sebep: "İlk iptal" });
    await expect(
      giderIptal(patron, { expenseId: gider.expenseId, sebep: "İkinci iptal" }),
    ).rejects.toThrow(/daha önce iptal/);
  });
});

// ===========================================================================
describe("diğer gelir", () => {
  it("gelir kaydı TAHSİLAT üretir ve kasaya düşer", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });

    const gelir = await digerGelirKaydet(patron, {
      etiket: "Test otomat geliri",
      tutarKurus: 250 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    expect(gelir.kod).toMatch(/^D-\d{6}-\d{4}$/);
    expect(gelir.kasaOturumuId).toBe(kasa.id);

    const odeme = await prisma.payment.findFirstOrThrow({
      where: { otherIncomeId: gelir.otherIncomeId },
    });
    expect(odeme.sourceType).toBe("OTHER_INCOME");
    expect(toKurus(odeme.amount)).toBe(250 * TL);

    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(250 * TL);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci gelir kaydı oluşmaz", async () => {
    const anah = anahtar();
    const girdi = {
      etiket: "Test hurda satışı",
      tutarKurus: 100 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH" as const,
      idempotencyKey: anah,
    };
    const birinci = await digerGelirKaydet(patron, girdi);
    const ikinci = await digerGelirKaydet(patron, girdi);

    expect(ikinci.otherIncomeId).toBe(birinci.otherIncomeId);
    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(await prisma.otherIncome.count()).toBe(1);
    expect(await prisma.payment.count({ where: { sourceType: "OTHER_INCOME" } })).toBe(1);
  });

  it("açık vardiya yoksa gelir kaydedilemez", async () => {
    await prisma.shift.updateMany({ where: { userId: patron.id }, data: { status: "CLOSED" } });
    await expect(
      digerGelirKaydet(patron, {
        etiket: "Vardiyasız gelir",
        tutarKurus: 100 * TL,
        gelirTarihi: bugun(),
        odemeYontemi: "CASH",
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/vardiya/i);
  });

  it("ÇİFTE MUHASEBE: para iade edildiyse ters kayıt üretilir, orijinal DURUR", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    const gelir = await digerGelirKaydet(patron, {
      etiket: "İade edilecek gelir",
      tutarKurus: 500 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const sonuc = await digerGelirIptal(patron, {
      otherIncomeId: gelir.otherIncomeId,
      sebep: "Müşteriye geri verildi",
      iadeEdildi: true,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.iadeEdilenKurus).toBe(500 * TL);
    expect(sonuc.tersKayitKodu).toBeTruthy();

    // Orijinal tahsilat DURUYOR.
    const orijinal = await prisma.payment.findFirstOrThrow({
      where: { otherIncomeId: gelir.otherIncomeId, direction: "IN" },
    });
    expect(orijinal.status).toBe("CONFIRMED");

    // Ters kayit var ve kasa net sifir.
    expect(await prisma.payment.count({ where: { direction: "OUT" } })).toBe(1);
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(0);
  });

  it("ÇİFTE MUHASEBE: para el değiştirmediyse orijinal VOIDED olur, ters kayıt ÜRETİLMEZ", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 0 });
    const gelir = await digerGelirKaydet(patron, {
      etiket: "Yanlış girilen gelir",
      tutarKurus: 500 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });

    const sonuc = await digerGelirIptal(patron, {
      otherIncomeId: gelir.otherIncomeId,
      sebep: "Hiç para alınmamıştı",
      iadeEdildi: false,
      idempotencyKey: anahtar(),
    });

    expect(sonuc.iptalEdilenKurus).toBe(500 * TL);
    expect(sonuc.tersKayitKodu).toBeNull();
    expect(await prisma.payment.count({ where: { direction: "OUT" } })).toBe(0);

    const orijinal = await prisma.payment.findFirstOrThrow({
      where: { otherIncomeId: gelir.otherIncomeId },
    });
    expect(orijinal.status).toBe("VOIDED");

    // Tutar BIR KEZ dusuldu, iki kez degil.
    expect((await kasaDokumu(kasa.id)).beklenenNakit).toBe(0);
  });

  it("gelir kaydı silinemez (veritabanı tetikleyicisi)", async () => {
    const gelir = await digerGelirKaydet(patron, {
      etiket: "Silinemez gelir",
      tutarKurus: 100 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await expect(
      prisma.otherIncome.delete({ where: { id: gelir.otherIncomeId } }),
    ).rejects.toThrow();
  });
});

// ===========================================================================
describe("gelir-gider raporu", () => {
  it("otopark, yıkama, abonman ve diğer gelir AYRI satırlarda raporlanır", async () => {
    await kasaAc(patron, { acilisNakdiKurus: 0 });
    const park = await nakitTahsilat("34 RPR 001", 90);
    await digerGelirKaydet(patron, {
      etiket: "Test diğer gelir",
      tutarKurus: 300 * TL,
      gelirTarihi: bugun(),
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 200 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Rapor testi gideri",
      idempotencyKey: anahtar(),
    });

    const rapor = await finansRaporu(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );

    expect(rapor.gelir.park).toBe(park);
    expect(rapor.gelir.yikama).toBe(0);
    expect(rapor.gelir.abonman).toBe(0);
    expect(rapor.gelir.diger).toBe(300 * TL);
    expect(rapor.gelir.toplam).toBe(park + 300 * TL);
    expect(rapor.gider.toplam).toBe(200 * TL);
    expect(rapor.net).toBe(park + 300 * TL - 200 * TL);
  });

  it("iptal edilen gider rapora GİRMEZ", async () => {
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 500 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "İptal edilecek rapor gideri",
      idempotencyKey: anahtar(),
    });
    await giderIptal(patron, { expenseId: gider.expenseId, sebep: "Yanlış giriş" });

    const rapor = await finansRaporu(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );
    expect(rapor.gider.toplam).toBe(0);
  });

  it("gider kalemleri kategori bazında toplanır", async () => {
    const ikinci = await giderKategorisiOlustur(patron, { ad: "İkinci test kategorisi" });

    await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Birinci kalem",
      idempotencyKey: anahtar(),
    });
    await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 150 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Birinci kalem tekrar",
      idempotencyKey: anahtar(),
    });
    await giderKaydet(patron, {
      expenseCategoryId: ikinci.id,
      tutarKurus: 400 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CARD",
      aciklama: "İkinci kalem",
      idempotencyKey: anahtar(),
    });

    const rapor = await finansRaporu(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );

    expect(rapor.gider.toplam).toBe(650 * TL);
    // En buyuk kalem basta.
    expect(rapor.gider.kalemler[0]!.tutar).toBe(400 * TL);
    const ilkKategori = rapor.gider.kalemler.find((k) => k.kategoriId === kategoriId)!;
    expect(ilkKategori.tutar).toBe(250 * TL);
    expect(ilkKategori.adet).toBe(2);
    expect(rapor.gider.nakit).toBe(250 * TL);
    expect(rapor.gider.kart).toBe(400 * TL);
  });
});

// ===========================================================================
describe("malzeme stoğu", () => {
  async function malzeme(ad = "Test şampuanı", birim: "LITRE" | "ADET" | "KG" = "LITRE") {
    return malzemeOlustur(patron, { ad, birim, asgariStok: 5 });
  }

  it("malzeme kartı stok SIFIRDAN başlar", async () => {
    const m = await malzeme();
    expect(Number(m.currentStock.toString())).toBe(0);
  });

  it("aynı adla ikinci malzeme kartı açılamaz", async () => {
    await malzeme("Test deterjanı");
    await expect(malzeme("test DETERJANI")).rejects.toThrow(/zaten kayıtlı/);
  });

  it("alış stoğu artırır, tüketim azaltır", async () => {
    const m = await malzeme();

    const alis = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 20,
      birimMaliyetKurus: 45 * TL,
      idempotencyKey: anahtar(),
    });
    expect(alis.yeniStok).toBe(20);

    const tuketim = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "CONSUMPTION",
      miktar: 0.25,
      idempotencyKey: anahtar(),
    });
    expect(tuketim.oncekiStok).toBe(20);
    expect(tuketim.yeniStok).toBe(19.75);
  });

  it("STOK NEGATİFE DÜŞMEZ: yetersiz stokta tüketim reddedilir", async () => {
    const m = await malzeme();
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 3,
      idempotencyKey: anahtar(),
    });

    await expect(
      stokHareketiEkle(patron, {
        inventoryItemId: m.id,
        tip: "CONSUMPTION",
        miktar: 5,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yetersiz/);

    // Stok DEGISMEDI.
    const guncel = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: m.id } });
    expect(Number(guncel.currentStock.toString())).toBe(3);
  });

  it("VERİTABANI KISITI: stok negatife elle de düşürülemez", async () => {
    const m = await malzeme();
    await expect(
      prisma.inventoryItem.update({ where: { id: m.id }, data: { currentStock: "-1" } }),
    ).rejects.toThrow();
  });

  it("zayi stoktan düşer, sayım düzeltmesi ekler", async () => {
    const m = await malzeme();
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 10,
      idempotencyKey: anahtar(),
    });

    const zayi = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "WASTE",
      miktar: 2,
      not: "Döküldü",
      idempotencyKey: anahtar(),
    });
    expect(zayi.yeniStok).toBe(8);

    const duzeltme = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "ADJUSTMENT",
      miktar: 1,
      not: "Sayımda fazla çıktı",
      idempotencyKey: anahtar(),
    });
    expect(duzeltme.yeniStok).toBe(9);
  });

  it("IDEMPOTENCY: aynı anahtarla ikinci hareket stoğu TEKRAR değiştirmez", async () => {
    const m = await malzeme();
    const anah = anahtar();
    const girdi = {
      inventoryItemId: m.id,
      tip: "PURCHASE" as const,
      miktar: 10,
      idempotencyKey: anah,
    };

    const birinci = await stokHareketiEkle(patron, girdi);
    const ikinci = await stokHareketiEkle(patron, girdi);

    expect(birinci.yeniStok).toBe(10);
    expect(ikinci.tekrarEdenIstek).toBe(true);
    expect(ikinci.yeniStok).toBe(10);
    expect(await prisma.inventoryMovement.count()).toBe(1);
  });

  it("STOK HAREKETİ SİLİNMEZ (veritabanı tetikleyicisi)", async () => {
    const m = await malzeme();
    const hareket = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 5,
      idempotencyKey: anahtar(),
    });

    await expect(
      prisma.inventoryMovement.delete({ where: { id: hareket.movementId } }),
    ).rejects.toThrow();
  });

  it("miktar pozitif olmalıdır", async () => {
    const m = await malzeme();
    for (const miktar of [0, -5]) {
      await expect(
        stokHareketiEkle(patron, {
          inventoryItemId: m.id,
          tip: "PURCHASE",
          miktar,
          idempotencyKey: anahtar(),
        }),
      ).rejects.toThrow(/sıfırdan büyük/);
    }
  });

  it("3 ondalıktan fazla hassasiyet sessizce yuvarlanmaz, reddedilir", async () => {
    const m = await malzeme();
    await expect(
      stokHareketiEkle(patron, {
        inventoryItemId: m.id,
        tip: "PURCHASE",
        miktar: 1.23456,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/3 ondalık/);
  });

  it("kritik stok uyarısı asgari eşikte verilir", async () => {
    const m = await malzeme(); // asgari 5
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 10,
      idempotencyKey: anahtar(),
    });
    expect(await kritikStoklar()).toHaveLength(0);

    const sonuc = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "CONSUMPTION",
      miktar: 5,
      idempotencyKey: anahtar(),
    });
    expect(sonuc.kritikStokUyarisi).toBe(true);
    expect(await kritikStoklar()).toHaveLength(1);
  });

  it("pasif malzemeye alış girilemez ama kalan stok tüketilebilir", async () => {
    const m = await malzeme();
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 10,
      idempotencyKey: anahtar(),
    });
    await malzemeDurum(patron, { id: m.id, aktif: false });

    await expect(
      stokHareketiEkle(patron, {
        inventoryItemId: m.id,
        tip: "PURCHASE",
        miktar: 5,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/kullanım dışı/);

    // Elde kalan stok eritilebilir.
    const tuketim = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "CONSUMPTION",
      miktar: 4,
      idempotencyKey: anahtar(),
    });
    expect(tuketim.yeniStok).toBe(6);
  });

  it("malzeme SİLİNMEZ, pasif yapılır", async () => {
    const m = await malzeme();
    const pasif = await malzemeDurum(patron, { id: m.id, aktif: false });
    expect(pasif.isActive).toBe(false);

    // Varsayilan listede gorunmez, "pasifleri de goster" ile gorunur.
    expect(await malzemeListesi()).toHaveLength(0);
    expect(await malzemeListesi({ pasifleriDeGoster: true })).toHaveLength(1);
  });

  it("dönem özeti alış ve tüketimi ayrı gösterir", async () => {
    const m = await malzeme();
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 20,
      idempotencyKey: anahtar(),
    });
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "CONSUMPTION",
      miktar: 7.5,
      idempotencyKey: anahtar(),
    });
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "WASTE",
      miktar: 1,
      idempotencyKey: anahtar(),
    });

    const ozet = await stokOzeti(
      new Date(Date.now() - 86_400_000),
      new Date(Date.now() + 86_400_000),
    );
    expect(ozet).toHaveLength(1);
    expect(ozet[0]!.alis).toBe(20);
    expect(ozet[0]!.tuketim).toBe(7.5);
    expect(ozet[0]!.zayi).toBe(1);
  });
});

// ===========================================================================
describe("stok alışı ↔ gider bağlantısı (Aşama 4'ten taşınan iş)", () => {
  it("alış hareketi gider kaydına bağlanır", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test cilası", birim: "ADET" });

    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 900 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Test cilası alımı",
      idempotencyKey: anahtar(),
    });

    const hareket = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 3,
      birimMaliyetKurus: 300 * TL,
      expenseId: gider.expenseId,
      idempotencyKey: anahtar(),
    });

    const kayit = await prisma.inventoryMovement.findUniqueOrThrow({
      where: { id: hareket.movementId },
      include: { expense: true },
    });
    expect(kayit.expense?.id).toBe(gider.expenseId);
    // Birim maliyet × miktar, giderin tutarıyla tutarlı.
    expect(toKurus(kayit.unitCost!) * Number(kayit.quantity.toString())).toBe(900 * TL);
  });

  it("bağlantı SONRADAN da kurulabilir", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test bezi", birim: "ADET" });
    const hareket = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 10,
      idempotencyKey: anahtar(),
    });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 200 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Test bezi alımı",
      idempotencyKey: anahtar(),
    });

    await alisiGidereBagla(patron, {
      movementId: hareket.movementId,
      expenseId: gider.expenseId,
    });

    const kayit = await prisma.inventoryMovement.findUniqueOrThrow({
      where: { id: hareket.movementId },
    });
    expect(kayit.expenseId).toBe(gider.expenseId);
  });

  it("yalnızca ALIŞ hareketi gidere bağlanabilir", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test sabunu", birim: "ADET" });
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 10,
      idempotencyKey: anahtar(),
    });
    const tuketim = await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "CONSUMPTION",
      miktar: 1,
      idempotencyKey: anahtar(),
    });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Tüketime bağlanamaz",
      idempotencyKey: anahtar(),
    });

    await expect(
      alisiGidereBagla(patron, { movementId: tuketim.movementId, expenseId: gider.expenseId }),
    ).rejects.toThrow(/Yalnızca alış/);
  });

  it("tüketim hareketine gider bağlantısı girişte de reddedilir", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test köpüğü", birim: "LITRE" });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "CASH",
      aciklama: "Yanlış bağlantı testi",
      idempotencyKey: anahtar(),
    });

    await expect(
      stokHareketiEkle(patron, {
        inventoryItemId: m.id,
        tip: "CONSUMPTION",
        miktar: 1,
        expenseId: gider.expenseId,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/yalnızca alış/i);
  });

  it("GİDER İPTALİ STOĞU GERİ ALMAZ: malzeme fiilen depoda, elle düzeltilir", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test parlatıcısı", birim: "ADET" });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 600 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "TRANSFER",
      aciklama: "İptal edilecek alım",
      idempotencyKey: anahtar(),
    });
    await stokHareketiEkle(patron, {
      inventoryItemId: m.id,
      tip: "PURCHASE",
      miktar: 2,
      expenseId: gider.expenseId,
      idempotencyKey: anahtar(),
    });

    const sonuc = await giderIptal(patron, {
      expenseId: gider.expenseId,
      sebep: "Fatura iade edildi",
    });

    // Stok DEGISMEDI ve cagirana "elle duzeltilmesi gerek" bilgisi dondu.
    const guncel = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: m.id } });
    expect(Number(guncel.currentStock.toString())).toBe(2);
    expect(sonuc.elleDuzeltilmesiGerekenStokHareketi).toBe(1);
  });

  it("iptal edilmiş gidere yeni alış bağlanamaz", async () => {
    const m = await malzemeOlustur(patron, { ad: "Test fırçası", birim: "ADET" });
    const gider = await giderKaydet(patron, {
      expenseCategoryId: kategoriId,
      tutarKurus: 100 * TL,
      giderTarihi: bugun(),
      odemeYontemi: "TRANSFER",
      aciklama: "İptal edilmiş gider",
      idempotencyKey: anahtar(),
    });
    await giderIptal(patron, { expenseId: gider.expenseId, sebep: "Hatalı kayıt" });

    await expect(
      stokHareketiEkle(patron, {
        inventoryItemId: m.id,
        tip: "PURCHASE",
        miktar: 1,
        expenseId: gider.expenseId,
        idempotencyKey: anahtar(),
      }),
    ).rejects.toThrow(/İptal edilmiş/);
  });
});

// ===========================================================================
describe("kasa ekranı sorguları", () => {
  it("açık kasa durumu döküm ve hareketleri birlikte verir", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });
    await kasaHareketiEkle(patron, {
      cashDrawerSessionId: kasa.id,
      tip: "DEPOSIT",
      tutarKurus: 50 * TL,
      aciklama: "Bozuk para",
      idempotencyKey: anahtar(),
    });

    const durum = await acikKasaDurumu();
    expect(durum).not.toBeNull();
    expect(durum!.kasa.id).toBe(kasa.id);
    expect(durum!.kasa.acanKisi).toBeTruthy();
    expect(durum!.dokum.beklenenNakit).toBe(150 * TL);
    expect(durum!.hareketler).toHaveLength(1);
  });

  it("kasa açık değilse null döner", async () => {
    expect(await acikKasaDurumu()).toBeNull();
  });

  it("kasa geçmişi farkları hesaplar", async () => {
    const kasa = await kasaAc(patron, { acilisNakdiKurus: 100 * TL });
    await kasaKapat(patron, {
      cashDrawerSessionId: kasa.id,
      sayilanNakitKurus: 120 * TL,
      farkSebebi: "Fazla çıktı",
    });

    const gecmis = await kasaGecmisi(10);
    expect(gecmis).toHaveLength(1);
    expect(gecmis[0]!.nakitFarki).toBe(20 * TL);
    expect(gecmis[0]!.durum).toBe("CLOSED");
    expect(gecmis[0]!.farkSebebi).toMatch(/Fazla/);
  });
});

// ===========================================================================
describe("yetki sınırları", () => {
  it("kasa izni olmayan personelin izin kümesinde kasa açma YOK", () => {
    // Guvenlik Server Action'da requirePermission ile saglanir; burada taban
    // kumenin dogru oldugu dogrulanir.
    expect(personel.permissions.has(PERMISSIONS.CASH_DRAWER_OPEN)).toBe(false);
    expect(personel.permissions.has(PERMISSIONS.CASH_REPORT_SELF)).toBe(true);
    expect(personel.permissions.has(PERMISSIONS.FINANCE_EXPENSE_CREATE)).toBe(false);
    expect(personel.permissions.has(PERMISSIONS.INVENTORY_MOVEMENT_CREATE)).toBe(false);
  });

  it("patron tüm kasa, finans ve stok izinlerine sahiptir", () => {
    for (const izin of [
      PERMISSIONS.CASH_DRAWER_OPEN,
      PERMISSIONS.CASH_DRAWER_CLOSE,
      PERMISSIONS.CASH_MOVEMENT_CREATE,
      PERMISSIONS.CASH_VOID,
      PERMISSIONS.FINANCE_EXPENSE_CREATE,
      PERMISSIONS.FINANCE_EXPENSE_VOID,
      PERMISSIONS.FINANCE_INCOME_CREATE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MOVEMENT_CREATE,
    ]) {
      expect(patron.permissions.has(izin), izin).toBe(true);
    }
  });
});
