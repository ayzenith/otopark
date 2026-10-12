-- İşletme sahibi 12.10.2026'da adresi DÜZELTTİ: konum "Ayamama Sok." değil,
-- "Burhan Doğançay Caddesi" olarak geçiyor. Yalnızca yanlış olan eski değer
-- düzeltilir; patron panelden başka bir adres yazdıysa ona DOKUNULMAZ.
UPDATE "BusinessSetting"
SET "addressText" = 'Burhan Doğançay Cad., Ataköy 7-8-9-10. Kısım, 34158 Bakırköy/İstanbul'
WHERE "id" = 'singleton'
  AND TRIM("addressText") = 'Ayamama Sok., Ataköy 7-8-9-10. Kısım, 34158 Bakırköy/İstanbul';
