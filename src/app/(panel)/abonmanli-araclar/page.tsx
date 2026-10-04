import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, CardBody, Input, Button, Rozet } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { abonmanliAraclar, ODEME_ETIKETLERI } from "@/server/subscription/queries";
import { normalizePlate } from "@/lib/plate";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Abonmanlı araçlar" };
export const dynamic = "force-dynamic";

/**
 * ABONMANLI ARACLAR
 *
 * Kapsami SU AN gecerli olan her plaka bir satirdir. Personel buradan
 * "bu plaka abonmanli mi?" sorusunu liste uzerinden de yanitlayabilir;
 * hizli yol ana ekrandaki ABONMAN SORGULA butonudur.
 */
export default async function AbonmanliAraclarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.SUBSCRIPTION_VIEW)) redirect("/vardiya");

  const { q = "" } = await searchParams;
  const tum = await abonmanliAraclar();
  const arama = normalizePlate(q);
  const liste = arama
    ? tum.filter(
        (a) =>
          a.plakaNormal.includes(arama) ||
          a.musteriAdi.toLocaleUpperCase("tr-TR").includes(q.trim().toLocaleUpperCase("tr-TR")),
      )
    : tum;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-lacivert-700">Abonmanlı araçlar</h1>
        <span className="rakam text-sm font-bold text-slate-500">{liste.length}</span>
      </div>

      <form className="flex gap-2" action="/abonmanli-araclar">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Plaka veya müşteri"
          aria-label="Abonmanlı araç ara"
          data-test="abonmanli-ara"
        />
        <Button type="submit" variant="ikincil" size="normal">
          ARA
        </Button>
      </form>

      {liste.length === 0 ? (
        <Alert
          tur="bilgi"
          baslik={arama ? "Eşleşen abonmanlı araç yok" : "Şu anda geçerli abonmanlı araç yok"}
        >
          Süresi dolmuş abonmanlar bu listede görünmez; araçları normal tarifeden
          ücretlendirilir.
        </Alert>
      ) : (
        <ul className="space-y-2" data-test="abonmanli-arac-listesi">
          {liste.map((a) => (
            <li key={`${a.abonmanId}-${a.vehicleId}`}>
              <Card>
                <CardBody className="pt-4">
                  <Link href={`/abonmanlar/${a.abonmanId}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xl font-bold tracking-wider text-lacivert-800">
                          {a.plaka}
                        </div>
                        <div className="truncate font-semibold text-lacivert-700">
                          {a.musteriAdi}
                        </div>
                        <div className="text-sm text-slate-500">
                          {[a.aracSinifi, a.markaModel, a.renk].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="rakam text-lg font-extrabold text-lacivert-700">
                          {a.kalanGun <= 0 ? "son gün" : `${a.kalanGun} gün`}
                        </div>
                        <div className="text-xs text-slate-500">{formatDate(a.bitis)}</div>
                        {a.odemeDurumu !== "PAID" ? (
                          <div className="mt-1">
                            <Rozet tur="uyari">
                              {ODEME_ETIKETLERI[a.odemeDurumu] ?? a.odemeDurumu}
                            </Rozet>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
