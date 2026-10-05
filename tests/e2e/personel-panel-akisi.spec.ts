import { expect, test, type Page } from "@playwright/test";
import {
  E2E_KULLANICI,
  E2E_PAROLA,
  E2E_PATRON,
  E2E_PERSONEL_ONEKI,
} from "./global-setup";

/**
 * AŞAMA 6 AKIŞLARI — PERSONEL, AVANS/MAAŞ, PATRON PANELİ, DENETİM
 *
 * ============================================================================
 * DİKKAT: Tüm isimler, maaşlar ve tutarlar YALNIZCA TESTtir. Londra Camping
 * Otopark'ın gerçek personeli veya maaşları DEĞİLDİR.
 *
 * E2E veritabanı üç Playwright projesi arasında PAYLAŞILIR. Bu yüzden:
 *   · her test kendi personel hesabını PROJEYE ÖZEL kullanıcı adıyla açar,
 *   · doğrulamalar o hesabın/plakanın satırına daraltılır ("liste boş"
 *     varsayımı yapılmaz),
 *   · kasa açan test onu kapatarak biter (tek açık kasa kuralı).
 * ============================================================================
 */

const PROJE_HARFI: Record<string, string> = {
  "telefon-kucuk": "k",
  "telefon-orta": "o",
  masaustu: "m",
};

let sayac = 0;
/** İşçi yeniden başlatmasına dayanıklı, projeye özel kullanıcı adı. */
const TABAN = process.pid % 10_000;

function kullaniciAdiUret(projeAdi: string): string {
  sayac += 1;
  const harf = PROJE_HARFI[projeAdi] ?? "x";
  return `${E2E_PERSONEL_ONEKI}${harf}${TABAN}${sayac}`;
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

/** Personel hesabı açar ve kullanıcı adını verir. */
async function personelAc(page: Page, kullaniciAdi: string, adSoyad: string) {
  await page.goto("/yonetim/personel");
  await expect(page.getByRole("heading", { name: "Personel", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByTestId("personel-ekle-ac").click();
  await page.getByTestId("personel-ad").fill(adSoyad);
  await page.getByTestId("personel-kullanici-adi").fill(kullaniciAdi);
  await page.getByTestId("personel-rol").selectOption("STAFF");
  await page.getByTestId("personel-kaydet").click();

  // Parola BİR KEZ gösterilir.
  await expect(page.getByTestId("yeni-parola")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("yeni-kullanici-adi")).toHaveText(kullaniciAdi);
  const parola = await page.getByTestId("yeni-parola").innerText();

  await page.getByTestId("personel-parola-anladim").click();
  await expect(page.getByTestId(`personel-link-${kullaniciAdi}`)).toBeVisible({
    timeout: 15_000,
  });

  return parola;
}

/** Açık kasa varsa gerekçeyle kapatır (tek açık kasa kuralı). */
async function kasayiKapatVarsa(page: Page) {
  await page.goto("/kasa");
  const kapatAc = page.getByTestId("kasa-kapat-ac");
  if (!(await kapatAc.isVisible().catch(() => false))) return;
  await kapatAc.click();
  await page.getByTestId("sayilan-nakit").fill("0");
  await page.getByTestId("fark-sebebi").fill("E2E Aşama 6 temizlik kapanışı");
  await page.getByTestId("kasa-kapat").click();
  await expect(page.getByTestId("son-kapanis")).toBeVisible({ timeout: 15_000 });
}

// ===========================================================================
// PERSONEL YÖNETİMİ
// ===========================================================================

test.describe.serial("personel yönetimi", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
  });

  test("TAM AKIŞ: hesap aç → parola bir kez → listede görün → kapat", async ({
    page,
  }, testInfo) => {
    const kullaniciAdi = kullaniciAdiUret(testInfo.project.name);
    const parola = await personelAc(page, kullaniciAdi, "E2E Test Personeli");

    // Üretilen parola güçlü olmalı.
    expect(parola.length).toBeGreaterThanOrEqual(12);

    // Satır rozetleri: ilk girişte parola değiştirecek.
    const satir = page.getByRole("listitem").filter({ hasText: kullaniciAdi });
    await expect(satir).toContainText("PAROLA DEĞİŞTİRECEK");
    await expect(satir).toContainText("Personel");

    // --- HESABI KAPAT ---
    await satir.getByTestId(`durum-ac-${await satirId(page, kullaniciAdi)}`).click();
    await satir.getByTestId(`durum-kaydet-${await satirId(page, kullaniciAdi)}`).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: kullaniciAdi }),
    ).toContainText("KULLANIM DIŞI", { timeout: 15_000 });
  });

  test("MÜDÜR rolü seçeneklerde YOKTUR (karar 05.10.2026)", async ({ page }) => {
    await page.goto("/yonetim/personel");
    await page.getByTestId("personel-ekle-ac").click();

    const secenekler = await page.getByTestId("personel-rol").locator("option").allInnerTexts();
    expect(secenekler).toHaveLength(2);
    expect(secenekler.join(" ")).not.toMatch(/[Mm]üdür|[Ss]orumlu|MANAGER/);
    expect(secenekler.join(" ")).toMatch(/Personel/);
    expect(secenekler.join(" ")).toMatch(/İşletme sahibi/);
  });

  test("KASA KAPATMA yetkisi personele tek tek verilir", async ({ page }, testInfo) => {
    const kullaniciAdi = kullaniciAdiUret(testInfo.project.name);
    await personelAc(page, kullaniciAdi, "E2E Yetki Testi");

    await page.getByTestId(`personel-link-${kullaniciAdi}`).click();
    await expect(page.getByRole("heading", { name: "E2E Yetki Testi" })).toBeVisible({
      timeout: 15_000,
    });

    // Başlangıçta rolde YOK.
    const satir = page.getByRole("listitem").filter({ hasText: "cash.drawer.close" });
    await expect(satir).toContainText("Rolde yok");

    // Ek olarak ver.
    await page.getByTestId("izin-ver-cash.drawer.close").click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "cash.drawer.close" }),
    ).toContainText("Ek olarak verildi", { timeout: 15_000 });

    // Role dön: sapma silinir.
    await page.getByTestId("izin-taban-cash.drawer.close").click();
    await expect(
      page.getByRole("listitem").filter({ hasText: "cash.drawer.close" }),
    ).toContainText("Rolde yok", { timeout: 15_000 });
  });

  test("MAAŞ bilgisi kaydedilir ve yalnızca patronda görünür", async ({ page }, testInfo) => {
    const kullaniciAdi = kullaniciAdiUret(testInfo.project.name);
    await personelAc(page, kullaniciAdi, "E2E Maaş Testi");

    await page.getByTestId(`personel-link-${kullaniciAdi}`).click();
    await page.getByTestId("maliyet-maas").fill("30000");
    await page.getByTestId("maliyet-kaydet").click();
    await expect(page.getByTestId("maliyet-basari")).toBeVisible({ timeout: 15_000 });

    // Listede maaş kolonu görünür.
    await page.goto("/yonetim/personel");
    await expect(
      page.getByRole("listitem").filter({ hasText: kullaniciAdi }),
    ).toContainText("30.000,00", { timeout: 15_000 });
  });

});

/**
 * PERSONEL yetki testleri AYRI describe'da: yukarıdaki beforeEach patron
 * olarak giriş yapıyor ve giriş yapılmış oturumda /giris sayfası /vardiya'ya
 * yönlendiriliyor; aynı testte ikinci kez giriş yapılamaz (Aşama 5'te yaşandı).
 */
test.describe("personel yetki sınırları", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_KULLANICI);
  });

  test("personel yönetim paneline giremez", async ({ page }) => {
    await page.goto("/yonetim/personel");
    // Yönetim layout'u patron olmayanı /vardiya'ya yönlendirir.
    await expect(page).toHaveURL(/\/vardiya/, { timeout: 15_000 });
  });

  test("personel denetim ekranına giremez", async ({ page }) => {
    await page.goto("/yonetim/denetim");
    await expect(page).toHaveURL(/\/vardiya/, { timeout: 15_000 });
  });

  test("personel bazlı tahsilat raporuna giremez", async ({ page }) => {
    await page.goto("/yonetim/raporlar/personel");
    await expect(page).toHaveURL(/\/vardiya/, { timeout: 15_000 });
  });
});

/**
 * Açılır listede bir personeli adına göre seçer.
 *
 * `selectOption({ label: ... })` RegExp KABUL ETMEZ (Aşama 5'te yaşandı);
 * bu yüzden seçeneğin `value` değeri okunup onunla seçilir.
 */
async function personelSec(page: Page, testId: string, adSoyad: string) {
  const deger = await page
    .getByTestId(testId)
    .locator("option", { hasText: adSoyad })
    .first()
    .getAttribute("value");
  expect(deger, `${adSoyad} seçeneği bulunmalı`).toBeTruthy();
  await page.getByTestId(testId).selectOption(deger!);
}

/** Satırdaki personelin id'sini test kancasından okur. */
async function satirId(page: Page, kullaniciAdi: string): Promise<string> {
  const href = await page
    .getByTestId(`personel-link-${kullaniciAdi}`)
    .getAttribute("href");
  return (href ?? "").split("/").pop() ?? "";
}

// ===========================================================================
// AVANS VE MAAŞ MAHSUBU
// ===========================================================================

test.describe.serial("avans ve maaş", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
    await vardiyaAc(page);
    await kasayiKapatVarsa(page);
  });

  test("TAM AKIŞ: avans ver → maaş öde → mahsup üç sayıda görünür", async ({
    page,
  }, testInfo) => {
    const kullaniciAdi = kullaniciAdiUret(testInfo.project.name);
    const adSoyad = `E2E Avans ${testInfo.project.name}`;
    await personelAc(page, kullaniciAdi, adSoyad);

    // Kasa aç: avans kasadan çıkacak.
    await page.goto("/kasa");
    await page.getByTestId("kasa-acilis-nakdi").fill("20000");
    await page.getByTestId("kasa-ac").click();
    await expect(page.getByText("Kasa açık")).toBeVisible({ timeout: 15_000 });

    // --- AVANS: 500 ₺ ---
    await page.goto("/yonetim/personel");
    await page.getByTestId("avans-ac").click();
    await personelSec(page, "avans-personel", adSoyad);
    await page.getByTestId("avans-tutar").fill("500");
    await page.getByTestId("avans-kaydet").click();
    await expect(page.getByTestId("avans-basari")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("avans-basari")).toContainText("500,00");

    // --- MAAŞ: 10.000 ₺, 500 ₺ mahsup ---
    await page.getByTestId("maas-ac").click();
    await personelSec(page, "maas-personel", adSoyad);
    await page.getByTestId("maas-tutar").fill("10000");

    // Mahsup kutusunu işaretle (bu personelin tek açık avansı).
    const mahsupKutusu = page.locator('[data-test^="mahsup-"]').first();
    await expect(mahsupKutusu).toBeVisible();
    await mahsupKutusu.check();

    // ÜÇ SAYI açıkça: gider tam, mahsup, ödenecek.
    await expect(page.getByTestId("maas-gider")).toContainText("10.000,00");
    await expect(page.getByTestId("maas-mahsup")).toContainText("500,00");
    await expect(page.getByTestId("maas-odenecek")).toContainText("9.500,00");

    await page.getByTestId("maas-kaydet").click();
    await expect(page.getByTestId("maas-basari")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("maas-basari")).toContainText("9.500,00");

    // Avans MAHSUP EDİLDİ rozetine döner.
    //
    // DİKKAT: personel adı HEM personel listesi satırında HEM avans kaydı
    // satırında geçer; `.first()` personel satırını yakalar. Bu yüzden iki
    // filtre birlikte kullanılır: adı VE rozeti taşıyan satır.
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: adSoyad })
        .filter({ hasText: "MAHSUP EDİLDİ" }),
    ).toHaveCount(1, { timeout: 15_000 });

    // Kasayı kapat (tek açık kasa kuralı).
    await kasayiKapatVarsa(page);
  });

  test("avans GİDER raporuna GİRMEZ", async ({ page }, testInfo) => {
    const kullaniciAdi = kullaniciAdiUret(testInfo.project.name);
    const adSoyad = `E2E Gider Dışı ${testInfo.project.name}`;
    await personelAc(page, kullaniciAdi, adSoyad);

    // Bugünün gider toplamını önce oku.
    await page.goto("/yonetim/finans/giderler");
    const oncekiBaslik = await page
      .getByText(/Son 90 gün ·/)
      .innerText()
      .catch(() => "");

    // Avans ver (kasa kapalı: kasa hareketi üretmez ama alacak kaydedilir).
    await page.goto("/yonetim/personel");
    await page.getByTestId("avans-ac").click();
    await personelSec(page, "avans-personel", adSoyad);
    await page.getByTestId("avans-tutar").fill("750");
    await page.getByTestId("avans-kaydet").click();
    await expect(page.getByTestId("avans-basari")).toBeVisible({ timeout: 15_000 });

    // Gider listesinde bu avans YOK: ekranda avans açıklaması aranmaz.
    await page.goto("/yonetim/finans/giderler");
    await expect(page.getByRole("listitem").filter({ hasText: "750,00" })).toHaveCount(0);
    // Gider toplamı değişmedi.
    const sonrakiBaslik = await page
      .getByText(/Son 90 gün ·/)
      .innerText()
      .catch(() => "");
    expect(sonrakiBaslik).toBe(oncekiBaslik);
  });

  test("avansın gider olmadığı ekranda YAZILI", async ({ page }) => {
    await page.goto("/yonetim/personel");
    await expect(page.getByText("Avans gider değil, alacaktır")).toBeVisible({
      timeout: 15_000,
    });
  });
});

// ===========================================================================
// PATRON PANELİ
// ===========================================================================

test.describe("patron paneli", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
  });

  test("dönem çipleri URL'e yazılır ve panel yeniden hesaplanır", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByRole("heading", { name: "İşletme durumu" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("donem-ay").click();
    await expect(page).toHaveURL(/donem=ay/, { timeout: 15_000 });
    await expect(page.getByTestId("panel-donem")).toContainText("Bu ay");

    await page.getByTestId("donem-hafta").click();
    await expect(page).toHaveURL(/donem=hafta/, { timeout: 15_000 });
    await expect(page.getByTestId("panel-donem")).toContainText("Bu hafta");
  });

  test("ÖZEL ARALIK seçilebilir ve bitiş günü dahildir", async ({ page }) => {
    await page.goto("/yonetim");
    await page.getByTestId("donem-ozel").click();
    await page.getByTestId("ozel-baslangic").fill("2026-10-01");
    await page.getByTestId("ozel-bitis").fill("2026-10-07");
    await page.getByTestId("ozel-uygula").click();

    await expect(page).toHaveURL(/donem=ozel/, { timeout: 15_000 });
    // Ekranda 01.10.2026 – 07.10.2026 görünür (bitiş DAHİL gösterilir).
    await expect(page.getByTestId("panel-donem")).toContainText("01.10.2026");
    await expect(page.getByTestId("panel-donem")).toContainText("07.10.2026");
  });

  test("DOLULUK YÜZDESİ gösterilmez (kapasite tanımsız)", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByText("Otoparkta")).toBeVisible({ timeout: 15_000 });
    // Kapasite sınırı yok kararı gereği doluluk kartı HİÇ çizilmez.
    await expect(page.getByText("Doluluk", { exact: true })).toHaveCount(0);
  });

  test("otopark, yıkama ve abonman AYRI satırlarda (mimari kural 11)", async ({ page }) => {
    await page.goto("/yonetim");
    const gelirKarti = page.getByText("Gelir", { exact: true }).locator("..").locator("..");
    await expect(gelirKarti.getByText("Otopark")).toBeVisible();
    await expect(gelirKarti.getByText("Oto yıkama")).toBeVisible();
    await expect(gelirKarti.getByText("Abonman")).toBeVisible();
  });

  test("NET kartı ve 'kasa bakiyesi değildir' notu görünür", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByTestId("panel-net")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Net bir kasa bakiyesi değildir/)).toBeVisible();
  });

  test("dönem karşılaştırması ve trend grafiği çizilir", async ({ page }) => {
    await page.goto("/yonetim");
    await expect(page.getByTestId("karsilastirma")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("trend-grafigi")).toBeVisible();
    // Üç seri etiketi (renk körlüğünde de okunur).
    await expect(page.getByTestId("trend-grafigi")).toHaveAttribute("role", "img");
  });

  test("uyarı merkezi çizilir ve ekrana bağlanır", async ({ page }) => {
    await page.goto("/yonetim");
    const merkez = page.getByTestId("uyari-merkezi");
    const yok = page.getByTestId("uyari-yok");
    await expect(merkez.or(yok)).toBeVisible({ timeout: 15_000 });

    if (await merkez.isVisible().catch(() => false)) {
      // Her uyarı bir bağlantıdır.
      const ilkBaglanti = merkez.getByRole("link").first();
      await expect(ilkBaglanti).toHaveAttribute("href", /^\//);
    }
  });

  test("personel bazlı tahsilat raporu açılır", async ({ page }) => {
    await page.goto("/yonetim/raporlar/personel");
    await expect(
      page.getByRole("heading", { name: "Personel bazlı tahsilat" }),
    ).toBeVisible({ timeout: 15_000 });
    // Performans değerlendirmesi olmadığı açıkça yazılı.
    await expect(page.getByText(/performans değerlendirmesi değildir/)).toBeVisible();
  });

  test("mobilde yatay kaydırma olmaz (panel ve raporlar)", async ({ page }) => {
    for (const yol of ["/yonetim", "/yonetim/raporlar/personel", "/yonetim/denetim"]) {
      await page.goto(yol);
      await page.waitForLoadState("networkidle");
      const tasma = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(tasma, yol).toBeLessThanOrEqual(1);
    }
  });

  test("dönem çipleri yeterli dokunma hedefine sahip", async ({ page }) => {
    await page.goto("/yonetim");
    for (const d of ["gun", "hafta", "ay"]) {
      const kutu = await page.getByTestId(`donem-${d}`).boundingBox();
      expect(kutu, d).not.toBeNull();
      expect(kutu!.height, d).toBeGreaterThanOrEqual(47.5);
    }
  });
});

// ===========================================================================
// DENETİM KAYITLARI
// ===========================================================================

test.describe("denetim kayıtları", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
  });

  test("kayıtlar listelenir ve grup filtresi çalışır", async ({ page }) => {
    await page.goto("/yonetim/denetim");
    await expect(page.getByRole("heading", { name: "Denetim kayıtları" })).toBeVisible({
      timeout: 15_000,
    });

    // Giriş yapıldığı için en az bir güvenlik kaydı vardır.
    await page.getByTestId("denetim-grup-guvenlik").click();
    await expect(page).toHaveURL(/grup=guvenlik/, { timeout: 15_000 });
    await expect(page.getByTestId("denetim-listesi")).toContainText("Giriş yapıldı");
  });

  test("eylem adları TÜRKÇE gösterilir", async ({ page }) => {
    await page.goto("/yonetim/denetim?grup=guvenlik");
    const liste = page.getByTestId("denetim-listesi");
    await expect(liste).toBeVisible({ timeout: 15_000 });
    // Ham enum adı ekranda görünmez.
    await expect(liste).not.toContainText("LOGIN_SUCCESS");
  });

  test("kayıtların değiştirilemediği ekranda YAZILI", async ({ page }) => {
    await page.goto("/yonetim/denetim");
    await expect(page.getByText("Kayıtlar değiştirilemez")).toBeVisible({ timeout: 15_000 });
  });
});

// ===========================================================================
// VARDİYA PENCERELERİ
// ===========================================================================

test.describe.serial("vardiya saatleri", () => {
  test.beforeEach(async ({ page }) => {
    await girisYap(page, E2E_PATRON);
  });

  test("pencere kaydedilir ve vardiya ekranında etiket görünür", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/isletme");
    await expect(page.getByRole("heading", { name: "Vardiya saatleri" })).toBeVisible({
      timeout: 15_000,
    });

    // 24 saati kapsayan pencere: test saatinden bağımsız olarak eşleşir.
    await page.getByTestId("vardiya-ad-1").fill("E2E Tam Gün");
    await page.getByTestId("vardiya-baslangic-1").fill("00:00");
    await page.getByTestId("vardiya-bitis-1").fill("00:00");
    await page.getByTestId("vardiya-penceresi-kaydet").click();
    await expect(page.getByTestId("vardiya-penceresi-basari")).toBeVisible({ timeout: 15_000 });

    // Vardiya ekranında etiket görünür.
    await page.goto("/vardiya");
    await expect(page.getByTestId("vardiya-penceresi")).toContainText("E2E Tam Gün", {
      timeout: 15_000,
    });
  });

  test("PENCERE VARDİYA AÇMAYI ENGELLEMEZ", async ({ page }) => {
    // Yalnızca geçmiş bir saat aralığı tanımla; şu an pencere dışı olabilir.
    await page.goto("/yonetim/ayarlar/isletme");
    await page.getByTestId("vardiya-ad-1").fill("E2E Dar Pencere");
    await page.getByTestId("vardiya-baslangic-1").fill("03:00");
    await page.getByTestId("vardiya-bitis-1").fill("03:01");
    await page.getByTestId("vardiya-penceresi-kaydet").click();
    await expect(page.getByTestId("vardiya-penceresi-basari")).toBeVisible({ timeout: 15_000 });

    // Vardiya açma butonu/durumu YİNE çalışır: engel yok.
    await page.goto("/vardiya");
    await vardiyaAc(page);
    await expect(page.getByTestId("islem-paneli").or(page.getByText(/Vardiya:/))).toBeVisible({
      timeout: 15_000,
    });
  });

  test("saatlerin engellemediği ekranda YAZILI", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/isletme");
    await expect(page.getByText("Bu saatler vardiya açmayı engellemez")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("geçersiz saat açık hata verir", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/isletme");
    await page.getByTestId("vardiya-ad-2").fill("E2E Hatalı");
    // type="time" alanı geçersiz metni kabul etmez; saatleri boş bırakıp
    // yalnızca ad girildiğinde sunucu açık hata döndürmeli.
    await page.getByTestId("vardiya-penceresi-kaydet").click();
    await expect(page.getByText(/saat girilmiş ama ad yazılmamış|SS:DD/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("pencereler temizlenebilir", async ({ page }) => {
    await page.goto("/yonetim/ayarlar/isletme");
    for (const no of [1, 2]) {
      await page.getByTestId(`vardiya-ad-${no}`).fill("");
      await page.getByTestId(`vardiya-baslangic-${no}`).fill("");
      await page.getByTestId(`vardiya-bitis-${no}`).fill("");
    }
    await page.getByTestId("vardiya-penceresi-kaydet").click();
    await expect(page.getByTestId("vardiya-penceresi-basari")).toContainText("kaldırıldı", {
      timeout: 15_000,
    });
  });
});
