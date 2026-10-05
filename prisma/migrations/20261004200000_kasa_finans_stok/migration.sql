-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN     "direction" "PaymentDirection" NOT NULL DEFAULT 'OUT',
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AlterTable
ALTER TABLE "OtherIncome" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- CreateIndex
CREATE INDEX "OtherIncome_status_idx" ON "OtherIncome"("status");


-- ===========================================================================
-- ASAMA 5 - KASA, GELIR/GIDER, MALZEME STOGU
-- Elle yazilan kisitlar ve tetikleyiciler (prisma migrate diff uretmez).
-- ===========================================================================

-- --- TUTAR VE MIKTAR KISITLARI -------------------------------------------
-- Para alanlari negatif olamaz. Kasa hareketinin YONU `direction` ile
-- tasinir, isaretli tutarla DEGIL; boylece "-500" gibi bir satir
-- hesaplamayi sessizce ters cevirmez.
ALTER TABLE "CashMovement"
  ADD CONSTRAINT "cash_movement_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "OtherIncome"
  ADD CONSTRAINT "other_income_amount_non_negative" CHECK ("amount" >= 0);

ALTER TABLE "CashDrawerSession"
  ADD CONSTRAINT "drawer_opening_float_non_negative" CHECK ("openingFloat" >= 0);

ALTER TABLE "CashDrawerSession"
  ADD CONSTRAINT "drawer_counted_cash_non_negative"
  CHECK ("countedCash" IS NULL OR "countedCash" >= 0);

ALTER TABLE "CashDrawerSession"
  ADD CONSTRAINT "drawer_declared_card_non_negative"
  CHECK ("declaredCard" IS NULL OR "declaredCard" >= 0);

-- Stok miktari negatife dusemez: eksik stokla tuketim girilemez.
ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "inventory_item_stock_non_negative" CHECK ("currentStock" >= 0);

-- Hareket miktari her zaman POZITIF buyukluktur; yonu `type` belirler
-- (PURCHASE/ADJUSTMENT artirir, CONSUMPTION/WASTE azaltir).
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "inventory_movement_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "inventory_movement_unit_cost_non_negative"
  CHECK ("unitCost" IS NULL OR "unitCost" >= 0);

-- --- TEK ACIK KASA --------------------------------------------------------
-- Isletmede TEK fiziki kasa var. Ayni anda iki acik kasa oturumu, beklenen
-- nakdin hangi oturuma yazilacagini belirsiz hale getirir ve kasa farkini
-- hesaplanamaz kilar. Kisitlama uygulama katmaninda da var; burada
-- VERITABANI garantisi verilir (esszamanli iki "kasa ac" isteginde ikincisi
-- reddedilir).
CREATE UNIQUE INDEX "cash_drawer_single_open"
  ON "CashDrawerSession" (("status"))
  WHERE "status" = 'OPEN';

-- --- STOK HAREKETI SILINMEZ ----------------------------------------------
-- Stok defteri de finansal kayit gibi append-only'dir: yanlis hareket
-- SILINMEZ, ters yonde duzeltme hareketi (ADJUSTMENT) girilir. Aksi halde
-- "stok neden eksik?" sorusu veriyle yanitlanamaz.
CREATE TRIGGER "inventory_movement_no_delete"
  BEFORE DELETE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION "financial_record_no_delete"();
