import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { abonmanDetay, DURUM_ETIKETLERI, ODEME_ETIKETLERI } from "@/server/subscription/queries";
import { KURAL_ETIKETLERI, type KuralTuru } from "@/server/subscription/rules";
import { formatDate, formatDateInput, formatDateTime } from "@/lib/datetime";
import { formatKurusPlain, toKurus } from "@/lib/money";
import {
  AbonmanAracFormu,
  AbonmanIptalFormu,
  AracCikarButonu,
  FiyatDuzeltFormu,
  TahsilatFormu,
  TahsilatIptalButonu,
  YenilemeFormu,
} from "../formlar";

export const metadata = { title: "Abonman" };
export const dynamic = "force-dynamic";

const YONTEM_ETIKET: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale",
  OTHER: "Diğer",
};

/**
 * ABONMAN DETAYI
 *
 * Donem tablosu kuralin kanitidir: her donem KENDI fiyatini tasir ve gecmis
 * donemler degistirilemez. Yenileme yeni satir ekler; eski satir oldugu gibi
 * kalir.
 */
export default async function AbonmanDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.SUBSCRIPTION_VIEW)) redirect("/vardiya");

  const { id } = await params;
  const detay = await abonmanDetay(id);
  if (!detay) notFound();

  const { abonman: a, donemler } = detay;
  const fiyatGorebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET);
  const duzenleyebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_EDIT);
  const tahsilEdebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_PAYMENT_COLLECT);
  const iptalEdebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_CANCEL);
  const tahsilatIptalEdebilir =
    user.permissions.has(PERMISSIONS.CASH_VOID) || iptalEdebilir;

  const sonDonem = donemler.find((d) => d.sonDonemMu) ?? donemler[0];
  const aktifAraclar = a.vehicles.filter((v) => v.removedAt === null);
  const gecmisAraclar = a.vehicles.filter((v) => v.removedAt !== null);

  return (
    <div className="space-y-4">
      <Link href="/abonmanlar" className="inline-flex h-12 items-center text-mavi-600">
        ← Abonmanlar
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold text-lacivert-700">{a.customer.fullName}</h1>
          <Rozet
            tur={a.status === "ACTIVE" ? "basari" : a.status === "CANCELLED" ? "hata" : "uyari"}
          >
            {DURUM_ETIKETLERI[a.status] ?? a.status}
          </Rozet>
          <Rozet tur={a.paymentStatus === "PAID" ? "notr" : "uyari"}>
            {ODEME_ETIKETLERI[a.paymentStatus] ?? a.paymentStatus}
          </Rozet>
        </div>
        <Link
          href={`/musteriler/${a.customerId}`}
          className="rakam inline-flex h-12 items-center text-mavi-600"
        >
          {a.customer.phone} · müşteri profili →
        </Link>
        <div className="text-sm text-slate-500">
          {a.code} · {a.planLabel} · {formatDate(a.startDate)} – {formatDate(a.endDate)}
        </div>
        <div className="text-sm text-slate-500">
          Kapsam: {KURAL_ETIKETLERI[a.accessRuleKind as KuralTuru]}
        </div>
      </div>

      {a.status === "CANCELLED" ? (
        <Alert tur="hata" baslik="Bu abonman iptal edildi">
          {a.cancelReason ? `Gerekçe: ${a.cancelReason}` : null}
          {a.cancelledAt ? ` · ${formatDateTime(a.cancelledAt)}` : null}
        </Alert>
      ) : null}

      {a.status === "EXPIRED" ? (
        <Alert tur="uyari" baslik="Abonman süresi dolmuş">
          Araçlar normal tarifeden ücretlendirilir. Yenilemek için aşağıdaki
          &quot;Yeni dönem&quot; bölümünü kullanın.
        </Alert>
      ) : null}

      {a.paymentStatus !== "PAID" && a.status === "ACTIVE" ? (
        <Alert tur="uyari" baslik="Ödeme alınmamış — abonman yine geçerli">
          Araç girişi engellenmez (karar S9). Tahsilatı aşağıdan kaydedebilirsiniz.
        </Alert>
      ) : null}

      {/* ---- ARACLAR ---- */}
      <Card>
        <CardHeader>
          <CardTitle>
            Araçlar ({aktifAraclar.length}/{a.includedVehicleCount})
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {aktifAraclar.length === 0 ? (
            <p className="text-sm text-slate-500">Bu abonmanda aktif araç yok.</p>
          ) : (
            <ul className="space-y-2" data-test="abonman-araclari">
              {aktifAraclar.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xl font-bold tracking-wider text-lacivert-800">
                      {v.vehicle.plateDisplay}
                    </div>
                    <div className="text-sm text-slate-500">
                      {[v.vehicle.vehicleClass.name, v.vehicle.brandModel, v.vehicle.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  {duzenleyebilir ? (
                    <AracCikarButonu
                      subscriptionId={a.id}
                      vehicleId={v.vehicle.id}
                      plaka={v.vehicle.plateDisplay}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {gecmisAraclar.length > 0 ? (
            <div className="border-t border-slate-200 pt-2">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Çıkarılan araçlar (kayıt silinmez)
              </div>
              <ul className="space-y-1 text-sm text-slate-500">
                {gecmisAraclar.map((v) => (
                  <li key={v.id}>
                    {v.vehicle.plateDisplay} · çıkarıldı {formatDate(v.removedAt!)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {duzenleyebilir && a.status !== "CANCELLED" ? (
            <div className="border-t border-slate-200 pt-3">
              <AbonmanAracFormu subscriptionId={a.id} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- DONEMLER ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Dönemler ({donemler.length})</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-2" data-test="donem-listesi">
            {donemler.map((d) => (
              <li
                key={d.id}
                className={`rounded-xl border p-3 ${
                  d.sonDonemMu ? "border-lacivert-300 bg-mavi-50" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-lacivert-700">
                      {d.donemNo}. dönem{d.sonDonemMu ? " (güncel)" : ""}
                    </div>
                    <div className="text-sm text-slate-500">
                      {formatDate(d.baslangic)} – {formatDate(d.bitis)}
                    </div>
                    {d.not ? <div className="text-xs text-slate-400">{d.not}</div> : null}
                  </div>
                  {fiyatGorebilir ? (
                    <div className="shrink-0 text-right text-sm">
                      <div data-test={`donem-${d.donemNo}-fiyat`}>
                        <Tutar kurus={d.fiyatKurus} />
                      </div>
                      <div className="text-xs text-slate-500">
                        Tahsil: {formatKurusPlain(d.tahsilEdilenKurus)} ₺
                      </div>
                      {d.kalanKurus > 0 ? (
                        <div className="text-xs font-bold text-uyari">
                          Kalan: {formatKurusPlain(d.kalanKurus)} ₺
                        </div>
                      ) : null}
                      {d.fazlaKurus > 0 ? (
                        <div className="text-xs font-bold text-mavi-600">
                          Fazla: {formatKurusPlain(d.fazlaKurus)} ₺
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {fiyatGorebilir && d.sonDonemMu ? (
                  <div className="mt-2">
                    <FiyatDuzeltFormu
                      subscriptionId={a.id}
                      periodId={d.id}
                      mevcutKurus={d.fiyatKurus}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Geçmiş dönemlerin fiyatı ve kuralı değiştirilemez. Yenileme yeni dönem satırı
            açar; eski dönem aynı kalır.
          </p>
        </CardBody>
      </Card>

      {/* ---- TAHSILAT ---- */}
      {tahsilEdebilir && sonDonem ? (
        <Card>
          <CardHeader>
            <CardTitle>Tahsilat kaydet</CardTitle>
          </CardHeader>
          <CardBody>
            <TahsilatFormu
              subscriptionId={a.id}
              periodId={sonDonem.id}
              donemNo={sonDonem.donemNo}
              kalanKurus={sonDonem.kalanKurus}
            />
          </CardBody>
        </Card>
      ) : null}

      {/* ---- ODEME GECMISI ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Ödeme geçmişi ({a.payments.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {a.payments.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz tahsilat kaydı yok.</p>
          ) : (
            <ul className="space-y-2" data-test="odeme-gecmisi">
              {a.payments.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <div className="font-bold text-lacivert-700">
                        {t.payment.direction === "OUT" ? "İADE" : "Tahsilat"} ·{" "}
                        {YONTEM_ETIKET[t.payment.method] ?? t.payment.method}
                        {t.payment.status === "VOIDED" ? " · İPTAL" : ""}
                      </div>
                      <div className="text-slate-500">
                        {formatDateTime(t.payment.paidAt)}
                        {t.subscriptionPeriod ? ` · ${t.subscriptionPeriod.periodNo}. dönem` : ""}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.payment.code} · tahsil eden:{" "}
                        {t.payment.collectedBy.fullName || t.payment.collectedBy.username}
                      </div>
                      {t.payment.voidReason ? (
                        <div className="text-xs text-hata">Gerekçe: {t.payment.voidReason}</div>
                      ) : null}
                      {t.payment.cardNote ? (
                        <div className="text-xs text-slate-400">Not: {t.payment.cardNote}</div>
                      ) : null}
                    </div>
                    {fiyatGorebilir ? (
                      <div
                        className={`shrink-0 text-right ${
                          t.payment.status === "VOIDED" ? "line-through opacity-60" : ""
                        }`}
                      >
                        <Tutar kurus={toKurus(t.payment.amount)} boyut="kucuk" />
                      </div>
                    ) : null}
                  </div>
                  {tahsilatIptalEdebilir &&
                  t.payment.status === "CONFIRMED" &&
                  t.payment.direction === "IN" ? (
                    <TahsilatIptalButonu
                      paymentId={t.payment.id}
                      subscriptionId={a.id}
                      tutarKurus={toKurus(t.payment.amount)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Finansal kayıtlar silinmez. İptal, kaydı geçersiz kılar veya ters kayıt üretir.
          </p>
        </CardBody>
      </Card>

      {/* ---- YENILEME ---- */}
      {duzenleyebilir && fiyatGorebilir && a.status !== "CANCELLED" && sonDonem ? (
        <Card>
          <CardHeader>
            <CardTitle>Yeni dönem (yenileme)</CardTitle>
          </CardHeader>
          <CardBody>
            <YenilemeFormu
              subscriptionId={a.id}
              oncekiBitis={formatDateInput(sonDonem.bitis)}
              oncekiUcretKurus={sonDonem.fiyatKurus}
            />
          </CardBody>
        </Card>
      ) : null}

      {/* ---- IPTAL ---- */}
      {iptalEdebilir && a.status !== "CANCELLED" ? (
        <AbonmanIptalFormu subscriptionId={a.id} />
      ) : null}
    </div>
  );
}
