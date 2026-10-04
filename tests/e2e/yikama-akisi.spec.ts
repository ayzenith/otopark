import { expect, test, type Page } from "@playwright/test";
import {
  E2E_KULLANICI,
  E2E_PAROLA,
  E2E_PATRON,
  E2E_YIKAMA_ANA,
  E2E_YIKAMA_EK,
  E2E_YIKAMA_FIYAT,
} from "./global-setup";

/**
 * OTO YIKAMA AKISLARI - UCTAN UCA
 *
 * ============================================================================
 * DIKKAT: Tutarlar YALNIZCA TEST verisidir. Yikama fiyatlari koda sabit
 * degildir; veritabanindan gelir ve patron panelinden degistirilir. Testler
 * bu mekanizmayi dogrular.
 * ============================================================================
 *
 * Dogrulanan isletme kararlari (04.10.2026):
 *   - Arac tipine gore fiyatlandirma YALNIZCA yikamada vardir.
 *   - Otopark ve yikama fiyatlandirmasi tamamen ayridir.
 *   - Hizmetler ve fiyatlar panelden yonetilebilir.
 */

const PROJE_HARFI: Record<string, string> = {
  "telefon-kucuk": "K",
  "telefon-orta": "O",
  masaustu: "M",
};

let sayac = 0;

/** Isci yeniden baslatmasina dayanikli, proje basina benzersiz plaka. */
const TABAN = (process.pid % 70) + 10;

function plakaUret(projeAdi: string): string {
  sayac += 1;
  const harf = PROJE_HARFI[projeAdi] ?? "X";
  const numara = ((TABAN + sayac) % 90) + 10;
  return `34ZW${harf}${String(numara).padStart(2, "0")}`;
}

function bicimle(plaka: string): string {
  const m = /^(\d{2})([A-Z]{1,3})(\d{2,5})$/.exec(plaka);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : plaka;
}

async function girisYap(page: Page, kullanici: string) {
  await page.goto("/giris");
  await page.getByLabel("Kullanıcı adı").fill(kullanici);
  await page.getByLabel("Parola").fill(E2E_PAROLA);
  await page.getByRole("button", { name: /GİRİŞ YAP/i }).click();
  await expect(page).toHaveURL(/\/vardiya/);
}

async function vardiyaAc(page: Page) {
  const buton = page.getByTestId("vardiya-baslat");
  if (await buton.isVisible().catch(() => false)) {
    await buton.click();
    await expect(buton).toBeHidden({ timeout: 10_000 });
  }
}

/** Yıkama ekranında yeni iş formunu açar. */
async function yeniYikamaAc(page: Page) {
  await page.goto("/yikama");
  await page.getByTestId("yeni-yikama").click();
  await expect(page.getByTestId("yikama-plaka")).toBeVisible({ timeout: 15_000 });
}

/** Ana hizmetin satırını (fiyatıyla) bulur. */
function hizmetSatiri(page: Page, ad: string) {
  return page.getByTestId("yikama-hizmetleri").getByRole("button", { name: new RegExp(ad) });
}

// ===========================================================================
// PERSONEL
// ===========================================================================

test.describe("personel: yıkama iş emri", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
    await vardiyaAc(page);
  });

  test("TAM AKIŞ: plaka → tip → hizmet → sıraya al → yıkamaya al → tamamla", async ({
    page,
  }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await yeniYikamaAc(page);

    // 1-2. ADIM: plaka ve araç tipi
    await page.getByTestId("yikama-plaka").fill(plaka);

    // 3. ADIM: hizmet seç — fiyat ekranda yazılı
    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();
    await expect(page.getByTestId("yikama-toplam")).toContainText("600,00");

    // 4. ADIM: sıraya al
    await page.getByTestId("yikama-kaydet").click();
    const onay = page.getByTestId("yikama-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    await expect(onay).toContainText("YIKAMA SIRAYA ALINDI");
    await expect(onay).toContainText(bicimle(plaka));
    await expect(onay).toContainText(/İş no: Y-\d{6}-\d{4}/);

    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    // 5. ADIM: kuyruktan yıkamaya al
    const kuyruk = page.getByTestId("yikama-kuyrugu");
    await expect(kuyruk).toContainText(bicimle(plaka), { timeout: 15_000 });

    const satir = kuyruk.locator("li", { hasText: bicimle(plaka) }).first();
    await satir.getByRole("button", { name: "YIKAMAYA AL" }).click();
    await expect(
      page.getByTestId("yikama-kuyrugu").locator("li", { hasText: bicimle(plaka) }).first(),
    ).toContainText("YIKAMADA", { timeout: 15_000 });

    // 6. ADIM: tamamla
    await page
      .getByTestId("yikama-kuyrugu")
      .locator("li", { hasText: bicimle(plaka) })
      .first()
      .getByRole("button", { name: "TAMAMLA" })
      .click();

    // Kuyruktan düşer.
    //
    // Veritabani UC Playwright projesi arasinda paylasilir ve kuyrukta baska
    // projelerin isleri olabilir; bu yuzden "kuyruk bos" degil, BU PLAKANIN
    // SATIRININ KALMADIGI dogrulanir. toHaveCount(0) listenin hic cizilmedigi
    // durumda da calisir.
    await expect(
      page.locator('[data-test="yikama-kuyrugu"] > li', { hasText: bicimle(plaka) }),
    ).toHaveCount(0, { timeout: 20_000 });
  });

  test("ARAÇ TİPİ değişince yıkama fiyatı değişir (SUV daha pahalı)", async ({ page }) => {
    await yeniYikamaAc(page);

    // Otomobil (varsayılan)
    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();
    await expect(page.getByTestId("yikama-toplam")).toContainText("600,00");

    // SUV'a geçince seçim sıfırlanır ve fiyat farklıdır.
    await page.getByRole("button", { name: /SUV/ }).click();
    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();
    await expect(page.getByTestId("yikama-toplam")).toContainText("700,00");

    expect(E2E_YIKAMA_FIYAT.suvKurus).toBeGreaterThan(E2E_YIKAMA_FIYAT.otomobilKurus);
  });

  test("FİYATI TANIMSIZ hizmet onay ister, onayla 0 ₺ kaydedilir", async ({
    page,
  }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await yeniYikamaAc(page);
    await page.getByTestId("yikama-plaka").fill(plaka);

    // Fiyatı girilmemiş hizmet listede "fiyat girilmemiş" yazar.
    const ekHizmet = hizmetSatiri(page, E2E_YIKAMA_EK.ad);
    await expect(ekHizmet).toContainText("fiyat girilmemiş");
    await ekHizmet.click();

    await page.getByTestId("yikama-kaydet").click();

    // Sessizce 0 ₺ kaydedilmez: açık uyarı ve onay istenir.
    const hata = page.getByTestId("yikama-hata");
    await expect(hata).toBeVisible({ timeout: 15_000 });
    await expect(hata).toContainText(/fiyatı tanımlı değil/i);

    await page.getByTestId("fiyatsiz-devam").click();

    const onay = page.getByTestId("yikama-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    await expect(onay).toContainText(/Fiyatı tanımsız hizmet 0 ₺ kaydedildi/);
  });

  test("birden fazla hizmet seçilince toplam toplanır", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await yeniYikamaAc(page);
    await page.getByTestId("yikama-plaka").fill(plaka);

    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();
    await hizmetSatiri(page, E2E_YIKAMA_EK.ad).click();

    // Ana hizmet 600 + fiyatsız ek hizmet 0 = 600, ama uyarı görünür.
    await expect(page.getByTestId("yikama-toplam")).toContainText("600,00");
    await expect(page.getByText(/Fiyatı girilmemiş hizmet var/)).toBeVisible();
  });

  test("boş plaka veya hizmetsiz kayıt yapılamaz", async ({ page }) => {
    await yeniYikamaAc(page);
    await expect(page.getByTestId("yikama-kaydet")).toBeDisabled();

    await page.getByTestId("yikama-plaka").fill("34ABC123");
    // Hizmet seçilmedi: hâlâ devre dışı.
    await expect(page.getByTestId("yikama-kaydet")).toBeDisabled();
  });

  test("yıkama ekranı mobilde yatay kaydırma üretmez", async ({ page }) => {
    await yeniYikamaAc(page);
    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();

    const tasma = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(tasma).toBeLessThanOrEqual(1);
  });

  test("hizmet butonları yeterli dokunma hedefine sahip", async ({ page }) => {
    await yeniYikamaAc(page);
    const kutu = await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).boundingBox();
    expect(kutu!.height).toBeGreaterThanOrEqual(48);
  });
});

test.describe("personel: yıkama tahsilatı", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
    await vardiyaAc(page);
  });

  /** Yeni bir iş açar ve detay sayfasına gider. */
  async function isAcVeDetayaGit(page: Page, plaka: string) {
    await yeniYikamaAc(page);
    await page.getByTestId("yikama-plaka").fill(plaka);
    await hizmetSatiri(page, E2E_YIKAMA_ANA.ad).click();
    await page.getByTestId("yikama-kaydet").click();
    await expect(page.getByTestId("yikama-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    const kuyruk = page.getByTestId("yikama-kuyrugu");
    await expect(kuyruk).toContainText(bicimle(plaka), { timeout: 15_000 });
    await kuyruk
      .locator("li", { hasText: bicimle(plaka) })
      .first()
      .getByRole("link", { name: /DETAY/ })
      .click();
    await expect(page).toHaveURL(/\/yikama\/[a-z0-9]+$/, { timeout: 15_000 });
  }

  test("NAKİT tahsilat yapılır ve iş tamamlanır", async ({ page }, testInfo) => {
    await isAcVeDetayaGit(page, plakaUret(testInfo.project.name));

    await expect(page.getByTestId("yikama-odenecek")).toContainText("600,00");
    await page.getByTestId("yikama-yontem-cash").click();
    await page.getByTestId("yikama-tahsil-et").click();

    // Tahsilat tamamlanınca tahsilat FORMU kapanır (ödenecek bir şey kalmadı).
    // Bu yüzden geçici başarı uyarısı değil, KALICI sonuç doğrulanır.
    await expect(page.getByTestId("yikama-tahsilatlari")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("yikama-tahsilatlari")).toContainText("600,00");
    await expect(page.getByTestId("yikama-tahsilatlari")).toContainText("Nakit");
    await expect(page.getByTestId("yikama-tahsilatlari")).toContainText("E2E Personel");
    await expect(page.getByText("Tahsil edildi").first()).toBeVisible();
    await expect(page.getByText("Tamamlandı").first()).toBeVisible();
    // Form kapandı: ikinci tahsilat kazası imkânsız.
    await expect(page.getByTestId("yikama-tahsil-et")).toHaveCount(0);
  });

  test("TAHSİLATSIZ TAMAMLAMA gerekçe ister", async ({ page }, testInfo) => {
    await isAcVeDetayaGit(page, plakaUret(testInfo.project.name));

    await page.getByTestId("tahsilatsiz-ac").click();

    // Gerekçe boşken gönderim OLMAZ: alan zorunlu işaretli olduğu için
    // tarayıcı formu göndermez ve iş tamamlanmaz. (Sunucu katmanı da ayrıca
    // gerekçe zorunluluğunu doğrular; entegrasyon testinde kanıtlanıyor.)
    await page.getByTestId("tahsilatsiz-onayla").click();
    await expect(page.getByTestId("tahsilatsiz-sebep")).toBeVisible();
    await expect(page.getByText(/TAHSİLAT YAPILMADI/)).toHaveCount(0);

    await page.getByTestId("tahsilatsiz-sebep").fill("Müşteri yarın ödeyecek");
    await page.getByTestId("tahsilatsiz-onayla").click();

    await expect(page.getByText("Tahsil edilmedi").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/TAHSİLAT YAPILMADI/)).toBeVisible();
  });

  test("hizmet eklenince ödenecek tutar artar", async ({ page }, testInfo) => {
    await isAcVeDetayaGit(page, plakaUret(testInfo.project.name));

    // Fiyatsız ek hizmet: onay istenir.
    const ekleButonu = page.getByRole("button", { name: new RegExp(E2E_YIKAMA_EK.ad) });
    await ekleButonu.click();
    await expect(page.getByTestId("satir-ekle-hata")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "0 ₺ olarak ekle" }).click();

    await expect(page.getByTestId("yikama-satirlari")).toContainText(E2E_YIKAMA_EK.ad, {
      timeout: 20_000,
    });
    // 600 + 0 = 600 (ek hizmetin fiyatı tanımsız)
    await expect(page.getByTestId("yikama-odenecek")).toContainText("600,00");
  });
});

// ===========================================================================
// PATRON
// ===========================================================================

test.describe("patron: yıkama fiyat yönetimi", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
  });

  test("fiyat ızgarası araç tiplerini kolon olarak gösterir", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/yikama");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Oto yıkama fiyatları");

    const satir = page.getByTestId(`fiyat-satiri-${E2E_YIKAMA_ANA.kod}`);
    await expect(satir).toBeVisible();
    await expect(page.getByTestId(`fiyat-${E2E_YIKAMA_ANA.kod}-OTOMOBIL`)).toHaveValue("600,00");
    await expect(page.getByTestId(`fiyat-${E2E_YIKAMA_ANA.kod}-SUV`)).toHaveValue("700,00");

    // Fiyatı girilmemiş hizmetin hücresi BOŞ (0 değil).
    await expect(page.getByTestId(`fiyat-${E2E_YIKAMA_EK.kod}-OTOMOBIL`)).toHaveValue("");
  });

  test("otopark ve yıkama fiyatlandırmasının AYRI olduğu ekranda yazılı", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/yikama");
    await expect(
      page.getByText(/Araç tipine göre fiyat YALNIZCA yıkamada geçerlidir/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Tarifeler" }).first()).toBeVisible();
  });

  test("YENİ HİZMET eklenir ve fiyatı girilebilir", async ({ page }, testInfo) => {
    const harf = PROJE_HARFI[testInfo.project.name] ?? "X";
    const kod = `E2E_YENI_${harf}`;
    const ad = `E2E Yeni Hizmet ${harf}`;

    await page.goto("/yonetim/ayarlar/yikama");
    await page.getByTestId("hizmet-ekle-ac").click();
    await page.getByTestId("hizmet-ad").fill(ad);
    await page.getByTestId("hizmet-kod").fill(kod);
    await page.getByTestId("hizmet-kaydet").click();

    // Izgarada görünür ve fiyatı BOŞ gelir.
    const hucre = page.getByTestId(`fiyat-${kod}-OTOMOBIL`);
    await expect(hucre).toBeVisible({ timeout: 20_000 });
    await expect(hucre).toHaveValue("");

    // Fiyat girilip kaydedilir.
    await hucre.fill("250");
    await page.getByTestId("fiyatlari-kaydet").click();
    await expect(page.getByTestId("fiyat-kaydet-basari")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(`fiyat-${kod}-OTOMOBIL`)).toHaveValue("250,00");

    // Personel fiyat listesinde yeni hizmet görünür.
    await page.goto("/tarife");
    await expect(page.getByTestId("yikama-fiyat-listesi")).toContainText(ad);
  });

  test("FİYAT DEĞİŞTİRİLİR ve personel ekranında yeni fiyat görünür", async ({
    page,
  }, testInfo) => {
    const harf = PROJE_HARFI[testInfo.project.name] ?? "X";
    const kod = `E2E_ZAM_${harf}`;
    const ad = `E2E Zam Hizmeti ${harf}`;

    // Bu test kendi hizmetini kurar: paylaşılan fixture'ı bozmaz.
    await page.goto("/yonetim/ayarlar/yikama");
    await page.getByTestId("hizmet-ekle-ac").click();
    await page.getByTestId("hizmet-ad").fill(ad);
    await page.getByTestId("hizmet-kod").fill(kod);
    await page.getByTestId("hizmet-kaydet").click();

    await expect(page.getByTestId(`fiyat-${kod}-OTOMOBIL`)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId(`fiyat-${kod}-OTOMOBIL`).fill("300");
    await page.getByTestId("fiyatlari-kaydet").click();
    await expect(page.getByTestId("fiyat-kaydet-basari")).toBeVisible({ timeout: 20_000 });

    // Zam
    await page.getByTestId(`fiyat-${kod}-OTOMOBIL`).fill("450");
    await page.getByTestId("fiyatlari-kaydet").click();
    await expect(page.getByTestId("fiyat-kaydet-basari")).toBeVisible({ timeout: 20_000 });

    // Fiyat geçmişi iki kaydı da gösterir: eski fiyat SİLİNMEZ.
    await expect(page.getByText(/Fiyat değişiklik geçmişi/)).toBeVisible();
    await expect(page.getByText("300,00 ₺").first()).toBeVisible();
    await expect(page.getByText("450,00 ₺").first()).toBeVisible();

    // Yıkama ekranında yeni fiyat geçerli.
    await page.goto("/yikama");
    await page.getByTestId("yeni-yikama").click();
    await expect(hizmetSatiri(page, ad)).toContainText("450,00", { timeout: 15_000 });
  });

  test("YENİ ARAÇ TİPİ eklenir; karavan gibi tarife dışı işaretlenebilir", async ({
    page,
  }, testInfo) => {
    const harf = PROJE_HARFI[testInfo.project.name] ?? "X";
    const kod = `E2E_TIP_${harf}`;

    await page.goto("/yonetim/ayarlar/yikama");
    await page.getByTestId("sinif-ekle-ac").click();
    await page.getByTestId("sinif-ad").fill(`E2E Tip ${harf}`);
    await page.getByTestId("sinif-kod").fill(kod);
    await expect(
      page.getByText(/Normal otopark tarifesine dahil değil/),
    ).toBeVisible();
    await page.getByTestId("sinif-kaydet").click();

    // Yeni tip fiyat ızgarasında kolon olarak çıkar, fiyatı BOŞ.
    const hucre = page.getByTestId(`fiyat-${E2E_YIKAMA_ANA.kod}-${kod}`);
    await expect(hucre).toBeVisible({ timeout: 20_000 });
    await expect(hucre).toHaveValue("");
  });

  test("yıkama raporları yalnızca yıkama cirosunu gösterir", async ({ page }) => {
    await page.goto("/yonetim/yikama");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Oto yıkama");
    await expect(page.getByText(/otopark tahsilatı ayrı tutulur/)).toBeVisible();
    await expect(page.getByText("Hizmet bazlı ciro")).toBeVisible();
    await expect(page.getByText("Personel işlem sayısı")).toBeVisible();
  });

  test("yıkama sayfaları yatay kaydırma üretmez", async ({ page }) => {
    for (const yol of ["/yikama", "/yonetim/yikama", "/yonetim/ayarlar/yikama", "/tarife"]) {
      await page.goto(yol);
      const tasma = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(tasma, `yatay taşma: ${yol}`).toBeLessThanOrEqual(1);
    }
  });

  test("fiyat listesinde otopark ve yıkama AYRI başlıklarda", async ({ page }) => {
    await page.goto("/tarife");
    await expect(page.getByRole("heading", { name: "Otopark", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Oto yıkama", exact: true })).toBeVisible();
    await expect(page.getByTestId("yikama-fiyat-listesi")).toContainText(E2E_YIKAMA_ANA.ad);
    await expect(page.getByTestId("yikama-fiyat-listesi")).toContainText("600,00");
  });
});
