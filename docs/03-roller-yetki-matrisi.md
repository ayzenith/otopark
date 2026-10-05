# 3. Roller ve Yetki Matrisi

## 3.1 Roller

| Rol | Kim | Özet |
|---|---|---|
| **OWNER** (İşletme Sahibi / Patron) | İşletme sahibi | Her şeyi görür ve yapar. Tek rol ki tarife, maaş, finans ve kullanıcı yönetimine erişir. |
| **MANAGER** (Vardiya Sorumlusu / Müdür) | — **ŞU AN KULLANILMIYOR** | Personelin tüm işlemleri + kasa kapanışı, abonman açma, iptal onayı, indirim. Maaş ve genel finans raporlarını **görmez**. Karar (05.10.2026): bu rol **aktif edilmedi**, altyapıda ileride açılmak üzere duruyor; personel ekleme ekranında seçilemez. |
| **STAFF** (Personel) | Vardiyadaki görevli | Araç giriş-çıkış, tahsilat, yıkama, abonman sorgulama. Kendi vardiyasının özetini görür. |

**Ek esneklik:** Roller taban izin kümesini belirler; patron `UserPermission` tablosu ile
tek tek kullanıcıya izin **ekleyebilir veya kaldırabilir**. Böylece yeni rol
tanımlamadan farklı yetki seviyeleri oluşur.

> ### Karar (05.10.2026): PATRON + PERSONEL
>
> İşletme şimdilik **yalnızca OWNER ve STAFF** rollerini kullanıyor. MANAGER
> rolü enum'da, taban izin kümesinde ve aşağıdaki matriste **duruyor** ama
> arayüzden seçilemez ve hiçbir hesaba atanmaz.
>
> **Kasa kapatma bunun ilk uygulaması:** patron + `cash.drawer.close` izni
> **kullanıcı bazında** verilen personel. İzin `STAFF` taban kümesinde yoktur;
> patron Yönetim → Personel ekranından verir. (Doküman önceki sürümünde bu izin
> `cash.close` olarak anılıyordu; koddaki sabit `cash.drawer.close`'dur.)
>
> **Personel adları sisteme tohum verisi olarak yazılmaz** — hesaplar patron
> panelinden açılır (bkz. `docs/07` S16).

## 3.2 İzin listesi (kod seviyesinde sabitler)

```
parking.entry            parking.exit             parking.search
parking.history.view     parking.void             parking.discount
parking.override_price

subscription.view        subscription.create      subscription.edit
subscription.price.set   subscription.cancel      subscription.payment.collect

customer.view            customer.create          customer.edit

wash.create              wash.update_status       wash.collect
wash.void                wash.report.view
inventory.view           inventory.movement.create

cash.shift.open          cash.shift.close         cash.drawer.open
cash.drawer.close        cash.movement.create     cash.report.self
cash.report.all          cash.void

finance.income.view      finance.income.create    finance.expense.view
finance.expense.create   finance.expense.void     finance.report.view
finance.report.export

tariff.view              tariff.edit
washprice.view           washprice.edit

personnel.view           personnel.manage         personnel.cost.view

site.content.edit        site.price.edit

settings.business.edit   audit.view               user.manage
```

## 3.3 Yetki matrisi

| İzin | OWNER | MANAGER | STAFF |
|---|:--:|:--:|:--:|
| parking.entry / exit / search | ✅ | ✅ | ✅ |
| parking.history.view | ✅ | ✅ | ✅ (kendi vardiyası + son 7 gün) |
| parking.discount | ✅ | ✅ | ❌ (izinle açılabilir) |
| parking.void (işlem iptali) | ✅ | ✅ | ❌ |
| parking.override_price (tutarı elle değiştirme) | ✅ | ❌ | ❌ |
| subscription.view | ✅ | ✅ | ✅ (salt okunur sorgulama) |
| subscription.create / edit | ✅ | ✅ | ❌ |
| ↳ *not:* abonman **oluşturmak** ücret yazmayı gerektirdiği için `subscription.price.set` de ister | ✅ | ❌ | ❌ |
| **subscription.price.set** (özel fiyat belirleme **ve abonman tutarını görme**) | ✅ | ❌ | ❌ |
| subscription.cancel | ✅ | ❌ | ❌ |
| subscription.payment.collect | ✅ | ✅ | ❌ (izinle açılabilir) |
| customer.view | ✅ | ✅ | ✅ (ad + plaka + abonman durumu) |
| customer.create / edit | ✅ | ✅ | ❌ (create izinle açılabilir) |
| wash.create / update_status / collect | ✅ | ✅ | ✅ |
| wash.void | ✅ | ✅ | ❌ |
| wash.report.view | ✅ | ✅ | ❌ |
| inventory.* | ✅ | ✅ | ❌ (movement.create izinle açılabilir) |
| cash.shift.open / close (kendi vardiyası) | ✅ | ✅ | ✅ |
| cash.drawer.open / close | ✅ | ✅ | ❌ (izinle açılabilir) |
| cash.movement.create | ✅ | ✅ | ❌ |
| cash.report.self (kendi tahsilatı) | ✅ | ✅ | ✅ |
| cash.report.all (tüm personel) | ✅ | ✅ | ❌ |
| cash.void | ✅ | ❌ | ❌ |
| finance.income.view | ✅ | ✅ | ❌ |
| finance.income.create | ✅ | ✅ | ❌ |
| finance.expense.view / create | ✅ | ✅ | ❌ |
| finance.expense.void | ✅ | ❌ | ❌ |
| finance.report.view / export | ✅ | ❌ | ❌ |
| tariff.view | ✅ | ✅ | ✅ (yalnızca geçerli fiyatlar) |
| **tariff.edit** | ✅ | ❌ | ❌ |
| washprice.view | ✅ | ✅ | ✅ |
| **washprice.edit** | ✅ | ❌ | ❌ |
| personnel.view | ✅ | ✅ (ad, görev, vardiya) | ❌ |
| personnel.manage (ekle/düzenle/devre dışı) | ✅ | ❌ | ❌ |
| **personnel.cost.view** (maaş, prim, SGK) | ✅ | ❌ | ❌ |
| site.content.edit / site.price.edit | ✅ | ❌ | ❌ |
| settings.business.edit | ✅ | ❌ | ❌ |
| audit.view (denetim kayıtları) | ✅ | ❌ | ❌ |
| user.manage (parola sıfırlama, kilit açma) | ✅ | ❌ | ❌ |

> **Not:** MANAGER rolü istenirse hiç kullanılmaz; patron + personel ile de çalışır.
> **05.10.2026 kararı tam olarak bu:** MANAGER aktif edilmedi. Matristeki
> MANAGER kolonu, rol ileride açılırsa geçerli olacak taban kümeyi gösterir.
> Matristeki "izinle açılabilir" satırları `UserPermission` ile kişiye özel verilir.

## 3.4 Uygulama şekli (iki katmanlı zorunluluk)

**1. Sunucu (asıl koruma).** Her Server Action ilk satırda:
```ts
const actor = await requirePermission("parking.exit");
```
İzin yoksa işlem çalışmadan `403` ile biter. Sayfa seviyesinde ayrıca
`(panel)/layout.tsx` oturumu, `yonetim/layout.tsx` ise OWNER rolünü doğrular.
Veri okuma sorguları da izne göre **alan bazında** kısıtlanır: `personnel.cost.view`
olmayan kullanıcıya `EmployeeProfile` hiç `select` edilmez (null döndürmek yerine
sorgulanmaz — böylece kazara sızma olmaz).

**2. Arayüz (kolaylık).** İzin yoksa buton/sekme hiç çizilmez. Ama bu **güvenlik
değil, kullanıcı deneyimidir**; arayüz kontrolü asla tek başına güvenilmez.

## 3.5 Denetim kaydı kuralı

Aşağıdaki işlemler **istisnasız** `AuditLog`'a yazılır (kim, ne zaman, önce/sonra):

- Giriş / çıkış / başarısız giriş denemesi
- Araç girişi, araç çıkışı, tahsilat, tahsilat iptali
- İndirim uygulanması ve gerekçesi
- Tarife sürümü oluşturma / pasifleştirme
- Yıkama fiyatı değişikliği
- Abonman oluşturma, **özel fiyat belirleme/değiştirme**, iptal, yenileme
- Müşteri/araç bilgisi değişikliği
- Kasa açılış/kapanış, kasa farkı ve açıklaması
- Gider kaydı ve gider iptali
- Personel ekleme, yetki değişikliği, hesap devre dışı bırakma, parola sıfırlama
- İşletme ayarları ve web sitesi fiyat içeriği değişikliği

Patron `yonetim/denetim` ekranından kullanıcıya, tarihe, işlem tipine ve kayda göre
filtreleyerek bu kayıtları görür. Kayıtlar düzenlenemez ve silinemez.

## 3.6 Aşama 3'te netleşen izin kararları (04.10.2026)

**Abonman ücreti hem yazma hem OKUMA iznine tabidir.** `subscription.price.set`
izni olmayan kullanıcı abonman tutarını hiçbir ekranda görmez — ne listede, ne
müşteri profilinde, ne personel sorgu kartında. Gerekçe: fiyat müşteriye özeldir
("biri 3.000, diğeri 4.000") ve işletme bilgisidir. Personel abonmanın
**geçerli olup olmadığını** ve **ödeme durumunu** görür; tutarı görmez.

**Abonman oluşturmak için iki izin birlikte gerekir:** `subscription.create`
**ve** `subscription.price.set`. Çünkü her abonmanın ücreti zorunludur ve
varsayılanı yoktur — ücret yazamayan kullanıcı abonman da oluşturamaz.
Yalnızca `create` izni olan kullanıcı ekranda açık bir uyarı görür:
"Abonman ücreti müşteriye özeldir ve işletme sahibi tarafından girilir."

**Abonman tahsilatını iptal etmek** `cash.void` veya `subscription.cancel`
izinlerinden birini ister (ikisi de varsayılan olarak yalnızca patronda).
Tahsilat iptali finansal kaydı değiştirdiği için gerekçe zorunludur ve
paranın fiilen iade edilip edilmediği **ayrıca** sorulur.
