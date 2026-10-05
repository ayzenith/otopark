import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/authz";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { personelListesi } from "@/server/staff/users";
import { acikAvanslar, avansListesi } from "@/server/staff/advance";
import {
  AvansFormu,
  AvansIptalButonu,
  MaasOdemeFormu,
  ParolaSifirlaButonu,
  PersonelDurumButonu,
  PersonelEkleFormu,
} from "./formlar";

export const metadata = { title: "Personel" };
export const dynamic = "force-dynamic";

/**
 * PERSONEL YÖNETİMİ (patron)
 *
 * ============================================================================
 * KARAR (05.10.2026): gerçek personel adları tohum verisine YAZILMAZ; hesaplar
 * bu ekrandan açılır. Roller yalnızca Patron + Personel.
 *
 * KASA KAPATMA personel rolünde yoktur: patron, personelin kendi sayfasından
 * `cash.drawer.close` iznini tek tek verir.
 *
 * AVANS GİDER DEĞİLDİR: kasadan çıkar, alacak olarak izlenir, maaş ödemesinde
 * mahsup edilir. Bu ekranın alt bölümü bunun takibidir.
 * ============================================================================
 */
export default async function PersonelSayfasi() {
  // Route Handler değil ama yine de çift kapı: layout patron kontrolü yapıyor,
  // burada izin açıkça zorunlu kılınıyor.
  const user = await requirePermission(PERMISSIONS.USER_MANAGE);

  const maliyetGorebilir = user.permissions.has(PERMISSIONS.PERSONNEL_COST_VIEW);
  const paraYetkisi = user.permissions.has(PERMISSIONS.FINANCE_EXPENSE_CREATE);
  const iptalYetkisi = user.permissions.has(PERMISSIONS.FINANCE_EXPENSE_VOID);

  const personeller = await personelListesi(user, { pasifleriDeGoster: true });
  const aktifler = personeller.filter((p) => p.aktif);

  // Maaş formunun avans listeleri: yalnızca para yetkisi olana çekilir.
  const avansHaritasi = paraYetkisi
    ? await Promise.all(
        aktifler.map(async (p) => ({ id: p.id, avanslar: await acikAvanslar(p.id) })),
      )
    : [];
  const avansListe = paraYetkisi ? await avansListesi({ limit: 60 }) : [];

  const toplamAcikAvans = personeller.reduce((t, p) => t + p.acikAvansKurus, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Personel</h1>
        <p className="text-sm text-slate-500">
          {aktifler.length} etkin hesap
          {personeller.length > aktifler.length
            ? ` · ${personeller.length - aktifler.length} kullanım dışı`
            : ""}
        </p>
      </div>

      <Alert tur="bilgi" baslik="Hesaplar buradan açılır">
        Personel adları sisteme önceden yazılmaz. Hesap açtığınızda başlangıç parolası
        <strong> bir kez</strong> gösterilir; personel ilk girişte kendi parolasını belirler.
        Vardiya sorumlusu (müdür) rolü şu anda kullanılmıyor — ek yetki gerekiyorsa
        personelin sayfasından tek tek verin.
      </Alert>

      <PersonelEkleFormu />

      {/* ---- PERSONEL LİSTESİ ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Hesaplar</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-y divide-slate-100">
            {personeller.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/yonetim/personel/${p.id}`}
                        className="font-bold text-lacivert-700 underline"
                        data-test={`personel-link-${p.kullaniciAdi}`}
                      >
                        {p.adSoyad}
                      </Link>
                      <Rozet tur={p.rol === "OWNER" ? "mavi" : "notr"}>
                        {ROLE_LABELS[p.rol]}
                      </Rozet>
                      {!p.aktif ? <Rozet tur="notr">KULLANIM DIŞI</Rozet> : null}
                      {p.kilitliMi ? <Rozet tur="hata">KİLİTLİ</Rozet> : null}
                      {p.parolaDegistirmeli ? (
                        <Rozet tur="uyari">PAROLA DEĞİŞTİRECEK</Rozet>
                      ) : null}
                      {p.izinSapmasi > 0 ? (
                        <Rozet tur="mavi">{p.izinSapmasi} ÖZEL YETKİ</Rozet>
                      ) : null}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{p.kullaniciAdi}</div>
                    <div className="text-xs text-slate-500">
                      {p.gorevUnvani ? `${p.gorevUnvani} · ` : ""}
                      {p.sonGirisAt
                        ? `son giriş ${formatDateTime(p.sonGirisAt)}`
                        : "hiç giriş yapmadı"}
                      {p.iseGirisAt ? ` · işe giriş ${formatDate(p.iseGirisAt)}` : ""}
                    </div>
                    {p.acikAvansKurus > 0 ? (
                      <div className="text-xs font-semibold text-amber-700">
                        Açık avans: <Tutar kurus={p.acikAvansKurus} boyut="kucuk" />
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-3">
                      <ParolaSifirlaButonu userId={p.id} />
                      <PersonelDurumButonu
                        userId={p.id}
                        aktif={p.aktif}
                        adSoyad={p.adSoyad}
                      />
                    </div>
                  </div>
                  {maliyetGorebilir && p.maliyet?.maasKurus != null ? (
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] uppercase text-slate-400">Maaş</div>
                      <Tutar kurus={p.maliyet.maasKurus} boyut="kucuk" />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* ---- AVANS VE MAAŞ ---- */}
      {paraYetkisi ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Avans ve maaş</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <Alert tur="bilgi" baslik="Avans gider değil, alacaktır">
                Avans verildiğinde kasadan para çıkar ama <strong>gider yazılmaz</strong>.
                Maaş ödemesinde mahsup edilir: gider maaşın tamamı, kasadan çıkan para
                ise maaş eksi avanstır. Böylece aynı para iki kez sayılmaz.
                {toplamAcikAvans > 0 ? (
                  <>
                    {" "}
                    Şu anda toplam <Tutar kurus={toplamAcikAvans} boyut="kucuk" /> açık avans var.
                  </>
                ) : null}
              </Alert>
              <AvansFormu
                personeller={aktifler.map((p) => ({
                  id: p.id,
                  ad: p.adSoyad,
                  acikAvansKurus: p.acikAvansKurus,
                }))}
              />
              <MaasOdemeFormu
                personeller={aktifler.map((p) => ({
                  id: p.id,
                  ad: p.adSoyad,
                  maasKurus: p.maliyet?.maasKurus ?? null,
                  acikAvanslar:
                    avansHaritasi.find((a) => a.id === p.id)?.avanslar.map((a) => ({
                      id: a.id,
                      kod: a.kod,
                      tutar: a.tutar,
                    })) ?? [],
                }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avans kayıtları</CardTitle>
            </CardHeader>
            <CardBody>
              {avansListe.length === 0 ? (
                <p className="text-sm text-slate-500" data-test="avans-bos">
                  Henüz avans kaydı yok.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {avansListe.map((a) => (
                    <li key={a.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-lacivert-700">
                              {a.personelAdi}
                            </span>
                            {a.durum === "OPEN" ? <Rozet tur="uyari">AÇIK</Rozet> : null}
                            {a.durum === "SETTLED" ? (
                              <Rozet tur="basari">MAHSUP EDİLDİ</Rozet>
                            ) : null}
                            {a.durum === "VOIDED" ? <Rozet tur="hata">İPTAL</Rozet> : null}
                            {!a.kasadanMi ? <Rozet tur="notr">KASA DIŞI</Rozet> : null}
                          </div>
                          <div className="text-xs text-slate-500">
                            {a.kod} · {formatDateTime(a.verilisAt)}
                            {a.verenKisi ? ` · ${a.verenKisi}` : ""}
                            {a.mahsupGiderKodu ? ` · gider ${a.mahsupGiderKodu}` : ""}
                            {a.not ? ` · ${a.not}` : ""}
                          </div>
                          {a.iptalSebebi ? (
                            <div className="text-xs font-semibold text-hata">
                              İptal gerekçesi: {a.iptalSebebi}
                            </div>
                          ) : null}
                          {a.durum === "OPEN" && iptalYetkisi ? (
                            <AvansIptalButonu id={a.id} />
                          ) : null}
                        </div>
                        <div className={a.durum === "VOIDED" ? "opacity-50 line-through" : ""}>
                          <Tutar kurus={a.tutar} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <Alert tur="bilgi" baslik="Hesap silinmez">
        İşten ayrılan personelin hesabı <strong>kullanım dışına alınır</strong>. Silinirse
        onun yaptığı tahsilatlar, vardiyalar ve denetim kayıtları sahipsiz kalır.
      </Alert>

      {/* Yetki etiketlerinin tek kaynağı: izin listesi ekranda da aynı adlarla görünür. */}
      <p className="text-center text-xs text-slate-400">
        {Object.keys(PERMISSION_LABELS).length} izin tanımlı · yetkileri personelin
        sayfasından düzenleyin
      </p>
    </div>
  );
}
