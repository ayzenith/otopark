/**
 * Entegrasyon testi hazirligi.
 *
 * Testler GERCEK PostgreSQL'e baglanir: transaction butunlugu, kismi tekil
 * indeksler, tetikleyiciler ve yaris kosullari yalnizca gercek veritabaninda
 * kanitlanabilir.
 *
 * DATABASE_URL, test veritabanina yonlendirilir; uretim/gelistirme verisine
 * dokunulmaz.
 */

import { config } from "dotenv";

config({ path: ".env", quiet: true });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  throw new Error(
    "DATABASE_URL_TEST tanımlı değil. .env.example dosyasına bakın; " +
      "entegrasyon testleri ayrı bir test veritabanı gerektirir.",
  );
}

// Guvenlik agi: test veritabani adi "test" icermiyorsa calistirma.
if (!/test/i.test(testUrl)) {
  throw new Error(
    `DATABASE_URL_TEST bir test veritabanını göstermiyor: ${testUrl}\n` +
      "Kazara üretim verisi silinmesin diye test veritabanı adı 'test' içermelidir.",
  );
}

process.env.DATABASE_URL = testUrl;
