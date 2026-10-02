# 6. Geliştirme Planı

Her aşama **çalışan kod** ile biter: testler geçer, önceki aşamaların özellikleri
bozulmaz, bilinen eksikler açıkça yazılır. Bir aşama, tamamlanma kriterlerinin
**tamamı test edilerek** doğrulanmadan "bitti" sayılmaz.

## Aşama 0 — Analiz ve tasarım (şu an / bu dokümanlar)
**Çıktı:** mimari, veri modeli, yetki matrisi, ekran akışları, tarife algoritması, plan.
**Tamamlanma kriteri:** Doküman 07'deki kritik soruların yanıtlanması ve mimarinin onayı.
**Durum:** ✅ Tamamlandı (02.10.2026). Dört kritik iş kuralı karara bağlandı
(S5, S7, S9, S10); fiyat değerleri panelden girilebilir olarak kodlanacağı için
geliştirme bekletilmedi.

---

## Aşama 1 — Altyapı, veritabanı, giriş ve yetkiler
**Kapsam**
- Next.js + TypeScript + Tailwind iskeleti, ESLint/Prettier, CI (lint + typecheck + test)
- Docker Compose: PostgreSQL + uygulama; `.env.example`
- Prisma şeması (doküman 02'nin tamamı) + ilk migration + kısmi tekil indeksler
- `seed.ts`: ilk OWNER hesabı, araç sınıfları, gider kategorileri, boş tarife planı
- Auth.js Credentials + Argon2id + veritabanı oturumu + giriş deneme sınırı
- `requirePermission()` ve izin sabitleri; `(panel)` ve `yonetim` layout korumaları
- `AuditLog` yazıcı altyapısı; giriş/çıkış ve başarısız giriş kaydı
- Mobil kabuk: üst bar, alt gezinme, temel UI bileşenleri (buton, kart, input, sheet, alert)
- Türkçe biçimleme yardımcıları: para, tarih/saat, süre, plaka normalizasyonu

**Tamamlanma kriterleri — ✅ TAMAMLANDI (02.10.2026)**
- [x] Sıfırdan çalışan ortam — `Dockerfile` + `ops/docker-compose.yml` (Postgres + app + Caddy + yedek)
- [x] Giriş/çıkış çalışıyor, oturum çerezi `httpOnly` + `secure` + `sameSite=lax`
- [x] Devre dışı bırakılan kullanıcının oturumu **anında** düşüyor — `tests/integration/oturum.test.ts`
- [x] 5 hatalı denemeden sonra 15 dk kilit — `tests/integration/kimlik-dogrulama.test.ts`
- [x] İzin altyapısı: `requirePermission()` + yetkisiz girişim denetime yazılıyor
- [x] Plaka normalizasyonu — 17 birim testi (Türkçe karakter dönüşümü dahil)
- [x] CI iş akışı yazıldı — lint + typecheck + unit + integration + build + e2e + şema/migration uyum kontrolü

**Ek olarak yapılanlar (planda yoktu, gerekli görüldü)**
- [x] Veritabanı seviyesinde bütünlük: mükerrer aktif giriş engeli (kısmi tekil
      indeks), finansal kayıt silme yasağı ve denetim kaydı değişmezliği
      (PostgreSQL tetikleyicileri) — 22 entegrasyon testi
- [x] Oturum jetonunun yalnızca SHA-256 özeti saklanıyor
- [x] Para hesapları kuruş tamsayısı üzerinden (float hatası yok) — testli
- [x] Yedekleme ve geri yükleme betikleri + `ops/RUNBOOK.md`

**Test sonucu:** 76 birim + 64 entegrasyon + 30 uçtan uca = **170 test geçiyor**

**Bilinen eksikler (Aşama 2'ye devredildi)**
- Vardiya açma/kapatma arayüzü yok (veri modeli hazır)
- Plaka girişi ve araç giriş/çıkış butonları ekranda **devre dışı** ve bu durum
  kullanıcıya açıkça yazıyor — çalışmayan buton gösterip personeli yanıltmamak için
- Tarife yönetimi arayüzü yok; ücret hesaplama motoru Aşama 2'de yazılacak
- Gerçek iOS Safari testi yapılmadı (konteynerde yalnızca Chromium var); ekran
  genişliği testleri Chromium'da 375/393/1280 px'de geçiyor, gerçek cihaz testi Aşama 8'de

---

## Aşama 2 — Mobil personel ana ekranı, araç giriş-çıkış, ücret hesaplama
**Kapsam**
- Tarife yönetimi (sürümlü) — minimum: patron tek plan + kural girebilsin
- `pricing/calculate.ts` saf hesaplama motoru + kapsamlı birim testleri
- Araç girişi: plaka doğrulama, mükerrer giriş engeli, sınıf seçimi, snapshot yazımı
- Araç çıkışı: süre + tutar + hesap dökümü + tahsilat (nakit/kart) tek transaction
- Aktif araçlar listesi, plaka arama, son işlemler
- Ana ekran sayaçları (otoparktaki araç, günlük giriş/çıkış, kendi tahsilatı, kapasite)
- Vardiya aç/kapat; işlem iptali (VOID) ve indirim (yetkiye bağlı)
- Hata ve onay ekranları (tam ekran, renk kodlu)

**Tamamlanma kriterleri**
- [ ] Doküman 05.7'deki ücret senaryolarının tamamı birim testle geçiyor
- [ ] Mükerrer giriş DB seviyesinde engellendiği testle kanıtlanıyor
- [ ] Eşzamanlı çıkış testi: tek tahsilat oluşuyor
- [ ] Aynı isteğin iki kez gönderilmesi (idempotency) tek kayıt üretiyor
- [ ] Playwright: 360/390/414 px genişlikte tam giriş→çıkış→tahsilat akışı
- [ ] Hiçbir ekranda yatay kaydırma yok (otomatik kontrol)
- [ ] Gün içi tarife değişikliğinde içerideki aracın fiyatı değişmiyor (test)

---

## Aşama 3 — Abonmanlar, müşteriler, abonmanlı araç listesi
**Kapsam**
- Müşteri CRUD + profil (araçlar, park geçmişi, abonmanlar, yıkamalar, ödemeler)
- Abonman oluşturma, **kişiye özel fiyat**, çoklu plaka, dönem/yenileme geçmişi
- Abonman listesi: arama + filtre çipleri (aktif / bitiyor / dolmuş / ödenmemiş / iptal)
- Girişte abonman tanıma + personel ekranında durum rozetleri
- Abonman tahsilatı (ayrı, onaylı; kısmi ödeme desteği)
- Süresi dolan abonmanın normal tarifeye geçişi
- Patron paneline "yakında bitecek abonman" uyarıları

**Tamamlanma kriterleri**
- [ ] Üç müşteriye üç farklı fiyat tanımlanıp doğru tahsil edildiği testle doğrulanıyor
- [ ] Aynı plakanın iki aktif abonmana eklenemediği test
- [ ] Abonman oluşturmanın **ödeme kaydı üretmediği** test
- [ ] Yenileme sonrası eski dönem fiyatının değişmediği test
- [ ] Süresi dolmuş abonmanlı aracın normal tarifeyle ücretlendirildiği test
- [ ] Çoklu plaka tek müşteri profilinde birleşiyor (E2E)

---

## Aşama 4 — Oto yıkama
**Kapsam**
- Yıkama hizmet kataloğu + sürümlü fiyat (araç sınıfı bazlı)
- Yıkama işi: sırada → yıkamada → tamamlandı / iptal; çoklu hizmet satırı
- Mobil yıkama kuyruğu ve tek dokunuşla durum değiştirme
- Tahsilat (nakit/kart) ve "tahsilatsız tamamla" durumu
- Günlük/aylık yıkama listeleri, hizmet bazlı ciro, personel işlem sayısı
- Malzeme stok kartı ve tüketim/alış hareketleri, alışların gidere bağlanması

**Tamamlanma kriterleri**
- [ ] Fiyat değişikliğinin geçmiş yıkama tutarlarını etkilemediği test
- [ ] Durum geçişlerinin yalnızca geçerli yönde yapılabildiği test
- [ ] Tahsil edilmemiş yıkamaların yönetim ekranında listelendiği E2E
- [ ] Stok hareketi ↔ gider ilişkisinin doğru kurulduğu test

---

## Aşama 5 — Kasa, gelir-gider, finansal raporlar
**Kapsam**
- Kasa oturumu: açılış nakdi, beklenen/sayılan, fark + zorunlu açıklama, mutabakat
- Vardiya bazlı ve personel bazlı tahsilat raporları
- Nakit/kart ayrımı, kasa hareketleri (avans, bankaya yatırma, düzeltme)
- Gider kayıtları + kategoriler + iptal (ters kayıt) mekanizması
- Diğer gelirler
- Finansal raporlar: günlük/aylık/yıllık gelir-gider, net sonuç, kategori dağılımı,
  gelir kaynağı dağılımı, dönem karşılaştırması
- Dışa aktarma: CSV + Excel (XLSX) + yazdırılabilir PDF özet
- Her rapor başlığında: *"Yönetim amaçlı rapordur; resmî muhasebe/yasal bilanço yerine geçmez."*

**Tamamlanma kriterleri**
- [ ] Kasa kapanış hesabı: açılış + nakit tahsilat − nakit çıkış = beklenen (test)
- [ ] İptal ve iade sonrası kasa ve rapor tutarlarının tutarlı kaldığı test
- [ ] Finansal satırın hiçbir arayüzden silinemediği test
- [ ] `finance.*` izni olmayan kullanıcının rapor verisine erişemediği test (sunucu)
- [ ] CSV/XLSX çıktısında tutar ve tarih biçimlerinin tr-TR olduğu doğrulandı

---

## Aşama 6 — Yönetici paneli, raporlar, ayarlar
**Kapsam**
- Yönetici ana paneli (doküman 04.8) + tarih aralığı filtresi + grafikler
- Uyarı merkezi: bitecek abonmanlar, uzun süre içeride kalan araçlar, kasa farkı,
  tahsil edilmemiş işler, düşük stok
- Personel yönetimi: ekleme, yetkilendirme (`UserPermission`), devre dışı bırakma,
  parola sıfırlama, maaş/avans/prim/SGK giderleriyle ilişkilendirme
- Ayarlar ekranları: tarifeler, yıkama fiyatları, kapasite, işletme künyesi
- Denetim kayıtları ekranı (filtreli)

**Tamamlanma kriterleri**
- [ ] Panel verileri ile rapor verilerinin birebir uyuştuğu test
- [ ] Maaş verisinin `personnel.cost.view` olmadan sorgulanmadığı test
- [ ] Mobilde panelin tek kolon kart düzeninde okunabilir olduğu kontrol
- [ ] Tarife değişikliğinin önizleme + onay + tarihçe ile kaydedildiği E2E

---

## Aşama 7 — Kurumsal web sitesi ve entegrasyon
**Kapsam**
- Ana sayfa, tanıtım, otopark hizmetleri, abonman bilgisi, yıkama hizmetleri ve
  açık fiyatlar, galeri, konum + harita + yol tarifi, telefon/WhatsApp, SSS
- İçerik ve public fiyatların panelden düzenlenmesi (`SitePage`, `SitePublicPrice`)
- SEO: başlık/açıklama, Open Graph, `sitemap.xml`, `robots.txt`,
  LocalBusiness yapılandırılmış veri, Türkçe URL'ler
- Performans: görsel optimizasyonu, Lighthouse mobil ≥ 90

**Tamamlanma kriterleri**
- [ ] Public sayfaların **hiçbir** müşteri/abonman/finans verisi okumadığı test
  (otomatik kontrol: `(public)` altında yasaklı model kullanımı taraması)
- [ ] Panelden fiyat metni değiştirilince sitede göründüğü E2E
- [ ] Lighthouse mobil: performans ≥ 90, erişilebilirlik ≥ 95
- [ ] WhatsApp ve telefon bağlantılarının mobil cihazda çalıştığı kontrol

---

## Aşama 8 — Test, güvenlik, yedekleme, canlıya alma
**Kapsam**
- Test tamamlama: iş kuralları, yetki matrisinin her satırı, kenar durumlar
- Mobil cihaz testleri: 360 / 390 / 414 / 430 px; iOS Safari + Android Chrome
- Güvenlik gözden geçirme: yetki atlatma, IDOR, kütle atama, oturum, hız sınırı,
  bağımlılık taraması
- Yedekleme: günlük `pg_dump` + şifreleme + dış depoya kopya; **geri yükleme testi**
- Sunucu kurulumu: VPS, Docker Compose, Caddy + Let's Encrypt SSL, alan adı
- `ops/RUNBOOK.md`: dağıtım, sürüm yükseltme, **geri alma (rollback)**, yedek/geri yükleme
- İşletme sahibine teslim: depo erişimi, sunucu/veritabanı erişimi, hesap devri
- Personel için 1 sayfalık kullanım kılavuzu (mobil akışlar, ekran görüntülü)

**Tamamlanma kriterleri**
- [ ] Yetki matrisinin her satırı için en az bir test
- [ ] Geri yükleme testi gerçek bir yedekten yapıldı ve kayıtlandı
- [ ] SSL A derecesi, güvenlik başlıkları (CSP, HSTS) aktif
- [ ] Rollback prosedürü bir kez denenerek doğrulandı
- [ ] İşletme sahibi depo + sunucu + veritabanı erişimine sahip

---

## Test stratejisi

| Katman | Araç | Neyi doğrular |
|---|---|---|
| Birim | Vitest | Ücret hesaplama, abonman çözümleme, kasa aritmetiği, plaka normalizasyonu, tarih/gün sınırı |
| Entegrasyon | Vitest + gerçek Postgres (test şeması) | Transaction bütünlüğü, kısmi indeksler, yarış koşulları, izin kontrolleri |
| Uçtan uca | Playwright (mobil + masaüstü viewport) | Giriş→çıkış→tahsilat, yıkama, abonman oluşturma, kasa kapanışı |
| Erişilebilirlik/perf | Lighthouse CI | Public site ve panel mobil performansı |

CI her push'ta: `lint → typecheck → unit → integration → e2e (ana akışlar)`.

## Sürümleme ve geri alma
- `main` daima canlıya çıkabilir durumda; her aşama kendi dalında geliştirilir.
- Semantik sürüm etiketleri (`v0.1.0` … ), her sürüm notunda değişiklik listesi.
- Migration'lar geriye dönük uyumlu yazılır (önce ekle, sonra kullan, en son kaldır) —
  böylece bir sürüm geri alındığında veritabanı bozulmaz.
- Dağıtım öncesi otomatik yedek; sorun çıkarsa önceki imaja dönüş + gerekirse yedekten geri yükleme.

## Bilinen kapsam dışı (ayrı kapsam olarak değerlendirilir)
- Gerçek POS / banka entegrasyonu
- Bariyer, turnike, plaka okuma kamerası (ANPR) donanım entegrasyonu
- Online ödeme / sanal POS ile abonman satışı
- SMS veya e-posta ile otomatik bildirim gönderimi (ücretli servis gerektirir)
- e-Arşiv fatura / resmî muhasebe entegrasyonu
- Çoklu şube yönetimi
- Müşterinin kendi girişiyle kullandığı müşteri portalı / mobil uygulama
