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

> **Yanıt:**

### S2 — Hangi araç sınıfları var ve fiyatları farklı mı?
Otomobil / SUV / minibüs / kamyonet / motosiklet / karavan / çekici?
"Londra Camping" adı karavan ve çekici park hizmeti de olabileceğini düşündürüyor —
öyleyse bu sınıfların fiyatı ve kuralları (uzun dönem park?) farklı mı?

> **Yanıt:**

### S3 — Otopark kapasitesi kaç araç?
Ayrıca abonmanlılara ayrılmış sabit yer var mı?

> **Yanıt:**

### S4 — Gece tarifesi nasıl çalışıyor?
- Gece hangi saat aralığı? (ör. 20:00–08:00)
- Gece sabit bir ücret mi (ör. "gece 150 ₺"), yoksa indirimli saatlik mi?
- Gece tarifesi normal hesapla karşılaştırılıp **avantajlı olan** mı uygulanacak,
  yoksa gece aralığında **her zaman** gece tarifesi mi geçerli?

> **Yanıt:**

### S5 — Tarife, girişte mi çıkışta mı sabitlenir?
Önerim: **giriş anındaki tarife** (müşteriye söylenen fiyat budur).
Yani gün içinde fiyat artarsa içeride olan araçlar eski fiyatla çıkar.
Onaylıyor musun, yoksa çıkış anındaki tarife mi uygulanmalı?

> **Yanıt:** ✅ **KARAR (02.10.2026): Giriş anındaki tarife uygulanır.** Giriş sırasında geçerli kural `tariffSnapshot` olarak park kaydına yazılır; gün içinde fiyat değişse bile içerideki araçlar eski fiyatla çıkar.

### S6 — Hafta sonu / tatil / sezon farkı var mı?
Cumartesi-Pazar veya resmî tatillerde farklı fiyat uygulanıyor mu?

> **Yanıt:**

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

> **Yanıt:**

### S12 — KVKK: müşteri verisi ne kadar saklanacak?
Abonmanı biten müşterinin adı/telefonu ne kadar süre tutulacak?
(Öneri: abonman bitiminden 2 yıl sonra kişisel alanlar anonimleştirilir,
finansal kayıtlar — tutar/tarih — korunur.)

> **Yanıt:**

---

## 🟡 Yıkama ve finans için gerekli (Aşama 4–5'i bloke eder)

### S13 — Oto yıkama hizmetleri ve fiyatları
Hizmet adları ve fiyatları (araç sınıfına göre değişiyorsa her sınıf için):
- İç dış yıkama: ?
- İç temizlik: ?
- Detaylı temizlik: ?
- Pasta cila: ?
- Diğer / ek hizmetler (motor yıkama, koltuk yıkama, seramik kaplama…): ?

> **Yanıt:**

### S14 — Yıkamayı kim yapıyor?
Personel mi, dışarıdan anlaşmalı ekip mi? Yıkayan kişiye prim/yüzde veriliyor mu?
(Veriliyorsa hesaplama kuralı gerekiyor; sisteme otomatik prim hesabı eklenebilir.)

> **Yanıt:**

### S15 — Kart ödemeleri nasıl kaydediliyor?
- Tek POS mu, birden fazla mı?
- Personel dekont toplamını mı girecek, her işlemi tek tek mi? (Tasarım: her işlem
  kendi kart kaydını alır, kapanışta toplam dekontla karşılaştırılır.)
- Taksitli satış oluyor mu? (Olursa kaydı nasıl tutalım?)

> **Yanıt:**

### S16 — Personel sayısı, vardiyalar ve yetkiler
- Kaç personel var ve isimleri/kullanıcı adları?
- Vardiya düzeni nasıl? (ör. 08:00–20:00 / 20:00–08:00, ya da tek vardiya)
- Hangi personel kasa kapatabilir?
- `MANAGER` (vardiya sorumlusu) rolü kullanılacak mı, yoksa sadece patron + personel mi?

> **Yanıt:**

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
Ancak **S5, S7, S9, S10 kararları koda gömülen mantığı belirler** — bunları
Aşama 2 başlamadan önce yanıtlamak gerekir — **bu dördü 02.10.2026'da karara bağlandı**
(S5: girişte sabitlenir · S7: takvim günü 00:00 · S9: a+c · S10: a). Dolayısıyla
Aşama 1 ve Aşama 2 için mantıksal engel kalmadı; eksik olan yalnızca fiyat
**değerleri**, onlar da panelden girilebilir.
