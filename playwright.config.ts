import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Bazi CI/konteyner ortamlarinda Chromium onceden kurulu olur ve Playwright'in
 * bekledigi surum numarasiyla eslesmez. Boyle bir kurulum varsa onu kullan;
 * yoksa Playwright'in kendi indirdigi tarayiciyi kullan (normal gelistirme
 * makinesinde `npx playwright install chromium` yeterlidir).
 */
const HARICI_CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const launchOptions = existsSync(HARICI_CHROMIUM)
  ? { executablePath: HARICI_CHROMIUM }
  : undefined;

/**
 * Uctan uca testler - MOBIL ONCELIKLI.
 *
 * Projenin en onemli tasarim karari personelin telefondan kullanmasi oldugu
 * icin testler once telefon ekran boyutlarinda calisir. Masaustu da ayrica
 * dogrulanir.
 *
 * Tarayici: konteynerde onceden kurulu Chromium kullanilir.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  // Bileşenlerde data-test kullaniliyor; Playwright'in varsayilani data-testid.
  expect: { timeout: 10_000 },

  use: {
    testIdAttribute: "data-test",
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    launchOptions,
  },

  /**
   * NOT: Tum projeler Chromium uzerinde calisir.
   *
   * Playwright'in "iPhone SE" profili varsayilan olarak WebKit ister; bu
   * konteynerde yalnizca Chromium kurulu. Ekran genisligi, dokunma ve mobil
   * davranis Chromium'da da dogru sekilde taklit edilir, dolayisiyla DUZEN
   * testleri gecerlidir.
   *
   * ANCAK: gercek iOS Safari davranisi (ornegin -webkit-* ozellikleri, 100dvh
   * farklari, input yakinlastirmasi) yalnizca gercek cihazda dogrulanabilir.
   * Asama 8'de gercek telefonlarda elle test yapilacak (docs/06).
   */
  projects: [
    // Personelin en kucuk ekran senaryosu: 375px (iPhone SE / 8 / mini).
    {
      name: "telefon-kucuk",
      use: {
        ...devices["iPhone SE"],
        browserName: "chromium",
        viewport: { width: 375, height: 667 },
      },
    },
    // Yaygin modern Android telefon: 393px.
    {
      name: "telefon-orta",
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
    // Patronun masaustu kullanimi.
    {
      name: "masaustu",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],

  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100/giris",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
