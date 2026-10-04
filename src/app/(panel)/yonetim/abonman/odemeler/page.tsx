import Link from "next/link";
import { Alert, Card, CardBody } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { abonmanOdemeGecmisi } from "@/server/subscription/queries";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Abonman ödeme geçmişi" };
export const dynamic = "force-dynamic";

const YONTEM: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale",
  OTHER: "Diğer",
};

/**
 * ABONMAN ODEME GECMISI
 *
 * Her satir KIMIN tahsil ettigini gosterir (kural 2). Iptal edilen kayitlar
 * listeden kaldirilmaz; ustu cizili ve gerekcesiyle gorunur - finansal kayit
 * silinmez.
 */
export default async function AbonmanOdemeleriSayfasi() {
  const kayitlar = await abonmanOdemeGecmisi({ limit: 200 });

  const net = kayitlar
    .filter((k) => k.durum === "CONFIRMED")
    .reduce((t, k) => t + (k.yon === "OUT" ? -k.tutarKurus : k.tutarKurus), 0);

  return (
    <div className="space-y-4">
      <Link href="/yonetim/abonman" className="inline-flex h-12 items-center text-mavi-600">
        ← Abonman yönetimi
      </Link>

      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-lacivert-700">Abonman ödeme geçmişi</h1>
        <span className="rakam text-sm font-bold text-slate-500">{kayitlar.length}</span>
      </div>

      <Card>
        <CardBody className="pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-slate-600">
              Net tahsilat (listelenen kayıtlar)
            </span>
            <Tutar kurus={net} boyut="normal" />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            İptal edilen tahsilatlar ve iadeler düşülmüştür. Yönetim amaçlı özettir.
          </p>
        </CardBody>
      </Card>

      {kayitlar.length === 0 ? (
        <Alert tur="bilgi" baslik="Henüz abonman tahsilatı yok">
          Abonman oluşturmak tahsilat üretmez; tahsilat ayrı işlemdir.
        </Alert>
      ) : (
        <ul className="space-y-2" data-test="abonman-odemeleri">
          {kayitlar.map((k) => (
            <li key={k.paymentId}>
              <Card>
                <CardBody className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <Link
                        href={`/abonmanlar/${k.abonmanId}`}
                        className="block truncate font-bold text-lacivert-700"
                      >
                        {k.musteriAdi}
                      </Link>
                      <div className="text-slate-500">
                        {formatDateTime(k.tarih)} · {YONTEM[k.yontem] ?? k.yontem}
                        {k.donemNo ? ` · ${k.donemNo}. dönem` : ""}
                      </div>
                      <div className="text-xs text-slate-400">
                        {k.tahsilatKodu} · tahsil eden: {k.tahsilEden}
                      </div>
                      {k.durum === "VOIDED" ? (
                        <div className="text-xs font-bold text-hata">
                          İPTAL{k.iptalSebebi ? ` · ${k.iptalSebebi}` : ""}
                        </div>
                      ) : null}
                      {k.yon === "OUT" ? (
                        <div className="text-xs font-bold text-uyari">İADE (ters kayıt)</div>
                      ) : null}
                    </div>
                    <div
                      className={`shrink-0 text-right ${
                        k.durum === "VOIDED" ? "line-through opacity-60" : ""
                      }`}
                    >
                      <Tutar kurus={k.tutarKurus} boyut="kucuk" />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
