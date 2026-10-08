# Bu klasördeki beceriler nereden geldi

Buradaki beceriler **Emil Kowalski**'nin açık kaynak beceri deposundan
alınmıştır:

- Kaynak: https://github.com/emilkowalski/skills
- Lisans: MIT (`LICENSE-emilkowalski` dosyasında tam metin)
- Telif: © 2026 Emil Kowalski
- Projeye eklenme: 08.10.2026, işletme sahibinin isteğiyle

## Neden depoya kopyalandı

Bu bulut oturumları her açılışta sıfırdan kurulur. Eklenti olarak kurulan
beceriler konteynere inmedi (hesap tarafında "installed" görünse bile).
Depoya `.claude/skills/` altına konulduğunda **her oturum** — bulutta ya da
yerelde — bunları otomatik yükler.

## Hangileri alındı

Web arayüzüyle ilgili olanlar alındı:

`emil-design-eng` · `animate` · `improve-animations` · `review-animations` ·
`find-animation-opportunities` · `animation-vocabulary` · `apple-design` ·
`break-ui` · `prototype` · `pick-ui-library` · `performance-cheatsheet.md`

Alınmayanlar (bu projeyle ilgisiz): `write-swift`, `animate-expo`,
`mobile-native`, `ask-sonner` — iOS/React Native ve Sonner kütüphanesine
özel beceriler.

## Güncelleme

Depodan yeniden çekmek için:

```bash
git clone --depth 1 https://github.com/emilkowalski/skills.git /tmp/emil
cp -r /tmp/emil/skills/<beceri-adi> .claude/skills/
```

Lisans dosyası ve bu not KORUNMALIDIR (MIT şartı).
