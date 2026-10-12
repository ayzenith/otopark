/**
 * KVKK PLAKA SAKLAMA TESTLERİ (12.10.2026)
 *
 * Kullanıcı kararı: plakalar 6 AY sonra silinir, kayıt kalır.
 * Burada kanıtlanan şeyler:
 *   · 6 aydan eski kapanmış kaydın plakası maskelenir,
 *   · TUTAR, SÜRE ve TAHSİLAT hiç değişmez (raporlar bozulmaz),
 *   · yeni kayıt ve OTOPARKTA DURAN araç korunur,
 *   · abonmanlı/müşteriye bağlı araç kartı korunur,
 *   · iki kez çalıştırmak ikinci kez bir şey değiştirmez (idempotent),
 *   · her çalıştırma denetim kaydı üretir.
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
import { aracGirisi } from "@/server/parking/entry";
import { aracCikisi } from "@/server/parking/exit";
import {
  MASKE,
  PLAKA_SAKLAMA_AYI,
  maskelenmisMi,
  plakalariTemizle,
  plakayiMaskele,
} from "@/server/privacy/retention";
import { AUDIT_ACTIONS } from "@/server/audit";
import { toKurus } from "@/lib/money";
import { SILINMIS_MUSTERI_ADI, musteriBilgisiniSil } from "@/server/subscription/customer";
import type { SessionUser } from "@/server/auth/session";

const TL = 100;
let sinifId: string;
let personel: SessionUser;
let patron: SessionUser;

let sayac = 0;
const anahtar = () => `saklama-${Date.now()}-${++sayac}`;

/** Verilen ay kadar geçmişte bir tarih. */
function ayOnce(ay: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - ay);
  return d;
}

beforeEach(async () => {
  await temizle();
  sinifId = (await aracSinifiGetir()).id;
  const p = await kullaniciOlustur({ username: "personel1", role: "STAFF" });
  await vardiyaOlustur(p.id);
  personel = oturum(p);
  const o = await kullaniciOlustur({ username: "patron1", role: "OWNER" });
  patron = oturum(o);
  await kapasiteAyarla(0);
  await tarifeOlustur({ ilkBlokDakika: 60, ilkBlokUcret: 100 * TL, saatlikUcret: 50 * TL });
});

afterAll(async () => {
  await temizle();
  await prisma.$disconnect();
});

/** Girip çıkmış, çıkışı `ay` ay öncesine alınmış bir park kaydı üretir. */
async function gecmisteKapanmisKayit(plaka: string, ay: number) {
  const giris = await aracGirisi(personel, { plaka, idempotencyKey: anahtar() });
  await prisma.parkingSession.update({
    where: { id: giris.parkingSessionId },
    data: { entryAt: new Date(Date.now() - 2 * 60 * 60000) },
  });
  const cikis = await aracCikisi(personel, {
    parkingSessionId: giris.parkingSessionId,
    odemeYontemi: "CASH",
    idempotencyKey: anahtar(),
  });
  const eski = ayOnce(ay);
  await prisma.parkingSession.update({
    where: { id: giris.parkingSessionId },
    data: { entryAt: new Date(eski.getTime() - 2 * 60 * 60000), exitAt: eski },
  });
  return { id: giris.parkingSessionId, odenen: cikis.odenenTutar };
}

describe("plaka maskeleme (saf fonksiyon)", () => {
  it("il kodunu korur, gerisini maskeler", () => {
    expect(plakayiMaskele("34 ABC 123")).toBe(`34 ${MASKE}`);
    expect(plakayiMaskele("06XY99")).toBe(`06 ${MASKE}`);
  });

  it("il kodu okunamayan plakayı tamamen maskeler", () => {
    expect(plakayiMaskele("XYZ")).toBe(MASKE);
  });

  it("maskelenmiş plakayı tanır", () => {
    expect(maskelenmisMi(plakayiMaskele("34ABC123"))).toBe(true);
    expect(maskelenmisMi("34ABC123")).toBe(false);
    expect(maskelenmisMi("ANON-abc")).toBe(true);
  });
});

describe("süresi geçmiş plakalar", () => {
  it("süre dolmuş kaydın plakası maskelenir, TUTAR ve SÜRE aynı kalır", async () => {
    const kayit = await gecmisteKapanmisKayit("34SKL001", PLAKA_SAKLAMA_AYI + 1);
    const onceki = await prisma.parkingSession.findUniqueOrThrow({ where: { id: kayit.id } });

    const sonuc = await plakalariTemizle();
    expect(sonuc.parkKaydi).toBe(1);

    const sonraki = await prisma.parkingSession.findUniqueOrThrow({ where: { id: kayit.id } });
    expect(sonraki.plateDisplay).toBe(`34 ${MASKE}`);
    expect(sonraki.plateNormalized).toBe(`34 ${MASKE}`);
    // Para ve süre DOKUNULMAZ: raporlar geçmişe dönük bozulmaz.
    expect(sonraki.payableAmount?.toString()).toBe(onceki.payableAmount?.toString());
    expect(sonraki.collectedAmount?.toString()).toBe(onceki.collectedAmount?.toString());
    expect(sonraki.durationMinutes).toBe(onceki.durationMinutes);
    expect(sonraki.status).toBe(onceki.status);
  });

  it("tahsilat kaydı SİLİNMEZ ve tutarı değişmez", async () => {
    const kayit = await gecmisteKapanmisKayit("34SKL002", PLAKA_SAKLAMA_AYI + 2);
    const oncekiToplam = await prisma.payment.aggregate({ _sum: { amount: true } });

    await plakalariTemizle();

    const sonrakiToplam = await prisma.payment.aggregate({ _sum: { amount: true } });
    expect(sonrakiToplam._sum.amount?.toString()).toBe(oncekiToplam._sum.amount?.toString());
    expect(await prisma.payment.count()).toBeGreaterThan(0);
    expect(kayit.odenen).toBeGreaterThan(0);
  });

  it("süresi DOLMAMIŞ kayda dokunulmaz", async () => {
    const kayit = await gecmisteKapanmisKayit("34SKL003", PLAKA_SAKLAMA_AYI - 1);

    const sonuc = await plakalariTemizle();
    expect(sonuc.parkKaydi).toBe(0);

    const sonraki = await prisma.parkingSession.findUniqueOrThrow({ where: { id: kayit.id } });
    expect(sonraki.plateDisplay).toBe("34 SKL 003");
  });

  it("OTOPARKTA DURAN araca dokunulmaz (girişi çok eski olsa bile)", async () => {
    const giris = await aracGirisi(personel, { plaka: "34SKL004", idempotencyKey: anahtar() });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: ayOnce(PLAKA_SAKLAMA_AYI + 6) },
    });

    await plakalariTemizle();

    const sonraki = await prisma.parkingSession.findUniqueOrThrow({
      where: { id: giris.parkingSessionId },
    });
    expect(sonraki.status).toBe("ACTIVE");
    expect(sonraki.plateDisplay).toBe("34 SKL 004");
  });

  it("ikinci çalıştırma hiçbir şey değiştirmez (idempotent)", async () => {
    await gecmisteKapanmisKayit("34SKL005", PLAKA_SAKLAMA_AYI + 1);

    const birinci = await plakalariTemizle();
    expect(birinci.parkKaydi).toBe(1);

    const ikinci = await plakalariTemizle();
    expect(ikinci.parkKaydi).toBe(0);
    expect(ikinci.arac).toBe(0);
  });

  it("her temizlik DENETİM KAYDI üretir", async () => {
    await gecmisteKapanmisKayit("34SKL006", PLAKA_SAKLAMA_AYI + 1);
    await plakalariTemizle();

    const kayit = await prisma.auditLog.findFirst({
      where: { action: AUDIT_ACTIONS.PLATE_ANONYMIZE },
      orderBy: { at: "desc" },
    });
    expect(kayit).not.toBeNull();
    expect((kayit!.after as Record<string, unknown>).saklamaAyi).toBe(PLAKA_SAKLAMA_AYI);
  });

  it("temizlenecek bir şey yoksa denetim kaydı ÜRETİLMEZ (gürültü olmaz)", async () => {
    await plakalariTemizle();
    expect(await prisma.auditLog.count({ where: { action: AUDIT_ACTIONS.PLATE_ANONYMIZE } })).toBe(0);
  });
});

describe("araç kartı", () => {
  it("hareketsiz ve kimseye bağlı olmayan araç kartı maskelenir", async () => {
    await gecmisteKapanmisKayit("34SKL007", PLAKA_SAKLAMA_AYI + 1);

    const sonuc = await plakalariTemizle();
    expect(sonuc.arac).toBe(1);

    const arac = await prisma.vehicle.findFirstOrThrow({ where: { plateDisplay: { contains: MASKE } } });
    expect(arac.plateNormalized.startsWith("ANON-")).toBe(true);
  });

  it("ABONMANLI araç kartı KORUNUR (abonman kayıtları kalacak)", async () => {
    const bugun = new Date();
    const gelecekAy = new Date(bugun);
    gelecekAy.setMonth(gelecekAy.getMonth() + 1);
    await abonmanOlustur({
      musteriAdi: "Saklama Müşterisi",
      plateNormalized: "34SKL008",
      vehicleClassId: sinifId,
      baslangic: bugun,
      bitis: gelecekAy,
      ucretKurus: 1000 * TL,
    });

    // Aracın park geçmişini süre dolmuş hâle getir.
    const giris = await aracGirisi(personel, { plaka: "34SKL008", idempotencyKey: anahtar() });
    await aracCikisi(personel, {
      parkingSessionId: giris.parkingSessionId,
      odemeYontemi: "CASH",
      idempotencyKey: anahtar(),
    });
    await prisma.parkingSession.update({
      where: { id: giris.parkingSessionId },
      data: { entryAt: ayOnce(PLAKA_SAKLAMA_AYI + 2), exitAt: ayOnce(PLAKA_SAKLAMA_AYI + 2) },
    });

    await plakalariTemizle();

    const arac = await prisma.vehicle.findFirstOrThrow({
      where: { plateNormalized: "34SKL008" },
    });
    // Abonman fixture plakayı biçimlendirmeden yazar; önemli olan MASKELENMEMİŞ olması.
    expect(maskelenmisMi(arac.plateDisplay)).toBe(false);
    expect(arac.plateDisplay).toContain("SKL008");
  });
});

describe("müşteri bilgisini ELLE silme (KVKK)", () => {
  it("ad, telefon ve notlar silinir; abonman ve TUTAR kalır", async () => {
    const gecmis = new Date();
    gecmis.setMonth(gecmis.getMonth() - 3);
    const bitti = new Date();
    bitti.setMonth(bitti.getMonth() - 2);
    const { musteri, abonman } = await abonmanOlustur({
      musteriAdi: "Silinecek Müşteri",
      plateNormalized: "34MST001",
      vehicleClassId: sinifId,
      baslangic: gecmis,
      bitis: bitti,
      ucretKurus: 1500 * TL,
      durum: "EXPIRED",
    });

    await musteriBilgisiniSil(patron, musteri.id, "müşterinin silme talebi");

    const sonra = await prisma.customer.findUniqueOrThrow({ where: { id: musteri.id } });
    expect(sonra.fullName).toBe(SILINMIS_MUSTERI_ADI);
    expect(sonra.phone).toBe("");
    expect(sonra.phoneNormalized).toBeNull();
    expect(sonra.notes).toBeNull();
    expect(sonra.isActive).toBe(false);

    // Abonman ve tutarı YERİNDE.
    const kalan = await prisma.subscription.findUniqueOrThrow({ where: { id: abonman.id } });
    expect(toKurus(kalan.agreedPrice)).toBe(1500 * TL);
  });

  it("DEVAM EDEN abonmanı olan müşteride çalışmaz", async () => {
    const bugun = new Date();
    const gelecek = new Date();
    gelecek.setMonth(gelecek.getMonth() + 1);
    const { musteri } = await abonmanOlustur({
      musteriAdi: "Aktif Abonman Müşterisi",
      plateNormalized: "34MST002",
      vehicleClassId: sinifId,
      baslangic: bugun,
      bitis: gelecek,
      ucretKurus: 1500 * TL,
      durum: "ACTIVE",
    });

    await expect(
      musteriBilgisiniSil(patron, musteri.id, "deneme"),
    ).rejects.toMatchObject({ code: "ABONMAN_SURUYOR" });

    const sonra = await prisma.customer.findUniqueOrThrow({ where: { id: musteri.id } });
    expect(sonra.fullName).toBe("Aktif Abonman Müşterisi");
  });

  it("gerekçe yazılmadan silinemez", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "Gerekçesiz", phone: "5551112233" },
    });
    await expect(musteriBilgisiniSil(patron, musteri.id, "  ")).rejects.toMatchObject({
      code: "GEREKCE_GEREKLI",
    });
  });

  it("aynı müşteri iki kez silinemez", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "İki Kez", phone: "5554443322" },
    });
    await musteriBilgisiniSil(patron, musteri.id, "talep");
    await expect(musteriBilgisiniSil(patron, musteri.id, "talep")).rejects.toMatchObject({
      code: "MUSTERI_SILINMIS",
    });
  });

  it("denetim kaydı üretir ama SİLİNEN BİLGİYİ yazmaz", async () => {
    const musteri = await prisma.customer.create({
      data: { fullName: "Denetim Müşterisi", phone: "5559998877", notes: "gizli not" },
    });
    await musteriBilgisiniSil(patron, musteri.id, "KVKK talebi");

    const kayit = await prisma.auditLog.findFirstOrThrow({
      where: { action: AUDIT_ACTIONS.CUSTOMER_ANONYMIZE, entityId: musteri.id },
    });
    const tumMetin = JSON.stringify(kayit);
    expect(tumMetin).not.toContain("Denetim Müşterisi");
    expect(tumMetin).not.toContain("5559998877");
    expect(tumMetin).not.toContain("gizli not");
    expect(kayit.note).toBe("KVKK talebi");
  });
});
