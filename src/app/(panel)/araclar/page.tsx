import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { prisma } from "@/server/db";
import { formatPlate } from "@/lib/plate";
import { formatDateTime } from "@/lib/datetime";

export const metadata = { title: "Araçlar" };

/** Aktif araclar listesi. Aşama 2'de arama, çıkış ve kart aksiyonları eklenecek. */
export default async function AraclarSayfasi() {
  const aktifler = await prisma.parkingSession.findMany({
    where: { status: "ACTIVE" },
    orderBy: { entryAt: "desc" },
    take: 50,
    select: { id: true, plateDisplay: true, plateNormalized: true, entryAt: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Otoparktaki araçlar</h1>

      {aktifler.length === 0 ? (
        <Alert tur="bilgi" baslik="Otoparkta kayıtlı araç yok">
          Araç girişi Aşama 2&apos;de devreye alınacak.
        </Alert>
      ) : (
        <ul className="space-y-2">
          {aktifler.map((a) => (
            <li key={a.id}>
              <Card>
                <CardBody className="flex items-center justify-between pt-4">
                  <span className="font-mono text-lg font-bold tracking-wider">
                    {formatPlate(a.plateDisplay || a.plateNormalized)}
                  </span>
                  <span className="text-sm text-slate-500">{formatDateTime(a.entryAt)}</span>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Araç geçmişi</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-500">
            Günlük, haftalık ve aylık geçmiş Aşama 2&apos;de eklenecek.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
