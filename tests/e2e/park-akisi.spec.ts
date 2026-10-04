import { expect, test, type Page } from "@playwright/test";
import {
  E2E_BEKLENEN_UCRET_METNI,
  E2E_KULLANICI,
  E2E_PAROLA,
  parkEdilmisPlaka,
} from "./global-setup";

/**
 * PERSONEL ISLEM AKISI - UCTAN UCA
 *
 * Kullanicinin istedigi 7 adim gercek tarayicida dogrulanir:
 *   1. Plaka gir
 *   2. Araç girişini tamamla
 *   3. Çıkış için plakayı ara
 *   4. Ücreti açık ve anlaşılır gör
 *   5. Nakit veya kart seç
 *   6. Ödemeyi tamamla
 *   7. İşlemin başarıyla sonuçlandığını gör
 *
 * E2E tarifesi: ilk 60 dk 40 ₺, sonra saatlik 25 ₺ (yalnizca test verisi).
 */

/**
 * Her testin kendi plakasi olsun: testler birbirini etkilemesin.
 *
 * Bicim GECERLI bir Turkiye plakasi olmalidir (2 rakam + 2 harf + 3 rakam);
 * aksi halde sistem - dogru sekilde - bicim uyarisi verir.
 */
let sayac = 0;

/**
 * Plakalar PROJE BASINA benzersiz olmalidir: ayni dosya uc farkli ekran
 * boyutunda calisir ve veritabani paylasilir. Proje adindan turetilen harf
 * cakismayi onler.
 */
const PROJE_HARFI: Record<string, string> = {
  "telefon-kucuk": "K",
  "telefon-orta": "O",
  masaustu: "M",
};

/**
 * ISCI SURECINE OZEL TABAN SAYI.
 *
 * Playwright bir test basarisiz olunca isci surecini yeniden baslatir; bu da
 * modul duzeyindeki `sayac` degiskenini SIFIRLAR. Taban yalnizca sayaca
 * dayaniyorsa, yeniden baslatmanin ardindan ayni plaka ikinci kez uretilir ve
 * "bu araç zaten otoparkta" hatasi tum kalan testleri zincirleme dusurur.
 * Surec kimligi (pid) her iscide farkli oldugu icin taban da farkli olur.
 */
const TABAN = (process.pid % 800) + 100;

function plakaUret(projeAdi: string): string {
  sayac += 1;
  const harf = PROJE_HARFI[projeAdi] ?? "X";
  const numara = ((TABAN + sayac) % 900) + 100;
  return `34Z${harf}${String(numara).padStart(3, "0")}`;
}

/** "34ZE001" -> "34 ZE 001" (arayuzdeki gosterim bicimi) */
function bicimle(plaka: string): string {
  const m = /^(\d{2})([A-Z]{1,3})(\d{2,5})$/.exec(plaka);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : plaka;
}

async function girisYap(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("Kullanıcı adı").fill(E2E_KULLANICI);
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

test.describe("personel işlem akışı", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await girisYap(page);
    await vardiyaAc(page);
  });

  test("7 ADIMLIK TAM AKIŞ: giriş → sorgula → ücret → nakit → onay", async ({ page }, testInfo) => {
    // --- 1. ADIM: plaka gir ---
    const yeniPlaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(yeniPlaka);

    // --- 2. ADIM: araç girişini tamamla ---
    await page.getByTestId("arac-girisi").click();

    const girisOnay = page.getByTestId("giris-onay");
    await expect(girisOnay).toBeVisible({ timeout: 15_000 });
    await expect(girisOnay).toContainText("GİRİŞ ALINDI");
    await expect(girisOnay).toContainText(/Fiş no: P-\d{6}-\d{4}/);
    await expect(girisOnay).toContainText(bicimle(yeniPlaka));

    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    // --- 3. ADIM: çıkış için plakayı ara ---
    // 3 saat 12 dakika önce park etmiş araç kullanılıyor; böylece ücret
    // gösterimi ve tahsilat gerçek bir tutarla doğrulanır. (Az önce giren
    // aracın süresi 0 dakikadır, ücreti de 0 olur.)
    await page.getByTestId("plaka-girisi").fill(parkEdilmisPlaka(testInfo.project.name));
    await page.getByTestId("cikis-sorgula").click();

    const cikisPaneli = page.getByTestId("cikis-paneli");
    await expect(cikisPaneli).toBeVisible({ timeout: 15_000 });

    // --- 4. ADIM: ücret açık ve anlaşılır gösterilir ---
    // İlk 60 dk 40 ₺ + ceil(132/60)=3 × 25 ₺ = 115 ₺
    await expect(page.getByTestId("odenecek-tutar")).toContainText(E2E_BEKLENEN_UCRET_METNI);
    await expect(cikisPaneli).toContainText("Hesap"); // döküm şeffaf
    await expect(cikisPaneli).toContainText("İlk 60 dk");
    await expect(cikisPaneli).toContainText("3 saat × 25 ₺");
    await expect(cikisPaneli).toContainText("Süre");
    // Sure METNI dogrulanir ama tam dakika SABIT BEKLENMEZ: park edilmis arac
    // hazirlik sirasinda olusur ve tum paket calisirken gecen dakikalar sureyi
    // buyutur. Ucret bandi (181-240 dk) degismedigi icin TUTAR sabittir;
    // dogrulanmasi gereken de odur.
    await expect(cikisPaneli).toContainText(/\d+ saat \d+ dakika/);

    // --- 5. ADIM: nakit veya kart seç ---
    await expect(page.getByTestId("nakit")).toBeVisible();
    await expect(page.getByTestId("kart")).toBeVisible();

    // --- 6. ADIM: ödemeyi tamamla ---
    await page.getByTestId("nakit").click();

    // --- 7. ADIM: başarı onayı ---
    const cikisOnay = page.getByTestId("cikis-onay");
    await expect(cikisOnay).toBeVisible({ timeout: 15_000 });
    await expect(cikisOnay).toContainText("TAHSİL EDİLDİ");
    await expect(page.getByTestId("onay-tutar")).toContainText(E2E_BEKLENEN_UCRET_METNI);
    await expect(cikisOnay).toContainText("Nakit");
    await expect(cikisOnay).toContainText(/Tahsilat: T-\d{6}-\d{4}/);
  });

  test("hemen çıkan araçta süre 0 olduğu için ücret alınmaz", async ({ page }, testInfo) => {
    // Beklenen davranis: sure 0 dakika ise ucret 0'dir ve tahsilat ekrani
    // yerine tek butonlu "ÇIKIŞI TAMAMLA" gosterilir.
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("cikis-sorgula").click();
    await expect(page.getByTestId("cikis-paneli")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("odenecek-tutar")).toContainText("0,00");
    await expect(page.getByTestId("cikisi-tamamla")).toBeVisible();

    await page.getByTestId("cikisi-tamamla").click();
    const onay = page.getByTestId("cikis-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    await expect(onay).toContainText("ÇIKIŞ TAMAMLANDI");
  });

  test("plaka küçük harfle yazılsa da normalize edilir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka.toLowerCase());
    await page.getByTestId("arac-girisi").click();

    const onay = page.getByTestId("giris-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    // Büyük harf ve gruplanmış biçimde gösterilir.
    await expect(onay).toContainText(bicimle(plaka));
  });

  test("MÜKERRER GİRİŞ engellenir ve çıkışa yönlendirir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    // Aynı plakayı tekrar girmeye çalış
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();

    const uyari = page.locator('[data-uyari="uyari"]').first();
    await expect(uyari).toBeVisible({ timeout: 15_000 });
    await expect(uyari).toContainText(/otoparkta/i);
    // Personel tek dokunuşla çıkışa geçebilir.
    await expect(page.getByRole("button", { name: /Çıkışa git/i })).toBeVisible();
  });

  test("ZATEN ÇIKMIŞ araç sorgulanınca bilgilendirici uyarı verir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("cikis-sorgula").click();
    await expect(page.getByTestId("cikis-paneli")).toBeVisible({ timeout: 15_000 });
    // Süre 0 olduğu için tek butonlu çıkış akışı geçerli.
    await page.getByTestId("cikisi-tamamla").click();
    await expect(page.getByTestId("cikis-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    // Aynı plakayı yeniden sorgula: ikinci tahsilat engellenmeli.
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("cikis-sorgula").click();

    const hata = page.locator('[data-uyari="hata"]').first();
    await expect(hata).toBeVisible({ timeout: 15_000 });
    await expect(hata).toContainText(/çıkış yapmış/i);
  });

  test("otoparkta olmayan plaka sorgulanınca hata verir", async ({ page }, testInfo) => {
    await page.getByTestId("plaka-girisi").fill("34YOK909");
    await page.getByTestId("cikis-sorgula").click();

    const hata = page.locator('[data-uyari="hata"]').first();
    await expect(hata).toBeVisible({ timeout: 15_000 });
    await expect(hata).toContainText(/bulunamadı/i);
  });

  test("geçersiz plaka biçimi onay ister", async ({ page }, testInfo) => {
    await page.getByTestId("plaka-girisi").fill("ABCDEF");
    await page.getByTestId("arac-girisi").click();

    const hata = page.locator('[data-uyari="hata"]').first();
    await expect(hata).toBeVisible({ timeout: 15_000 });
    await expect(hata).toContainText(/biçimine uymuyor/i);
    await expect(page.getByRole("button", { name: /Yine de kaydet/i })).toBeVisible();
  });

  test("sayaçlar işlem sonrası güncellenir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    // Sayfa yenilendikten sonra "Otoparkta" sayacı en az 1 olmalı.
    await page.reload();
    const otoparkta = page.locator("text=Otoparkta").first();
    await expect(otoparkta).toBeVisible();
    await expect(page.getByText(bicimle(plaka))).toBeVisible();
  });

  test("boş plaka ile butonlar devre dışı", async ({ page }, testInfo) => {
    await expect(page.getByTestId("arac-girisi")).toBeDisabled();
    await expect(page.getByTestId("cikis-sorgula")).toBeDisabled();
  });

  test("işlem butonları yeterli dokunma hedefine sahip", async ({ page }, testInfo) => {
    const giris = await page.getByTestId("arac-girisi").boundingBox();
    const cikis = await page.getByTestId("cikis-sorgula").boundingBox();
    // Birincil işlem butonları 64px olarak tasarlandı.
    expect(giris!.height).toBeGreaterThanOrEqual(56);
    expect(cikis!.height).toBeGreaterThanOrEqual(56);
  });

  test("YATAY KAYDIRMA YOK (işlem paneli dahil)", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /YENİ İŞLEM/i }).click();

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("cikis-sorgula").click();
    await expect(page.getByTestId("cikis-paneli")).toBeVisible({ timeout: 15_000 });

    const tasma = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(tasma, "çıkış panelinde sayfa yatay kayıyor").toBe(false);
  });

  test("aktif araçlar listesinde görünür ve plakayla aranabilir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("arac-girisi").click();
    await expect(page.getByTestId("giris-onay")).toBeVisible({ timeout: 15_000 });

    await page.goto(`/araclar?q=${plaka}`);
    await expect(page.getByText("Otoparkta (1)")).toBeVisible();
  });
});

test.describe("yetki sınırları", () => {
  test("personel yönetim paneline giremez", async ({ page }, testInfo) => {
    await girisYap(page);
    await page.goto("/yonetim/ayarlar/tarifeler");
    // Sunucu tarafı rol kontrolü personeli vardiya ekranına geri gönderir.
    await expect(page).toHaveURL(/\/vardiya/);
  });

  test("personel fiyat listesini görebilir", async ({ page }, testInfo) => {
    await girisYap(page);
    await page.goto("/tarife");
    await expect(page.getByRole("heading", { name: /Geçerli fiyatlar/i })).toBeVisible();
  });
});
