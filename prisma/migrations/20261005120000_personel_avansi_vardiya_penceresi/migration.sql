-- CreateEnum
CREATE TYPE "StaffAdvanceStatus" AS ENUM ('OPEN', 'SETTLED', 'VOIDED');

-- AlterTable
ALTER TABLE "BusinessSetting" ADD COLUMN     "shiftWindows" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "advanceOffsetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StaffAdvance" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StaffAdvanceStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "cashMovementId" TEXT,
    "settledByExpenseId" TEXT,
    "settledAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "StaffAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffAdvance_code_key" ON "StaffAdvance"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAdvance_cashMovementId_key" ON "StaffAdvance"("cashMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAdvance_idempotencyKey_key" ON "StaffAdvance"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StaffAdvance_userId_status_idx" ON "StaffAdvance"("userId", "status");

-- CreateIndex
CREATE INDEX "StaffAdvance_status_givenAt_idx" ON "StaffAdvance"("status", "givenAt");

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_settledByExpenseId_fkey" FOREIGN KEY ("settledByExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ===========================================================================
-- ASAMA 6 - PERSONEL AVANSI (ALACAK), VARDIYA PENCERELERI
-- Elle yazilan kisitlar, tetikleyiciler ve veri gocu.
-- ===========================================================================

-- --- TUTAR KISITLARI -----------------------------------------------------
ALTER TABLE "StaffAdvance"
  ADD CONSTRAINT "staff_advance_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "Expense"
  ADD CONSTRAINT "expense_advance_offset_non_negative"
  CHECK ("advanceOffsetAmount" >= 0);

-- Mahsup, giderin kendisinden buyuk olamaz: aksi halde kasadan NEGATIF para
-- cikmis gibi hesaplanir ("maas 1.000, mahsup 1.500" anlamsizdir).
ALTER TABLE "Expense"
  ADD CONSTRAINT "expense_advance_offset_not_above_amount"
  CHECK ("advanceOffsetAmount" <= "amount");

-- Mahsup edilmis avansin baglantisi ve tarihi ZORUNLU; acik avansin ise
-- olmamali. Yarim kayit "bu avans dusuldu mu?" sorusunu yanitsiz birakir.
ALTER TABLE "StaffAdvance"
  ADD CONSTRAINT "staff_advance_settled_consistency" CHECK (
    ("status" = 'SETTLED' AND "settledByExpenseId" IS NOT NULL AND "settledAt" IS NOT NULL)
    OR ("status" <> 'SETTLED' AND "settledByExpenseId" IS NULL AND "settledAt" IS NULL)
  );

-- Iptal edilen avansin gerekcesi ZORUNLU (mimari kural 4).
ALTER TABLE "StaffAdvance"
  ADD CONSTRAINT "staff_advance_void_reason" CHECK (
    ("status" = 'VOIDED' AND "voidReason" IS NOT NULL AND "voidedAt" IS NOT NULL)
    OR ("status" <> 'VOIDED')
  );

-- --- AVANS SILINMEZ ------------------------------------------------------
-- Avans isletmenin ALACAGIDIR; silinmesi "bu para kime gitti?" sorusunu
-- yanitlanamaz hale getirir. Hatali kayit VOIDED + gerekce ile iptal edilir.
CREATE TRIGGER "staff_advance_no_delete"
  BEFORE DELETE ON "StaffAdvance"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();

-- --- AVANS GIDER KATEGORISI KULLANIM DISINA ALINIR -----------------------
-- Karar (05.10.2026): avans GIDER DEGIL, alacaktir. Kategori acik kalirsa
-- patron avansi elle gider olarak girebilir ve tutar IKI KEZ sayilir
-- (bir kez avans olarak kasadan, bir kez maas giderinde). Kategori SILINMEZ
-- (gecmis kayitlar kategorisini kaybetmemeli), pasifleştirilir.
UPDATE "ExpenseCategory"
  SET "isActive" = false
  WHERE "code" = 'AVANS';
