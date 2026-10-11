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

## impeccable (11.10.2026)

- Kaynak: https://github.com/pbakaus/impeccable (commit `c63b8dd`)
- Alınan: `plugin/skills/impeccable` (Claude Code için derlenmiş sürüm)
- Lisans: Apache 2.0 — `impeccable/LICENSE` ve `impeccable/NOTICE.md`
- Kullanım: `/impeccable <komut> <hedef>` (ör. `/impeccable critique`,
  `/impeccable polish`, `/impeccable audit`). Yeni projede önce
  `/impeccable init`.
- `scripts/impeccable` başlatıcısı ilk çalışmada motor ikilisini GitHub
  sürümlerinden indirir (depoya değil, önbelleğe). İndirme engellenirse
  beceri PRODUCT.md / DESIGN.md'yi doğrudan okuyarak devam eder.
- Eklentinin `hooks` klasörü ALINMADI; yalnızca beceri.

## ui-ux-pro-max (11.10.2026)

- Kaynak: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (commit `67803ea`)
- Alınan: yalnızca `.claude/skills/ui-ux-pro-max` (aynı depodaki banner,
  slides, brand vb. bu projeyle ilgisiz, ALINMADI). `scripts/tests` çıkarıldı.
- Lisans: MIT — `ui-ux-pro-max/LICENSE`
- Değişiklik: SKILL.md'deki `${CLAUDE_PLUGIN_ROOT}/` öneki kaldırıldı;
  eklenti olarak değil depodan yüklendiği için yol proje köküne göre
  (`.claude/skills/ui-ux-pro-max/scripts/search.py`). Python 3, ağ YOK.
