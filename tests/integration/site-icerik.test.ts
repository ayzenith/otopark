/**
 * KURUMSAL SITE ICERIGI TESTLERI (Asama 7)
 *
 * ============================================================================
 * DIKKAT: Bu dosyadaki adres, telefon ve fiyat metinleri YALNIZCA TESTtir.
 * Londra Camping'in gercek bilgileri DEGILDIR - isletme bunlari henuz
 * vermedi (docs/07 S18-S19). Testler "girilen ne ise o gorunur, girilmeyen
 * HIC gorunmez" davranisini dogrular; belirli bir adresin dogrulugunu degil.
 * ============================================================================
 *
 * Dogrulanan kurallar:
 *   1. Bos veritabaninda site hicbir bilgi UYDURMAZ, eksikleri listeler
 *   2. Girilmeyen kunye alani public icerige null olarak doner
 *   3. Yayinda olmayan sayfa/fiyat/gorsel public tarafta GORUNMEZ
 *   4. Bos metinli sayfa YAYINA ALINAMAZ (yarim site gosterilmez)
 *   5. Yayinda ama metni bos birakilmis kayit public tarafta atlanir
 *   6. Site fiyati TARIFEDEN KOPYALANMAZ - serbest metindir
 *   7. Her icerik degisikligi denetim kaydi uretir
 *   8. Fiyat/gorsel silinebilir (site icerigi finansal kayit degildir)
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { kullaniciOlustur, oturum, prisma, temizle } from "./helpers";
import {
  siteIcerigi,
  siteSayfalariYonetim,
  SITE_SAYFA_ANAHTARLARI,
} from "@/server/site/queries";
import {
  siteSayfasiKaydet,
  siteFiyatiKaydet,
  siteFiyatiSil,
  siteGorseliKaydet,
  siteGorseliSil,
} from "@/server/site/admin";
import { isletmeKunyesiKaydet } from "@/server/settings/business";
import { IslemHatasi } from "@/server/errors";

async function patron() {
  const u = await kullaniciOlustur({ username: "site_patron", role: "OWNER" });
  return oturum(u);
}

/** Kunyeyi BOS haline getirir: testler birbirinin bilgisini gormesin. */
async function kunyeyiBosalt() {
  await prisma.businessSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", businessName: "Test İşletme" },
    update: {
      businessName: "Test İşletme",
      addressText: "",
      phone: "",
      whatsappPhone: null,
      workingHoursText: "",
      mapsUrl: null,
      instagramUrl: null,
    },
  });
}

describe("kurumsal site içeriği", () => {
  beforeEach(async () => {
    await temizle();
    await kunyeyiBosalt();
  });

  afterAll(async () => {
    await temizle();
    await kunyeyiBosalt();
  });

  it("boş veritabanında hiçbir bilgi uydurmaz, eksikleri listeler", async () => {
    const icerik = await siteIcerigi();

    expect(icerik.kunye.adres).toBeNull();
    expect(icerik.kunye.telefon).toBeNull();
    expect(icerik.kunye.calismaSaatleri).toBeNull();
    expect(icerik.kunye.mapsUrl).toBeNull();
    expect(icerik.fiyatlar).toHaveLength(0);
    expect(icerik.galeri).toHaveLength(0);
    expect(Object.keys(icerik.sayfalar)).toHaveLength(0);

    // Eksikler patron panelinde uyari olarak listelenir.
    expect(icerik.eksikler).toContain("Adres");
    expect(icerik.eksikler).toContain("Telefon");
    expect(icerik.eksikler).toContain("Çalışma saatleri");
    expect(icerik.eksikler).toContain("Sitede gösterilecek fiyatlar");
    expect(icerik.eksikler).toContain("Ana sayfa tanıtım metni");
  });

  it("künye girilince sitede görünür, girilmeyen alan null kalır", async () => {
    const actor = await patron();

    await isletmeKunyesiKaydet(actor, {
      isletmeAdi: "Test Kamp",
      adres: "Test Mahallesi 1",
      telefon: "0000 000 00 00",
      whatsapp: "",
      calismaSaatleri: "",
      mapsUrl: "",
      instagramUrl: "",
    });

    const icerik = await siteIcerigi();
    expect(icerik.kunye.isletmeAdi).toBe("Test Kamp");
    expect(icerik.kunye.adres).toBe("Test Mahallesi 1");
    expect(icerik.kunye.telefon).toBe("0000 000 00 00");

    // Girilmeyenler null: site o bolumu hic cizmez.
    expect(icerik.kunye.whatsapp).toBeNull();
    expect(icerik.kunye.calismaSaatleri).toBeNull();
    expect(icerik.kunye.mapsUrl).toBeNull();
    expect(icerik.eksikler).toContain("Çalışma saatleri");
    expect(icerik.eksikler).not.toContain("Adres");
  });

  it("geçersiz harita bağlantısı reddedilir", async () => {
    const actor = await patron();
    await expect(
      isletmeKunyesiKaydet(actor, {
        isletmeAdi: "Test Kamp",
        adres: "",
        telefon: "",
        whatsapp: "",
        calismaSaatleri: "",
        mapsUrl: "maps.example.com",
        instagramUrl: "",
      }),
    ).rejects.toThrow();
  });

  it("boş metinli sayfa yayına alınamaz", async () => {
    const actor = await patron();

    await expect(
      siteSayfasiKaydet(actor, {
        anahtar: SITE_SAYFA_ANAHTARLARI.ANASAYFA,
        baslik: "Ana sayfa",
        govde: "   ",
        yayinda: true,
      }),
    ).rejects.toBeInstanceOf(IslemHatasi);

    // Taslak olarak bos birakmak serbesttir.
    const taslak = await siteSayfasiKaydet(actor, {
      anahtar: SITE_SAYFA_ANAHTARLARI.ANASAYFA,
      baslik: "Ana sayfa",
      govde: "",
      yayinda: false,
    });
    expect(taslak.isPublished).toBe(false);

    const icerik = await siteIcerigi();
    expect(icerik.sayfalar[SITE_SAYFA_ANAHTARLARI.ANASAYFA]).toBeUndefined();
  });

  it("yayınlanan sayfa sitede görünür, yayından kaldırılan kaybolur", async () => {
    const actor = await patron();

    await siteSayfasiKaydet(actor, {
      anahtar: SITE_SAYFA_ANAHTARLARI.OTOPARK,
      baslik: "Otopark",
      govde: "Test tanıtım metni.",
      yayinda: true,
    });

    let icerik = await siteIcerigi();
    expect(icerik.sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK]?.govde).toBe("Test tanıtım metni.");

    await siteSayfasiKaydet(actor, {
      anahtar: SITE_SAYFA_ANAHTARLARI.OTOPARK,
      baslik: "Otopark",
      govde: "Test tanıtım metni.",
      yayinda: false,
    });

    icerik = await siteIcerigi();
    expect(icerik.sayfalar[SITE_SAYFA_ANAHTARLARI.OTOPARK]).toBeUndefined();
  });

  it("yönetim listesi, kaydı olmayan sayfaları da boş satır olarak verir", async () => {
    const satirlar = await siteSayfalariYonetim();
    expect(satirlar).toHaveLength(Object.keys(SITE_SAYFA_ANAHTARLARI).length);
    expect(satirlar.every((s) => s.govde === "" && s.yayinda === false)).toBe(true);
  });

  it("site fiyatı serbest metindir ve tarifeden kopyalanmaz", async () => {
    const actor = await patron();

    await siteFiyatiKaydet(actor, {
      etiket: "Test kalemi",
      fiyatMetni: "test fiyatı",
      sira: 0,
      yayinda: true,
    });

    const icerik = await siteIcerigi();
    expect(icerik.fiyatlar).toHaveLength(1);
    // Metin aynen korunur: sayiya cevrilmez, kurusa donusturulmez.
    expect(icerik.fiyatlar[0]!.fiyatMetni).toBe("test fiyatı");

    // Sitede fiyat satiri olmasi otopark tarifesini OLUSTURMAZ.
    expect(await prisma.tariffPlan.count()).toBe(0);
  });

  it("yayından kaldırılan fiyat satırı sitede görünmez ama kayıt durur", async () => {
    const actor = await patron();

    const satir = await siteFiyatiKaydet(actor, {
      etiket: "Test kalemi",
      fiyatMetni: "test fiyatı",
      sira: 0,
      yayinda: false,
    });

    const icerik = await siteIcerigi();
    expect(icerik.fiyatlar).toHaveLength(0);
    expect(await prisma.sitePublicPrice.findUnique({ where: { id: satir.id } })).not.toBeNull();
  });

  it("fiyat satırı sıraya göre gelir", async () => {
    const actor = await patron();
    await siteFiyatiKaydet(actor, { etiket: "İkinci", fiyatMetni: "b", sira: 5, yayinda: true });
    await siteFiyatiKaydet(actor, { etiket: "Birinci", fiyatMetni: "a", sira: 1, yayinda: true });

    const icerik = await siteIcerigi();
    expect(icerik.fiyatlar.map((f) => f.etiket)).toEqual(["Birinci", "İkinci"]);
  });

  it("görsel adresi http(s) ya da / ile başlamalı", async () => {
    const actor = await patron();
    await expect(
      siteGorseliKaydet(actor, { url: "otopark.jpg", alt: "Test", sira: 0, yayinda: true }),
    ).rejects.toThrow();

    const kayit = await siteGorseliKaydet(actor, {
      url: "/test.jpg",
      alt: "Test görseli",
      sira: 0,
      yayinda: true,
    });
    expect(kayit.url).toBe("/test.jpg");
  });

  it("fiyat ve görsel silinebilir; silinince sitede kalmaz", async () => {
    const actor = await patron();

    const fiyat = await siteFiyatiKaydet(actor, {
      etiket: "Test kalemi",
      fiyatMetni: "test",
      sira: 0,
      yayinda: true,
    });
    const gorsel = await siteGorseliKaydet(actor, {
      url: "/test.jpg",
      alt: "Test görseli",
      sira: 0,
      yayinda: true,
    });

    await siteFiyatiSil(actor, fiyat.id);
    await siteGorseliSil(actor, gorsel.id);

    const icerik = await siteIcerigi();
    expect(icerik.fiyatlar).toHaveLength(0);
    expect(icerik.galeri).toHaveLength(0);
  });

  it("her içerik değişikliği denetim kaydı üretir", async () => {
    const actor = await patron();

    await siteSayfasiKaydet(actor, {
      anahtar: SITE_SAYFA_ANAHTARLARI.ILETISIM,
      baslik: "İletişim",
      govde: "Test metni.",
      yayinda: true,
    });
    await siteFiyatiKaydet(actor, {
      etiket: "Test kalemi",
      fiyatMetni: "test",
      sira: 0,
      yayinda: true,
    });

    const kayitlar = await prisma.auditLog.findMany({
      where: { action: "SITE_CONTENT_UPDATE" },
    });
    expect(kayitlar).toHaveLength(2);
    expect(kayitlar.every((k) => k.actorLabel === actor.username)).toBe(true);
    expect(kayitlar.map((k) => k.entityType).sort()).toEqual(["SitePage", "SitePublicPrice"]);
  });

  it("künye değişikliği denetim kaydı üretir", async () => {
    const actor = await patron();
    await isletmeKunyesiKaydet(actor, {
      isletmeAdi: "Test Kamp",
      adres: "",
      telefon: "",
      whatsapp: "",
      calismaSaatleri: "",
      mapsUrl: "",
      instagramUrl: "",
    });

    const kayit = await prisma.auditLog.findFirst({
      where: { entityType: "BusinessSetting", action: "SETTINGS_UPDATE" },
    });
    expect(kayit).not.toBeNull();
  });

  it("tanımsız sayfa anahtarı reddedilir", async () => {
    const actor = await patron();
    await expect(
      siteSayfasiKaydet(actor, {
        anahtar: "kampanyalar",
        baslik: "Kampanyalar",
        govde: "Test",
        yayinda: true,
      }),
    ).rejects.toThrow();
  });
});
