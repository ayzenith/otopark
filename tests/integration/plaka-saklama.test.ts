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
import type { SessionUser } from "@/server/auth/session";

const TL = 100;
let sinifId: string;
let personel: SessionUser;

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
