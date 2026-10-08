import { expect, test, type Page } from "@playwright/test";
import {
  E2E_KULLANICI,
  E2E_PAROLA,
  E2E_PATRON,
  E2E_SITE_MAPS,
  E2E_SITE_SAAT,
  E2E_SITE_WHATSAPP_BAGLANTI,
} from "./global-setup";

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

  /**
   * ISLETMENIN 05.10.2026 KARARI: ziyaretci ilk ekranda "7/24 acik" bilgisini
   * ve tek dokunusla yol tarifi butonunu gormeli.
   */
  test("ana sayfada 7/24 bilgisi ve YOL TARİFİ butonu ilk ekranda", async ({ page }) => {
    await page.goto("/");

    const rozet = page.getByTestId("calisma-saatleri-rozeti");
    await expect(rozet).toHaveText(E2E_SITE_SAAT);

    const yolTarifi = page.getByTestId("yol-tarifi");
    await expect(yolTarifi).toBeVisible();
    await expect(yolTarifi).toHaveAttribute("href", E2E_SITE_MAPS);

    // Telefonda kaydirmadan gorunmeli: butonun alt kenari ekranin icinde.
    const kutu = await yolTarifi.boundingBox();
    const ekranYuksekligi = page.viewportSize()!.height;
    expect(kutu!.y + kutu!.height).toBeLessThanOrEqual(ekranYuksekligi);

    // Dokunma hedefi en az 48px (mobil oncelikli tasarim kurali).
    expect(kutu!.height).toBeGreaterThanOrEqual(48);
  });

  test("WhatsApp bağlantısı ülke koduyla üretilir", async ({ page }) => {
    await page.goto("/");
    // Ulke kodu eksik olursa WhatsApp calismayan bir sohbet acar.
    await expect(page.getByTestId("whatsapp")).toHaveAttribute(
      "href",
      E2E_SITE_WHATSAPP_BAGLANTI,
    );
  });

  test("telefon girilmediği için arama butonu çizilmez", async ({ page }) => {
    await page.goto("/");
    // Mimari kural 19: girilmemis bilgi icin yer tutucu buton konulmaz.
    await expect(page.getByTestId("ara")).toHaveCount(0);
  });

  test("iletişim sayfasında da yol tarifi butonu vardır", async ({ page }) => {
    await page.goto("/iletisim");
    await expect(page.getByTestId("yol-tarifi")).toHaveAttribute("href", E2E_SITE_MAPS);
  });

  /**
   * Sayfa baslikleri tasarim diliyle birlikte degisebilir (ornek: "Fiyatlar"
   * basligi "Fiyat bilgisi" oldu, bolum adi ustteki etikette duruyor). Bu
   * yuzden test SABIT METNE degil, YAPIYA bakar: sayfa aciliyor mu, tek bir
   * h1 var mi, bos mu degil mi.
   */
  test("fiyatlar ve iletişim sayfaları açılır", async ({ page }) => {
    for (const yol of ["/fiyatlar", "/iletisim"]) {
      await page.goto(yol);
      const baslik = page.getByRole("heading", { level: 1 });
      await expect(baslik, `${yol} başlığı`).toHaveCount(1);
      await expect(baslik, `${yol} başlığı boş`).not.toHaveText("");
    }
  });

  /**
   * ISLETMENIN 06.10.2026 ISTEGI: ust menude Ana sayfa / Otopark / Oto Yikama
   * secenekleri olsun, tiklayinca detayli bilgi gelsin.
   */
  test("üst menüden otopark ve oto yıkama sayfalarına gidilir", async ({ page }) => {
    await page.goto("/");

    // Telefonda menu saran etiket satiridir; masaustunde baslik icindedir.
    const menu = page.getByRole("link", { name: "Otopark", exact: true });
    await menu.first().click();
    await expect(page).toHaveURL(/\/otopark$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("otopark");

    await page.getByRole("link", { name: "Oto Yıkama", exact: true }).first().click();
    await expect(page).toHaveURL(/\/oto-yikama$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("oto yıkama");
  });

  test("hizmet kartları ilgili sayfaya götürür", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Oto yıkama/ }).first().click();
    await expect(page).toHaveURL(/\/oto-yikama$/);
  });

  test("hizmet sayfalarında iletişim butonları vardır", async ({ page }) => {
    for (const yol of ["/otopark", "/oto-yikama"]) {
      await page.goto(yol);
      await expect(page.getByTestId("whatsapp"), `${yol} WhatsApp`).toBeVisible();
      await expect(page.getByTestId("yol-tarifi"), `${yol} yol tarifi`).toBeVisible();
    }
  });

  test("sitede yatay kaydırma yoktur", async ({ page }) => {
    for (const yol of ["/", "/otopark", "/oto-yikama", "/fiyatlar", "/iletisim"]) {
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

/**
 * EN KÖTÜ VERİ (break-ui becerisiyle bulundu, 08.10.2026)
 *
 * ============================================================================
 * Site içeriğinin TAMAMI panelden serbest metin olarak giriliyor. Tasarım
 * kibar veriyle yapıldı: kısa işletme adı, tek telefon, "7/24 AÇIK". Gerçek
 * işletmeler böyle yazmıyor.
 *
 * Bu testler şema sınırları içinde kalan GERÇEKÇİ en kötü değerleri yazar ve
 * sayfanın kırılmadığını doğrular. Bulunan dört gerçek hata:
 *   1. Tek alana iki numara → tel: bağlantısı var olmayan numara üretiyordu
 *   2. Uzun Instagram adresi → 320px'te 296px yatay taşma
 *   3. Yüklenemeyen galeri görseli → kırık görsel ikonu
 *   4. (Ayrıca) kaydırma animasyonu JS'e bağlıydı; betik çalışmazsa sayfanın
 *      yarısı görünmüyordu — CSS'e taşındı
 *
 * Veri E2E veritabanına yazılır ve test SONUNDA GERİ ALINIR; diğer testler
 * künyenin sabit değerlerine güveniyor.
 * ============================================================================
 */
test.describe("en kötü veri", () => {
  const UZUN_UNVAN =
    "E2E Londra Camping Otopark Oto Yıkama ve Turizm İşletmeciliği Sanayi ve Ticaret Limited Şirketi";
  const IKI_NUMARA = "+90 (212) 555 00 00 / 0555 000 00 00";
  const UZUN_SAAT =
    "E2E Hafta içi 07:00–23:00, hafta sonu ve resmî tatillerde 08:00–22:00; bayramın birinci günü kapalıdır";
  const UZUN_INSTAGRAM =
    "https://www.instagram.com/londracampingotoparkotoyikamaistanbulatakoy/?hl=tr&utm_source=qr";

  test("uzun unvan, iki numara ve uzun Instagram adresi sayfayı bozmaz", async ({ page }) => {
    // Veriyi panelden yaz: gercek sinir bu yoldan gecer.
    await page.goto("/giris");
    await page.getByLabel("Kullanıcı adı").fill(E2E_PATRON);
    await page.getByLabel("Parola").fill(E2E_PAROLA);
    await page.getByRole("button", { name: /GİRİŞ YAP/i }).click();
    await expect(page).toHaveURL(/\/vardiya/);

    await page.goto("/yonetim/ayarlar/isletme");
    await page.getByLabel("İşletme adı").fill(UZUN_UNVAN);
    await page.getByLabel("Telefon").fill(IKI_NUMARA);
    await page.getByLabel("Çalışma saatleri").fill(UZUN_SAAT);
    await page.getByLabel("Instagram bağlantısı").fill(UZUN_INSTAGRAM);
    await page.getByRole("button", { name: "KAYDET" }).last().click();
    await expect(page.getByText("İşletme bilgileri kaydedildi").first()).toBeVisible({
      timeout: 15_000,
    });

    try {
      // 1. Tel baglantisi YALNIZCA ilk numarayi icerir.
      await page.goto("/");
      const ara = page.getByTestId("ara").first();
      await expect(ara).toHaveAttribute("href", "tel:+902125550000");

      // 2. Hicbir sayfada yatay tasma yok (320px dahil).
      await page.setViewportSize({ width: 320, height: 720 });
      for (const yol of ["/", "/otopark", "/oto-yikama", "/fiyatlar", "/iletisim"]) {
        await page.goto(yol);
        const tasma = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(tasma, `${yol} yatay taşma üretiyor`).toBeLessThanOrEqual(1);
      }

      // 3. Instagram adresinin TAMAMI basilmaz; kullanici adi gosterilir.
      await page.goto("/iletisim");
      const govde = await page.locator("body").innerText();
      expect(govde).not.toContain("utm_source");
    } finally {
      // Kunyeyi geri al: diger testler sabit degerlere guveniyor.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/yonetim/ayarlar/isletme");
      await page.getByLabel("İşletme adı").fill("Londra Camping Otopark");
      await page.getByLabel("Telefon").fill("");
      await page.getByLabel("Çalışma saatleri").fill(E2E_SITE_SAAT);
      await page.getByLabel("Instagram bağlantısı").fill("");
      await page.getByRole("button", { name: "KAYDET" }).last().click();
      await expect(page.getByText("İşletme bilgileri kaydedildi").first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("betikler çalışmasa da sayfa içeriği görünür", async ({ browser }) => {
    // Kaydirma animasyonu CSS'e tasindi; JS olmadan da her bolum okunur.
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const sayfa = await ctx.newPage();
    await sayfa.goto("/", { waitUntil: "domcontentloaded" });

    await expect(sayfa.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(sayfa.getByText("Hizmetlerimiz")).toBeVisible();
    await expect(sayfa.getByText("Konum").first()).toBeVisible();

    // Esik, E2E veritabanindaki metne gore degil, "sayfa bos degil"e gore.
    // Onceki surumde bu deger 0'a yakindi: bolumler opacity:0 ile gizliydi.
    const metin = await sayfa.locator("body").innerText();
    expect(metin.length, "JS kapalıyken içerik kayboluyor").toBeGreaterThan(900);

    await ctx.close();
  });
});
