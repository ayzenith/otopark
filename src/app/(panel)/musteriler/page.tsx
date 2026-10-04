import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Button, Card, CardBody, Input } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { musteriAra } from "@/server/subscription/customer";

export const metadata = { title: "Müşteriler" };
export const dynamic = "force-dynamic";

/**
 * MUSTERILER - arama ve liste.
 *
 * Arama ad, telefon VE PLAKA uzerinden calisir: personel "34 ABC 123 kimin?"
 * sorusunu musteri adini bilmeden yanitlayabilir.
 */
export default async function MusterilerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.CUSTOMER_VIEW)) redirect("/vardiya");

  const { q = "" } = await searchParams;
  const musteriler = await musteriAra(q);
  const ekleyebilir = user.permissions.has(PERMISSIONS.CUSTOMER_CREATE);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-lacivert-700">Müşteriler</h1>
        <span className="rakam text-sm font-bold text-slate-500">{musteriler.length}</span>
      </div>

      {ekleyebilir ? (
        <Link href="/musteriler/yeni" className="block">
          <Button variant="birincil" size="ikincil" tamGenislik data-test="yeni-musteri">
            + YENİ MÜŞTERİ
          </Button>
        </Link>
      ) : null}

      <form className="flex gap-2" action="/musteriler">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Ad, telefon veya plaka"
          aria-label="Müşteri ara"
          data-test="musteri-ara"
        />
        <Button type="submit" variant="ikincil" size="normal">
          ARA
        </Button>
      </form>

      {musteriler.length === 0 ? (
        <Alert tur="bilgi" baslik={q ? "Eşleşen müşteri bulunamadı" : "Henüz müşteri kaydı yok"}>
          {q
            ? "Ad, telefon veya plakanın bir bölümünü yazarak tekrar deneyin."
            : "Abonman tanımlamak için önce müşteri kaydı oluşturmanız gerekir."}
        </Alert>
      ) : (
        <ul className="space-y-2">
          {musteriler.map((m) => (
            <li key={m.id}>
              <Card>
                <CardBody className="pt-4">
                  <Link
                    href={`/musteriler/${m.id}`}
                    className="flex min-h-12 items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-lacivert-700">
                        {m.fullName}
                        {m.isActive ? "" : " (pasif)"}
                      </span>
                      <span className="rakam block text-sm text-slate-500">{m.phone}</span>
                      {m.isCompany && m.companyName ? (
                        <span className="block truncate text-xs text-slate-400">
                          {m.companyName}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right text-[11px] font-bold text-slate-500">
                      <span className="block">{m._count.vehicles} araç</span>
                      <span className="block">{m._count.subscriptions} abonman</span>
                    </span>
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
