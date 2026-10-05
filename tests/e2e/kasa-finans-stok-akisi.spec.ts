import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_GIDER_KATEGORISI,
  E2E_PAROLA,
  E2E_PATRON,
  E2E_KULLANICI,
  e2eMalzemeAdi,
} from "./global-setup";

/**
 * ASAMA 5 AKISLARI - UCTAN UCA (kasa · gelir/gider · malzeme stogu)
 *
 * ============================================================================
 * DIKKAT: Tum tutarlar, gider kalemleri ve malzeme adlari YALNIZCA TESTtir.
 * Londra Camping Otopark'in gercek giderleri veya malzemeleri DEGILDIR.
 *
 * TEK ACIK KASA KURALI: isletmede tek fiziki kasa var, dolayisiyla ayni anda
 * yalnizca BIR acik kasa oturumu olabilir ve E2E veritabani uc Playwright
 * projesi arasinda PAYLASILIR. Bu yuzden:
 *   · kasa testleri `serial` calisir,
 *   · kasayi acan her test onu KAPATARAK biter,
 *   · boylece sonraki proje temiz bir "kasa kapalı" durumuyla baslar.
 * ============================================================================
 */

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

/** Kasa ekranini acar; kasa kapaliysa acilis kartini bekler. */
async function kasaEkrani(page: Page) {
  await page.goto("/kasa");
  await expect(page.getByRole("heading", { name: "Kasa", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** Acik kasa varsa gerekceyle kapatir - testler arasi temiz baslangic. */
async function kasayiKapatVarsa(page: Page) {
  await kasaEkrani(page);
  const kapatAc = page.getByTestId("kasa-kapat-ac");
  if (!(await kapatAc.isVisible().catch(() => false))) return;

  await kapatAc.click();
  await page.getByTestId("sayilan-nakit").fill("0");
  await page.getByTestId("fark-sebebi").fill("E2E temizlik kapanışı");
  await page.getByTestId("kasa-kapat").click();
  // Kapanis onayi SUNUCUDAN gelir: "Son kasa kapanışı" karti.
  await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });
}

// ===========================================================================
// KASA
// ===========================================================================

test.describe.serial("kasa oturumu", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
    await kasayiKapatVarsa(page);
  });

  test("TAM AKIŞ: kasayı aç → hareket gir → say ve kapat", async ({ page }) => {
    await kasaEkrani(page);

    // --- AÇ ---
    await expect(page.getByText("Kasa kapalı")).toBeVisible();
    await page.getByTestId("kasa-acilis-nakdi").fill("100");
    await page.getByTestId("kasa-ac").click();
    await expect(page.getByText("Kasa açık")).toBeVisible({ timeout: 15_000 });

    // BEKLENEN NAKIT SAYIMDAN ONCE GOSTERILMEZ: saymadan kopyalanmasin.
    await expect(page.getByText(/Beklenen nakit, sayımı yaptıktan sonra/)).toBeVisible();

    // --- HAREKET: kasaya para konuldu ---
    await page.getByTestId("kasa-hareket-ac").click();
    await page.getByTestId("hareket-tip").selectOption("DEPOSIT");
    await page.getByTestId("hareket-tutar").fill("50");
    await page.getByTestId("hareket-aciklama").fill("E2E bozuk para eklendi");
    await page.getByTestId("hareket-kaydet").click();
    await expect(page.getByTestId("kasa-hareket-basari")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("E2E bozuk para eklendi").first()).toBeVisible();

    // --- SAY VE KAPAT: 100 + 50 = 150 bekleniyor, tam sayılır ---
    await page.getByTestId("kasa-kapat-ac").click();
    await page.getByTestId("sayilan-nakit").fill("150");
    await page.getByTestId("kasa-kapat").click();

    // Kapanis onayi SUNUCUDAN okunur ve sayfa tazelenince KAYBOLMAZ.
    await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Kasa tam — fark yok")).toBeVisible();

    // Sayfayi yeniden yukle: onay HALA orada (kalici kayit).
    await page.reload();
    await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });
  });

  test("FARK GEREKÇESİZ KAPATILAMAZ, gerekçeyle kaydedilir", async ({ page }) => {
    await kasaEkrani(page);
    await page.getByTestId("kasa-acilis-nakdi").fill("200");
    await page.getByTestId("kasa-ac").click();
    await expect(page.getByText("Kasa açık")).toBeVisible({ timeout: 15_000 });

    // Gerekcesiz: 200 bekleniyor, 150 sayildi -> reddedilir.
    await page.getByTestId("kasa-kapat-ac").click();
    await page.getByTestId("sayilan-nakit").fill("150");
    await page.getByTestId("kasa-kapat").click();

    await expect(page.getByText(/Gerekçe girmeniz zorunludur/)).toBeVisible({ timeout: 15_000 });
    // Kasa HALA acik: gerekcesiz kapanis uygulanmadi.
    await expect(page.getByTestId("sayilan-nakit")).toBeVisible();

    // Gerekceyle tekrar dene.
    await page.getByTestId("fark-sebebi").fill("E2E müşteriye fazla para üstü verildi");
    await page.getByTestId("kasa-kapat").click();

    await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/EKSİK/)).toBeVisible();
  });

  test("kapanan kasa yönetim geçmişinde farkıyla görünür", async ({ page }) => {
    await kasaEkrani(page);
    await page.getByTestId("kasa-acilis-nakdi").fill("300");
    await page.getByTestId("kasa-ac").click();
    await expect(page.getByText("Kasa açık")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("kasa-kapat-ac").click();
    await page.getByTestId("sayilan-nakit").fill("320");
    await page.getByTestId("fark-sebebi").fill("E2E sayımda fazla çıktı");
    await page.getByTestId("kasa-kapat").click();
    await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });

    // --- YÖNETİM → KASA GEÇMİŞİ ---
    await page.goto("/yonetim/kasa");
    await expect(page.getByRole("heading", { name: "Kasa geçmişi" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("E2E sayımda fazla çıktı").first()).toBeVisible();
    // Fark rozeti ve mutabakat butonu var.
    await expect(page.getByText("FARK").first()).toBeVisible();
  });

});

/**
 * PERSONEL testleri AYRI describe'da: yukaridaki beforeEach patron olarak
 * giris yapiyor ve giris yapmis bir oturumda /giris sayfasi /vardiya'ya
 * yonlendiriliyor; ayni testte ikinci kez giris yapilamaz (E2E'de yasandi).
 */
test.describe("kasa — personel yetkisi", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
    await vardiyaAc(page);
  });

  test("personel kasa açma yetkisi olmadan kasayı açamaz", async ({ page }) => {
    // Personel rolunde cash.drawer.open YOKTUR: acilis karti HIC cizilmez.
    await kasaEkrani(page);
    await expect(page.getByText("Kasa oturumu açık değil")).toBeVisible();
    await expect(page.getByTestId("kasa-ac")).toHaveCount(0);
  });

  test("personel kendi vardiya tahsilat özetini görür", async ({ page }) => {
    await kasaEkrani(page);
    await expect(page.getByText("Vardiyamın tahsilatı")).toBeVisible();
  });

  test("CSV uç noktası YETKİSİZ personele 403 döner", async ({ page }) => {
    // Route Handler (panel) layout'undan GECMEZ; yetki kontrolu dosyanin
    // kendisinde. Dogrudan URL'e giden personel finansal veri indiremez.
    //
    // Yetkisiz yanit JSON'dur (indirme degil), bu yuzden goto ile okunur ve
    // oturum cerezi dogal olarak tasinir.
    const yanit = await page.goto("/yonetim/finans/csv?tur=gider");
    expect(yanit?.status()).toBe(403);
    const govde = await page.content();
    expect(govde).not.toContain("Kod;Tarih;Kategori");
  });
});

// ===========================================================================
// GELIR / GIDER
// ===========================================================================

test.describe("gelir / gider", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
  });

  test("TAM AKIŞ: gider kaydı → listede görünür → iptal edilir ve ÜZERİ ÇİZİLİ kalır", async ({
    page,
  }, testInfo) => {
    const aciklama = `E2E gider ${testInfo.project.name} ${Date.now()}`;

    await page.goto("/yonetim/finans/giderler");
    await expect(page.getByRole("heading", { name: "Giderler" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("gider-ekle-ac").click();
    await page.getByTestId("gider-kategori").selectOption({ label: E2E_GIDER_KATEGORISI.ad });
    await page.getByTestId("gider-tutar").fill("450");
    await page.getByTestId("gider-yontem").selectOption("TRANSFER");
    await page.getByTestId("gider-aciklama").fill(aciklama);
    await page.getByTestId("gider-kaydet").click();
    await expect(page.getByTestId("gider-basari")).toBeVisible({ timeout: 15_000 });

    // Liste bu giderin SATIRINA daraltilir: E2E veritabani paylasimli.
    const satir = page.getByRole("listitem").filter({ hasText: aciklama });
    await expect(satir).toHaveCount(1, { timeout: 15_000 });
    await expect(satir).toContainText("450,00");

    // --- İPTAL: gerekçe zorunlu ---
    await satir.getByRole("button", { name: /İptal et/ }).click();
    await satir.getByLabel("İptal gerekçesi (zorunlu)").fill("E2E yanlış kategoriye girildi");
    await satir.getByRole("button", { name: /^İptal et$/ }).click();

    // Satir SILINMEZ: iptal rozetiyle ve gerekcesiyle listede kalir.
    const iptalli = page.getByRole("listitem").filter({ hasText: aciklama });
    await expect(iptalli).toContainText("İPTAL", { timeout: 15_000 });
    await expect(iptalli).toContainText("E2E yanlış kategoriye girildi");
  });

  test("gider açıklaması zorunludur", async ({ page }) => {
    await page.goto("/yonetim/finans/giderler");
    await page.getByTestId("gider-ekle-ac").click();
    await page.getByTestId("gider-tutar").fill("100");
    // Aciklama BOS: tarayici "required" ile gondermez; alanin zorunlulugu
    // HTML seviyesinde de isaretli olmali.
    await expect(page.getByTestId("gider-aciklama")).toHaveAttribute("required", "");
  });

  test("diğer gelir kaydı tahsilat üretir", async ({ page }, testInfo) => {
    const etiket = `E2E gelir ${testInfo.project.name} ${Date.now()}`;

    await page.goto("/yonetim/finans/giderler");
    await page.getByTestId("gelir-ekle-ac").click();
    await page.getByTestId("gelir-etiket").fill(etiket);
    await page.getByTestId("gelir-tutar").fill("250");
    await page.getByTestId("gelir-yontem").selectOption("CASH");
    await page.getByTestId("gelir-kaydet").click();
    await expect(page.getByTestId("gelir-basari")).toBeVisible({ timeout: 15_000 });

    const satir = page.getByRole("listitem").filter({ hasText: etiket });
    await expect(satir).toHaveCount(1, { timeout: 15_000 });
    await expect(satir).toContainText("250,00");
  });

  test("gelir-gider paneli otopark ve yıkamayı AYRI satırda gösterir", async ({ page }) => {
    await page.goto("/yonetim/finans");
    await expect(page.getByRole("heading", { name: "Gelir / Gider" })).toBeVisible({
      timeout: 15_000,
    });

    // Mimari kural 11: otopark ve yikama tek sayida eritilmez.
    const bugun = page.getByRole("listitem").or(page.locator("body"));
    await expect(bugun.getByText("Otopark").first()).toBeVisible();
    await expect(bugun.getByText("Oto yıkama").first()).toBeVisible();
    await expect(bugun.getByText("Abonman").first()).toBeVisible();

    // Net bir kasa bakiyesi degildir uyarisi.
    await expect(page.getByText(/Net bir kasa bakiyesi değildir/).first()).toBeVisible();
  });

  test("CSV dışa aktarma tr-TR biçiminde indirilir", async ({ page }) => {
    await page.goto("/yonetim/finans");
    const baglanti = page.getByTestId("csv-ozet&donem=ay");
    await expect(baglanti).toBeVisible({ timeout: 15_000 });

    // INDIRME akisi: Content-Disposition attachment oldugu icin tarayici
    // gezinmez, dosya indirir. Dosya icerigi diskten okunup dogrulanir.
    const [indirme] = await Promise.all([page.waitForEvent("download"), baglanti.click()]);
    expect(indirme.suggestedFilename()).toMatch(/^gelir-gider-ay-\d{8}\.csv$/);

    const yol = await indirme.path();
    expect(yol).toBeTruthy();
    const metin = await readFile(yol!, "utf8");

    // UTF-8 BOM: Excel tr-TR'de Turkce karakterler bozulmaz.
    expect(metin.charCodeAt(0)).toBe(0xfeff);
    expect(metin).toContain("Yönetim amaçlı rapordur");
    // Alan ayirici NOKTALI VIRGUL ve otopark/yikama AYRI satirlarda.
    expect(metin).toContain("Gelir;Otopark;;");
    expect(metin).toContain("Gelir;Oto yıkama;;");
    // Tutarlar tr-TR: ondalik virgul.
    expect(metin).toMatch(/Sonuç;NET;;-?[\d.]*\d,\d{2}/);
  });

  test("gider CSV'si indirilebilir", async ({ page }) => {
    await page.goto("/yonetim/finans");
    const baglanti = page.getByTestId("csv-gider");
    await expect(baglanti).toBeVisible({ timeout: 15_000 });

    const [indirme] = await Promise.all([page.waitForEvent("download"), baglanti.click()]);
    const metin = await readFile((await indirme.path())!, "utf8");
    expect(metin).toContain("Kod;Tarih;Kategori");
    expect(metin).toContain("Toplam (iptaller hariç)");
  });

  test("mobilde yatay kaydırma olmaz (finans panelleri)", async ({ page }) => {
    for (const yol of ["/yonetim/finans", "/yonetim/finans/giderler", "/yonetim/kasa"]) {
      await page.goto(yol);
      await page.waitForLoadState("networkidle");
      const tasma = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      // 1px'lik yuvarlama farkina tolerans.
      expect(tasma, yol).toBeLessThanOrEqual(1);
    }
  });
});

// ===========================================================================
// MALZEME STOGU
// ===========================================================================

test.describe.serial("malzeme stoğu", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
  });

  test("TAM AKIŞ: malzeme kartı → alış → tüketim → kritik stok uyarısı", async ({
    page,
  }, testInfo) => {
    const malzeme = e2eMalzemeAdi(testInfo.project.name);

    await page.goto("/stok");
    await expect(page.getByRole("heading", { name: "Malzeme stoğu" })).toBeVisible({
      timeout: 15_000,
    });

    // --- MALZEME KARTI (yoksa olustur) ---
    const kart = page.getByRole("listitem").filter({ hasText: malzeme });
    if ((await kart.count()) === 0) {
      await page.getByTestId("malzeme-ekle-ac").click();
      await page.getByTestId("malzeme-ad").fill(malzeme);
      await page.getByTestId("malzeme-birim").selectOption("LITRE");
      await page.getByTestId("malzeme-asgari").fill("5");
      await page.getByTestId("malzeme-kaydet").click();
      await expect(page.getByRole("listitem").filter({ hasText: malzeme })).toHaveCount(1, {
        timeout: 15_000,
      });
    }

    // --- ALIŞ: 20 litre, birim 45 ₺ ---
    await page.getByTestId("stok-hareket-ac").click();
    await page.getByTestId("stok-malzeme").selectOption({ label: malzeme });
    await page.getByTestId("stok-tip").selectOption("PURCHASE");
    await page.getByTestId("stok-miktar").fill("20");
    await page.getByTestId("stok-birim-maliyet").fill("45");
    await page.getByTestId("stok-not").fill("E2E alış");
    await page.getByTestId("stok-kaydet").click();

    // BASARI ONAYI beklenir: "yeni stok ..." mesaji, sunucunun hesabini
    // gosterir ve tazeleme tamamlandigina isarettir.
    await expect(page.getByTestId("stok-basari")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("stok-basari")).toContainText("yeni stok");

    // --- TÜKETİM: stoğu asgarinin altına indir ---
    //
    // Eldeki stok onceki kosulardan birikebilir; bu yuzden ekrandaki METIN
    // ayristirilmaz (tr-TR bicimli), MAKINE OKUNUR data-stok degeri okunur.
    const hamStok = await page.getByTestId(`stok-${malzeme}`).getAttribute("data-stok");
    const kalan = Number(hamStok);
    expect(kalan, "data-stok okunmalı").toBeGreaterThan(1);

    await page.getByTestId("stok-hareket-ac").click();
    await page.getByTestId("stok-malzeme").selectOption({ label: malzeme });
    await page.getByTestId("stok-tip").selectOption("CONSUMPTION");
    // Asgari 5; kalanin tamamindan 1 eksigini dusur -> 1 litre kalir.
    await page.getByTestId("stok-miktar").fill(String(Math.round((kalan - 1) * 1000) / 1000));
    await page.getByTestId("stok-kaydet").click();

    // KRİTİK STOK UYARISI
    await expect(page.getByTestId("kritik-stok")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("kritik-stok")).toContainText(malzeme);
  });

  test("STOK NEGATİFE DÜŞMEZ: yetersiz stokta açık hata gösterilir", async ({
    page,
  }, testInfo) => {
    const malzeme = e2eMalzemeAdi(testInfo.project.name);

    await page.goto("/stok");
    await expect(page.getByTestId("stok-hareket-ac")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("stok-hareket-ac").click();
    await page.getByTestId("stok-malzeme").selectOption({ label: malzeme });
    await page.getByTestId("stok-tip").selectOption("CONSUMPTION");
    await page.getByTestId("stok-miktar").fill("9999");
    await page.getByTestId("stok-kaydet").click();

    // IS HATASI KULLANICIYA AYNEN GOSTERILIR (mimari kural 12).
    await expect(page.getByText(/stoğu yetersiz/)).toBeVisible({ timeout: 15_000 });
  });

  test("seçilen malzemenin ELDEKİ STOĞU formda görünür", async ({ page }, testInfo) => {
    const malzeme = e2eMalzemeAdi(testInfo.project.name);
    await page.goto("/stok");
    await page.getByTestId("stok-hareket-ac").click();
    await page.getByTestId("stok-malzeme").selectOption({ label: malzeme });
    await expect(page.getByTestId("stok-eldeki")).toBeVisible();
    await expect(page.getByTestId("stok-eldeki")).toContainText("litre");
  });

  test("alış hareketi gider kaydına bağlanabilir", async ({ page }, testInfo) => {
    const malzeme = e2eMalzemeAdi(testInfo.project.name);
    const aciklama = `E2E malzeme alımı ${testInfo.project.name} ${Date.now()}`;

    // Once gider kaydi.
    await page.goto("/yonetim/finans/giderler");
    await page.getByTestId("gider-ekle-ac").click();
    await page.getByTestId("gider-kategori").selectOption({ label: E2E_GIDER_KATEGORISI.ad });
    await page.getByTestId("gider-tutar").fill("900");
    await page.getByTestId("gider-yontem").selectOption("TRANSFER");
    await page.getByTestId("gider-aciklama").fill(aciklama);
    await page.getByTestId("gider-kaydet").click();
    await expect(page.getByTestId("gider-basari")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("listitem").filter({ hasText: aciklama })).toHaveCount(1, {
      timeout: 15_000,
    });

    // Sonra alis hareketini o gidere bagla.
    await page.goto("/stok");
    await page.getByTestId("stok-hareket-ac").click();
    await page.getByTestId("stok-malzeme").selectOption({ label: malzeme });
    await page.getByTestId("stok-tip").selectOption("PURCHASE");
    await page.getByTestId("stok-miktar").fill("3");
    await page.getByTestId("stok-birim-maliyet").fill("300");
    // selectOption LABEL olarak RegExp KABUL ETMEZ; secenegin value'su okunur.
    // Secenek etiketi "G-261004-0001 — <kategori> · <aciklama>" bicimindedir.
    const giderDegeri = await page
      .getByTestId("stok-gider")
      .locator("option", { hasText: aciklama })
      .getAttribute("value");
    expect(giderDegeri, "gider seçeneği bulunmalı").toBeTruthy();
    await page.getByTestId("stok-gider").selectOption(giderDegeri!);
    await page.getByTestId("stok-kaydet").click();
    await expect(page.getByTestId("stok-basari")).toBeVisible({ timeout: 15_000 });

    // Hareket listesinde gider kodu gorunur.
    await expect(page.getByText(/gider G-\d{6}-\d{4}/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("mobilde yatay kaydırma olmaz (stok ekranı)", async ({ page }) => {
    await page.goto("/stok");
    await page.waitForLoadState("networkidle");
    const tasma = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(tasma).toBeLessThanOrEqual(1);
  });

  test("dokunma hedefleri en az 48px (stok formu)", async ({ page }) => {
    await page.goto("/stok");
    await page.getByTestId("stok-hareket-ac").click();

    for (const testId of ["stok-malzeme", "stok-tip", "stok-miktar", "stok-kaydet"]) {
      const kutu = await page.getByTestId(testId).boundingBox();
      expect(kutu, testId).not.toBeNull();
      expect(kutu!.height, testId).toBeGreaterThanOrEqual(47.5);
    }
  });
});
