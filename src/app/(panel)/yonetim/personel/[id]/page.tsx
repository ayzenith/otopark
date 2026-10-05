import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/authz";
import { formatDate, formatDateInput, formatDateTime } from "@/lib/datetime";
import { personelDetay } from "@/server/staff/users";
import { avansListesi } from "@/server/staff/advance";
import {
  AvansIptalButonu,
  IzinAnahtari,
  MaliyetFormu,
  PersonelDuzenleFormu,
} from "../formlar";

export const dynamic = "force-dynamic";

/**
 * PERSONEL DETAY SAYFASI
 *
 * Üç bölüm:
 *   1. Bilgiler (ad, rol, iletişim)
 *   2. Yetkiler — `cash.drawer.close` burada verilir (karar 05.10.2026)
 *   3. Maliyet profili ve avanslar — maaş alanları YALNIZCA patronda çizilir
 *
 * İzin listesi uzun olduğu için BÖLÜMLERE ayrılır; 53 satırı tek listede
 * taramak mobilde kullanılamaz.
 */

/** İzinleri ekranda gruplayan harita: anahtar ön eki -> bölüm adı. */
const IZIN_BOLUMLERI: { baslik: string; onEk: string[] }[] = [
  { baslik: "Otopark", onEk: ["parking."] },
  { baslik: "Abonman ve müşteri", onEk: ["subscription.", "customer."] },
  { baslik: "Oto yıkama ve stok", onEk: ["wash.", "inventory."] },
  { baslik: "Kasa", onEk: ["cash."] },
  { baslik: "Finans", onEk: ["finance."] },
  { baslik: "Fiyatlar", onEk: ["tariff.", "washprice."] },
  { baslik: "Personel", onEk: ["personnel.", "user."] },
  { baslik: "Web sitesi ve sistem", onEk: ["site.", "settings.", "audit."] },
];

export default async function PersonelDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission(PERMISSIONS.USER_MANAGE);
  const { id } = await params;

  const personel = await personelDetay(user, id);
  if (!personel) notFound();

  const maliyetGorebilir = user.permissions.has(PERMISSIONS.PERSONNEL_COST_VIEW);
  const paraYetkisi = user.permissions.has(PERMISSIONS.FINANCE_EXPENSE_CREATE);
  const iptalYetkisi = user.permissions.has(PERMISSIONS.FINANCE_EXPENSE_VOID);

  const avanslar = paraYetkisi ? await avansListesi({ userId: id, limit: 50 }) : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/yonetim/personel" className="text-sm font-semibold text-lacivert-600">
          ← Personel listesi
        </Link>
        <h1 className="mt-1 text-xl font-extrabold text-lacivert-700">{personel.adSoyad}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="font-mono">{personel.kullaniciAdi}</span>
          <Rozet tur={personel.rol === "OWNER" ? "mavi" : "notr"}>
            {ROLE_LABELS[personel.rol]}
          </Rozet>
          {!personel.aktif ? <Rozet tur="notr">KULLANIM DIŞI</Rozet> : null}
          {personel.kilitliMi ? <Rozet tur="hata">KİLİTLİ</Rozet> : null}
        </div>
      </div>

      {/* ---- BİLGİLER ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Bilgiler</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <dl className="space-y-1 text-sm">
            <Satir etiket="Görev unvanı" deger={personel.gorevUnvani ?? "—"} />
            <Satir etiket="Telefon" deger={personel.telefon ?? "—"} />
            <Satir
              etiket="Son giriş"
              deger={personel.sonGirisAt ? formatDateTime(personel.sonGirisAt) : "hiç giriş yapmadı"}
            />
            <Satir etiket="Hesap açılışı" deger={formatDateTime(personel.olusturmaAt)} />
            <Satir
              etiket="Parola durumu"
              deger={
                personel.parolaDegistirmeli
                  ? "İlk girişte değiştirecek"
                  : "Kendi parolasını belirlemiş"
              }
            />
          </dl>
          <PersonelDuzenleFormu
            userId={personel.id}
            adSoyad={personel.adSoyad}
            gorevUnvani={personel.gorevUnvani}
            telefon={personel.telefon}
            rol={personel.rol}
          />
        </CardBody>
      </Card>

      {/* ---- YETKİLER ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Yetkiler</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Alert tur="bilgi" baslik="Rol taban yetkileri verir, buradan tek tek değiştirilir">
            Örnek: <strong>kasa kapatma</strong> personel rolünde yoktur; güvendiğiniz
            personele buradan verebilirsiniz. &quot;Role dön&quot; özel ayarı kaldırır.
          </Alert>

          {IZIN_BOLUMLERI.map((bolum) => {
            const satirlar = personel.izinler.satirlar.filter((s) =>
              bolum.onEk.some((o) => s.izin.startsWith(o)),
            );
            if (satirlar.length === 0) return null;
            const ozelSayisi = satirlar.filter((s) => s.sapma !== null).length;

            return (
              <div key={bolum.baslik}>
                <div className="mb-1 flex items-baseline justify-between">
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-slate-600">
                    {bolum.baslik}
                  </h3>
                  {ozelSayisi > 0 ? (
                    <span className="text-xs font-bold text-mavi-600">
                      {ozelSayisi} özel ayar
                    </span>
                  ) : null}
                </div>
                <ul className="divide-y divide-slate-100">
                  {satirlar.map((s) => (
                    <IzinAnahtari
                      key={s.izin}
                      userId={personel.id}
                      izin={s.izin}
                      etiket={PERMISSION_LABELS[s.izin] ?? s.izin}
                      tabanda={s.tabanda}
                      sapma={s.sapma}
                      etkin={s.etkin}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* ---- MALİYET PROFİLİ (yalnızca patron) ---- */}
      {maliyetGorebilir ? (
        <Card>
          <CardHeader>
            <CardTitle>Maaş ve maliyet</CardTitle>
          </CardHeader>
          <CardBody>
            <MaliyetFormu
              userId={personel.id}
              maasKurus={personel.maliyet?.maasKurus ?? null}
              sgkKurus={personel.maliyet?.sgkKurus ?? null}
              yemekKurus={personel.maliyet?.yemekKurus ?? null}
              iseGirisAt={personel.iseGirisAt ? formatDateInput(personel.iseGirisAt) : null}
              ayrilisAt={personel.ayrilisAt ? formatDateInput(personel.ayrilisAt) : null}
              not={personel.profilNotu}
            />
          </CardBody>
        </Card>
      ) : (
        <Alert tur="bilgi" baslik="Maaş bilgileri gizli">
          Personel maliyet bilgilerini görme yetkiniz yok.
        </Alert>
      )}

      {/* ---- AVANSLAR ---- */}
      {paraYetkisi ? (
        <Card>
          <CardHeader>
            <CardTitle>Avanslar</CardTitle>
          </CardHeader>
          <CardBody>
            {personel.acikAvans.adet > 0 ? (
              <Alert tur="uyari" baslik="Açık avans borcu var" data-test="personel-acik-avans">
                {personel.acikAvans.adet} avans ·{" "}
                <Tutar kurus={personel.acikAvans.tutar} boyut="kucuk" /> — maaş ödemesinde
                mahsup edilecek.
              </Alert>
            ) : (
              <p className="text-sm text-slate-500">Açık avans borcu yok.</p>
            )}

            {avanslar.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {avanslar.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-slate-500">{a.kod}</span>
                          {a.durum === "OPEN" ? <Rozet tur="uyari">AÇIK</Rozet> : null}
                          {a.durum === "SETTLED" ? (
                            <Rozet tur="basari">MAHSUP EDİLDİ</Rozet>
                          ) : null}
                          {a.durum === "VOIDED" ? <Rozet tur="hata">İPTAL</Rozet> : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(a.verilisAt)}
                          {a.mahsupAt ? ` · mahsup ${formatDate(a.mahsupAt)}` : ""}
                          {a.mahsupGiderKodu ? ` (${a.mahsupGiderKodu})` : ""}
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
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{etiket}</dt>
      <dd className="text-right font-semibold text-lacivert-800">{deger}</dd>
    </div>
  );
}
