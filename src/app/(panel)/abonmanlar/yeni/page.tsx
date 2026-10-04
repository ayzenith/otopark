import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { AbonmanFormu } from "../formlar";

export const metadata = { title: "Yeni abonman" };
export const dynamic = "force-dynamic";

export default async function YeniAbonmanSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ musteri?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.SUBSCRIPTION_CREATE)) redirect("/abonmanlar");

  // Ucret yazma yetkisi olmadan abonman olusturulamaz: her abonmanin
  // musteriye ozel bir ucreti vardir ve varsayilani yoktur.
  if (!user.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET)) {
    return (
      <div className="space-y-4">
        <Link href="/abonmanlar" className="inline-flex h-12 items-center text-mavi-600">
          ← Abonmanlar
        </Link>
        <Alert tur="uyari" baslik="Abonman ücreti belirleme yetkiniz yok">
          Abonman ücreti müşteriye özeldir ve işletme sahibi tarafından girilir.
        </Alert>
      </div>
    );
  }

  const { musteri: musteriId } = await searchParams;
  const musteri = musteriId
    ? await prisma.customer.findUnique({
        where: { id: musteriId },
        include: { vehicles: { select: { plateDisplay: true } } },
      })
    : null;

  if (!musteri) {
    return (
      <div className="space-y-4">
        <Link href="/abonmanlar" className="inline-flex h-12 items-center text-mavi-600">
          ← Abonmanlar
        </Link>
        <Alert tur="bilgi" baslik="Önce müşteri seçin">
          Abonman bir müşteriye bağlıdır. <Link href="/musteriler" className="underline">
            Müşteriler
          </Link>{" "}
          listesinden müşteriyi açıp &quot;+ ABONMAN&quot; düğmesine dokunun.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/musteriler/${musteri.id}`}
        className="inline-flex h-12 items-center text-mavi-600"
      >
        ← {musteri.fullName}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Yeni abonman</CardTitle>
        </CardHeader>
        <CardBody>
          <AbonmanFormu
            musteriId={musteri.id}
            musteriAdi={musteri.fullName}
            musteriPlakalari={musteri.vehicles.map((v) => v.plateDisplay)}
          />
        </CardBody>
      </Card>
    </div>
  );
}
