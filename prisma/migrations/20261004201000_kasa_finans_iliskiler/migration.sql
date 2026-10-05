-- ===========================================================================
-- ASAMA 5 - "KIM GIRDI" BAGLANTILARI
--
-- Kasa, gider, diger gelir ve stok hareketlerinde `createdById` / `openedById`
-- alanlari serbest metin kimlikti; artik YABANCI ANAHTAR. Boylece var olmayan
-- bir kullanici kimligi yazilamaz ve ekranlarda "kim girdi" adi tek sorguda
-- okunur.
--
-- Kasa acan kullanici RESTRICT: kasa oturumunun sorumlusu belirsizlesemez.
-- Digerleri SET NULL: kullanici kaydi silinirse (silinmiyor, pasifleştiriliyor)
-- finansal satir kaybolmaz, yalnizca baglanti bosalir.
-- ===========================================================================

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerSession" ADD CONSTRAINT "CashDrawerSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtherIncome" ADD CONSTRAINT "OtherIncome_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

