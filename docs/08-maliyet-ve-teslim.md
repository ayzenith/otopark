# 8. Maliyetler, Teslim ve Destek Yapısı

## 8.1 Üçüncü taraf servisler ve süregelen maliyetler

Mimari, **ücretli servis bağımlılığını en aza indirecek** şekilde seçildi.
Zorunlu olanlar:

| Kalem | Gereklilik | Tahmini aylık | Not |
|---|---|---|---|
| **Alan adı** (.com) | Zorunlu | ~15–25 ₺ (yıllık ~200–300 ₺) | İşletme adına alınması önerilir |
| **VPS sunucu** (2 vCPU / 4 GB / 80 GB SSD) | Zorunlu | ~200–400 ₺ | Hetzner / DigitalOcean / yerli sağlayıcı |
| **SSL sertifikası** | Zorunlu | **0 ₺** | Let's Encrypt, Caddy ile otomatik yenilenir |
| **Yedek depolama** (S3 uyumlu, ~50 GB) | Şiddetle önerilir | ~30–80 ₺ | Yedekler sunucu dışında tutulmalı |
| **E-posta (kurumsal)** | İsteğe bağlı | 0–60 ₺ | Zorunlu değil |
| **Hata izleme** (Sentry vb.) | İsteğe bağlı | 0 ₺ (ücretsiz katman yeter) | Destek sürecini kolaylaştırır |

**Toplam zorunlu süregelen maliyet: yaklaşık aylık 250–500 ₺.**

Veritabanı, kimlik doğrulama, dosya depolama ve raporlama için **ücretli dış servis
kullanılmıyor** — hepsi aynı sunucuda çalışır. Böylece işletmenin aylık sabit gideri
düşük ve öngörülebilir kalır, veriler de işletmenin kontrolünde olur.

### Şu an kapsamda OLMAYAN, ileride istenirse ücret doğuracak kalemler
| Kalem | Tahmini maliyet |
|---|---|
| SMS bildirimi (abonman hatırlatma) | SMS başına ücret + sağlayıcı aboneliği |
| Sanal POS / online ödeme | Banka komisyonu (%1,5–3) + kurulum |
| Plaka okuma kamerası (ANPR) | Donanım + lisans, ayrı proje kapsamı |
| Bariyer / turnike entegrasyonu | Donanım + entegrasyon işçiliği |
| e-Arşiv fatura entegrasyonu | Entegratör aboneliği |
| Yönetilen veritabanı servisi (daha yüksek erişilebilirlik) | Aylık ek ücret |

## 8.2 Dağıtım (deployment) özeti

```
VPS (Ubuntu 24.04)
 └─ Docker Compose
     ├─ caddy          → 80/443, otomatik Let's Encrypt SSL, güvenlik başlıkları
     ├─ app            → Next.js (production build)
     ├─ postgres       → kalıcı volume
     └─ backup (cron)  → günlük pg_dump → şifrele → dış depoya yükle
```

Adımlar `ops/RUNBOOK.md` içinde komut komut yazılacak:
1. Sunucu hazırlığı, güvenlik duvarı (yalnızca 22/80/443), SSH anahtarı
2. Alan adı DNS yönlendirmesi
3. `.env` üretimi (veritabanı parolası, oturum sırrı)
4. İlk dağıtım + migration + `seed` (ilk patron hesabı)
5. Yedekleme görevinin kurulması ve **ilk geri yükleme testi**
6. Sürüm yükseltme prosedürü
7. **Geri alma (rollback)** prosedürü
8. İzleme: disk/bellek uyarısı, uygulama sağlık kontrolü (`/api/health`)

## 8.3 Yedekleme ve geri yükleme

| Tür | Sıklık | Saklama |
|---|---|---|
| Tam veritabanı yedeği | Günlük (gece) | 30 gün |
| Haftalık arşiv | Haftalık | 12 hafta |
| Aylık arşiv | Aylık | 12 ay |
| Dağıtım öncesi anlık yedek | Her sürümde | 10 sürüm |

- Yedekler **şifrelenir** ve sunucu dışındaki depoya kopyalanır.
- Geri yükleme prosedürü yazılı olacak ve **her çeyrekte bir test edilip kayıtlanacak**
  (test edilmemiş yedek, yedek sayılmaz).
- Yedek başarısız olursa patron paneline uyarı düşer.

## 8.4 Teslim yapısı

İşletme sahibi şunlara sahip olur:
1. **Kaynak kodun tamamı** — GitHub deposunda, işletme adına açılmış/devredilmiş hesapta
2. **Sunucu erişimi** — SSH anahtarı ve yönetim paneli hesabı
3. **Veritabanı erişimi** — bağlantı bilgileri ve yedeklerin bulunduğu depo hesabı
4. **Dokümantasyon** — `docs/` klasörü + `ops/RUNBOOK.md`
5. **Personel kullanım kılavuzu** — mobil akışların ekran görüntülü, 1–2 sayfalık özeti
6. **Yönetici kılavuzu** — tarife değiştirme, abonman açma, kasa kapatma, rapor alma

Hiçbir bileşen yalnızca geliştiricinin hesabına bağlı kalmaz; hizmetler işletme
adına açılır veya devredilir.

## 8.5 Bir yıllık teknik destek için yapı

Sistem, teslimden sonra bir yıl boyunca makul kapsamda değişiklik ve destek
alabilecek şekilde tasarlanıyor:

**Kapsam içi (bir yıl)**
- Hata giderme (işlev hatası, hesaplama hatası, arayüz sorunu)
- Kullanım desteği ve personel eğitimi soruları
- Mevcut ekranlarda iyileştirme (alan ekleme, filtre ekleme, rapor kolonu)
- Makul kapsamda özellik ekleme/çıkarma (ör. yeni gider kategorisi tipi, yeni rapor)
- Güvenlik ve bağımlılık güncellemeleri
- Yedekleme/geri yükleme desteği

**Ayrı kapsam (ek anlaşma)**
- Yeni büyük modül (ör. müşteri portalı, çoklu şube, personel puantaj sistemi)
- Donanım entegrasyonu (bariyer, ANPR kamera, yazarkasa)
- Ücretli üçüncü taraf servis entegrasyonu (sanal POS, SMS, e-fatura)
- Mobil uygulama (App Store / Play Store yayını)

**Desteği kolaylaştıran teknik kararlar**
- Tek kod tabanı, tek dağıtım hedefi → sorun teşhisi hızlı
- İş mantığı `src/server/**` altında toplanmış, saf fonksiyonlar test edilebilir
- Her değişiklik migration + sürüm etiketi ile izlenebilir, geri alınabilir
- Denetim kayıtları sayesinde "bu kayıt neden böyle" sorusu veriyle yanıtlanır
- Fiyat, kapasite, hizmet, kategori gibi işletme parametreleri **koda gömülü değil,
  panelden düzenlenebilir** → bu tür değişiklikler geliştirici gerektirmez

## 8.6 Yasal / muhasebe uyarısı

Finansal raporlar **yönetim amaçlıdır**. Resmî muhasebe kaydı, yasal bilanço,
beyanname veya e-fatura yerine geçmez. Her rapor çıktısının başlığında bu ifade
yer alır. Resmî muhasebe için mali müşavirin kayıtları esastır.
