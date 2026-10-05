/**
 * KASA OTURUMU: AÇ · SAY · KAPAT
 *
 * ============================================================================
 * NEDEN AYRI BIR "KASA OTURUMU" VAR?
 * ----------------------------------------------------------------------------
 * Vardiya personelin calisma suresidir; kasa oturumu ise PARANIN fiziki
 * sorumlulugudur. Ikisi her zaman ortusmez: bir vardiyada kasa iki kez
 * sayilabilir, ya da iki personel ayni kasayi devralabilir. Bu yuzden kasa
 * kendi oturumunu tutar ve her tahsilat hangi kasa oturumuna dustugunu
 * `Payment.cashDrawerSessionId` ile tasir.
 *
 * TEK FIZIKI KASA: ayni anda yalnizca BIR acik kasa oturumu olabilir.
 * Uygulama kontrol eder, veritabani da kismi unique indeksle garanti eder
 * (`cash_drawer_single_open`) - esszamanli iki "kasa ac" isteginde ikincisi
 * veritabaninda reddedilir.
 *
 * BEKLENEN NAKIT SUNUCUDA HESAPLANIR. Personel yalnizca SAYDIGI tutari girer;
 * beklenen tutar hicbir zaman istemciden alinmaz. Fark varsa GEREKCE
 * ZORUNLUDUR - "neden 50 ₺ eksik?" sorusunun yanitsiz kalmasi kabul edilemez.
 *
 * ÇİFTE MUHASEBE TUZAGI (mimari kural 5'in kasa karsiligi): nakit gider
 * kasadan odendiginde YALNIZCA Expense satiri uretilir ve kasa oturumuna
 * baglanir. AYRICA kasa hareketi URETILMEZ; ikisini birlikte yapmak beklenen
 * nakdi iki kez dusurur. Beklenen nakit hesabi, gidere bagli kasa
 * hareketlerini (expenseId dolu olanlari) bu yuzden TOPLAMAZ.
 * ============================================================================
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { acikVardiya } from "@/server/shift";
import type { SessionUser } from "@/server/auth/session";

/** Beklenen nakit/kart dokumu - personel ekraninda seffaf gosterilir. */
export interface KasaDokumu {
  /** Acilis nakdi (kasada baslangicta duran para). */
  acilisNakdi: number;
  /** Nakit tahsilatlar (park + yikama + abonman + diger gelir). */
  nakitTahsilat: number;
  /** Nakit iadeler (ters kayitlar). */
  nakitIade: number;
  /** Kasaya elden eklenen para (DEPOSIT). */
  kasaGirisi: number;
  /** Kasadan cikan para (WITHDRAWAL / BANK_TRANSFER / ADVANCE). */
  kasaCikisi: number;
  /** Kasadan odenen nakit giderler. */
  nakitGider: number;
  /** Beklenen nakit = acilis + tahsilat - iade + giris - cikis - gider. */
  beklenenNakit: number;
  /** Kart tahsilatlari (dekontla karsilastirilmak uzere). */
  kartTahsilat: number;
  kartIade: number;
  beklenenKart: number;
  /** Diger yontemler (havale vb.) - kasa nakdini etkilemez. */
  digerTahsilat: number;
}

/** Acik kasa oturumu (varsa). */
export async function acikKasa() {
  return prisma.cashDrawerSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * Tahsilat kaydedilirken kullanilacak acik kasa oturumunun kimligi.
 *
 * Kasa acik degilse null doner ve tahsilat ENGELLENMEZ: personelin kasa
 * oturumu acmayi unutmasi musteriyi kapida bekletmemelidir. Bu tahsilatlar
 * hicbir kasa oturumuna dusmez ve patron panelinde "kasa dışı tahsilat"
 * olarak gorunur - kayip sessiz kalmaz.
 */
export async function acikKasaId(
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string | null> {
  const oturum = await db.cashDrawerSession.findFirst({
    where: { status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
  return oturum?.id ?? null;
}

/**
 * Bir kasa oturumunun beklenen nakit/kart dokumunu hesaplar.
 *
 * TUM TUTARLAR VERITABANINDAN OKUNUR. Istemciden hicbir tutar alinmaz.
 */
export async function kasaDokumu(cashDrawerSessionId: string): Promise<KasaDokumu> {
  const oturum = await prisma.cashDrawerSession.findUnique({
    where: { id: cashDrawerSessionId },
    select: { openingFloat: true },
  });
  if (!oturum) throw new IslemHatasi("KASA_YOK", "Kasa oturumu bulunamadı.");

  const [tahsilatlar, hareketler, giderler] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method", "direction"],
      where: { cashDrawerSessionId, status: "CONFIRMED" },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["direction"],
      where: {
        cashDrawerSessionId,
        status: "CONFIRMED",
        // Gidere bagli hareketler SAYILMAZ: gider ayri satir olarak
        // dusuluyor, ikisini toplamak tutari iki kez azaltir.
        expenseId: null,
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { cashDrawerSessionId, status: "CONFIRMED", paymentMethod: "CASH" },
      _sum: { amount: true },
    }),
  ]);

  const topla = (method: string | null, direction: "IN" | "OUT") =>
    tahsilatlar
      .filter((t) => (method === null ? t.method !== "CASH" && t.method !== "CARD" : t.method === method))
      .filter((t) => t.direction === direction)
      .reduce((toplam, t) => toplam + toKurus(t._sum.amount), 0);

  const hareket = (direction: "IN" | "OUT") =>
    hareketler
      .filter((h) => h.direction === direction)
      .reduce((toplam, h) => toplam + toKurus(h._sum.amount), 0);

  const acilisNakdi = toKurus(oturum.openingFloat);
  const nakitTahsilat = topla("CASH", "IN");
  const nakitIade = topla("CASH", "OUT");
  const kasaGirisi = hareket("IN");
  const kasaCikisi = hareket("OUT");
  const nakitGider = toKurus(giderler._sum.amount);

  const kartTahsilat = topla("CARD", "IN");
  const kartIade = topla("CARD", "OUT");

  return {
    acilisNakdi,
    nakitTahsilat,
    nakitIade,
    kasaGirisi,
    kasaCikisi,
    nakitGider,
    beklenenNakit:
      acilisNakdi + nakitTahsilat - nakitIade + kasaGirisi - kasaCikisi - nakitGider,
    kartTahsilat,
    kartIade,
    beklenenKart: kartTahsilat - kartIade,
    digerTahsilat: topla(null, "IN") - topla(null, "OUT"),
  };
}

// ---------------------------------------------------------------------------
// KASA AÇ
// ---------------------------------------------------------------------------

export interface KasaAcIstegi {
  /** Kasada baslangicta duran para (kurus). 0 olabilir. */
  acilisNakdiKurus: number;
  not?: string | null;
}

export async function kasaAc(actor: SessionUser, istek: KasaAcIstegi) {
  if (istek.acilisNakdiKurus < 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Açılış nakdi negatif olamaz.");
  }

  const mevcut = await acikKasa();
  if (mevcut) {
    throw new IslemHatasi(
      "KASA_ACIK",
      "Zaten açık bir kasa oturumu var. Yeni kasa açmak için önce mevcut kasayı kapatın.",
    );
  }

  // Kasa oturumu, acan kisinin vardiyasina baglanir (varsa). Vardiya
  // ZORUNLU DEGILDIR: patron vardiya acmadan kasa sayabilir.
  const vardiya = await acikVardiya(actor.id);

  let oturum;
  try {
    oturum = await prisma.cashDrawerSession.create({
      data: {
        shiftId: vardiya?.id ?? null,
        openedById: actor.id,
        openingFloat: kurusToDecimalString(istek.acilisNakdiKurus),
        status: "OPEN",
        notes: istek.not?.trim() || null,
      },
    });
  } catch (hata) {
    // Esszamanli ikinci istek: veritabani kismi unique indeksi reddetti.
    if (hata instanceof Prisma.PrismaClientKnownRequestError && hata.code === "P2002") {
      throw new IslemHatasi(
        "KASA_ACIK",
        "Aynı anda başka bir kasa oturumu açıldı. Ekranı yenileyip tekrar bakın.",
      );
    }
    throw hata;
  }

  await writeAudit({
    action: AUDIT_ACTIONS.DRAWER_OPEN,
    entityType: "CashDrawerSession",
    entityId: oturum.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: {
      acilisNakdiKurus: istek.acilisNakdiKurus,
      vardiyaId: vardiya?.id ?? null,
      acanKisi: actor.username,
    },
    note: istek.not?.trim() || null,
  });

  return oturum;
}

// ---------------------------------------------------------------------------
// KASA KAPAT (SAYIM)
// ---------------------------------------------------------------------------

export interface KasaKapatIstegi {
  cashDrawerSessionId: string;
  /** Personelin FIILEN saydigi nakit (kurus). */
  sayilanNakitKurus: number;
  /** POS dekont toplami (kurus). Girilmezse kart karsilastirmasi yapilmaz. */
  beyanEdilenKartKurus?: number | null;
  /** Fark varsa ZORUNLU gerekce. */
  farkSebebi?: string | null;
  not?: string | null;
}

export interface KasaKapanisSonucu {
  cashDrawerSessionId: string;
  dokum: KasaDokumu;
  sayilanNakit: number;
  nakitFarki: number;
  beyanEdilenKart: number | null;
  kartFarki: number | null;
  /** Fark var mi? (nakit veya kart) */
  farkVarMi: boolean;
}

/**
 * Kasayi kapatir ve farki kayda gecirir.
 *
 * FARK GIZLENMEZ: beklenen ile sayilan arasindaki fark hesaplanir, kayda
 * yazilir ve denetim kaydina dusurulur. Fark varsa gerekce ZORUNLUDUR.
 * Kasa yine de kapatilir - personelin kasayi kapatamamasi, sayimi hic
 * yapmamasindan daha kotudur.
 */
export async function kasaKapat(
  actor: SessionUser,
  istek: KasaKapatIstegi,
): Promise<KasaKapanisSonucu> {
  if (istek.sayilanNakitKurus < 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Sayılan nakit negatif olamaz.");
  }
  if ((istek.beyanEdilenKartKurus ?? 0) < 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Kart dekont toplamı negatif olamaz.");
  }

  const oturum = await prisma.cashDrawerSession.findUnique({
    where: { id: istek.cashDrawerSessionId },
  });
  if (!oturum) throw new IslemHatasi("KASA_YOK", "Kasa oturumu bulunamadı.");
  if (oturum.status !== "OPEN") {
    throw new IslemHatasi("KASA_KAPALI", "Bu kasa oturumu zaten kapatılmış.");
  }

  // --- BEKLENEN TUTAR SUNUCUDA HESAPLANIR ---
  const dokum = await kasaDokumu(oturum.id);
  const nakitFarki = istek.sayilanNakitKurus - dokum.beklenenNakit;
  const beyanEdilenKart = istek.beyanEdilenKartKurus ?? null;
  const kartFarki = beyanEdilenKart === null ? null : beyanEdilenKart - dokum.beklenenKart;

  const farkVarMi = nakitFarki !== 0 || (kartFarki !== null && kartFarki !== 0);
  const sebep = istek.farkSebebi?.trim() ?? "";
  if (farkVarMi && sebep.length < 3) {
    throw new IslemHatasi(
      "FARK_SEBEBI",
      nakitFarki !== 0
        ? `Kasada ${formatFark(nakitFarki)} fark var. Gerekçe girmeniz zorunludur.`
        : "Kart dekont toplamı sistemle uyuşmuyor. Gerekçe girmeniz zorunludur.",
    );
  }

  const simdi = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.cashDrawerSession.update({
      where: { id: oturum.id },
      data: {
        status: "CLOSED",
        closedAt: simdi,
        closedById: actor.id,
        expectedCash: kurusToDecimalString(dokum.beklenenNakit),
        countedCash: kurusToDecimalString(istek.sayilanNakitKurus),
        expectedCard: kurusToDecimalString(dokum.beklenenKart),
        declaredCard: beyanEdilenKart === null ? null : kurusToDecimalString(beyanEdilenKart),
        differenceReason: farkVarMi ? sebep : null,
        notes: [oturum.notes, istek.not?.trim() || null].filter(Boolean).join(" · ") || null,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.DRAWER_CLOSE,
        entityType: "CashDrawerSession",
        entityId: oturum.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { acilisNakdiKurus: dokum.acilisNakdi },
        after: {
          beklenenNakitKurus: dokum.beklenenNakit,
          sayilanNakitKurus: istek.sayilanNakitKurus,
          nakitFarkiKurus: nakitFarki,
          beklenenKartKurus: dokum.beklenenKart,
          beyanEdilenKartKurus: beyanEdilenKart,
          kartFarkiKurus: kartFarki,
          dokum,
        },
        note: farkVarMi ? `KASA FARKI: ${sebep}` : null,
      },
      tx,
    );
  });

  return {
    cashDrawerSessionId: oturum.id,
    dokum,
    sayilanNakit: istek.sayilanNakitKurus,
    nakitFarki,
    beyanEdilenKart,
    kartFarki,
    farkVarMi,
  };
}

/**
 * Kapanmis kasayi "mutabakat yapildi" (RECONCILED) olarak isaretler.
 * Yalnizca patron/yonetici yapar; kasa farkinin incelenip kapatildigini
 * gosterir. Tutarlara DOKUNMAZ.
 */
export async function kasaMutabakat(
  actor: SessionUser,
  istek: { cashDrawerSessionId: string; not?: string | null },
) {
  const oturum = await prisma.cashDrawerSession.findUnique({
    where: { id: istek.cashDrawerSessionId },
  });
  if (!oturum) throw new IslemHatasi("KASA_YOK", "Kasa oturumu bulunamadı.");
  if (oturum.status === "OPEN") {
    throw new IslemHatasi("KASA_ACIK", "Açık kasa için mutabakat yapılamaz. Önce kapatın.");
  }
  if (oturum.status === "RECONCILED") {
    throw new IslemHatasi("ZATEN_MUTABIK", "Bu kasa oturumunun mutabakatı yapılmış.");
  }

  const guncel = await prisma.cashDrawerSession.update({
    where: { id: oturum.id },
    data: {
      status: "RECONCILED",
      notes: [oturum.notes, istek.not?.trim() || null].filter(Boolean).join(" · ") || null,
    },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.DRAWER_RECONCILE,
    entityType: "CashDrawerSession",
    entityId: oturum.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { durum: oturum.status },
    after: { durum: "RECONCILED" },
    note: istek.not?.trim() || null,
  });

  return guncel;
}

function formatFark(kurus: number): string {
  const lira = Math.abs(kurus) / 100;
  const metin = lira.toLocaleString("tr-TR", { minimumFractionDigits: 2 });
  return kurus > 0 ? `${metin} ₺ FAZLA` : `${metin} ₺ EKSİK`;
}
