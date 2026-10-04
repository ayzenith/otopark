import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { aktifAraclar, parkGecmisi } from "@/server/parking/queries";
import { businessDayRange, formatDateTime, formatDuration, formatTime } from "@/lib/datetime";
import { Tutar } from "@/components/panel/para";
import { toKurus } from "@/lib/money";
import { normalizePlate } from "@/lib/plate";

export const metadata = { title: "Araçlar" };
export const dynamic = "force-dynamic";

export default async function AraclarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const arama = q ? normalizePlate(q) : undefined;

  const { start, end } = businessDayRange();
  const [aktifler, gecmis] = await Promise.all([
    aktifAraclar(arama),
    parkGecmisi({ baslangic: start, bitis: end, plaka: arama }),
  ]);

  const tamamlananlar = gecmis.filter((g) => g.status !== "ACTIVE");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Araçlar</h1>

      {/* Plaka arama - tek alan, hem aktif hem geçmişte arar */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Plaka ara"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 flex-1 rounded-xl border-2 border-slate-300 bg-white px-3 font-mono text-base uppercase tracking-wider outline-none focus:border-mavi-500"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-xl bg-lacivert-600 px-4 text-sm font-bold text-white"
        >
          ARA
        </button>
        {q ? (
          <Link
            href="/araclar"
            className="flex h-12 shrink-0 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-lacivert-700"
          >
            Temizle
          </Link>
        ) : null}
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Otoparkta ({aktifler.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {aktifler.length === 0 ? (
            <p className="text-sm text-slate-500">
              {arama ? "Bu plakayla otoparkta araç yok." : "Otoparkta kayıtlı araç yok."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {aktifler.map((a) => {
                const sure = Math.floor((Date.now() - a.entryAt.getTime()) / 60000);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-wider text-lacivert-800">
                          {a.plateDisplay}
                        </span>
                        {a.billingMode === "SUBSCRIPTION" ? (
                          <Rozet tur="basari">ABONMANLI</Rozet>
                        ) : null}
                        {sure > 48 * 60 ? <Rozet tur="uyari">48 SAAT+</Rozet> : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {a.vehicle.vehicleClass.name} · Giriş {formatTime(a.entryAt)} ·{" "}
                        {formatDuration(sure)}
                        {a.subscription?.customer.fullName
                          ? ` · ${a.subscription.customer.fullName}`
                          : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{a.code}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bugün tamamlanan ({tamamlananlar.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {tamamlananlar.length === 0 ? (
            <p className="text-sm text-slate-500">Bugün tamamlanan işlem yok.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tamamlananlar.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold tracking-wide text-lacivert-800">
                        {g.plateDisplay}
                      </span>
                      {g.status === "VOIDED" ? <Rozet tur="hata">İPTAL</Rozet> : null}
                      {g.billingMode === "SUBSCRIPTION" ? (
                        <Rozet tur="basari">ABONMANLI</Rozet>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(g.entryAt)}
                      {g.exitAt ? ` → ${formatTime(g.exitAt)}` : ""}
                      {g.durationMinutes !== null ? ` · ${formatDuration(g.durationMinutes)}` : ""}
                    </div>
                    {g.voidReason ? (
                      <div className="text-xs text-hata">İptal: {g.voidReason}</div>
                    ) : null}
                  </div>
                  {g.collectedAmount && toKurus(g.collectedAmount) > 0 ? (
                    <Tutar kurus={toKurus(g.collectedAmount)} boyut="kucuk" />
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">—</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Haftalık ve aylık geçmiş ile dışa aktarma Aşama 5&apos;te eklenecek.
          </p>
        </CardBody>
      </Card>

      <Alert tur="bilgi" baslik="Araç çıkışı ana ekrandan yapılır">
        <Link href="/vardiya" className="font-semibold underline">
          Vardiya ekranına git
        </Link>{" "}
        ve plakayı yazıp &quot;ÇIKIŞ / SORGULA&quot; butonuna dokunun.
      </Alert>
    </div>
  );
}
