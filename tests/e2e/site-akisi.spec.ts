import { expect, test, type Page } from "@playwright/test";
import { E2E_KULLANICI, E2E_PAROLA, E2E_PATRON } from "./global-setup";

/**
 * KURUMSAL SITE - UCTAN UCA (Asama 7)
 *
 * ============================================================================
 * DIKKAT: Buradaki fiyat ve metinler YALNIZCA TESTtir. Isletmenin sitede
 * hangi fiyatlarin yazacagi henuz KARARA BAGLANMADI (docs/07 S19) ve adres /
 * telefon da verilmedi (S18). Testler "panelden girilen ne ise sitede o
 * gorunur, girilmeyen hic gorunmez" davranisini dogrular.
 * ============================================================================
 *
 * E2E veritabani UC proje arasinda PAYLASILIR. Site icerigi tek ve ortaktir;
 * bu yuzden testler sayfa metinlerini DEGISTIRMEZ. Yazma testi yalnizca
 * projeye ozel bir fiyat satiri uzerinden yapilir ve o satir silinerek biter.
 */

const PROJE_HARFI: Record<string, string> = {
  "telefon-kucuk": "K",
  "telefon-orta": "O",
  masaustu: "M",
};

async function girisYap(page: Page, kullanici: string) {
  await page.goto("/giris");
  await page.getByLabel("Kullanıcı adı").fill(kullanici);
  await page.getByLabel("Parola").fill(E2E_PAROLA);
  await page.getByRole("button", { name: /GİRİŞ YAP/i }).click();
  await expect(page).toHaveURL(/\/vardiya/);
}

test.describe("kurumsal site - ziyaretçi", () => {
  test("ana sayfa oturum GEREKTİRMEDEN açılır", async ({ page }) => {
    await page.goto("/");
    // Panele yonlendirme YOK: kok adres artik sitenin kendisidir.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Personel girişi" })).toBeVisible();
  });

  test("fiyatlar ve iletişim sayfaları açılır", async ({ page }) => {
    await page.goto("/fiyatlar");
    await expect(page.getByRole("heading", { name: "Fiyatlar", level: 1 })).toBeVisible();

    await page.goto("/iletisim");
    await expect(page.getByRole("heading", { name: "İletişim", level: 1 })).toBeVisible();
  });

  test("sitede yatay kaydırma yoktur", async ({ page }) => {
    for (const yol of ["/", "/fiyatlar", "/iletisim"]) {
      await page.goto(yol);
      const tasma = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // 1 piksel tolerans: yuvarlama farki tasma sayilmaz.
      expect(tasma, `${yol} yatay kaydırma üretiyor`).toBeLessThanOrEqual(1);
    }
  });

  test("personel girişi bağlantısı giriş ekranına götürür", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Personel girişi" }).click();
    await expect(page).toHaveURL(/\/giris/);
  });

  test("telefona ait ana ekran bilgisi (manifest) yayındadır", async ({ page }) => {
    const yanit = await page.request.get("/manifest.webmanifest");
    expect(yanit.ok()).toBe(true);
    const manifest = await yanit.json();
    expect(manifest.display).toBe("standalone");
    // Personel ana ekrandan acinca dogrudan is ekranina dusmeli.
    expect(manifest.start_url).toBe("/vardiya");
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

test.describe("site yönetimi - patron", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
  });

  test("web sitesi ekranı açılır ve eksik bilgileri listeler", async ({ page }) => {
    await page.goto("/yonetim/site");
    await expect(page.getByRole("heading", { name: "Web sitesi", level: 1 })).toBeVisible();
    // Sayfa metni kutulari dort tanimli sayfa icin de cikar.
    await expect(page.getByTestId("site-govde-anasayfa")).toBeVisible();
    await expect(page.getByTestId("site-govde-iletisim")).toBeVisible();
  });

  test("panelden eklenen fiyat satırı sitede görünür, silinince kaybolur", async ({
    page,
  }, testInfo) => {
    const harf = PROJE_HARFI[testInfo.project.name] ?? "X";
    const etiket = `E2E Site Kalemi ${harf}`;
    const fiyatMetni = `E2E ${harf} fiyatı`;

    await page.goto("/yonetim/site");

    // "YENİ FİYAT SATIRI" bolumundeki bos form: sayfadaki SON formdur.
    const yeniForm = page.getByTestId("site-fiyat-etiket").last();
    await yeniForm.fill(etiket);
    await page.getByTestId("site-fiyat-tutar").last().fill(fiyatMetni);
    await page.getByTestId("site-fiyat-kaydet").last().click();

    // Kayit SUNUCUDAN okunarak dogrulanir (kural 18): satir listeye duser.
    await expect(page.locator(`input[value="${etiket}"]`)).toHaveCount(1);

    // Ziyaretci tarafinda gorunur.
    await page.goto("/fiyatlar");
    await expect(page.getByText(etiket)).toBeVisible();
    await expect(page.getByText(fiyatMetni)).toBeVisible();

    // Temizlik: satiri sil. Paylasilan veritabaninda artik kalmaz.
    await page.goto("/yonetim/site");
    const satir = page
      .getByTestId("site-fiyat-satiri")
      .filter({ has: page.locator(`input[value="${etiket}"]`) });
    await expect(satir).toHaveCount(1);
    await satir.getByTestId("site-fiyat-sil").click();

    await expect(page.locator(`input[value="${etiket}"]`)).toHaveCount(0);

    await page.goto("/fiyatlar");
    await expect(page.getByText(etiket)).toHaveCount(0);
  });
});

test.describe("site yönetimi - personel", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
  });

  test("personel site yönetimine giremez", async ({ page }) => {
    await page.goto("/yonetim/site");
    // Sunucu tarafi yetki kontrolu personeli vardiya ekranina geri gonderir.
    await expect(page).toHaveURL(/\/vardiya/);
  });
});
