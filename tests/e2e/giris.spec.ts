import { expect, test } from "@playwright/test";

/**
 * GIRIS AKISI VE MOBIL DUZEN TESTLERI
 *
 * Asama 1 tamamlanma kriterleri (docs/06):
 *  - Giris/cikis calisiyor
 *  - Hicbir ekranda yatay kaydirma yok
 *  - Dokunma hedefleri yeterli buyuklukte
 */

test.describe("giriş ekranı", () => {
  test("giriş formu görünür ve Türkçe", async ({ page }) => {
    await page.goto("/giris");
    await expect(page.getByRole("heading", { name: /Londra Camping Otopark/i })).toBeVisible();
    await expect(page.getByLabel("Kullanıcı adı")).toBeVisible();
    await expect(page.getByLabel("Parola")).toBeVisible();
    await expect(page.getByRole("button", { name: /GİRİŞ YAP/i })).toBeVisible();
  });

  test("YATAY KAYDIRMA YOK", async ({ page }) => {
    await page.goto("/giris");
    const tasma = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(tasma, "sayfa yatay kayıyor").toBe(false);
  });

  test("giriş butonu dokunma hedefi yeterli (en az 48px)", async ({ page }) => {
    await page.goto("/giris");
    const kutu = await page.getByRole("button", { name: /GİRİŞ YAP/i }).boundingBox();
    expect(kutu).not.toBeNull();
    // Birincil işlem butonu 64px olarak tasarlandı.
    expect(kutu!.height).toBeGreaterThanOrEqual(56);
  });

  test("girdi alanlarının yazı boyutu 16px'in altına inmez", async ({ page }) => {
    // iOS Safari daha küçük puntoda input'a dokunulunca sayfayı yakınlaştırır.
    await page.goto("/giris");
    const boyut = await page
      .getByLabel("Kullanıcı adı")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(boyut).toBeGreaterThanOrEqual(16);
  });

  test("yanlış bilgiyle giriş reddedilir ve hata gösterilir", async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("Kullanıcı adı").fill("olmayan-kullanici");
    await page.getByLabel("Parola").fill("YanlisParola9");
    await page.getByRole("button", { name: /GİRİŞ YAP/i }).click();

    await expect(page.locator('[data-uyari="hata"]')).toContainText(/hatalı/i);
    // Hâlâ giriş ekranındayız.
    await expect(page).toHaveURL(/\/giris/);
  });

  test("hata mesajı kullanıcının var olup olmadığını ifşa etmez", async ({ page }) => {
    await page.goto("/giris");
    await page.getByLabel("Kullanıcı adı").fill("kesinlikle-olmayan-biri");
    await page.getByLabel("Parola").fill("YanlisParola9");
    await page.getByRole("button", { name: /GİRİŞ YAP/i }).click();

    const mesaj = await page.locator('[data-uyari="hata"]').textContent();
    expect(mesaj).not.toMatch(/bulunamadı|kayıtlı değil|yok/i);
  });
});

test.describe("yetkisiz erişim", () => {
  test("oturum olmadan panel sayfaları giriş ekranına yönlendirir", async ({ page }) => {
    for (const yol of ["/vardiya", "/araclar", "/yikama", "/diger", "/hesabim"]) {
      await page.goto(yol);
      await expect(page, `${yol} korumalı olmalı`).toHaveURL(/\/giris/);
    }
  });

  /**
   * ASAMA 7 DEGISIKLIGI: kok adres artik KURUMSAL SITEdir.
   *
   * Once "/" oturumu olmayani /giris'e yonlendiriyordu. Site yayina girince
   * ziyaretcinin karsisina giris ekrani cikmasi yanlis olurdu; personel
   * panele sitedeki "Personel girisi" baglantisindan (ya da dogrudan /giris
   * adresinden) ulasir. Panel sayfalari KORUMALI kalmaya devam eder -
   * ustteki test bunu dogrular.
   */
  test("kök adres oturum olmadan kurumsal siteyi açar", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/giris/);
    await expect(page.getByRole("link", { name: "Personel girişi" })).toBeVisible();
  });
});

test.describe("güvenlik başlıkları", () => {
  test("temel güvenlik başlıkları gönderilir", async ({ page }) => {
    const yanit = await page.goto("/giris");
    const h = yanit!.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("sunucu sürümü ifşa edilmez", async ({ page }) => {
    const yanit = await page.goto("/giris");
    expect(yanit!.headers()["x-powered-by"]).toBeUndefined();
  });
});
