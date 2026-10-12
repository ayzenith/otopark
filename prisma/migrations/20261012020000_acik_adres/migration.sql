-- İşletme sahibi 12.10.2026'da açık adresi verdi. VERİ olarak yazılır
-- (mimari kural 1/20): yalnızca alan BOŞSA; panelden girilmiş bir adres
-- ASLA ezilmez. Adres, Google için LocalBusiness yapısal verisinde kullanılır.
UPDATE "BusinessSetting"
SET "addressText" = 'Ayamama Sok., Ataköy 7-8-9-10. Kısım, 34158 Bakırköy/İstanbul'
WHERE "id" = 'singleton' AND COALESCE(TRIM("addressText"), '') = '';
