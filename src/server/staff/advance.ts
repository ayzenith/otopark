/**
 * PERSONEL AVANSI VE MAAŞ ÖDEMESİ
 *
 * ============================================================================
 * KARAR (05.10.2026): AVANS GİDER DEĞİL, MAAŞTAN DÜŞÜLECEK ALACAKTIR.
 * ----------------------------------------------------------------------------
 * Avans verildiğinde:
 *   · kasadan para ÇIKAR      -> CashMovement (ADVANCE / OUT)
 *   · gider YAZILMAZ          -> gider raporunda görünmez
 *   · işletmenin ALACAĞI olur -> StaffAdvance (OPEN)
 *
 * Maaş ödenirken:
 *   · giderin tamamı maaşın kendisidir  -> Expense.amount = maaş
 *   · daha önce avans olarak ödenen kısım mahsup edilir
 *                                       -> Expense.advanceOffsetAmount
 *   · kasadan o an çıkan para           = amount - advanceOffsetAmount
 *
 * Örnek: 10.000 ₺ maaş, önceden 500 ₺ avans.
 *   avans anı : kasa −500, gider 0, alacak 500
 *   maaş anı  : gider 10.000, kasa −9.500, alacak 0
 *   TOPLAM    : gider 10.000, kasa −10.000  ✓ (ne eksik ne fazla)
 *
 * Bu alan olmadan ya avans kasadan iki kez düşülür ya da maaş gideri eksik
 * yazılır. `AVANS` gider kategorisi bu yüzden KULLANIM DIŞIDIR.
 *
 * SİLİNMEZ (mimari kural 4): hatalı avans VOIDED + gerekçe; DB tetikleyicisi
 * DELETE'i reddeder.
 * ============================================================================
 */

import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { businessDayRange } from "@/lib/datetime";
import { buildCode } from "@/lib/utils";
import { acikKasaId } from "@/server/cash/drawer";
import { giderKodu } from "@/server/cash/codes";
import type { SessionUser } from "@/server/auth/session";

/** Avans kodu: V-261005-0003 */
async function avansKodu(
  db: Prisma.TransactionClient | typeof prisma,
  anında = new Date(),
): Promise<string> {
  const { start, end } = businessDayRange(anında);
  const adet = await db.staffAdvance.count({ where: { createdAt: { gte: start, lt: end } } });
  return buildCode("V", anında, adet + 1);
}

// ---------------------------------------------------------------------------
// AVANS VER
// ---------------------------------------------------------------------------

export interface AvansIstegi {
  /** Avansı alan personel. */
  userId: string;
  tutarKurus: number;
  not?: string | null;
  /**
   * Para kasadan mı verildi?
   *
   * true (varsayılan): açık kasa varsa kasa hareketi üretilir ve beklenen
   * nakit azalır. false: kasa dışından verildi (patron cebinden); alacak
   * yine kaydedilir ama kasa etkilenmez.
   */
  kasadanVerildi?: boolean;
  idempotencyKey: string;
}

export interface AvansSonucu {
  staffAdvanceId: string;
  kod: string;
  tutarKurus: number;
  kasaHareketiId: string | null;
  /** Bu personelin toplam açık avans borcu (bu avans dahil). */
  acikBakiyeKurus: number;
  tekrarEdenIstek: boolean;
}

export async function avansVer(actor: SessionUser, istek: AvansIstegi): Promise<AvansSonucu> {
  // Idempotency (mimari kural 7): aynı anahtarla ikinci istek yeni avans
  // ÜRETMEZ; aksi halde personele iki kez avans borcu yazılırdı.
  const onceki = await prisma.staffAdvance.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
  });
  if (onceki) {
    return {
      staffAdvanceId: onceki.id,
      kod: onceki.code,
      tutarKurus: toKurus(onceki.amount),
      kasaHareketiId: onceki.cashMovementId,
      acikBakiyeKurus: await acikAvansBakiyesi(onceki.userId),
      tekrarEdenIstek: true,
    };
  }

  if (!Number.isInteger(istek.tutarKurus) || istek.tutarKurus <= 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Avans tutarı sıfırdan büyük olmalıdır.");
  }

  const personel = await prisma.user.findUnique({
    where: { id: istek.userId },
    select: { id: true, fullName: true, username: true, isActive: true },
  });
  if (!personel) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");
  if (!personel.isActive) {
    throw new IslemHatasi(
      "PERSONEL_PASIF",
      `${personel.fullName} kullanım dışı bir hesap. Avans vermek için hesabı yeniden etkinleştirin.`,
    );
  }

  const kasadan = istek.kasadanVerildi !== false;
  const kasaId = kasadan ? await acikKasaId() : null;
  const simdi = new Date();

  const sonuc = await prisma.$transaction(async (tx) => {
    let kasaHareketiId: string | null = null;

    if (kasaId) {
      // Kasa hareketi: tutar POZİTİF, yön OUT (mimari kural 15).
      const hareket = await tx.cashMovement.create({
        data: {
          cashDrawerSessionId: kasaId,
          type: "ADVANCE",
          direction: "OUT",
          amount: kurusToDecimalString(istek.tutarKurus),
          description: `Personel avansı — ${personel.fullName}${
            istek.not?.trim() ? ` · ${istek.not.trim()}` : ""
          }`,
          status: "CONFIRMED",
          idempotencyKey: `${istek.idempotencyKey}-kasa`,
          createdById: actor.id,
        },
        select: { id: true },
      });
      kasaHareketiId = hareket.id;
    }

    const avans = await tx.staffAdvance.create({
      data: {
        code: await avansKodu(tx, simdi),
        userId: personel.id,
        amount: kurusToDecimalString(istek.tutarKurus),
        givenAt: simdi,
        status: "OPEN",
        note: istek.not?.trim() || null,
        cashMovementId: kasaHareketiId,
        idempotencyKey: istek.idempotencyKey,
        createdById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.STAFF_ADVANCE_GIVE,
        entityType: "StaffAdvance",
        entityId: avans.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: avans.code,
          personel: personel.username,
          personelAdi: personel.fullName,
          tutarKurus: istek.tutarKurus,
          kasaHareketiId,
          kasaOturumuId: kasaId,
          // Avans GIDER DEGIL: denetim kaydina da boyle yazilir.
          giderMi: false,
        },
        note:
          istek.not?.trim() ||
          "Personel avansı verildi (gider değil, maaştan düşülecek alacak)",
      },
      tx,
    );

    return { avans, kasaHareketiId };
  });

  return {
    staffAdvanceId: sonuc.avans.id,
    kod: sonuc.avans.code,
    tutarKurus: istek.tutarKurus,
    kasaHareketiId: sonuc.kasaHareketiId,
    acikBakiyeKurus: await acikAvansBakiyesi(personel.id),
    tekrarEdenIstek: false,
  };
}

/** Bir personelin mahsup edilmemiş (OPEN) avans borcu toplamı. */
export async function acikAvansBakiyesi(userId: string): Promise<number> {
  const sonuc = await prisma.staffAdvance.aggregate({
    where: { userId, status: "OPEN" },
    _sum: { amount: true },
  });
  return toKurus(sonuc._sum.amount);
}

/** Personelin açık avansları (maaş ödemesinde mahsup için seçilir). */
export async function acikAvanslar(userId: string) {
  const liste = await prisma.staffAdvance.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { givenAt: "asc" },
  });
  return liste.map((a) => ({
    id: a.id,
    kod: a.code,
    tutar: toKurus(a.amount),
    verilisAt: a.givenAt,
    not: a.note,
  }));
}

// ---------------------------------------------------------------------------
// AVANS İPTALİ
// ---------------------------------------------------------------------------

/**
 * Hatalı avans kaydını iptal eder.
 *
 * SATIR SİLİNMEZ: VOIDED + gerekçe. Avansa bağlı kasa hareketi de iptal edilir
 * ki beklenen nakit geri yükselsin — para fiilen verilmediyse kasada duruyor
 * demektir.
 *
 * MAHSUP EDİLMİŞ avans iptal EDİLEMEZ: maaş gideri ona dayanıyor, geriye
 * dönük iptal maaş kaydını tutarsız bırakır.
 */
export async function avansIptal(
  actor: SessionUser,
  istek: { staffAdvanceId: string; sebep: string },
) {
  const sebep = istek.sebep.trim();
  if (sebep.length < 3) throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");

  const avans = await prisma.staffAdvance.findUnique({
    where: { id: istek.staffAdvanceId },
    include: {
      user: { select: { username: true, fullName: true } },
      cashMovement: { select: { id: true, cashDrawerSession: { select: { status: true } } } },
    },
  });
  if (!avans) throw new IslemHatasi("AVANS_YOK", "Avans kaydı bulunamadı.");
  if (avans.status === "VOIDED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu avans daha önce iptal edilmiş.");
  }
  if (avans.status === "SETTLED") {
    throw new IslemHatasi(
      "MAHSUP_EDILMIS",
      "Bu avans bir maaş ödemesiyle mahsup edilmiş; geriye dönük iptal edilemez. " +
        "Düzeltme için maaş gideriyle birlikte değerlendirin.",
    );
  }
  // Kapanmış kasanın hareketini iptal etmek imzalanmış sayımı bozar.
  if (avans.cashMovement && avans.cashMovement.cashDrawerSession.status !== "OPEN") {
    throw new IslemHatasi(
      "KASA_KAPALI",
      "Bu avans kapatılmış bir kasa oturumundan verildi. Geriye dönük iptal kasa " +
        "sayımını bozar; düzeltmeyi yeni kasa oturumunda düzeltme hareketiyle yapın.",
    );
  }

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.staffAdvance.update({
      where: { id: avans.id },
      data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
    });

    if (avans.cashMovementId) {
      await tx.cashMovement.update({
        where: { id: avans.cashMovementId },
        data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
      });
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.STAFF_ADVANCE_VOID,
        entityType: "StaffAdvance",
        entityId: avans.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: "OPEN", tutarKurus: toKurus(avans.amount) },
        after: { durum: "VOIDED", iptalEdilenKasaHareketi: avans.cashMovementId },
        note: sebep,
      },
      tx,
    );

    return { staffAdvanceId: guncel.id, kod: guncel.code };
  });
}

// ---------------------------------------------------------------------------
// MAAŞ ÖDEMESİ (avans mahsuplu)
// ---------------------------------------------------------------------------

export interface MaasOdemeIstegi {
  userId: string;
  /** Maaşın TAMAMI (gerçekleşen maliyet), kuruş. */
  maasKurus: number;
  /** Giderin ait olduğu tarih. */
  odemeTarihi: Date;
  odemeYontemi: PaymentMethod;
  /** Mahsup edilecek açık avanslar. Boş liste = mahsup yok. */
  mahsupAvansIdleri?: string[];
  aciklama?: string | null;
  /** Nakit ödemede kasadan mı ödendi? */
  kasadanOdendi?: boolean;
  idempotencyKey: string;
}

export interface MaasOdemeSonucu {
  expenseId: string;
  kod: string;
  /** Gider olarak yazılan tutar = maaşın tamamı. */
  giderKurus: number;
  /** Avanslardan mahsup edilen kısım. */
  mahsupKurus: number;
  /** Kasadan/hesaptan o an çıkan tutar. */
  odenenKurus: number;
  mahsupEdilenAvansSayisi: number;
  kasaOturumuId: string | null;
  tekrarEdenIstek: boolean;
}

export async function maasOde(
  actor: SessionUser,
  istek: MaasOdemeIstegi,
): Promise<MaasOdemeSonucu> {
  const onceki = await prisma.expense.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
    include: { settledAdvances: { select: { id: true } } },
  });
  if (onceki) {
    const mahsup = toKurus(onceki.advanceOffsetAmount);
    return {
      expenseId: onceki.id,
      kod: onceki.code,
      giderKurus: toKurus(onceki.amount),
      mahsupKurus: mahsup,
      odenenKurus: toKurus(onceki.amount) - mahsup,
      mahsupEdilenAvansSayisi: onceki.settledAdvances.length,
      kasaOturumuId: onceki.cashDrawerSessionId,
      tekrarEdenIstek: true,
    };
  }

  if (!Number.isInteger(istek.maasKurus) || istek.maasKurus <= 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Maaş tutarı sıfırdan büyük olmalıdır.");
  }
  if (istek.odemeTarihi.getTime() > Date.now() + 86_400_000) {
    throw new IslemHatasi("GELECEK_TARIH", "Ödeme tarihi ileri bir güne verilemez.");
  }

  const personel = await prisma.user.findUnique({
    where: { id: istek.userId },
    select: { id: true, fullName: true, username: true },
  });
  if (!personel) throw new IslemHatasi("PERSONEL_YOK", "Personel bulunamadı.");

  const kategori = await prisma.expenseCategory.findUnique({ where: { code: "MAAS" } });
  if (!kategori) {
    throw new IslemHatasi(
      "KATEGORI_YOK",
      "Maaş gider kategorisi bulunamadı. `npm run db:seed` çalıştırılmalı.",
    );
  }

  const mahsupIdleri = [...new Set(istek.mahsupAvansIdleri ?? [])];
  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    // --- MAHSUP EDİLECEK AVANSLARI KİLİTLE ---
    // Eşzamanlı iki maaş ödemesi aynı avansı iki kez mahsup edemesin.
    let mahsupKurus = 0;
    if (mahsupIdleri.length > 0) {
      const kilitli = await tx.$queryRaw<
        { id: string; userId: string; status: string; amount: Prisma.Decimal }[]
      >`SELECT id, "userId", status, amount FROM "StaffAdvance" WHERE id = ANY(${mahsupIdleri}::text[]) FOR UPDATE`;

      if (kilitli.length !== mahsupIdleri.length) {
        throw new IslemHatasi("AVANS_YOK", "Mahsup edilecek avanslardan biri bulunamadı.");
      }
      for (const a of kilitli) {
        if (a.userId !== personel.id) {
          throw new IslemHatasi(
            "AVANS_BASKA_PERSONEL",
            "Başka bir personelin avansı bu maaştan düşülemez.",
          );
        }
        if (a.status !== "OPEN") {
          throw new IslemHatasi(
            "AVANS_KAPALI",
            "Seçilen avanslardan biri zaten mahsup edilmiş veya iptal edilmiş.",
          );
        }
        mahsupKurus += toKurus(a.amount);
      }

      // Mahsup maaştan büyük olamaz: kasadan negatif para çıkamaz.
      if (mahsupKurus > istek.maasKurus) {
        throw new IslemHatasi(
          "MAHSUP_FAZLA",
          `Seçilen avanslar (${(mahsupKurus / 100).toLocaleString("tr-TR")} ₺) maaştan ` +
            `(${(istek.maasKurus / 100).toLocaleString("tr-TR")} ₺) fazla. ` +
            "Daha az avans seçin veya maaşı kısmi ödeyin.",
        );
      }
    }

    const odenecek = istek.maasKurus - mahsupKurus;

    // Nakit ödeme + açık kasa => kasaya bağlanır. Kasa dökümü, kasadan çıkan
    // tutarı `amount - advanceOffsetAmount` olarak hesaplar.
    const kasadan = istek.kasadanOdendi !== false && istek.odemeYontemi === "CASH";
    const kasaId = kasadan ? await acikKasaId(tx) : null;

    const gider = await tx.expense.create({
      data: {
        code: await giderKodu(tx, simdi),
        expenseCategoryId: kategori.id,
        amount: kurusToDecimalString(istek.maasKurus),
        advanceOffsetAmount: kurusToDecimalString(mahsupKurus),
        expenseDate: istek.odemeTarihi,
        paymentMethod: istek.odemeYontemi,
        description:
          istek.aciklama?.trim() ||
          `${personel.fullName} maaş ödemesi` +
            (mahsupKurus > 0
              ? ` (${(mahsupKurus / 100).toLocaleString("tr-TR")} ₺ avans mahsup edildi)`
              : ""),
        relatedUserId: personel.id,
        cashDrawerSessionId: kasaId,
        status: "CONFIRMED",
        idempotencyKey: istek.idempotencyKey,
        createdById: actor.id,
      },
    });

    if (mahsupIdleri.length > 0) {
      await tx.staffAdvance.updateMany({
        where: { id: { in: mahsupIdleri } },
        data: { status: "SETTLED", settledByExpenseId: gider.id, settledAt: simdi },
      });
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.STAFF_SALARY_PAY,
        entityType: "Expense",
        entityId: gider.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: gider.code,
          personel: personel.username,
          personelAdi: personel.fullName,
          maasKurus: istek.maasKurus,
          mahsupKurus,
          odenenKurus: odenecek,
          mahsupEdilenAvanslar: mahsupIdleri,
          yontem: istek.odemeYontemi,
          kasaOturumuId: kasaId,
        },
        note:
          mahsupKurus > 0
            ? `Maaş ödendi; ${(mahsupKurus / 100).toLocaleString("tr-TR")} ₺ avans mahsup edildi`
            : "Maaş ödendi",
      },
      tx,
    );

    return {
      expenseId: gider.id,
      kod: gider.code,
      giderKurus: istek.maasKurus,
      mahsupKurus,
      odenenKurus: odenecek,
      mahsupEdilenAvansSayisi: mahsupIdleri.length,
      kasaOturumuId: kasaId,
      tekrarEdenIstek: false,
    };
  });
}

// ---------------------------------------------------------------------------
// SORGULAR
// ---------------------------------------------------------------------------

export interface AvansSatiri {
  id: string;
  kod: string;
  personelId: string;
  personelAdi: string;
  tutar: number;
  verilisAt: Date;
  durum: "OPEN" | "SETTLED" | "VOIDED";
  not: string | null;
  mahsupGiderKodu: string | null;
  mahsupAt: Date | null;
  iptalSebebi: string | null;
  verenKisi: string | null;
  /** Kasadan mı verildi? (kasa hareketi var mı) */
  kasadanMi: boolean;
}

export async function avansListesi(
  opts: { userId?: string; yalnizcaAcik?: boolean; limit?: number } = {},
): Promise<AvansSatiri[]> {
  const liste = await prisma.staffAdvance.findMany({
    where: {
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.yalnizcaAcik ? { status: "OPEN" } : {}),
    },
    orderBy: [{ givenAt: "desc" }],
    take: opts.limit ?? 100,
    include: {
      user: { select: { fullName: true, username: true } },
      createdBy: { select: { fullName: true, username: true } },
      settledByExpense: { select: { code: true } },
    },
  });

  return liste.map((a) => ({
    id: a.id,
    kod: a.code,
    personelId: a.userId,
    personelAdi: a.user.fullName || a.user.username,
    tutar: toKurus(a.amount),
    verilisAt: a.givenAt,
    durum: a.status,
    not: a.note,
    mahsupGiderKodu: a.settledByExpense?.code ?? null,
    mahsupAt: a.settledAt,
    iptalSebebi: a.voidReason,
    verenKisi: a.createdBy?.fullName ?? a.createdBy?.username ?? null,
    kasadanMi: a.cashMovementId !== null,
  }));
}

/** Personel bazında açık avans borcu özeti (patron paneli uyarı kartı). */
export async function acikAvansOzeti(): Promise<
  { personelId: string; personelAdi: string; adet: number; tutar: number }[]
> {
  const gruplar = await prisma.staffAdvance.groupBy({
    by: ["userId"],
    where: { status: "OPEN" },
    _sum: { amount: true },
    _count: true,
  });
  if (gruplar.length === 0) return [];

  const kisiler = await prisma.user.findMany({
    where: { id: { in: gruplar.map((g) => g.userId) } },
    select: { id: true, fullName: true, username: true },
  });
  const harita = new Map(kisiler.map((k) => [k.id, k.fullName || k.username]));

  return gruplar
    .map((g) => ({
      personelId: g.userId,
      personelAdi: harita.get(g.userId) ?? "—",
      adet: g._count,
      tutar: toKurus(g._sum.amount),
    }))
    .sort((a, b) => b.tutar - a.tutar);
}
