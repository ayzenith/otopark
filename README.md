# Londra Camping Otopark — İşletme Yönetim Sistemi

Otopark giriş-çıkış, abonman, oto yıkama, kasa, gelir-gider ve kurumsal web sitesini
tek platformda birleştiren, mobil öncelikli işletme yönetim yazılımı.

> **Durum: Tasarım aşaması (Aşama 0).** Bu depoda henüz uygulama kodu yok.
> Önce mimari, veri modeli, yetki matrisi, ekran akışları ve geliştirme planı
> onaya sunulur; kod yazımı onaydan sonra Aşama 1 ile başlar.

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [docs/01-mimari.md](docs/01-mimari.md) | Teknoloji seçimi, gerekçeler, alternatifler, klasör yapısı, dağıtım |
| [docs/02-veritabani-semasi.md](docs/02-veritabani-semasi.md) | Tablolar, ilişkiler, Prisma şema taslağı, veri bütünlüğü kuralları |
| [docs/03-roller-yetki-matrisi.md](docs/03-roller-yetki-matrisi.md) | Roller, izin listesi, yetki matrisi, denetim kayıtları |
| [docs/04-ekranlar-ve-akislar.md](docs/04-ekranlar-ve-akislar.md) | Mobil personel ana ekranı, patron paneli, ekran listesi, akış şemaları |
| [docs/05-tarife-ve-abonman.md](docs/05-tarife-ve-abonman.md) | Ücret hesaplama algoritması, kişiye özel abonman kuralları, örnekler |
| [docs/06-gelistirme-plani.md](docs/06-gelistirme-plani.md) | 8 aşama, her aşamanın tamamlanma kriterleri, test planı |
| [docs/07-acik-sorular.md](docs/07-acik-sorular.md) | **Yanıt bekleyen kritik sorular** (işletme kuralları varsayılmadı) |
| [docs/08-maliyet-ve-teslim.md](docs/08-maliyet-ve-teslim.md) | Üçüncü taraf servisler, aylık maliyetler, teslim ve 1 yıl destek yapısı |

## Önce okunacak

İşletme sahibi için: **[docs/07-acik-sorular.md](docs/07-acik-sorular.md)**.
Oradaki yanıtlar olmadan tarife ve abonman mantığı kesinleştirilemez;
varsayım yapılmamıştır.
