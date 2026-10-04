import { expect, test, type Page } from "@playwright/test";
import {
  E2E_ABONMAN_MUSTERISI,
  E2E_DOLMUS_MUSTERISI,
  E2E_KULLANICI,
  E2E_PAROLA,
  E2E_PATRON,
  abonmanPlakalari,
} from "./global-setup";

/**
 * ABONMAN VE MUSTERI AKISLARI - UCTAN UCA
 *
 * ============================================================================
 * DIKKAT: Buradaki tutarlar YALNIZCA TEST verisidir. Sistemde genel bir
 * abonman fiyati YOKTUR; her abonmanin ucreti patron tarafindan o musteri
 * icin girilir. Testler bu davranisi dogrular.
 * ============================================================================
 *
 * Dogrulanan senaryolar (kullanicinin istedigi liste):
 *   - ayni plakanin iki aktif abonmana baglanamamasi
 *   - abonman bitisi
 *   - park sirasinda abonman bitisi (abonmanli cikis ucretsiz tamamlanir)
 *   - musteriye ozel fiyat
 *   - yenilemede eski fiyatin korunmasi
 *   - odenmemis abonmanin gecerli kabul edilmesi
 *   - bir musteriye birden fazla arac baglanmasi
 */

const PROJE_HARFI: Record<string, string> = {
  "telefon-kucuk": "K",
  "telefon-orta": "O",
  masaustu: "M",
};

let sayac = 0;

/**
 * ISCI SURECINE OZEL TABAN: Playwright basarisiz testten sonra isci surecini
 * yeniden baslatir ve modul durumu sifirlanir. Taban pid'den turetilerek
 * yeniden baslatma sonrasi plaka cakismasi onlenir.
 */
const TABAN = (process.pid % 70) + 10;

/** Proje basina benzersiz, GECERLI bicimde test plakasi. */
function plakaUret(projeAdi: string): string {
  sayac += 1;
  const harf = PROJE_HARFI[projeAdi] ?? "X";
  const numara = ((TABAN + sayac) % 90) + 10;
  return `34ZY${harf}${String(numara).padStart(2, "0")}`;
}

/** Proje basina benzersiz musteri adi (listeler karismasin). */
function musteriAdiUret(projeAdi: string, etiket: string): string {
  const harf = PROJE_HARFI[projeAdi] ?? "X";
  return `E2E ${etiket} ${harf}${Date.now().toString().slice(-5)}`;
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

/** Yeni musteri olusturur ve musteri detay sayfasinda kalir. */
async function musteriOlustur(page: Page, ad: string, telefon: string) {
  await page.goto("/musteriler/yeni");
  await page.getByTestId("musteri-ad").fill(ad);
  await page.getByTestId("musteri-telefon").fill(telefon);
  await page.getByTestId("musteri-kaydet").click();
  await expect(page).toHaveURL(/\/musteriler\/[a-z0-9]+$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(ad);
}

/** Musteri detay sayfasinda plaka baglar. */
async function aracBagla(page: Page, plaka: string) {
  await page.getByTestId("arac-plaka").fill(plaka);
  await page.getByTestId("arac-bagla").click();
  await expect(page.getByText(bicimle(plaka), { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Yarin/gelecek tarih (YYYY-MM-DD). */
function tarih(gunFark: number): string {
  return new Date(Date.now() + gunFark * 86_400_000).toISOString().slice(0, 10);
}

// ===========================================================================
// PERSONEL EKRANI
// ===========================================================================

test.describe("personel: plaka ile abonman sorgusu", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
    await vardiyaAc(page);
  });

  test("ÖDENMEMİŞ abonman GEÇERLİ görünür: müşteri, tarih, kalan gün ve uyarı", async ({
    page,
  }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(p.aktif);
    await page.getByTestId("abonman-sorgula").click();

    const kart = page.getByTestId("abonman-karti");
    await expect(kart).toBeVisible({ timeout: 15_000 });
    // Gecerli abonman: ucret alinmaz.
    await expect(kart).toHaveAttribute("data-abonman", "gecerli");
    await expect(page.getByTestId("abonman-musteri")).toContainText(E2E_ABONMAN_MUSTERISI);
    await expect(page.getByTestId("kalan-gun")).toContainText("gün");
    await expect(kart).toContainText("Başlangıç");
    await expect(kart).toContainText("Bitiş");
    await expect(kart).toContainText("Ödenmedi");
    await expect(kart).toContainText("Otopark ücreti alınmaz.");
    // S9: odeme alinmamis olsa da giris engellenmez.
    await expect(kart).toContainText(/engellenmez/);
  });

  test("ABONMAN SÜRESİ DOLMUŞ açıkça uyarır: normal tarife uygulanacak", async ({
    page,
  }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(p.dolmus);
    await page.getByTestId("abonman-sorgula").click();

    const kart = page.getByTestId("abonman-karti");
    await expect(kart).toBeVisible({ timeout: 15_000 });
    await expect(kart).toHaveAttribute("data-abonman", "gecersiz");
    await expect(kart).toContainText(E2E_DOLMUS_MUSTERISI);
    await expect(kart).toContainText(/SÜRESİ DOLMUŞ/);
    await expect(kart).toContainText(/NORMAL TARİFE/);
  });

  test("abonmanı olmayan plaka ABONMAN YOK gösterir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("abonman-sorgula").click();

    const kart = page.getByTestId("abonman-karti");
    await expect(kart).toBeVisible({ timeout: 15_000 });
    await expect(kart).toHaveAttribute("data-abonman", "yok");
    await expect(kart).toContainText("ABONMAN YOK");
    await expect(kart).toContainText(/Normal tarife uygulanır/);
  });

  test("sorgu sonrası doğrudan araç girişi alınabilir", async ({ page }, testInfo) => {
    const plaka = plakaUret(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(plaka);
    await page.getByTestId("abonman-sorgula").click();
    await expect(page.getByTestId("abonman-paneli")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("sorgudan-giris").click();
    const onay = page.getByTestId("giris-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    await expect(onay).toContainText("GİRİŞ ALINDI");
  });

  test("otoparkta olan abonmanlı araç için çıkışa yönlendirir", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(p.parkli);
    await page.getByTestId("abonman-sorgula").click();
    await expect(page.getByTestId("abonman-paneli")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Bu araç şu anda otoparkta.")).toBeVisible();
    await expect(page.getByTestId("sorgudan-cikis")).toBeVisible();
  });

  test("abonman kartı mobilde yatay kaydırma üretmez", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);
    await page.getByTestId("plaka-girisi").fill(p.aktif);
    await page.getByTestId("abonman-sorgula").click();
    await expect(page.getByTestId("abonman-karti")).toBeVisible({ timeout: 15_000 });

    const tasma = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(tasma).toBeLessThanOrEqual(1);
  });

  test("abonman sorgula butonu yeterli dokunma hedefine sahip", async ({ page }) => {
    await page.getByTestId("plaka-girisi").fill("34ABC123");
    const kutu = await page.getByTestId("abonman-sorgula").boundingBox();
    expect(kutu!.height).toBeGreaterThanOrEqual(48);
  });

  test("boş plaka ile abonman sorgulanamaz", async ({ page }) => {
    await expect(page.getByTestId("abonman-sorgula")).toBeDisabled();
  });
});

test.describe("personel: abonmanlı araç çıkışı", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
    await vardiyaAc(page);
  });

  test("ABONMANLI ÇIKIŞ: ücret hesaplama akışı AÇILMAZ, çıkış ücretsiz tamamlanır", async ({
    page,
  }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);

    await page.getByTestId("plaka-girisi").fill(p.parkli);
    await page.getByTestId("cikis-sorgula").click();

    const panel = page.getByTestId("cikis-paneli");
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // Abonman karti gosterilir, musteri gorunur.
    await expect(page.getByTestId("abonman-karti")).toBeVisible();
    await expect(panel).toContainText(E2E_ABONMAN_MUSTERISI);

    // UCRET HESAPLAMA AKISI ACILMAZ: tutar kutusu ve nakit/kart yok.
    await expect(page.getByTestId("abonman-ucretsiz")).toBeVisible();
    await expect(page.getByTestId("abonman-ucretsiz")).toContainText("ÜCRET ALINMAZ");
    await expect(page.getByTestId("odenecek-tutar")).toHaveCount(0);
    await expect(page.getByTestId("nakit")).toHaveCount(0);
    await expect(page.getByTestId("kart")).toHaveCount(0);

    // Tek dokunusla cikis tamamlanir.
    await page.getByTestId("cikisi-tamamla").click();

    const onay = page.getByTestId("cikis-onay");
    await expect(onay).toBeVisible({ timeout: 15_000 });
    await expect(onay).toContainText("ÇIKIŞ TAMAMLANDI");
    await expect(onay).toContainText("Abonman kapsamında — ücret alınmadı");
    await expect(onay).toContainText(bicimle(p.parkli));
  });
});

// ===========================================================================
// PATRON PANELI
// ===========================================================================

test.describe("patron: müşteri ve abonman yönetimi", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
  });

  test("MÜŞTERİYE BİRDEN FAZLA ARAÇ bağlanabilir", async ({ page }, testInfo) => {
    const ad = musteriAdiUret(testInfo.project.name, "Çok Araçlı");
    await musteriOlustur(page, ad, "0532 111 22 33");

    const birinci = plakaUret(testInfo.project.name);
    const ikinci = plakaUret(testInfo.project.name);
    await aracBagla(page, birinci);
    await aracBagla(page, ikinci);

    await expect(page.getByText("Araçlar (2)")).toBeVisible();
    // Plaka hem arac kartinda hem basari mesajinda gorunur: ilki yeterli.
    await expect(page.getByText(bicimle(birinci)).first()).toBeVisible();
    await expect(page.getByText(bicimle(ikinci)).first()).toBeVisible();
  });

  test("abonman ücreti ÖN DOLU GELMEZ: genel abonman fiyatı yoktur", async ({
    page,
  }, testInfo) => {
    const ad = musteriAdiUret(testInfo.project.name, "Fiyat Kontrol");
    await musteriOlustur(page, ad, "0532 111 22 33");
    const plaka = plakaUret(testInfo.project.name);
    await aracBagla(page, plaka);

    await page.getByTestId("yeni-abonman").click();
    await expect(page.getByTestId("abonman-ucret")).toBeVisible({ timeout: 15_000 });

    // Ucret alani BOS: sistem fiyat varsaymaz.
    await expect(page.getByTestId("abonman-ucret")).toHaveValue("");
    // Bitis tarihi de bos: sure de varsayilmaz.
    await expect(page.getByTestId("abonman-bitis")).toHaveValue("");
    await expect(page.getByText(/bu müşteriye özeldir/i)).toBeVisible();
  });

  test("MÜŞTERİYE ÖZEL FİYAT ile abonman oluşturulur; TAHSİLAT OLUŞMAZ", async ({
    page,
  }, testInfo) => {
    const ad = musteriAdiUret(testInfo.project.name, "Abonman Kuran");
    await musteriOlustur(page, ad, "0532 111 22 33");
    const plaka = plakaUret(testInfo.project.name);
    await aracBagla(page, plaka);

    await page.getByTestId("yeni-abonman").click();
    await expect(page.getByTestId("abonman-ucret")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("abonman-bitis").fill(tarih(30));
    await page.getByTestId("abonman-ucret").fill("2750");
    await page.getByTestId("abonman-kaydet").click();

    await expect(page).toHaveURL(/\/abonmanlar\/[a-z0-9]+$/, { timeout: 20_000 });

    // Girilen ucret aynen gorunur.
    await expect(page.getByTestId("donem-1-fiyat")).toContainText("2.750,00");
    // KURAL 1: abonman olusturmak tahsilat olusturmaz.
    await expect(page.getByText("Ödenmedi").first()).toBeVisible();
    await expect(page.getByText("Henüz tahsilat kaydı yok.")).toBeVisible();
    await expect(page.getByText(/Ödeme alınmamış — abonman yine geçerli/)).toBeVisible();
  });

  test("TAHSİLAT AYRI İŞLEMDİR ve tahsil edeni kaydeder", async ({ page }, testInfo) => {
    const ad = musteriAdiUret(testInfo.project.name, "Tahsilat");
    await musteriOlustur(page, ad, "0532 111 22 33");
    await aracBagla(page, plakaUret(testInfo.project.name));

    await page.getByTestId("yeni-abonman").click();
    await page.getByTestId("abonman-bitis").fill(tarih(30));
    await page.getByTestId("abonman-ucret").fill("1500");
    await page.getByTestId("abonman-kaydet").click();
    await expect(page).toHaveURL(/\/abonmanlar\/[a-z0-9]+$/, { timeout: 20_000 });

    // Tahsilat formu kalan tutarla gelir.
    // Kalan tutar binlik ayraciyla gelir; form bu bicimi de dogru okur.
    await expect(page.getByTestId("tahsilat-tutar")).toHaveValue("1.500,00");
    await page.getByTestId("yontem-cash").click();
    await page.getByTestId("tahsilati-kaydet").click();

    await expect(page.getByTestId("tahsilat-basari")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("tahsilat-basari")).toContainText(/Dönem tamamen ödendi/);

    // Odeme gecmisinde tahsil eden gorunur.
    await expect(page.getByTestId("odeme-gecmisi")).toContainText("E2E Patron");
    await expect(page.getByTestId("odeme-gecmisi")).toContainText("Nakit");
  });

  test("YENİLEMEDE ESKİ DÖNEMİN FİYATI DEĞİŞMEZ", async ({ page }, testInfo) => {
    const ad = musteriAdiUret(testInfo.project.name, "Yenileme");
    await musteriOlustur(page, ad, "0532 111 22 33");
    await aracBagla(page, plakaUret(testInfo.project.name));

    await page.getByTestId("yeni-abonman").click();
    await page.getByTestId("abonman-bitis").fill(tarih(10));
    await page.getByTestId("abonman-ucret").fill("1000");
    await page.getByTestId("abonman-kaydet").click();
    await expect(page).toHaveURL(/\/abonmanlar\/[a-z0-9]+$/, { timeout: 20_000 });
    await expect(page.getByTestId("donem-1-fiyat")).toContainText("1.000,00");

    // Yeni donem: FARKLI fiyat.
    await page.getByTestId("yenileme-bitis").fill(tarih(40));
    await page.getByTestId("yenileme-ucret").fill("1800");
    await page.getByTestId("yenile").click();

    await expect(page.getByText(/2\. dönem açıldı/)).toBeVisible({ timeout: 20_000 });

    // ESKI DONEM AYNI KALDI, yeni donem yeni fiyat.
    await expect(page.getByTestId("donem-1-fiyat")).toContainText("1.000,00");
    await expect(page.getByTestId("donem-2-fiyat")).toContainText("1.800,00");
    await expect(page.getByText(/Geçmiş dönemlerin fiyatı ve kuralı değiştirilemez/)).toBeVisible();
  });

  test("AYNI PLAKA İKİNCİ ABONMANA EKLENEMEZ (arayüzde uyarı)", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);

    // Yeni bir musteri ve abonman; sonra BASKASININ abonmanindaki plakayi ekle.
    const ad = musteriAdiUret(testInfo.project.name, "Çakışma");
    await musteriOlustur(page, ad, "0532 111 22 33");
    await aracBagla(page, plakaUret(testInfo.project.name));

    await page.getByTestId("yeni-abonman").click();
    await page.getByTestId("abonman-bitis").fill(tarih(30));
    await page.getByTestId("abonman-ucret").fill("1000");
    await page.getByTestId("arac-sayisi").fill("3");
    await page.getByTestId("abonman-kaydet").click();
    await expect(page).toHaveURL(/\/abonmanlar\/[a-z0-9]+$/, { timeout: 20_000 });

    // Baska musterinin AKTIF abonmanindaki plaka.
    await page.getByTestId("abonman-arac-plaka").fill(p.aktif);
    await page.getByTestId("abonman-arac-ekle").click();

    const hata = page.getByTestId("arac-ekle-hata");
    await expect(hata).toBeVisible({ timeout: 20_000 });
    await expect(hata).toContainText(/yalnızca tek abonmanda olabilir/);
  });

  test("abonman listesi filtreleri çalışır", async ({ page }) => {
    await page.goto("/abonmanlar");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Abonmanlar");

    await page.getByTestId("filtre-odenmemis").click();
    await expect(page).toHaveURL(/filtre=odenmemis/);
    await expect(page.getByText(/Ödenmemiş abonman geçersiz değildir/)).toBeVisible();

    await page.getByTestId("filtre-dolmus").click();
    await expect(page).toHaveURL(/filtre=dolmus/);
    await expect(page.getByTestId("abonman-listesi")).toContainText(E2E_DOLMUS_MUSTERISI);
  });

  test("abonmanlı araçlar listesi plakayı ve kalan günü gösterir", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);
    await page.goto("/abonmanli-araclar");
    await page.getByTestId("abonmanli-ara").fill(p.aktif);
    await page.getByRole("button", { name: "ARA" }).click();

    const liste = page.getByTestId("abonmanli-arac-listesi");
    await expect(liste).toBeVisible({ timeout: 15_000 });
    await expect(liste).toContainText(bicimle(p.aktif));
    await expect(liste).toContainText(E2E_ABONMAN_MUSTERISI);
    await expect(liste).toContainText("gün");
  });

  test("patron abonman panelinde tüm ekranlar listelenir", async ({ page }) => {
    await page.goto("/yonetim/abonman");
    for (const etiket of [
      "Müşteriler",
      "Abonmanlar",
      "Abonmanlı araçlar",
      "Süresi yaklaşanlar",
      "Süresi dolanlar",
      "Ödenmemiş abonmanlar",
      "Abonman ödeme geçmişi",
    ]) {
      await expect(page.getByRole("link", { name: new RegExp(etiket) }).first()).toBeVisible();
    }
  });

  test("müşteri plakayla aranabilir", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);
    await page.goto("/musteriler");
    await page.getByTestId("musteri-ara").fill(p.aktif);
    await page.getByRole("button", { name: "ARA" }).click();
    await expect(page.getByText(E2E_ABONMAN_MUSTERISI).first()).toBeVisible({ timeout: 15_000 });
  });

  test("müşteri detayında aracın abonman geçmişi görünür", async ({ page }, testInfo) => {
    const p = abonmanPlakalari(testInfo.project.name);
    await page.goto("/musteriler");
    await page.getByTestId("musteri-ara").fill(p.aktif);
    await page.getByRole("button", { name: "ARA" }).click();
    await page.getByText(E2E_ABONMAN_MUSTERISI).first().click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E_ABONMAN_MUSTERISI);
    await expect(page.getByText(bicimle(p.aktif)).first()).toBeVisible();
    // Aracin altinda abonman gecmisi satiri (A- kodlu baglanti).
    await expect(page.getByRole("link", { name: /A-E2E-/ }).first()).toBeVisible();
  });

  test("abonman ödeme geçmişi ekranı tahsil edeni gösterir", async ({ page }) => {
    await page.goto("/yonetim/abonman/odemeler");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Abonman ödeme geçmişi",
    );
    await expect(page.getByText(/Net tahsilat/)).toBeVisible();
  });

  test("abonman sayfaları masaüstü ve mobilde yatay kaydırma üretmez", async ({ page }) => {
    for (const yol of ["/abonmanlar", "/abonmanli-araclar", "/musteriler", "/yonetim/abonman"]) {
      await page.goto(yol);
      const tasma = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(tasma, `yatay taşma: ${yol}`).toBeLessThanOrEqual(1);
    }
  });
});
