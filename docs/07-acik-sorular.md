# 7. Yanıt Bekleyen Sorular

Bu sorular **işletmenin gerçek kurallarıdır**; teknik tercih değil. Varsayım
yapılmamıştır çünkü yanlış bir varsayım yanlış para tahsil edilmesine yol açar.

**Yanıtlama kolaylığı:** Her sorunun altına tek satır yazman yeterli.
Bir kısmını "şimdilik boş kalsın, sonra gireriz" diye işaretlemen de olur —
o alanlar panelden düzenlenebilir olarak kodlanır, yalnızca başlangıç değeri boş kalır.

---

## 🔴 Kod yazımına başlamadan önce gerekli (Aşama 1–2'yi bloke eder)

### S1 — Otopark tarifesi nedir?
Şu alanların gerçek değerleri gerekiyor:
- Ücretsiz süre var mı, kaç dakika? (ör. 15 dk)
- İlk blok ücreti var mı? (ör. "ilk 1 saat 50 ₺")
- Saatlik ücret?
- Başlayan saat tam sayılıyor mu, yoksa yarım saatlik kademe var mı?
- Günlük (24 saat) ücret?
- Günlük üst limit var mı? (ör. "ne kadar kalırsa kalsın bir günde en fazla 300 ₺")
- Asgari ücret var mı?

> **Yanıt:** ✅ **KARAR (04.10.2026).** Tarife tam olarak verildi:
> 0–1 saat 100 ₺, sonra her saat +50 ₺ (1–2 sa 150, 2–3 sa 200 … 8–9 sa 500),
> 9–24 saat 500 ₺ sabit, 24 saatten sonra **başlayan her 24 saat** +600 ₺.
> Ücretsiz süre yok. Değerler `docs/05` bölüm 0.1'de tablo hâlinde ve
> `tests/unit/gercek-tarife.test.ts` içinde bant bant testli. Koda sabit
> değildir: veritabanında sürümlü tutulur, panelden değiştirilir.

### S2 — Hangi araç sınıfları var ve fiyatları farklı mı?
Otomobil / SUV / minibüs / kamyonet / motosiklet / karavan / çekici?
"Londra Camping" adı karavan ve çekici park hizmeti de olabileceğini düşündürüyor —
öyleyse bu sınıfların fiyatı ve kuralları (uzun dönem park?) farklı mı?

> **Yanıt:** ✅ **KARAR (04.10.2026).**
> **Normal otoparkta araç sınıfına göre fiyat farkı YOKTUR** — tek genel kural
> uygulanır. **Araç tipine göre fiyatlandırma YALNIZCA oto yıkamada vardır**
> (Otomobil 600 ₺, SUV 700 ₺, Motosiklet 400 ₺ başlangıç değerleri; panelden
> değiştirilir, yeni tip eklenebilir).
> **Karavan ayrı — fiyatı da karara bağlandı (04.10.2026):**
> normal otopark tarifesinin dışındadır (`excludeFromStandardTariff`) ve
> **kendi tarifesi vardır: 700 ₺ / 24 saat, 24 saatten sonra başlayan her
> 24 saat +700 ₺.** İşletme yalnızca 24 saatlik fiyatı verdiği için karavan
> tarifesi 24 saatlik **tek blok** olarak girildi (saatlik kademe
> **uydurulmadı**): 1 saatlik karavan parkı da 700 ₺'dir. Çözümleyici bu
> sınıfta genel kurala düşmediği için, kural silinse bile sessizce otomobil
> fiyatı uygulanmaz. Ayrıntı `docs/05` 0.2; testler
> `tests/unit/karavan-tarife.test.ts` ve
> `tests/integration/karavan-ve-kapasite.test.ts`.
> **Karavan YIKAMA ücreti hâlâ belirlenmedi.**

### S3 — Otopark kapasitesi kaç araç?
Ayrıca abonmanlılara ayrılmış sabit yer var mı?

> **Yanıt:** ✅ **KARAR (04.10.2026): ŞİMDİLİK KAPASİTE YOK — sınır
> uygulanmaz.** `ParkingCapacitySetting.totalCapacity = 0` bırakıldı
> ("tanımlı değil"): doluluk hesaplanmaz, personel ekranında kapasite çubuğu
> çizilmez, araç girişi doluluk yüzünden **hiçbir zaman** engellenmez.
> Kapasite mantığı koddan kaldırılmadı; patron ileride Yönetim → Ayarlar'dan
> bir sayı girerse gösterge ve "otopark dolu" onayı kendiliğinden devreye
> girer. Şu an **aktif edilmedi** (testle doğrulanıyor).
> **Abonmanlılara ayrılmış sabit yer sorusu yanıtlanmadı** — sistemde böyle
> bir ayırma yok.

### S4 — Gece tarifesi nasıl çalışıyor?
- Gece hangi saat aralığı? (ör. 20:00–08:00)
- Gece sabit bir ücret mi (ör. "gece 150 ₺"), yoksa indirimli saatlik mi?
- Gece tarifesi normal hesapla karşılaştırılıp **avantajlı olan** mı uygulanacak,
  yoksa gece aralığında **her zaman** gece tarifesi mi geçerli?

> **Yanıt:** ✅ **KARAR (04.10.2026): GECE TARİFESİ YOK.**
> Gece giren araç gündüzle aynı ücreti öder. Hesaplama motorundaki gece
> tarifesi mantığı yerinde duruyor ama gece ücreti girilmediği için **hiç
> devreye girmez** (testle doğrulanıyor). İleride istenirse panelden girilmesi
> yeterlidir.

### S5 — Tarife, girişte mi çıkışta mı sabitlenir?
Önerim: **giriş anındaki tarife** (müşteriye söylenen fiyat budur).
Yani gün içinde fiyat artarsa içeride olan araçlar eski fiyatla çıkar.
Onaylıyor musun, yoksa çıkış anındaki tarife mi uygulanmalı?

> **Yanıt:** ✅ **KARAR (02.10.2026): Giriş anındaki tarife uygulanır.** Giriş sırasında geçerli kural `tariffSnapshot` olarak park kaydına yazılır; gün içinde fiyat değişse bile içerideki araçlar eski fiyatla çıkar.

### S6 — Hafta sonu / tatil / sezon farkı var mı?
Cumartesi-Pazar veya resmî tatillerde farklı fiyat uygulanıyor mu?

> **Yanıt:** ✅ **KARAR (04.10.2026): HAFTA SONU FARKI YOK.**
> Cumartesi ile pazartesi aynı ücret. Hafta sonu katsayısı alanı boş kalır ve
> kural devreye girmez (testle doğrulanıyor). Sezon farkı sorulmadı; ileride
> gerekirse yeni tarife sürümü açılarak uygulanabilir.

### S7 — "Günlük" rapor hangi saatte başlar?
Gece 00:00'da mı, yoksa vardiya başlangıcında mı (ör. 08:00–08:00)?
Bu, günlük kasa ve gelir raporlarının doğruluğunu belirler.

> **Yanıt:** ✅ **KARAR (02.10.2026): Takvim günü, 00:00 – 00:00 (Europe/Istanbul).** `BusinessSetting.businessDayStartHour = 0`. Alan yapılandırılabilir kalır; ileride gece vardiyası için değiştirilebilir.

### S8 — İlk patron hesabı
Kullanıcı adı ne olsun? (Parolayı sistemde ilk girişte sen belirleyeceksin;
başlangıç parolası güvenli bir kanaldan iletilir ve ilk girişte değiştirme zorunlu olur.)

> **Yanıt:**

---

## 🟠 Abonman modülü için gerekli (Aşama 3'ü bloke eder)

### S9 — Abonman ödemesi alınmamışsa araç girişinde ne olsun?
Seçenekler:
- **(a)** Abonman geçerli sayılır, sadece "ödeme alınmamış" uyarısı gösterilir
- **(b)** Abonman geçersiz sayılır, normal tarife uygulanır
- **(c)** Geçerli sayılır ama yöneticiye uyarı düşer

Önerim: **(a) + (c)** — personel müşteriyi kapıda tutmaz, patron görür.

> **Yanıt:** ✅ **KARAR (02.10.2026): Seçenek (a) + (c).** Abonman geçerli sayılır, personel ekranında "abonman ödemesi alınmamış" uyarısı çıkar ve patron panelindeki uyarı merkezine düşer. Personel müşteriyi kapıda tutmaz.

### S10 — Abonman park sırasında biterse?
Araç abonmanlıyken girdi, içerideyken abonman bitti, sonra çıkıyor.
- **(a)** O park ücretsiz tamamlanır (önerim)
- **(b)** Abonmanın bittiği andan itibaren ücret işler

> **Yanıt:** ✅ **KARAR (02.10.2026): Seçenek (a).** Girişte abonman geçerliyse o park ücretsiz tamamlanır (`billingMode = SUBSCRIPTION` korunur). Sonraki girişler normal tarifeye tabi olur.

### S11 — Abonman süreleri ve kuralları
- Hangi süreler sunulacak? (aylık / 3 aylık / 6 aylık / yıllık / haftalık?)
- Abonman **sınırsız giriş-çıkış** mı, yoksa günde/ayda sınır var mı?
- Abonman belirli saat aralığını mı kapsıyor (ör. sadece gündüz), yoksa 7/24 mü?
- Abonman fiyatına oto yıkama indirimi gibi bir şey dahil mi?
- Bir abonmana en fazla kaç plaka eklenebilir?

> **Yanıt:** ✅ **KARAR (04.10.2026) — kapsam kuralı:**
> Abonman **7/24 geçerlidir** ve **sınırsız giriş-çıkış** hakkı verir. Abonman
> aktif olduğu sürece araç günün herhangi bir saatinde girip çıkabilir; günlük
> giriş/çıkış sayısında limit yoktur. Veri modeli ileride farklı abonman
> kurallarına (belirli saat aralığı, hafta içi/hafta sonu ayrımı, giriş sayısı
> limiti) izin verecek şekilde tasarlandı; bu kurallar **şu anda devre dışıdır**
> ve arayüzden seçilemez (bkz. `src/server/subscription/rules.ts`).
>
> ✅ **KARAR (04.10.2026) — süre:** Standart abonman **1 AYDIR** ve şu anda
> **yalnızca 1 aylık** abonman vardır. Arayüzde tek süre seçeneği sunulur,
> bitiş tarihi +1 ay ön dolu gelir. İleride farklı süreler eklenebilir; veri
> modeli herhangi bir aralığı destekler.
>
> ✅ **KARAR (04.10.2026) — yıkama indirimi:** Abonmanın oto yıkamada indirimi
> **YOKTUR.** Yıkama fiyatlandırması abonman tablolarına hiç bakmaz; abonmanlı
> müşterinin yıkama ücreti abonmansızla aynıdır (testle doğrulanıyor).
>
> **Hâlâ açık** (sistemi engellemez): bir abonmana en fazla kaç plaka
> eklenebileceği. Sınır **abonman başına** girilir (`includedVehicleCount`);
> genel bir üst sınır tanımlanmadı.

### S12 — KVKK: müşteri verisi ne kadar saklanacak?
Abonmanı biten müşterinin adı/telefonu ne kadar süre tutulacak?
(Öneri: abonman bitiminden 2 yıl sonra kişisel alanlar anonimleştirilir,
finansal kayıtlar — tutar/tarih — korunur.)

> **Yanıt:** ⏸️ **ERTELENDİ (05.10.2026): otomasyon ŞİMDİLİK EKLENMEYECEK.**
> İşletme sahibi veri saklama/anonimleştirme otomasyonunun şu an yazılmamasını
> istedi. Saklama süresi **hâlâ belirlenmedi**; bir süre varsayılmadı ve
> zamanlanmış bir silme/anonimleştirme süreci **yoktur**.
>
> Not: Bu bir teknik eksik değil, **bilinçli bir erteleme**. Karar verildiğinde
> yapılacak iş: `Customer` üzerindeki kişisel alanların (ad, telefon)
> anonimleştirilmesi + finansal satırların korunması. Veri modeli buna hazır
> (finansal kayıtlar müşteriye `SetNull` ile bağlı, tutarlar kendi
> satırlarında). Devreye alma öncesinde (Aşama 8) tekrar sorulacak.

---

## 🟡 Yıkama ve finans için gerekli (Aşama 4–5'i bloke eder)

### S13 — Oto yıkama hizmetleri ve fiyatları
Hizmet adları ve fiyatları (araç sınıfına göre değişiyorsa her sınıf için):
- İç dış yıkama: ?
- İç temizlik: ?
- Detaylı temizlik: ?
- Pasta cila: ?
- Diğer / ek hizmetler (motor yıkama, koltuk yıkama, seramik kaplama…): ?

> **Yanıt:** ✅ **KISMİ KARAR (04.10.2026).**
> **İç Dış Yıkama** fiyatları araç tipine göre verildi: Otomobil 600 ₺,
> SUV 700 ₺, Motosiklet 400 ₺. Bunlar başlangıç değerleridir ve panelden
> değiştirilir.
>
> **Ek hizmetler panelden yönetilir:** patron yeni hizmet ekleyebilir
> (motor yıkama, pasta cila, koltuk yıkama…) ve her birinin fiyatını araç tipi
> bazında girebilir. **Motor Yıkama** hizmeti oluşturuldu ama **ücreti
> belirlenmedi** — fiyatsız hizmet 0 ₺'ye çevrilmez; personel ekranında
> "fiyat girilmemiş" yazar ve kayıt için açık onay istenir.
>
> ✅ **EK KARAR (04.10.2026):** Otomobil 600 ₺ / SUV 700 ₺ / Motosiklet 400 ₺
> **ana yıkama fiyatları olarak kalır.** Motor yıkama, iç temizlik, pasta/cila
> gibi ek hizmetlerin fiyatları **şimdilik girilmeyecek ve UYDURULMAYACAK**;
> panelden sonradan girilebilir bırakıldı.
>
> **Hâlâ açık (varsayılmadı):** motor yıkama ücreti; iç temizlik, detaylı
> temizlik, pasta cila gibi diğer hizmetlerin adları ve fiyatları; karavan
> yıkama ücreti.

### S14 — Yıkamayı kim yapıyor?
Personel mi, dışarıdan anlaşmalı ekip mi? Yıkayan kişiye prim/yüzde veriliyor mu?
(Veriliyorsa hesaplama kuralı gerekiyor; sisteme otomatik prim hesabı eklenebilir.)

> **Yanıt:** ✅ **KARAR (05.10.2026): yıkamayı PERSONEL yapıyor; prim/yüzde
> sistemi YOK.**
> Prim altyapısı **şu an eklenmeyecek** — ne alan, ne hesaplama, ne ekran.
> Yıkama iş emri `assignedUserId` ile zaten "kim yaptı" bilgisini taşıyor;
> prim kararı verilirse hesaplama bu alandan türetilebilir.
> `PRIM` gider kategorisi kayıtlı duruyor ama **otomatik prim hesabı yoktur**:
> patron isterse elle gider girer.

### S15 — Kart ödemeleri nasıl kaydediliyor?
- Tek POS mu, birden fazla mı?
- Personel dekont toplamını mı girecek, her işlemi tek tek mi? (Tasarım: her işlem
  kendi kart kaydını alır, kapanışta toplam dekontla karşılaştırılır.)
- Taksitli satış oluyor mu? (Olursa kaydı nasıl tutalım?)

> **Yanıt:** ✅ **KARAR (05.10.2026): TEK POS + nakit. TAKSİT YOK.**
> Mevcut tasarım bunu zaten karşılıyor: her işlem kendi kart kaydını alır
> (`Payment.method = CARD`, `cardNote` serbest dekont notu), kasa kapanışında
> **tek** dekont toplamı girilir ve sistemdeki kart tahsilatıyla
> karşılaştırılır (`CashDrawerSession.declaredCard` / `expectedCard`).
>
> **İleride çoklu POS'a genişletilebilir** bırakıldı: o zaman yapılacak iş bir
> `PosTerminal` tablosu + `Payment.posTerminalId` + kapanışta terminal başına
> dekont alanıdır. Şimdi **eklenmedi** çünkü kullanılmayan alan, personelin
> doldurmak zorunda sandığı boş bir kutu üretir.
>
> **POS entegrasyonu YOKTUR** (hiç olmadı): kart ödemesi personel tarafından
> elle kaydedilir.

### S16 — Personel sayısı, vardiyalar ve yetkiler
- Kaç personel var ve isimleri/kullanıcı adları?
- Vardiya düzeni nasıl? (ör. 08:00–20:00 / 20:00–08:00, ya da tek vardiya)
- Hangi personel kasa kapatabilir?
- `MANAGER` (vardiya sorumlusu) rolü kullanılacak mı, yoksa sadece patron + personel mi?

> **Yanıt:** ✅ **KARAR (05.10.2026).**
>
> **Personel isimleri sisteme YAZILMAZ.** Gerçek personel adları/kullanıcı
> adları `prisma/seed.ts`'e **girilmeyecek**; hesaplar **patron panelinden**
> açılacak (Yönetim → Personel). Seed yalnızca tek bir patron hesabı üretir
> (kullanıcı adı `OWNER_USERNAME` ortam değişkeninden, varsayılan `patron`).
> Test/demo personeli gerekiyorsa **ayrı fixture** olarak üretilir
> (`tests/e2e/global-setup.ts` → `e2e_personel`); üretim verisine karışmaz.
>
> **Roller: şimdilik yalnızca PATRON + PERSONEL.** `MANAGER` (vardiya
> sorumlusu) rolü **aktif olarak kullanılmayacak**; enum, izin taban kümesi ve
> yetki matrisi altyapıda **duruyor** ve ileride tek satırla açılabilir. Personel
> ekleme ekranında rol seçimi **Patron / Personel** olarak sunulur.
>
> **Kasa kapatma:** patron **+ `cash.drawer.close` izni verilen personel.**
> Bu izin `STAFF` taban kümesinde YOKTUR; patron, personel bazında
> (`UserPermission`) verir. Böylece yeni rol tanımlamaya gerek kalmaz.
>
> **Vardiya düzeni: TEK VARDİYA ZORUNLULUĞU YOK.** Personel kendi vardiyasını
> açıp kapatır. **Aynı anda yalnızca bir açık KASA oturumu** olabilir (tek
> fiziki kasa; veritabanı kısmi unique indeksiyle garanti). Vardiya saatleri
> **işletme ayarlarından yönetilir** (`BusinessSetting.shiftWindows`) ve
> yalnızca **bilgilendirme/raporlama etiketidir** — personelin vardiya açmasını
> ENGELLEMEZ.

---

## 🟢 Web sitesi ve teslim için gerekli (Aşama 7–8)

### S17 — Alan adı ve barındırma
- Alan adı var mı? (ör. londracampingotopark.com) Yoksa alınacak mı, kim alacak?
- Sunucu tercihi: biz kuralım mı, mevcut bir sunucu var mı?

> **Yanıt:**

### S18 — Web sitesi içeriği
- İşletme tam adı, açık adres, telefon, WhatsApp numarası
- Çalışma saatleri (7/24 mi?)
- Google Maps konum bağlantısı
- Instagram / sosyal medya hesapları
- Fotoğraflar (otopark, yıkama alanı, giriş) — mevcut mu, yoksa logo ve geçici görselle mi başlayalım?
- Logo var mı? (Yoksa isim bazlı sade bir kurumsal logo tasarlanabilir.)

> **Yanıt:**

### S19 — Web sitesinde hangi fiyatlar açıkça yazılacak?
Otopark saatlik fiyatı yazılsın mı, yoksa "bilgi için arayınız" mı?
Abonman fiyatları kişiye özel olduğundan sitede **yazılmaması** öneriliyor —
onaylıyor musun?

> **Yanıt:**

### S20 — Teslim ve erişim
- GitHub deposu işletme adına mı olacak, senin hesabında mı kalacak?
- Sunucu ve veritabanı erişim bilgileri kime teslim edilecek?
- Yedeklerin kopyalanacağı dış depolama hesabı kimde olacak?

> **Yanıt:**

---

## Yanıt gelmeden ne yapılabilir?

Aşağıdaki işler **hiçbir yanıta bağlı değil** ve onay verirsen hemen başlayabilirim:

| İş | Aşama |
|---|---|
| Proje iskeleti, Docker, CI, Prisma şeması, migration'lar | 1 |
| Kimlik doğrulama, oturum, izin altyapısı, denetim kayıtları | 1 |
| Mobil UI bileşen kümesi ve kabuk (üst bar, alt gezinme, kartlar, alt paneller) | 1 |
| Türkçe para/tarih/süre/plaka biçimleme ve testleri | 1 |
| **Tarife motoru** — fiyatlar boş, kurallar yapılandırılabilir; S1 gelince panelden girilir | 2 |
| Araç giriş-çıkış ekranları ve akışları (tarife değerleri sonradan doldurulur) | 2 |
| Müşteri ve abonman modülü (fiyat her zaman elle girildiği için S11 beklemez) | 3 |

Yani **S1–S4 ve S13'ün gecikmesi geliştirmeyi durdurmaz**: tarifeler panelden
girilebilir alanlar olarak kodlanır, sen hazır olduğunda kendi ekranından girersin.

> **Güncelleme (04.10.2026 — ikinci tur):** S1, S2, S3, S4, S6, S11 karara
> bağlandı; S13 kısmen yanıtlandı ve kalanı bilinçli olarak açık bırakıldı.
> Verilen fiyatlar `npm run fiyatlar:kur` ile veritabanına **veri olarak**
> yazıldı; koda sabitlenmedi.
>
> | Konu | Durum |
> |---|---|
> | Karavan otopark ücreti | ✅ 700 ₺ / 24 sa, her ek 24 sa +700 ₺ |
> | Otopark kapasitesi (S3) | ✅ sınır yok, aktif edilmedi |
> | Yıkama ana fiyatları | ✅ 600 / 700 / 400 ₺ (değişmedi) |
> | Abonman süresi | ✅ 1 ay |
> | Abonmanın yıkama indirimi | ✅ yok |
> | Motor yıkama ücreti | ⏳ **belirlenmedi — uydurulmadı** |
> | Diğer yıkama hizmetleri (iç temizlik, pasta/cila…) | ⏳ **belirlenmedi** |
> | Karavan yıkama ücreti | ⏳ **belirlenmedi** |
> | S12 (KVKK otomasyonu) | ⏸️ **bilinçli olarak ertelendi** |
> | S14 (yıkama primi) | ✅ prim YOK, altyapı eklenmedi |
> | S15 (kart ödemesi) | ✅ tek POS + nakit, taksit yok |
> | S16 (personel/vardiya/yetki) | ✅ patron+personel, kasa kapatma izinle |
> | S17–S20 (web sitesi, teslim) | ⏳ yanıt bekliyor (Aşama 7–8) |
Ancak **S5, S7, S9, S10 kararları koda gömülen mantığı belirler** — bunları
Aşama 2 başlamadan önce yanıtlamak gerekir — **bu dördü 02.10.2026'da karara bağlandı**
(S5: girişte sabitlenir · S7: takvim günü 00:00 · S9: a+c · S10: a). Dolayısıyla
Aşama 1 ve Aşama 2 için mantıksal engel kalmadı; eksik olan yalnızca fiyat
**değerleri**, onlar da panelden girilebilir.


---

## 05.10.2026 — Aşama 7 sonrası durum

Kurumsal sitenin **iskeleti tamamlandı**; içerik hâlâ girilmedi.

| Soru | Durum |
|---|---|
| S17 alan adı / sunucu | Kullanıcı ".com alacağım, yarın olur" dedi (05.10.2026). Sunucu sağlayıcı kararı YOK. |
| S18 işletme künyesi | VERİLMEDİ. Site alanları boş; panelden girilecek. Logo ve fotoğraf da yok — PWA ikonu geçici. |
| S19 sitedeki fiyatlar | KARAR YOK. Site fiyatı tarifeden otomatik akmaz; patron hangi satırı yazarsa o görünür. Satır yoksa "arayınız" denir. |
| S20 teslim ve erişim | KARAR YOK. |
| S12 KVKK saklama süresi | Ertelendi, Aşama 8'de tekrar sorulacak. |

Aşama 7'de alınan teknik karar: **site, otopark tarifesini ve yıkama fiyat
tablosunu KENDİ OKUMAZ.** Yalnızca `SitePublicPrice` satırlarını gösterir.
Gerekçe: tarifede yapılan bir düzeltmenin sitede istenmeden yayına çıkmaması
ve S19'un hâlâ açık olması. (Mimari kural 11'in site karşılığı.)

Site, bilgiler girilene kadar **arama motorlarına kapalıdır**
(`robots: index false`); yarım bir sayfanın indekslenmesi sonradan zor
düzelir. Aşama 8'de açılacak.
