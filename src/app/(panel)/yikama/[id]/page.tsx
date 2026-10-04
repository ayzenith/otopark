import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { yikamaDetay } from "@/server/wash/queries";
import { sinifIcinFiyatListesi } from "@/server/wash/pricing";
import { DURUM_ETIKETLERI } from "@/server/wash/job";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import {
  IptalFormu,
  SatirCikarButonu,
  SatirEkleFormu,
  TahsilatFormu,
  TahsilatsizTamamlaFormu,
} from "./formlar";

export const metadata = { title: "Yıkama işi" };
export const dynamic = "force-dynamic";

const YONTEM: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale",
  OTHER: "Diğer",
};

const ODEME_ETIKET: Record<string, string> = {
  UNPAID: "Tahsil edilmedi",
  PAID: "Tahsil edildi",
  VOIDED: "İptal",
};

export default async function YikamaDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");

  const { id } = await params;
  const is = await yikamaDetay(id);
  if (!is) notFound();

  const tahsilEdebilir = user.permissions.has(PERMISSIONS.WASH_COLLECT);
  const iptalEdebilir = user.permissions.has(PERMISSIONS.WASH_VOID);
  const duzenleyebilir = user.permissions.has(PERMISSIONS.WASH_CREATE);
  const indirimYetkisi = user.permissions.has(PERMISSIONS.PARKING_DISCOUNT);

  const acik = is.durum !== "COMPLETED" && is.durum !== "CANCELLED";
  const tahsilatVarMi = is.tahsilatlar.some(
    (t) => t.durum === "CONFIRMED" && t.yon === "IN",
  );

  // Eklenebilecek hizmetler: is emrinde zaten olanlar listeden cikarilir.
  const tumHizmetler = acik ? await sinifIcinFiyatListesi(is.aracSinifiId) : [];
  const mevcutAdlar = new Set(is.satirlar.map((s) => s.ad));
  const eklenebilir = tumHizmetler
    .filter((h) => !mevcutAdlar.has(h.ad))
    .map((h) => ({ washServiceId: h.washServiceId, ad: h.ad, fiyatKurus: h.fiyatKurus }));

  return (
    <div className="space-y-4">
      <Link href="/yikama" className="inline-flex h-12 items-center text-mavi-600">
        ← Oto yıkama
      </Link>

      <div>
        <div className="font-mono text-3xl font-bold tracking-wider text-lacivert-800">
          {is.plaka}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Rozet
            tur={
              is.durum === "COMPLETED"
                ? "basari"
                : is.durum === "CANCELLED"
                  ? "hata"
                  : is.durum === "IN_PROGRESS"
                    ? "mavi"
                    : "notr"
            }
          >
            {DURUM_ETIKETLERI[is.durum as keyof typeof DURUM_ETIKETLERI]}
          </Rozet>
          <Rozet tur={is.odemeDurumu === "PAID" ? "notr" : "uyari"}>
            {ODEME_ETIKET[is.odemeDurumu] ?? is.odemeDurumu}
          </Rozet>
        </div>
        <div className="mt-1 text-sm text-slate-500">
          {[is.aracSinifi, is.markaModel, is.renk].filter(Boolean).join(" · ")}
        </div>
        <div className="text-xs text-slate-400">
          {is.kod} · sıraya alındı {formatDateTime(is.siradaBeri)}
          {is.bitis ? ` · bitti ${formatDateTime(is.bitis)}` : ""}
        </div>
        {is.musteriId ? (
          <Link
            href={`/musteriler/${is.musteriId}`}
            className="inline-flex h-12 items-center text-mavi-600"
          >
            {is.musteriAdi} · müşteri profili →
          </Link>
        ) : null}
      </div>

      {is.durum === "CANCELLED" ? (
        <Alert tur="hata" baslik="Bu iş iptal edildi">
          {is.iptalSebebi ? `Gerekçe: ${is.iptalSebebi}` : null}
        </Alert>
      ) : null}

      {is.satirlar.some((s) => s.fiyatTanimsizMi) ? (
        <Alert tur="uyari" baslik="Fiyatı tanımsız hizmet var">
          0 ₺ olarak kaydedildi. Patron panelinden fiyat girilmeli; bu iş için tutar elle
          düzeltilmez, iş iptal edilip yeniden açılır.
        </Alert>
      ) : null}

      {is.not ? <Alert tur="bilgi" baslik="Not">{is.not}</Alert> : null}

      {/* ---- HIZMETLER ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Hizmetler</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ul className="space-y-2" data-test="yikama-satirlari">
            {is.satirlar.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-lacivert-700">
                    {s.ad}
                    {s.adet > 1 ? ` ×${s.adet}` : ""}
                  </span>
                  {s.fiyatTanimsizMi ? (
                    <span className="block text-xs font-bold text-uyari">fiyat tanımsız</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Tutar kurus={s.toplamKurus} boyut="kucuk" />
                  {duzenleyebilir && acik && is.satirlar.length > 1 ? (
                    <SatirCikarButonu washJobId={is.id} washJobItemId={s.id} ad={s.ad} />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-1 border-t border-slate-200 pt-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Toplam</span>
              <Tutar kurus={is.toplamKurus} boyut="kucuk" />
            </div>
            {is.indirimKurus > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-500">İndirim</span>
                <span className="rakam font-semibold text-uyari">
                  −<Tutar kurus={is.indirimKurus} boyut="kucuk" simge={false} />
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-1">
              <span className="font-bold text-lacivert-700">Ödenecek</span>
              <Tutar kurus={is.odenecekKurus} />
            </div>
          </div>

          {duzenleyebilir && acik && eklenebilir.length > 0 ? (
            <div className="border-t border-slate-200 pt-3">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-600">
                Hizmet ekle
              </div>
              <SatirEkleFormu washJobId={is.id} secenekler={eklenebilir} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- TAHSILAT ---- */}
      {tahsilEdebilir && is.odemeDurumu === "UNPAID" && is.durum !== "CANCELLED" ? (
        <Card>
          <CardHeader>
            <CardTitle>Tahsilat</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <TahsilatFormu
              washJobId={is.id}
              odenecekKurus={is.odenecekKurus}
              indirimYetkisi={indirimYetkisi}
            />
            {is.durum !== "COMPLETED" ? (
              <TahsilatsizTamamlaFormu washJobId={is.id} />
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {/* ---- TAHSILAT GECMISI ---- */}
      {is.tahsilatlar.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tahsilat kayıtları</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm" data-test="yikama-tahsilatlari">
              {is.tahsilatlar.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-lacivert-700">
                        {t.yon === "OUT" ? "İADE" : "Tahsilat"} ·{" "}
                        {YONTEM[t.yontem] ?? t.yontem}
                        {t.durum === "VOIDED" ? " · İPTAL" : ""}
                      </div>
                      <div className="text-slate-500">{formatDateTime(t.tarih)}</div>
                      <div className="text-xs text-slate-400">
                        {t.kod} · tahsil eden: {t.tahsilEden}
                      </div>
                      {t.iptalSebebi ? (
                        <div className="text-xs text-hata">Gerekçe: {t.iptalSebebi}</div>
                      ) : null}
                    </div>
                    <div
                      className={`shrink-0 ${t.durum === "VOIDED" ? "line-through opacity-60" : ""}`}
                    >
                      <Tutar kurus={t.tutarKurus} boyut="kucuk" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Finansal kayıtlar silinmez. İptal, kaydı geçersiz kılar veya ters kayıt üretir.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {is.baslangic && is.bitis ? (
        <p className="text-center text-sm text-slate-500">
          Yıkama süresi: {formatDuration(Math.round((is.bitis.getTime() - is.baslangic.getTime()) / 60000))}
        </p>
      ) : null}

      {iptalEdebilir && is.durum !== "CANCELLED" ? (
        <IptalFormu washJobId={is.id} tahsilatVarMi={tahsilatVarMi} />
      ) : null}
    </div>
  );
}
