---
name: Londra Camping Otopark — kurumsal site
description: Otomobil lansman broşürü dili; gerçek giriş fotoğrafı, model adı gibi dizilmiş işletme adı, teknik veriler tablosu.
colors:
  showroom: "#eef1f6"
  showroom-deep: "#e2e7f0"
  navy: "#002c72"
  navy-deep: "#001a47"
  ink: "#000f29"
  blue: "#0159e6"
  blue-pressed: "#0149bf"
  steel: "#4f5a70"
  steel-light: "#c3cde0"
  white: "#ffffff"
typography:
  model:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 8.4vw, 4.75rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.012em"
  section-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 3.6vw, 2.5rem)"
    fontWeight: 850
    lineHeight: 1
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
  data:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
rounded:
  plate: "4px"
  button: "6px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "32px"
  section: "96px"
  section-desktop: "128px"
components:
  button-directions:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.button}"
    height: "64px"
    padding: "0 32px"
  button-directions-hover:
    backgroundColor: "{colors.blue-pressed}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.navy}"
    rounded: "{rounded.button}"
    height: "56px"
  hours-plate:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    typography: "{typography.data}"
    rounded: "{rounded.plate}"
  callout-label:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
  header:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
  footer:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.white}"
---

## Overview

Kapsam: yalnızca kurumsal site (`src/app/(site)`). Panelin kendi arayüz
dili vardır; bu belge ona uygulanmaz.

Site, Londra Camping'i yeni bir otomobil modelinin lansman broşürü gibi
sunar. Gerçek giriş fotoğrafı tam genişlikte açılır; üzerinde güvenlik
kulübesi, kamera ve giriş işaretlenir. İşletme adı fotoğrafın alt
kenarına binen bir sekmede model adı gibi dizilir. Kanıt, bir teknik
veriler tablosudur: 7/24 güvenlik, 7/24 oto yıkama, ulaşım dakikaları ve
çevre noktaları. Hepsi işletme sahibinden gelen bilgidir (PRODUCT.md).

Yön, 11.10.2026'da Impeccable eleştirisinden (18/32) sonra seçildi.
Sözleşmesi `.impeccable/surfaces/` altında.

## Colors

Renkler **logodan** gelir; bu bir işletme kararıdır.
- **Lacivert `navy`** yazı, çizgi ve dolu bantlar için.
- **Mavi `blue`** yalnızca ana eyleme (YOL TARİFİ AL) ve fotoğraf
  işaretlerinin halkasına ayrılmıştır. Mavi her yerde tek anlama gelir:
  yol tarifi.

Zemin "showroom beyazı"dır: maviye çekilmiş serin bir beyaz. İkincil yazı
`steel` rengindedir; lacivert zemin üzerinde `steel-light` kullanılır.

Kırmızı yalnızca fotoğraftaki gerçek pankartta bulunur; arayüzde
kullanılmaz. Sarı, gradyan ve ışıma bu dilde yoktur.

## Typography

Tek aile: **Archivo**, genişlik eksenli değişken font, OFL lisanslı.
Otomobil markalarının kurumsal yazı sistemleri gibi üç genişlikte
kullanılır:
- **125% genişlik, 900 kalınlık, büyük harf:** model adı ve hizmet adları.
- **118% genişlik, 850 kalınlık:** bölüm başlıkları.
- **110–115% genişlik:** etiketler, veri değerleri ve buton yazıları.
- **Normal genişlik:** gövde metni.

Font `public/yazitipi/` altından sunulur; dış font sunucusuna bağımlılık
yoktur. `lang="tr"` olduğu için büyük harfe çevrilen "i" harfi "İ" olur
(CAMPİNG).

Model adının en küçük boyutu ekran genişliğine bağlıdır. Böylece
"PROFESYONEL" gibi uzun bir kelime 320 piksel genişlikte bile ortasından
bölünmez.

## Layout

- **Telefon önce:** yan boşluk 16px, masaüstünde 32px; içerik en fazla
  `max-w-6xl` genişliğindedir, fotoğraf en fazla 1600px.
- **Fotoğraf oranı sabittir:** telefonda 16:10, masaüstünde 3:1. Oran
  sabit olduğu için kırpım değişmez ve işaretler aynı nesnenin üstünde
  kalır.
- **Ana eylem ilk ekrandadır:** YOL TARİFİ AL 375×667 ve 1280×800'de
  ilk ekranda durur (E2E testi bunu ölçer).
- **Tek sütunlu ızgaralar** `grid-cols-[minmax(0,1fr)]` kullanır. Aksi
  hâlde uzun bir telefon numarası ızgarayı genişletip sayfayı yana
  taşırır; bu, 11.10.2026'da iki kez yaşandı.
- **Telefonda eylem çubuğu her sayfada vardır** ve kapak kaydırılıp
  geçilince yükselir. Bunu yalnızca CSS (scroll timeline) yapar;
  desteklemeyen tarayıcıda çubuk her zaman görünür.

## Elevation & Depth

Gölge yoktur. Derinliği yalnızca iki şey verir: fotoğrafın üstüne binen
model adı sekmesi ve lacivert dolu bantlar (örneğin "Aracınız emin
ellerde").

## Shapes

- Köşeler: plakalar 4px, butonlar 6px.
- Bölümler kutuyla değil, 2px lacivert çizgiyle açılır; satırlar 1px,
  %15–20 lacivert çizgiyle ayrılır.
- Kart yoktur.

## Components

- **YOL TARİFİ AL** (`YolTarifiButonu`): mavi zemin, beyaz yazı, 64px
  yükseklik, sağa bakan çizilmiş ok (logodaki okun yönü). Testin
  aradığı `data-test="yol-tarifi"` işareti her sayfada yalnızca bir
  kopyada bulunur.
- **İkincil eylemler:** WhatsApp ve Ara; lacivert çerçeveli, 56px
  yükseklik, logolarıyla. Telefonda arama butonu numara yerine "Ara"
  yazar.
- **Fotoğraf işareti** (`FotoIsareti`): beyaz nokta ve mavi halka,
  ardından çizgi, ardından lacivert etiket. Etiket pankartı örtecekse
  sola açılır (`sol`).
- **Teknik veriler tablosu** (`VeriGrubu` / `VeriSatiri` /
  `KonumTablosu`): grup başlıkları mavi etiketle yazılır. Değerler
  tablo rakamlarıyla dizilir; sözcük olan değerler daha küçük durur.
- **Sayfa kapağı** (`SayfaKapagi`): fotoğraf bandı, ona binen başlık
  sekmesi ve giriş paragrafı; isterse YOL TARİFİ AL içerir. Yıkama
  sayfasında fotoğraf yoktur; otopark fotoğrafı yıkama diye gösterilmez.
- **Hareket:** fotoğraf işaretleri yüklemede bir kez çizilir. Her öğe
  180–260ms sürer ve sırayla, ease-out ile gelir. Basılan öğe
  `scale(0.97)` olur. `prefers-reduced-motion` açıksa hiçbir şey
  oynamaz.

## Do's and Don'ts

**Yap:**
- Her bilgiyi işletme sahibinden al. Girilmemiş bilgi için bölüm hiç
  çizilmez.
- Mavi rengi yalnızca yol tarifi için kullan.
- Uzun panel metnini (iki numara, 92 karakterlik unvan) 320 piksel
  genişlikte dene.

**Yapma:**
- Başlık üstü etiket ve süs numarası koyma.
- Kart ızgarası, gradyan, ışıma ya da sarı kullanma.
- Fotoğraf işaretleriyle pankartı örtme.
- Fiyat yazma; sitedeki fiyat yalnızca panelden girilen serbest
  metindir.
- "Yer ayırtma" deme.
- Ulaşım dakikalarının yürüyerek mi araçla mı olduğunu belirtme.
