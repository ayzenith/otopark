/**
 * GIDER KAYITLARI
 *
 * ============================================================================
 * GIDER SILINMEZ (mimari kural 4). Hatali gider VOIDED + gerekce ile iptal
 * edilir; veritabani tetikleyicisi DELETE'i reddeder.
 *
 * NAKIT GIDER VE KASA: gider nakit odendiyse ve o anda ACIK KASA varsa, gider
 * kasa oturumuna baglanir ve beklenen nakitten DUSULUR. Bunun icin AYRICA
 * kasa hareketi URETILMEZ - ikisini birlikte yapmak beklenen nakdi iki kez
 * dusurur (Asama 2'de tahsilat iptalinde yasanan cifte muhasebe hatasinin
 * kasa karsiligi).
 *
 * KART/HAVALE GIDER kasa nakdini etkilemez; kasa oturumuna baglanmaz.
 *
 * TUTAR ISTEMCIDEN ALINIR - cunku gider bir HESAPLAMA DEGIL, dis dunyadan
 * gelen bir olgudur (fatura tutari). Bu yuzden gider girisi IZNE baglidir
 * (finance.expense.create) ve her kayit denetime yazilir.
 * ============================================================================
 */

import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";
import { IslemHatasi } from "@/server/errors";
import { kurusToDecimalString, toKurus } from "@/lib/money";
import { giderKodu } from "@/server/cash/codes";
import { acikKasaId } from "@/server/cash/drawer";
import type { SessionUser } from "@/server/auth/session";

export interface GiderIstegi {
  expenseCategoryId: string;
  tutarKurus: number;
  /** Giderin ait oldugu tarih (fatura tarihi). Gelecege tarihlenemez. */
  giderTarihi: Date;
  odemeYontemi: PaymentMethod;
  aciklama: string;
  tedarikci?: string | null;
  belgeNo?: string | null;
  /** Personel gideri (maas/avans/prim) ise ilgili personel. */
  ilgiliKullaniciId?: string | null;
  /**
   * Nakit gider kasadan mi odendi?
   *
   * true (varsayilan): acik kasa varsa gidere baglanir ve beklenen nakitten
   * dusulur. false: kasa disindan odendi (patron cebinden), kasa etkilenmez.
   */
  kasadanOdendi?: boolean;
  idempotencyKey: string;
}

export interface GiderSonucu {
  expenseId: string;
  kod: string;
  tutarKurus: number;
  kasaOturumuId: string | null;
  tekrarEdenIstek: boolean;
}

export async function giderKaydet(actor: SessionUser, istek: GiderIstegi): Promise<GiderSonucu> {
  // --- IDEMPOTENCY (mimari kural 7) ---
  // Ayni anahtarla gelen ikinci istek YENI GIDER URETMEZ; ilk kaydin
  // sonucu dondurulur. Personel "kaydet"e iki kez bastiginda gider iki
  // kez yazilmaz.
  const onceki = await prisma.expense.findUnique({
    where: { idempotencyKey: istek.idempotencyKey },
  });
  if (onceki) {
    return {
      expenseId: onceki.id,
      kod: onceki.code,
      tutarKurus: toKurus(onceki.amount),
      kasaOturumuId: onceki.cashDrawerSessionId,
      tekrarEdenIstek: true,
    };
  }

  const aciklama = istek.aciklama.trim();
  if (aciklama.length < 3) {
    throw new IslemHatasi("ACIKLAMA_ZORUNLU", "Gider açıklaması zorunludur.");
  }
  if (!Number.isInteger(istek.tutarKurus) || istek.tutarKurus <= 0) {
    throw new IslemHatasi("GECERSIZ_TUTAR", "Gider tutarı sıfırdan büyük olmalıdır.");
  }
  // Gelecege tarihli gider, gunluk ve aylik raporlari bozar.
  if (istek.giderTarihi.getTime() > Date.now() + 86_400_000) {
    throw new IslemHatasi("GELECEK_TARIH", "Gider tarihi ileri bir güne verilemez.");
  }

  const kategori = await prisma.expenseCategory.findUnique({
    where: { id: istek.expenseCategoryId },
  });
  if (!kategori) throw new IslemHatasi("KATEGORI_YOK", "Gider kategorisi bulunamadı.");
  if (!kategori.isActive) {
    throw new IslemHatasi("KATEGORI_PASIF", `"${kategori.name}" kategorisi kullanım dışı.`);
  }

  // Nakit gider + acik kasa => kasaya baglanir. Kart/havale kasayi etkilemez.
  const kasadanOdendi = istek.kasadanOdendi !== false && istek.odemeYontemi === "CASH";
  const kasaOturumuId = kasadanOdendi ? await acikKasaId() : null;

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const gider = await tx.expense.create({
      data: {
        code: await giderKodu(tx, simdi),
        expenseCategoryId: kategori.id,
        amount: kurusToDecimalString(istek.tutarKurus),
        expenseDate: istek.giderTarihi,
        paymentMethod: istek.odemeYontemi,
        description: aciklama,
        supplierName: istek.tedarikci?.trim() || null,
        documentNo: istek.belgeNo?.trim() || null,
        relatedUserId: istek.ilgiliKullaniciId || null,
        cashDrawerSessionId: kasaOturumuId,
        status: "CONFIRMED",
        idempotencyKey: istek.idempotencyKey,
        createdById: actor.id,
      },
    });

    await writeAudit(
      {
        action: AUDIT_ACTIONS.EXPENSE_CREATE,
        entityType: "Expense",
        entityId: gider.id,
        userId: actor.id,
        actorLabel: actor.username,
        after: {
          kod: gider.code,
          kategori: kategori.name,
          tutarKurus: istek.tutarKurus,
          giderTarihi: istek.giderTarihi,
          yontem: istek.odemeYontemi,
          kasaOturumuId,
          tedarikci: gider.supplierName,
          belgeNo: gider.documentNo,
        },
        note: aciklama,
      },
      tx,
    );

    return {
      expenseId: gider.id,
      kod: gider.code,
      tutarKurus: istek.tutarKurus,
      kasaOturumuId,
      tekrarEdenIstek: false,
    };
  });
}

/**
 * Gideri iptal eder (VOIDED + gerekce). SATIR SILINMEZ.
 *
 * Gidere bagli kasa hareketleri ve stok hareketleri de etkilenir:
 *  - bagli kasa hareketleri VOIDED olur,
 *  - bagli STOK hareketleri DEGISMEZ: malzeme fiilen depoya girdiyse iptal
 *    edilen gider onu geri cikarmaz. Stok duzeltmesi ayri ADJUSTMENT
 *    hareketiyle yapilir ve kullaniciya bu acikca soylenir.
 */
export async function giderIptal(
  actor: SessionUser,
  istek: { expenseId: string; sebep: string },
) {
  const sebep = istek.sebep.trim();
  if (sebep.length < 3) throw new IslemHatasi("SEBEP_ZORUNLU", "İptal gerekçesi zorunludur.");

  const gider = await prisma.expense.findUnique({
    where: { id: istek.expenseId },
    include: {
      cashDrawerSession: { select: { id: true, status: true } },
      cashMovements: { where: { status: "CONFIRMED" } },
      inventoryMovements: { select: { id: true } },
    },
  });
  if (!gider) throw new IslemHatasi("GIDER_YOK", "Gider kaydı bulunamadı.");
  if (gider.status === "VOIDED") {
    throw new IslemHatasi("ZATEN_IPTAL", "Bu gider daha önce iptal edilmiş.");
  }
  // Kapanmis kasanin gideri iptal edilirse, imzalanmis sayim geriye donuk
  // degisir ve kasa farki aciklanamaz hale gelir.
  if (gider.cashDrawerSession && gider.cashDrawerSession.status !== "OPEN") {
    throw new IslemHatasi(
      "KASA_KAPALI",
      "Bu gider kapatılmış bir kasa oturumuna ait. Geriye dönük iptal kasa sayımını " +
        "bozar; düzeltmeyi yeni kasa oturumunda düzeltme hareketiyle yapın.",
    );
  }

  const simdi = new Date();

  return prisma.$transaction(async (tx) => {
    const guncel = await tx.expense.update({
      where: { id: gider.id },
      data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
    });

    // Gidere bagli kasa hareketleri de gecersiz kilinir.
    if (gider.cashMovements.length > 0) {
      await tx.cashMovement.updateMany({
        where: { expenseId: gider.id, status: "CONFIRMED" },
        data: { status: "VOIDED", voidedAt: simdi, voidedById: actor.id, voidReason: sebep },
      });
    }

    await writeAudit(
      {
        action: AUDIT_ACTIONS.EXPENSE_VOID,
        entityType: "Expense",
        entityId: gider.id,
        userId: actor.id,
        actorLabel: actor.username,
        before: { durum: "CONFIRMED", tutarKurus: toKurus(gider.amount) },
        after: {
          durum: "VOIDED",
          iptalEdilenKasaHareketi: gider.cashMovements.length,
          // Stok hareketleri KASITLI OLARAK degistirilmez.
          dokunulmayanStokHareketi: gider.inventoryMovements.length,
        },
        note: sebep,
      },
      tx,
    );

    return {
      expenseId: guncel.id,
      kod: guncel.code,
      iptalEdilenKasaHareketi: gider.cashMovements.length,
      /** Bu giderle depoya girmis malzeme hareketleri - stok ELLE duzeltilmeli. */
      elleDuzeltilmesiGerekenStokHareketi: gider.inventoryMovements.length,
    };
  });
}

// ---------------------------------------------------------------------------
// KATEGORI YONETIMI (patron)
// ---------------------------------------------------------------------------

export async function giderKategorileri(yalnizcaAktif = true) {
  return prisma.expenseCategory.findMany({
    where: yalnizcaAktif ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function giderKategorisiOlustur(
  actor: SessionUser,
  girdi: { ad: string; siraNo?: number },
) {
  const ad = girdi.ad.trim();
  if (ad.length < 2) {
    throw new IslemHatasi("GECERSIZ_AD", "Kategori adı en az 2 karakter olmalıdır.");
  }

  // Kod addan uretilir; cakisirsa sonuna sayi eklenir.
  const temelKod = ad
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞİÖŞÜ]/g, (h) => ({ Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U" })[h]!)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "KATEGORI";

  let kod = temelKod;
  for (let i = 2; await prisma.expenseCategory.findUnique({ where: { code: kod } }); i++) {
    kod = `${temelKod}_${i}`;
  }

  const kategori = await prisma.expenseCategory.create({
    data: { code: kod, name: ad, isSystem: false, isActive: true, sortOrder: girdi.siraNo ?? 500 },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "ExpenseCategory",
    entityId: kategori.id,
    userId: actor.id,
    actorLabel: actor.username,
    after: { kod: kategori.code, ad: kategori.name },
    note: "Gider kategorisi eklendi",
  });

  return kategori;
}

/**
 * Kategoriyi kullanim dışına alir / geri acar.
 *
 * SILINMEZ: eski gider kayitlari kategorisini kaybetmemelidir. Sistem
 * kategorileri (isSystem) de pasifleştirilebilir ama silinemez.
 */
export async function giderKategorisiDurum(
  actor: SessionUser,
  girdi: { id: string; aktif: boolean },
) {
  const onceki = await prisma.expenseCategory.findUnique({ where: { id: girdi.id } });
  if (!onceki) throw new IslemHatasi("KATEGORI_YOK", "Gider kategorisi bulunamadı.");

  const kategori = await prisma.expenseCategory.update({
    where: { id: girdi.id },
    data: { isActive: girdi.aktif },
  });

  await writeAudit({
    action: AUDIT_ACTIONS.SETTINGS_UPDATE,
    entityType: "ExpenseCategory",
    entityId: kategori.id,
    userId: actor.id,
    actorLabel: actor.username,
    before: { aktif: onceki.isActive },
    after: { aktif: kategori.isActive },
    note: girdi.aktif ? "Gider kategorisi açıldı" : "Gider kategorisi kullanım dışına alındı",
  });

  return kategori;
}
