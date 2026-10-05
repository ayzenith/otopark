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
**Durum:** ✅ Tamamlandı (04.10.2026)

**Kapsam**
- Tarife yönetimi (sürümlü) — minimum: patron tek plan + kural girebilsin
- `pricing/calculate.ts` saf hesaplama motoru + kapsamlı birim testleri
- Araç girişi: plaka doğrulama, mükerrer giriş engeli, sınıf seçimi, snapshot yazımı
- Araç çıkışı: süre + tutar + hesap dökümü + tahsilat (nakit/kart) tek transaction
- Aktif araçlar listesi, plaka arama, son işlemler
- Ana ekran sayaçları (otoparktaki araç, günlük giriş/çıkış, kendi tahsilatı, kapasite)
- Vardiya aç/kapat; işlem iptali (VOID) ve indirim (yetkiye bağlı)
- Hata ve onay ekranları (tam ekran, renk kodlu)

**Tamamlanma kriterleri — ✅ TAMAMLANDI (04.10.2026)**
- [x] Doküman 05.7'deki ücret senaryolarının tamamı birim testle geçiyor (64 test)
- [x] Mükerrer giriş hem uygulama hem DB seviyesinde engelleniyor (testli)
- [x] Eşzamanlı çıkış testi: `FOR UPDATE` kilidi ile tek tahsilat oluşuyor
- [x] Idempotency: aynı istek iki kez gelirse tek kayıt üretiliyor (giriş + çıkış)
- [x] Playwright: 375/393/1280 px genişlikte tam giriş→sorgula→ücret→tahsilat akışı
- [x] Hiçbir ekranda yatay kaydırma yok (işlem paneli dahil, otomatik kontrol)
- [x] Gün içi tarife değişikliğinde içerideki aracın fiyatı değişmiyor (testli)
- [x] Çıkışta ücret **sunucuda yeniden hesaplanıyor**; istemci tutar göndermiyor
- [x] İptal: finansal kayıt silinmiyor, VOIDED + gerekçe; iade senaryosunda ters kayıt
- [x] Abonmanlı araç ücretsiz çıkıyor (S10 kuralı dahil)
- [x] Kapasite tanımsızsa araç girişi engellenmiyor

**Test sonucu:** 140 birim + 154 entegrasyon + 72 uçtan uca = **366 test geçiyor**

**Bu aşamada bulunan ve düzeltilen üç hata**
1. **İş hataları kullanıcıya ulaşmıyordu.** `runAction` tüm hataları yakalayıp
   "İşlem tamamlanamadı" genel mesajına çeviriyordu; "bu araç zaten otoparkta"
   gibi eyleme yönelten uyarılar personele hiç gösterilmiyordu. `IslemHatasi`
   artık ayrı bir modülde (`src/server/errors.ts`) tanımlı ve `runAction`
   mesajını aynen geçiriyor. Gerileme testi: `tests/unit/permissions.test.ts`.
2. **Idempotency sırası yanlıştı.** Mükerrer giriş kontrolü idempotency
   kontrolünden önce çalışıyordu; yavaş hatta butona iki kez basan personel
   kendi ilk isteği yüzünden "araç zaten içeride" hatası alıyordu. Sıra
   düzeltildi.
3. **İptalde çifte muhasebe.** Orijinal tahsilat `VOIDED` yapılıp aynı zamanda
   ters kayıt üretiliyordu; bu parayı iki kez düşürüyordu. Artık iki durum
   ayrı: para fiilen iade edildiyse orijinal `CONFIRMED` kalır + ters kayıt
   üretilir; para el değiştirmediyse orijinal `VOIDED` olur ve ters kayıt
   üretilmez. Çağıran taraf hangi durumun geçerli olduğunu bildirmek zorunda —
   sistem bunu varsaymıyor.

**Bilinen eksikler (sonraki aşamalara devredildi)**
- Çıkış panelinde indirim ve elle tutar arayüzü yok (sunucu tarafı hazır ve
  testli; yetki kontrolleri çalışıyor)
- İşlem iptali arayüzü yok (servis hazır ve testli)
- Araç geçmişi yalnızca bugünü gösteriyor; haftalık/aylık ve dışa aktarma Aşama 5
- Kart ödemesinde dekont notu arayüzde girilemiyor (servis destekliyor)
- Gece tarifesi mantığı dokümandaki "avantajlı olanı uygula" kuralıyla yazıldı;
  **S4 onayı bekliyor.** Patron gece ücreti girmediği sürece kural hiç devreye girmez.

---

## Aşama 3 — Abonmanlar, müşteriler, abonmanlı araç listesi ✅ TAMAMLANDI (04.10.2026)
**Kapsam**
- Müşteri CRUD + profil (araçlar, park geçmişi, abonmanlar, yıkamalar, ödemeler)
- Abonman oluşturma, **kişiye özel fiyat**, çoklu plaka, dönem/yenileme geçmişi
- Abonman listesi: arama + filtre çipleri (aktif / bitiyor / dolmuş / ödenmemiş / iptal)
- Girişte abonman tanıma + personel ekranında durum rozetleri
- Abonman tahsilatı (ayrı, onaylı; kısmi ödeme desteği)
- Süresi dolan abonmanın normal tarifeye geçişi
- Patron paneline "yakında bitecek abonman" uyarıları

**Tamamlanma kriterleri**
- [x] Üç müşteriye üç farklı fiyat tanımlanıp doğru tahsil edildiği testle doğrulanıyor
- [x] Aynı plakanın iki aktif abonmana eklenemediği test (uygulama **ve** veritabanı tetikleyicisi)
- [x] Abonman oluşturmanın **ödeme kaydı üretmediği** test
- [x] Yenileme sonrası eski dönem fiyatının değişmediği test
- [x] Süresi dolmuş abonmanlı aracın normal tarifeyle ücretlendirildiği test
- [x] Çoklu plaka tek müşteri profilinde birleşiyor (E2E)
- [x] Park sırasında abonman bitişinde çıkışın ücretsiz tamamlandığı test (S10)
- [x] Ödenmemiş abonmanın geçerli kabul edildiği test (S9)
- [x] Abonmanlı çıkışta ücret hesaplama akışının **hiç açılmadığı** E2E testi

**Test sayıları (04.10.2026)**

| Katman | Aşama 2 sonu | Aşama 3 eklenen | Toplam |
|---|---:|---:|---:|
| Birim | 140 | +25 | **165** |
| Entegrasyon (gerçek PostgreSQL) | 154 | +66 | **220** |
| Uçtan uca (3 ekran boyutu) | 72 | +66 | **138** |
| **Toplam** | 366 | +157 | **523** |

Başarısız test yok. `tsc --noEmit`, `npm run lint` ve `npm run build` temiz.

**Aşama 3'te bulunan ve düzeltilen hatalar**

1. **Telefonla müşteri arama çalışmıyordu (gerçek, kullanıcıya dokunan).**
   Arama sorgusu normalize ediliyor ama veritabanındaki **ham** telefon
   alanıyla karşılaştırılıyordu. "0532 111 22 33" kaydı, personel
   "5321112233" yazdığında bulunamıyordu — yani aramanın en çok kullanılacağı
   biçim çalışmıyordu. `Customer.phoneNormalized` / `altPhoneNormalized`
   alanları eklendi (indeksli, geçmiş kayıtlar için geri dolduruldu) ve arama
   bu alanlar üzerinden yapılıyor. Üç yazım biçiminin aynı müşteriyi bulduğu
   test eklendi.
2. **Test temizliği sessizce bozulabiliyordu (altyapı).**
   `temizle()` tetikleyicileri `SET session_replication_role` ile kapatıyordu;
   bu ayar **bağlantı bazlıdır** ve Prisma havuzdan başka bir bağlantı
   verdiğinde etkisiz kalıyor, finansal tabloların "silinemez" tetikleyicisi
   devreye girip hazırlık çöküyordu. Temizlik tek `TRUNCATE ... CASCADE`
   ifadesine çevrildi: satır tetikleyicisi çalışmaz, çok daha hızlıdır ve
   bağlantıya bağımlı değildir. Aynı kırılganlık E2E hazırlığında da vardı;
   orada tek transaction + `SET LOCAL` kullanıldı.
3. **E2E paketi uzayınca kendi kendini düşürüyordu (test altyapısı).**
   İki ayrı kırılganlık: (a) park edilmiş fixture aracının süresi **sabit
   metinle** doğrulanıyordu, paket uzadıkça geçen dakika büyüyüp doğrulama
   bozuluyordu; (b) Playwright başarısız testten sonra işçi sürecini yeniden
   başlatıyor ve plaka üreten modül sayacı sıfırlanıyor, aynı plaka ikinci kez
   üretilip "bu araç zaten otoparkta" hatası kalan testleri zincirleme
   düşürüyordu. Süre doğrulaması desene çevrildi (tutar zaten sabit), plaka
   üretimi süreç kimliğinden türetilen tabana bağlandı.

**Aşama 3 sonunda bilinen eksikler**

- Abonman **arayüzünde** kural seçimi yok: tek kural (7/24 sınırsız) kullanılıyor.
  Diğer kurallar şemada ve hesap mantığında hazır, testli, ama devre dışı (S11).
- Müşteri profilinde **park geçmişi** sayı olarak görünüyor; tarihli liste ve
  dışa aktarma Aşama 5'te.
- Abonman **belgesi/fişi yazdırma** yok (Aşama 7).
- Otomatik yenileme (`autoRenew`) alanı saklanıyor ama **çalıştıran süreç yok**;
  yenileme elle yapılır. Zamanlanmış görev Aşama 5'te değerlendirilecek.
- Süresi yaklaşan abonman uyarısı patron panelinde gösteriliyor; **SMS/WhatsApp
  bildirimi yok** (S19 yanıtlanmadı).

---

## Aşama 4 — Oto yıkama ✅ TAMAMLANDI (04.10.2026)
**Kapsam**
- Yıkama hizmet kataloğu + sürümlü fiyat (araç sınıfı bazlı)
- Yıkama işi: sırada → yıkamada → tamamlandı / iptal; çoklu hizmet satırı
- Mobil yıkama kuyruğu ve tek dokunuşla durum değiştirme
- Tahsilat (nakit/kart) ve "tahsilatsız tamamla" durumu
- Günlük/aylık yıkama listeleri, hizmet bazlı ciro, personel işlem sayısı
- ~~Malzeme stok kartı ve tüketim/alış hareketleri, alışların gidere bağlanması~~
  → **Aşama 5'e taşındı** (gerekçe aşağıda)

**Tamamlanma kriterleri**
- [x] Fiyat değişikliğinin geçmiş yıkama tutarlarını etkilemediği test
- [x] Durum geçişlerinin yalnızca geçerli yönde yapılabildiği test
- [x] Tahsil edilmemiş yıkamaların yönetim ekranında listelendiği E2E
- [x] ~~Stok hareketi ↔ gider ilişkisinin doğru kurulduğu test~~ → **Aşama 5'te
      yapıldı** (gider modülü orada geldi; stok alışını gidere bağlamak onu
      gerektiriyordu)

---

**Aşama 4'te eklenen kararlar (04.10.2026)**

| Karar | Uygulama |
|---|---|
| Otopark tarifesi (0–1 sa 100 ₺ … 24 sa sonrası +600 ₺) | `extraDayBlockPrice` alanı + motorda "ek gün bloğu" modeli; `tests/unit/gercek-tarife.test.ts` bant bant doğrular |
| Gece tarifesi yok, hafta sonu farkı yok | Alanlar boş bırakılır, kurallar hiç devreye girmez (testli) |
| Otoparkta araç sınıfı farkı yok | Tek genel kural (`vehicleClassId = null`) |
| **Karavan normal tarifenin dışında** | `VehicleClass.excludeFromStandardTariff`; çözümleyici genel kurala düşmez, personele açık uyarı |
| Araç tipine göre fiyat **yalnızca yıkamada** | Ayrı tablo, ayrı servis, ayrı ekran; ayrılık testle kanıtlı |
| Abonmanın yıkama indirimi yok | Yıkama fiyatlandırması abonman tablolarına hiç bakmaz (testli) |
| Standart abonman 1 ay | Arayüzde tek süre seçeneği, bitiş +1 ay ön dolu |
| Fiyatlar koda sabitlenmez | `npm run fiyatlar:kur` veritabanına **veri** yazar; mevcut fiyatları ezmez |

**Test sayıları (04.10.2026)**

| Katman | Aşama 3 sonu | Aşama 4 eklenen | Toplam |
|---|---:|---:|---:|
| Birim | 165 | +26 | **191** |
| Entegrasyon (gerçek PostgreSQL) | 220 | +67 | **287** |
| Uçtan uca (3 ekran boyutu) | 138 | +54 | **192** |
| **Toplam** | 523 | +147 | **670** |

Başarısız test yok. `tsc --noEmit`, `npm run lint`, `npm run build` temiz.

**Aşama 4'te düzeltilen hatalar**

Bu aşamada **ürün kodunda hata bulunmadı**; bulunan dört sorun test
doğrulamalarındaydı ve hepsi şu ortak kök nedenden geliyordu: *testler ürünün
doğru davranışını yanlış varsaymıştı.*

1. Tahsilat tamamlanınca tahsilat formu (ve içindeki başarı uyarısı) **kapanıyor** —
   doğru davranış; test geçici uyarıyı bekliyordu. Kalıcı sonuç doğrulanacak
   şekilde değiştirildi.
2. Kuyruk boşalınca liste öğesi **hiç çizilmiyor**; Playwright'ın
   `not.toContainText` doğrulaması var olmayan öğede başarısız olur.
   `toHaveCount(0)` kullanıldı.
3. Veritabanı üç Playwright projesi arasında paylaşıldığı için "kuyruk boş"
   varsayımı geçersiz; doğrulama **o plakanın satırı** üzerine daraltıldı.
4. `VehicleClass` test temizliğinde silinmiyordu; bir testte eklenen araç tipi
   sonraki koşuda "kod zaten kullanılıyor" hatası veriyordu. Tablo temizlik
   listesine eklendi.

**Aşama 4 sonunda bilinen eksikler**

- **Malzeme stoğu Aşama 5'e bırakıldı.** `InventoryItem` / `InventoryMovement`
  tabloları hazır, ama planın "alışların gidere bağlanması" maddesi Gelir-Gider
  modülünü gerektiriyor ve o Aşama 5'te geliyor. Stok hareketini şimdi, gider
  bağını sonra yapmak yarım bir muhasebe kaydı üretirdi.
  → **Aşama 5'te tamamlandı (05.10.2026).**
- Yıkama **fişi/belgesi yazdırma** yok (Aşama 7).
- Yıkama **süre hedefi / SLA** tanımlanmadı.
- Motor yıkama ücreti ve diğer yıkama hizmetlerinin fiyatları
  **belirlenmedi** (bilinçli olarak boş).
  → **Karavan otopark ücreti 04.10.2026'da karara bağlandı:** 700 ₺ / 24 saat,
  her ek 24 saat +700 ₺ (`docs/05` 0.2). Karavan **yıkama** ücreti hâlâ açık.

---

## Aşama 5 — Kasa, gelir-gider, malzeme stoğu ✅ TAMAMLANDI (05.10.2026)

**Kapsam**
- Kasa oturumu: açılış nakdi, **sunucuda hesaplanan** beklenen nakit/kart,
  sayım, fark + **zorunlu gerekçe**, mutabakat
- Kasa hareketleri: kasaya ekleme, kasadan alma, bankaya yatırma, personel
  avansı, sayım düzeltmesi (yön ayrıca sorulur) + iptal
- Her tahsilatın **açık kasa oturumuna bağlanması**; kasa açık değilken
  yapılan nakit tahsilatların **"kasa dışı tahsilat"** olarak işaretlenmesi
- Vardiya bazlı tahsilat özeti (nakit/kart/kaynak dağılımı)
- Gider kayıtları + kategoriler + iptal (VOIDED + gerekçe)
- Diğer gelirler (tahsilat üreten) + iptal (iade / ters kayıt ayrımı)
- Finansal raporlar: günlük/aylık gelir-gider, net, kategori dağılımı,
  **otopark / yıkama / abonman ayrı satırlarda**
- **(Aşama 4'ten taşındı)** Malzeme stok kartı, alış/tüketim/zayi/düzeltme
  hareketleri ve **alışların gidere bağlanması**
- CSV dışa aktarma (tr-TR; noktalı virgül + UTF-8 BOM, Excel TR uyumlu)
- Her rapor/dosya başlığında: *"Yönetim amaçlı rapordur; resmî
  muhasebe/yasal bilanço yerine geçmez."*

**Tamamlanma kriterleri**
- [x] Kasa kapanış hesabı: açılış + nakit tahsilat − nakit çıkış − nakit gider
      = beklenen (birim + entegrasyon testi)
- [x] İptal ve iade sonrası kasa ve rapor tutarlarının tutarlı kaldığı test
- [x] Finansal satırın hiçbir arayüzden silinemediği test (DB tetikleyicisi)
- [x] `finance.*` izni olmayan kullanıcının rapor verisine erişemediği test
      (CSV uç noktası personele **403**; E2E ile doğrulandı)
- [x] CSV çıktısında tutar ve tarih biçimlerinin tr-TR olduğu doğrulandı
- [x] Stok hareketi ↔ gider ilişkisinin doğru kurulduğu test (Aşama 4'ten devir)
- [x] Stoğun negatife düşemediği test (uygulama **ve** veritabanı kısıtı)

**Aşama 5'te alınan yapısal kararlar**

| Karar | Gerekçe |
|---|---|
| Kasa oturumu vardiyadan AYRI | Vardiya çalışma süresi, kasa oturumu **paranın fiziki sorumluluğu**; bir vardiyada kasa iki kez sayılabilir |
| **Aynı anda tek açık kasa** | Tek fiziki kasa var. Uygulama kontrolü + kısmi unique indeks (`cash_drawer_single_open`) |
| Beklenen nakit **sayımdan önce gösterilmez** | Ekranda yazarsa personel saymadan o rakamı yazar, kasa farkı hiç ortaya çıkmaz |
| Nakit gider kasadan **bir kez** düşer | Hem `Expense` hem `CashMovement` üretmek beklenen nakdi iki kez düşürür (Aşama 2'deki çifte muhasebe hatasının kasa karşılığı). Gider için kasa hareketi **üretilmez**; beklenen nakit hesabı gidere bağlı hareketleri toplamaz |
| Kasa açık değilken tahsilat **engellenmez** | Müşteri kapıda bekletilmez. Kayıp sessiz kalmasın diye "kasa dışı tahsilat" sayacı patron panelinde gösterilir |
| Kapanmış kasanın gideri/hareketi geriye dönük **iptal edilemez** | İmzalanmış sayımı bozar; düzeltme yeni kasada düzeltme hareketiyle yapılır |
| Kasa kapanış onayı **sunucudan** okunur | Kapanış `revalidatePath` çağırır; istemcide tutulan özet o anda yok olur ve personel farkı göremez. "Son kasa kapanışı" kartı kalıcı kaynaktır |
| Stok **negatife düşmez** | Elde 3 litre varken 5 litre tüketim girilemez; uygulama hatası + DB CHECK kısıtı |
| Stok hareketi ve miktarı **işaretsiz** | Yön `type` (stok) / `direction` (kasa) alanında taşınır; "-500" satırı hesabı sessizce ters çeviremez |
| Stok defteri **silinmez** | Yanlış hareket için ters yönde düzeltme girilir; DB tetikleyicisi DELETE'i reddeder |
| Gider iptali stoğu **geri almaz** | Malzeme fiilen depoya girdiyse iptal onu çıkarmaz. Kullanıcıya "elle düzeltin" uyarısı verilir |
| Malzeme ve kategori **silinmez** | Pasifleştirilir; geçmiş hareketler kategorisini/malzemesini kaybetmemeli |
| Gider/gelir tutarı **istemciden alınır** | Hesaplanan değil, dış dünyadan gelen olgu (fatura tutarı). Bu yüzden izne bağlı ve denetimli |

**Test sayıları (05.10.2026)**

| Katman | Aşama 4 sonu | Aşama 5 eklenen | Toplam |
|---|---:|---:|---:|
| Birim | 191 | +56 | **247** |
| Entegrasyon (gerçek PostgreSQL) | 287 | +84 | **371** |
| Uçtan uca (3 ekran boyutu) | 192 | +57 | **249** |
| **Toplam** | 670 | +197 | **867** |

Başarısız test yok. `tsc --noEmit`, `npm run lint`, `npm run build` temiz.

> Not: Birim ve entegrasyon artışının bir kısmı (16 + 14) karavan tarifesi ve
> kapasite kararının testlerinden gelir; bunlar Aşama 5 kodundan önce,
> `ddcfdc3` commit'inde eklendi.

**Aşama 5'te bulunan ve düzeltilen hatalar**

Bu aşamada **beş gerçek hata** bulundu; dördü ürün kodunda, biri test
altyapısındaydı.

1. **Türkçe büyük/küçük harf tuzağı (ürün kodu).** Malzeme adı tekilliği
   Prisma'nın `mode: "insensitive"` karşılaştırmasıyla yapılıyordu; bu
   PostgreSQL'de Türkçe I/ı ve İ/i çifti için **doğru sonuç vermez**.
   "Deterjanı" ile "DETERJANI" farklı sayılıyor ve aynı malzeme iki kez
   açılabiliyordu. Karşılaştırma Türkçe yerel kuralıyla uygulamaya taşındı
   (`adAnahtari`).
2. **Zod 4 davranışı: eksik form alanı tüm işlemi düşürüyordu (ürün kodu).**
   `z.union([..., z.undefined()])` nesne doğrulamasında **eksik anahtarı**
   kabul etmez; alanın kendisi `.optional()` olmak zorundadır. Formlar
   göndermediği (`yon`, `tedarikci`, `belgeNo`…) alanlar yüzünden kasa
   hareketi ve stok hareketi "Girdiğiniz bilgiler geçersiz" hatasıyla
   reddediliyordu.
3. **Doğrulama hataları kullanıcıya gösterilmiyordu (ürün kodu, mimari
   kural 12).** `runAction` tüm Zod hatalarını tek bir *"Girdiğiniz bilgiler
   geçersiz."* mesajına çeviriyordu; personel hangi alanın yanlış olduğunu
   göremiyordu. Artık alan adı + Türkçe mesaj aynen gösteriliyor. **Bu hata
   Aşama 2–4'te de vardı**, yalnızca bu aşamada ortaya çıktı.
4. **Başarı ve kapanış onayları ekrandan siliniyordu (ürün kodu).** Form
   kaydettikten sonra kapandığı için başarı uyarısı da yok oluyordu; kasa
   kapanışında ise `revalidatePath` sayfayı tazeleyince **kasa farkı özeti**
   tamamen kayboluyordu — personel farkı hiç görmüyordu. Başarı mesajları form
   kapandıktan sonra da çiziliyor, kasa kapanış özeti ise **sunucudan** okunan
   kalıcı "Son kasa kapanışı" kartına taşındı.
   Ayrıca React 19'da `<form action={fn}>` **formu sıfırladığı** için, sayım
   formundaki alanlar hata sonrası siliniyordu (personelin az önce saydığı
   nakit dahil). Sayım formu kontrollü duruma geçirildi.
5. **`ExpenseCategory` test temizliğinde silinmiyordu (test altyapısı).**
   Testlerin oluşturduğu kategoriler birikiyor, sonraki koşuda "kod zaten
   kullanılıyor" hatası **tüm dosyayı** düşürüyordu. `VehicleClass` ile aynı
   gerekçeyle temizlik listesine eklendi.

**Aşama 5 sonunda bilinen eksikler**

- **XLSX ve PDF dışa aktarma yok.** CSV yapıldı (Excel TR uyumlu: noktalı
  virgül + BOM) ve testli. XLSX yeni bir bağımlılık (`exceljs` vb.), PDF ise
  yazdırma şablonu gerektirir; yazdırılabilir sayfalar **Aşama 7** kapsamında.
  Bağımlılık eklemek için onay beklenmektedir.
- **Dönem karşılaştırması** (geçen aya göre değişim) ve **yıllık grafik** yok;
  CSV'de yıllık özet var. Grafikler Aşama 6 panelinde.
- Kasa raporlarında **tarih aralığı filtresi** yok; günlük/aylık sabit
  dönemler ve son 90 gün listeleri var. Filtre Aşama 6'da.
- **Personel bazlı** tahsilat raporu yok (vardiya bazlı var); personel
  yönetimi Aşama 6'da geliyor.
- Malzeme **birim maliyeti ortalaması / stok değerlemesi** yapılmıyor; her
  alışın birim maliyeti kendi satırında saklanıyor.

---

## Aşama 6 — Personel, patron paneli, raporlar, denetim ✅ TAMAMLANDI (05.10.2026)

**Kapsam**
- Personel yönetimi: hesap açma (patron panelinden), düzenleme, pasifleştirme,
  parola sıfırlama, **izin bazlı yetkilendirme** (`UserPermission`)
- Personel maliyet profili (maaş / SGK / yemek) — **yalnızca patron**, alan
  bazlı kısıt: izin yoksa alanlar **sorgulanmaz**
- **Personel avansı = alacak** (gider değil) + **maaş ödemesinde mahsup**
- Patron ana paneli: tarih aralığı filtresi (gün/hafta/ay/yıl/özel),
  gelir-gider kartları, **dönem karşılaştırması**, 30 günlük trend grafiği,
  aktif vardiyalar
- **Uyarı merkezi**: tarife yok, tarifesiz park, kasa dışı tahsilat, kasa
  farkı, bitecek/dolmuş/ödenmemiş abonman, uzun süreli park, tahsil edilmemiş
  yıkama, fiyatsız yıkama kalemi, kritik stok, açık avans
- **Personel bazlı tahsilat raporu** (Aşama 5'ten devir)
- **Denetim kaydı ekranı**: grup ve kişi filtresi, imleç sayfalama, önce/sonra
  ayrıntısı
- **Vardiya saatleri** işletme ayarından yönetilir (zorlayıcı değil)

**Tamamlanma kriterleri**
- [x] Panel verileri ile rapor verilerinin birebir uyuştuğu test
- [x] Maaş verisinin `personnel.cost.view` olmadan sorgulanmadığı test
- [x] Mobilde panelin tek kolon kart düzeninde okunabilir olduğu kontrol
      (yatay kaydırma testi, 3 ekran boyutu)
- [x] ~~Tarife değişikliğinin önizleme + onay + tarihçe ile kaydedildiği E2E~~
      → Aşama 2'de yapılmıştı (`tests/e2e/park-akisi.spec.ts`, tarife ekranı);
      bu aşamada tekrar edilmedi
- [x] Avansın gider raporuna girmediği ve kasadan bir kez düştüğü test
- [x] MANAGER rolünün atanamadığı test
- [x] Son patron hesabının kapatılamadığı / rolünün düşürülemediği test
- [x] Denetim kaydının değiştirilemediği ve silinemediği test

**Aşama 6'da alınan yapısal kararlar**

| Karar | Gerekçe |
|---|---|
| **Personel adları tohum verisine yazılmaz** | Gerçek isimler kod deposuna girmez; hesaplar patron panelinden açılır. Test personeli ayrı fixture (`e2e_p…`) |
| **Roller: yalnızca PATRON + PERSONEL** | MANAGER enum'da, izin matrisinde ve taban kümesinde **duruyor** ama atanamaz. Silmek yerine kapatmak, ileride tek satırla açmayı mümkün kılar |
| **Kasa kapatma izni kullanıcı bazında** | Yeni rol tanımlamadan "bu personel kasa kapatabilsin" demenin yolu `UserPermission`. Rol şişmesi olmaz |
| **Başlangıç parolası bir kez gösterilir** | Veritabanında yalnızca Argon2id özeti durur; patronun bildiği parola personelin kalıcı parolası olmasın diye ilk girişte değiştirme zorunlu |
| **Hesap kapatınca oturumlar da kapanır** | Aksi halde işten çıkan personel tarayıcısı açık kaldığı sürece işlem yapmaya devam eder |
| **Son patron korunur** | Tek patronun rolü düşürülemez / hesabı kapatılamaz; sistem yönetilemez hale gelemez |
| **Maaş alanları izin yoksa SELECT EDİLMEZ** | `null` döndürmek yerine hiç sorgulanmaz: kazara sızma yolu kapanır |
| **Girilmeyen maaş 0 değil null** | "Maaş 0 ₺" ile "maaş girilmedi" karıştırılmaz (kural 10'un personel karşılığı) |
| **AVANS GİDER DEĞİL, ALACAK** | Avans verildiğinde kasa azalır ama gider yazılmaz; maaş ödemesinde mahsup edilir. Gider = maaşın tamamı, kasa çıkışı = maaş − mahsup. Toplam kasa çıkışı maaşa eşit |
| **`AVANS` gider kategorisi kullanım dışı** | Açık kalırsa patron avansı elle gider girer ve tutar iki kez sayılır. Kategori silinmez (geçmiş kayıt kategorisini kaybetmemeli), pasifleştirilir |
| **Mahsup edilmiş avans iptal edilemez** | Maaş gideri ona dayanıyor; geriye dönük iptal maaş kaydını tutarsız bırakır |
| **Vardiya penceresi ZORLAYICI DEĞİL** | İşletme "tek vardiya zorunluluğu olmasın" dedi. Pencere yalnızca bilgi/rapor etiketi; saat dışında vardiya açmak serbest, uyarı bile çıkmaz |
| **Doluluk yüzdesi gösterilmez** | Kapasite tanımsız (sınır yok kararı). `docs/04` 4.8 taslağında DOLULUK kartı var ama anlamsız bir oran göstermek yanlış bilgi olur; kapasite girilirse kart kendiliğinden çizilir |
| **Yüzde değişimde önceki dönem 0 ise yüzde tanımsız** | "%∞ arttı" yanıltıcı; arayüz "önceki dönem 0" yazar |
| **Giderde artış KIRMIZI** | Gelirde yeşil olan yön giderde kırmızı olmalı; aksi halde "giderler %40 arttı" yeşil görünür ve yanlış okunur |
| **Grafik kütüphanesi eklenmedi** | Tek çizgi grafiği için bağımsız paket, mobil paket boyutunu gereksiz büyütür. Satır içi SVG kullanıldı; seriler hem renk hem etiketle ayrılır |
| **Personel raporu performans aracı değil** | Tahsilat tutarı vardiya yoğunluğuna bağlı. Ekranda açıkça yazılı; kasa farkı araştırması için var |

**Test sayıları (05.10.2026)**

| Katman | Aşama 5 sonu | Aşama 6 eklenen | Toplam |
|---|---:|---:|---:|
| Birim | 247 | +40 | **287** |
| Entegrasyon (gerçek PostgreSQL) | 371 | +78 | **449** |
| Uçtan uca (3 ekran boyutu) | 249 | +84 | **333** |
| **Toplam** | 867 | +202 | **1069** |

Başarısız test yok. `tsc --noEmit`, `npm run lint`, `npm run build` temiz,
migration sürüklenmesi yok.

**Aşama 6'da bulunan ve düzeltilen hatalar**

1. **`"use server"` dosyasından fonksiyon olmayan ihraç (ürün kodu).**
   `src/server/actions/ayarlar.ts` bir Zod şeması da ihraç ediyordu. Next.js
   bir Server Action modülünden **yalnızca async fonksiyon** ihraç edilmesine
   izin verir; derleme bunu yakalamadı, **çalışma anında** işletme ayarları
   sayfası "server-side exception" ile çöktü. Şema ihracı kaldırıldı.
   *Kök neden:* kuralın derleme zamanında denetlenmemesi; bu yüzden
   `CLAUDE.md`'ye kural olarak yazıldı.
2. **Test yardımcısında tarih biçimi (test kodu).** `Intl` `dateStyle: "short"`
   biçimi "7.10.2026" veriyor, başındaki sıfırı atıyor. Testler projenin kendi
   `formatDate`'ini (dd.MM.yyyy) kullanacak şekilde düzeltildi — böylece test
   ekranda görünen biçimi doğrular.
3. **`selectOption({ label: RegExp })` yine kullanıldı (test kodu).** Aşama
   5'te bulunan tuzağın tekrarı: Playwright etiket olarak RegExp kabul etmez.
   Seçeneğin `value` değerini okuyan ortak yardımcıya çevrildi.
4. **Aynı testte iki kez giriş (test kodu).** Giriş yapılmış oturumda `/giris`
   sayfası `/vardiya`'ya yönlendiriliyor; patron olarak giriş yapan
   `beforeEach`'ten sonra personel olarak giriş yapılamıyordu. Personel yetki
   testleri ayrı `describe`'a taşındı (Aşama 5'te de yaşanmıştı).
5. **Satır seçicisi iki kartı birden yakalıyordu (test kodu).** Personel adı
   hem personel listesinde hem avans kaydında geçiyor; `.first()` yanlış kartı
   seçiyordu. İki filtre birlikte kullanıldı (ad **ve** rozet).

**Aşama 6 sonunda bilinen eksikler**

- **XLSX ve PDF dışa aktarma hâlâ yok** (Aşama 5'ten devam). CSV var ve
  testli; XLSX yeni bağımlılık, PDF yazdırma şablonu gerektirir (Aşama 7).
  Bağımlılık eklemek için onay bekleniyor.
- **Prim/yüzde sistemi yok** — işletme kararı gereği altyapı eklenmedi
  (`docs/07` S14). Yıkama iş emri "kim yaptı" bilgisini zaten taşıyor.
- **KVKK saklama/anonimleştirme otomasyonu yok** — bilinçli erteleme
  (`docs/07` S12). Aşama 8'de tekrar sorulacak.
- **Çoklu POS desteği yok** — tek POS kararı gereği (`docs/07` S15). Gerektiğinde
  `PosTerminal` + `Payment.posTerminalId` eklenir.
- **Grafikler sade**: tek satır içi SVG çizgi grafik. Çubuk/pasta grafik,
  yakınlaştırma, gün bazında ipucu (tooltip) yok.
- **Patron paneli 30 günlük trendi dönem filtresinden BAĞIMSIZ** okur
  (her zaman son 30 gün). Dönem seçimi kartları ve karşılaştırmayı etkiler,
  grafiği etkilemez.
- **Personel maliyetleri (maaş/SGK/yemek) OTOMATİK GİDER ÜRETMEZ.** Profilde
  saklanır ve maaş ödemesinde ön dolu gelir; her ay kendiliğinden gider
  yazılmaz. Otomatik tahakkuk istenirse ayrı karar gerekir.
- **Personel ekranında arama/sayfalama yok**; hesap sayısı onlarla ölçüldüğü
  için liste tek sayfada veriliyor.

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
