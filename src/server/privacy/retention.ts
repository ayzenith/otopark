/**
 * KVKK — PLAKA SAKLAMA SÜRESİ (12.10.2026, kullanıcı kararı: 6 AY)
 *
 * ============================================================================
 * KARAR: Plaka kişisel veridir ve sonsuza kadar tutulmaz. 6 aydan eski
 * kayıtların plakası MASKELENİR.
 *
 * KAYIT SİLİNMEZ (mimari kural 4): tutar, tarih, süre, tahsilat ve denetim
 * kaydı yerinde kalır. Bu yüzden ciro, kasa ve personel raporları geçmişe
 * dönük olarak BOZULMAZ; yalnızca "kimin aracıydı" bilgisi gider.
 *
 * DOKUNULMAYANLAR:
 *   · Açık (ACTIVE) park kaydı ve bitmemiş yıkama — süre dolmuş sayılmaz.
 *   · Müşteriye bağlı araçlar ve abonmanlı araçlar: abonman kayıtları
 *     kalacak (kullanıcı kararı 12.10.2026). Abonmanlı müşterinin plakası
 *     işin kendisidir, kişisel veri fazlalığı değildir.
 *   · Müşteri adı/telefonu: bu iş KVKK'nın ayrı bir kararını ister,
 *     VERİLMEDİ — varsayılmaz (mimari kural: uydurma yok).
 * ============================================================================
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";

/** Kullanıcı kararı 12.10.2026. Değiştirmek iş kararıdır, kod kararı değil. */
export const PLAKA_SAKLAMA_AYI = 6;

/** Maskelenmiş kayıtların plakası bununla başlar; rapor ekranı bunu olduğu gibi gösterir. */
export const MASKE = "•••";

/**
 * Plakayı okunamaz hâle getirir ama kaydın tanınabilir kalmasını sağlar:
 * il kodu (ilk 2 hane) korunur, gerisi maskelenir. "34 ABC 123" → "34 •••".
 *
 * SAF fonksiyon: veritabanı, saat ve rastgelelik yok (test edilebilir).
 */
export function plakayiMaskele(plaka: string): string {
  const temiz = plaka.trim();
  const il = temiz.slice(0, 2);
  return /^\d{2}$/.test(il) ? `${il} ${MASKE}` : MASKE;
}

/** Zaten maskelenmiş bir kayda ikinci kez dokunulmaz. */
export function maskelenmisMi(plaka: string): boolean {
  return plaka.includes(MASKE) || plaka.startsWith("ANON-");
}

export interface TemizlikSonucu {
  /** Hangi tarihten eskisi temizlendi. */
  sinir: Date;
  parkKaydi: number;
  yikamaIsEmri: number;
  arac: number;
}

function sinirTarihi(simdi: Date): Date {
  const d = new Date(simdi);
  d.setMonth(d.getMonth() - PLAKA_SAKLAMA_AYI);
  return d;
}

/**
 * Süresi geçmiş plakaları maskeler. İdempotenttir: ikinci çalıştırmada
 * 0 kayıt döner, çünkü maskelenmiş kayıtlar hariç tutulur.
 *
 * `simdi` dışarıdan verilebilir (test içindir); üretimde o anın saati.
 */
export async function plakalariTemizle(
  simdi: Date = new Date(),
  tetikleyen: { id: string | null; etiket: string } = { id: null, etiket: "otomatik gece bakımı" },
): Promise<TemizlikSonucu> {
  const sinir = sinirTarihi(simdi);

  const sonuc = await prisma.$transaction(async (tx) => {
    const parkKaydi = await parkKayitlariniMaskele(tx, sinir);
    const yikamaIsEmri = await yikamaIsEmirleriniMaskele(tx, sinir);
    const arac = await araclariMaskele(tx, sinir);
    return { parkKaydi, yikamaIsEmri, arac };
  });

  const toplam = sonuc.parkKaydi + sonuc.yikamaIsEmri + sonuc.arac;
  if (toplam > 0) {
    await writeAudit({
      action: AUDIT_ACTIONS.PLATE_ANONYMIZE,
      entityType: "Privacy",
      entityId: "plaka-saklama",
      userId: tetikleyen.id,
      actorLabel: tetikleyen.etiket,
      after: {
        saklamaAyi: PLAKA_SAKLAMA_AYI,
        sinir: sinir.toISOString(),
        parkKaydi: sonuc.parkKaydi,
        yikamaIsEmri: sonuc.yikamaIsEmri,
        arac: sonuc.arac,
      },
      note: `${PLAKA_SAKLAMA_AYI} aydan eski ${toplam} kaydın plakası maskelendi.`,
    });
  }

  return { sinir, ...sonuc };
}

type Tx = Prisma.TransactionClient;

/** Çıkışı sınırdan eski, KAPANMIŞ park kayıtları. Açık kayda dokunulmaz. */
async function parkKayitlariniMaskele(tx: Tx, sinir: Date): Promise<number> {
  const kayitlar = await tx.parkingSession.findMany({
    where: {
      status: { not: "ACTIVE" },
      exitAt: { lt: sinir, not: null },
      NOT: { plateDisplay: { contains: MASKE } },
    },
    select: { id: true, plateDisplay: true },
  });
  for (const k of kayitlar) {
    const maske = plakayiMaskele(k.plateDisplay);
    await tx.parkingSession.update({
      where: { id: k.id },
      data: { plateDisplay: maske, plateNormalized: maske },
    });
  }
  return kayitlar.length;
}

/** Bitmiş (tamamlanmış ya da iptal) yıkama iş emirleri. */
async function yikamaIsEmirleriniMaskele(tx: Tx, sinir: Date): Promise<number> {
  const kayitlar = await tx.washJob.findMany({
    where: {
      status: { in: ["COMPLETED", "CANCELLED"] },
      OR: [{ completedAt: { lt: sinir } }, { cancelledAt: { lt: sinir } }],
      NOT: { plateDisplay: { contains: MASKE } },
    },
    select: { id: true, plateDisplay: true },
  });
  for (const k of kayitlar) {
    const maske = plakayiMaskele(k.plateDisplay);
    await tx.washJob.update({
      where: { id: k.id },
      data: { plateDisplay: maske, plateNormalized: maske },
    });
  }
  return kayitlar.length;
}

/**
 * Araç kartı: yalnızca TAMAMEN hareketsiz ve kimseye bağlı olmayanlar.
 * Müşterisi olan, abonmanı olan ya da son 6 ayda işlem görmüş araç KALIR.
 *
 * `plateNormalized` tekil olduğu için maske yetmez; arama alanına kaydın
 * kendi kimliğinden türeyen tekil bir değer yazılır (geri döndürülemez).
 */
async function araclariMaskele(tx: Tx, sinir: Date): Promise<number> {
  const araclar = await tx.vehicle.findMany({
    where: {
      customerId: null,
      NOT: { plateDisplay: { contains: MASKE } },
      subscriptionVehicles: { none: {} },
      parkingSessions: { none: { OR: [{ status: "ACTIVE" }, { entryAt: { gte: sinir } }] } },
      washJobs: { none: { OR: [{ status: { in: ["QUEUED", "IN_PROGRESS"] } }, { queuedAt: { gte: sinir } }] } },
    },
    select: { id: true, plateDisplay: true },
  });
  for (const a of araclar) {
    await tx.vehicle.update({
      where: { id: a.id },
      data: {
        plateDisplay: plakayiMaskele(a.plateDisplay),
        plateNormalized: `ANON-${a.id}`,
        brandModel: null,
        color: null,
        notes: null,
      },
    });
  }
  return araclar.length;
}
