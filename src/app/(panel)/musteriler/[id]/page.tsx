import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { musteriDetay } from "@/server/subscription/customer";
import { DURUM_ETIKETLERI, ODEME_ETIKETLERI } from "@/server/subscription/queries";
import { formatDate } from "@/lib/datetime";
import { toKurus } from "@/lib/money";
import { AracBaglaFormu, AracCozButonu } from "../formlar";

export const metadata = { title: "Müşteri" };
export const dynamic = "force-dynamic";

/**
 * MUSTERI DETAY / PROFIL
 *
 * Patronun istedigi gorunum: musteriye bagli TUM ARACLAR ve her aracin
 * ABONMAN GECMISI.
 *
 * FIYAT GORUNURLUGU: abonman ucreti musteriye ozeldir ve isletme bilgisidir;
 * yalnizca subscription.price.set izni olan kullaniciya (varsayilan: patron)
 * gosterilir. Personel tarih ve odeme durumunu gorur, tutari gormez.
 */
export default async function MusteriDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.CUSTOMER_VIEW)) redirect("/vardiya");

  const { id } = await params;
  const musteri = await musteriDetay(id).catch(() => null);
  if (!musteri) notFound();

  const duzenleyebilir = user.permissions.has(PERMISSIONS.CUSTOMER_EDIT);
  const abonmanGorebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_VIEW);
  const abonmanKurabilir =
    user.permissions.has(PERMISSIONS.SUBSCRIPTION_CREATE) &&
    user.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET);
  const fiyatGorebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET);

  return (
    <div className="space-y-4">
      <Link href="/musteriler" className="inline-flex h-12 items-center text-mavi-600">
        ← Müşteriler
      </Link>

      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">{musteri.fullName}</h1>
        <a
          href={`tel:${musteri.phone.replace(/\s/g, "")}`}
          className="rakam inline-flex h-12 items-center text-base font-semibold text-mavi-600"
        >
          {musteri.phone}
        </a>
        {musteri.altPhone ? (
          <div className="rakam text-sm text-slate-500">{musteri.altPhone}</div>
        ) : null}
        {musteri.isCompany && musteri.companyName ? (
          <div className="text-sm text-slate-500">
            {musteri.companyName}
            {musteri.taxId ? ` · ${musteri.taxId}` : ""}
          </div>
        ) : null}
        {musteri.email ? <div className="text-sm text-slate-500">{musteri.email}</div> : null}
        {!musteri.isActive ? (
          <div className="mt-2">
            <Rozet tur="uyari">PASİF MÜŞTERİ</Rozet>
          </div>
        ) : null}
      </div>

      {musteri.notes ? <Alert tur="bilgi" baslik="Not">{musteri.notes}</Alert> : null}

      <div className="grid grid-cols-2 gap-3">
        {abonmanKurabilir ? (
          <Link href={`/abonmanlar/yeni?musteri=${musteri.id}`} className="block">
            <Button variant="birincil" size="ikincil" tamGenislik data-test="yeni-abonman">
              + ABONMAN
            </Button>
          </Link>
        ) : null}
        {duzenleyebilir ? (
          <Link href={`/musteriler/${musteri.id}/duzenle`} className="block">
            <Button variant="sade" size="ikincil" tamGenislik>
              DÜZENLE
            </Button>
          </Link>
        ) : null}
      </div>

      {/* ---- ARACLAR VE HER ARACIN ABONMAN GECMISI ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Araçlar ({musteri.vehicles.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {musteri.vehicles.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bu müşteriye bağlı araç yok. Aşağıdan plaka ekleyebilirsiniz.
            </p>
          ) : (
            <ul className="space-y-3">
              {musteri.vehicles.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xl font-bold tracking-wider text-lacivert-800">
                        {a.plateDisplay}
                      </div>
                      <div className="text-sm text-slate-500">
                        {[a.vehicleClass.name, a.brandModel, a.color]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="text-xs text-slate-400">
                        {a._count.parkingSessions} park kaydı
                      </div>
                    </div>
                  </div>

                  {/* Aracin abonman gecmisi: kaldirilmis baglar da gorunur. */}
                  {abonmanGorebilir && a.subscriptionVehicles.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-sm">
                      {a.subscriptionVehicles.map((b) => (
                        <li key={b.id} className="flex items-center justify-between gap-2">
                          <Link
                            href={`/abonmanlar/${b.subscription.id}`}
                            className="min-w-0 flex-1 truncate text-mavi-600"
                          >
                            {b.subscription.code} · {formatDate(b.subscription.startDate)} –{" "}
                            {formatDate(b.subscription.endDate)}
                            {b.subscription.customerId !== musteri.id
                              ? ` · ${b.subscription.customer.fullName}`
                              : ""}
                          </Link>
                          <span className="shrink-0 text-[11px] font-bold text-slate-500">
                            {DURUM_ETIKETLERI[b.subscription.status] ?? b.subscription.status}
                            {b.removedAt ? " · çıkarıldı" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {duzenleyebilir ? (
                    <div className="mt-2">
                      <AracCozButonu
                        vehicleId={a.id}
                        musteriId={musteri.id}
                        plaka={a.plateDisplay}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {duzenleyebilir ? (
            <div className="border-t border-slate-200 pt-3">
              <div className="mb-2 text-[13px] font-bold uppercase tracking-wide text-slate-600">
                Araç ekle
              </div>
              <AracBaglaFormu musteriId={musteri.id} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* ---- ABONMANLAR ---- */}
      {abonmanGorebilir ? (
        <Card>
          <CardHeader>
            <CardTitle>Abonmanlar ({musteri.subscriptions.length})</CardTitle>
          </CardHeader>
          <CardBody>
            {musteri.subscriptions.length === 0 ? (
              <p className="text-sm text-slate-500">Bu müşterinin abonman kaydı yok.</p>
            ) : (
              <ul className="space-y-2">
                {musteri.subscriptions.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                    <Link href={`/abonmanlar/${s.id}`} className="block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-lacivert-700">
                            {s.planLabel} · {s.code}
                          </div>
                          <div className="text-sm text-slate-500">
                            {formatDate(s.startDate)} – {formatDate(s.endDate)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {s.periods.length} dönem ·{" "}
                            {s.vehicles.map((v) => v.vehicle.plateDisplay).join(", ") || "araç yok"}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <Rozet
                            tur={
                              s.status === "ACTIVE"
                                ? "basari"
                                : s.status === "CANCELLED"
                                  ? "hata"
                                  : "uyari"
                            }
                          >
                            {DURUM_ETIKETLERI[s.status] ?? s.status}
                          </Rozet>
                          <div className="mt-1 text-[11px] font-bold text-slate-500">
                            {ODEME_ETIKETLERI[s.paymentStatus] ?? s.paymentStatus}
                          </div>
                          {fiyatGorebilir ? (
                            <div className="mt-1">
                              <Tutar kurus={toKurus(s.agreedPrice)} boyut="kucuk" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
