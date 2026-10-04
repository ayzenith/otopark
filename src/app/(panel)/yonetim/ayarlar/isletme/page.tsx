import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { prisma } from "@/server/db";
import { KapasiteFormu } from "./formlar";

export const metadata = { title: "İşletme ayarları" };
export const dynamic = "force-dynamic";

export default async function IsletmeAyarlariSayfasi() {
  const [kapasite, aktifArac] = await Promise.all([
    prisma.parkingCapacitySetting.findUnique({ where: { id: "singleton" } }),
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">İşletme ayarları</h1>

      <Card>
        <CardHeader>
          <CardTitle>Otopark kapasitesi</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Alert tur="bilgi" baslik="Kapasite girilmesi zorunlu değil">
            0 girerseniz kapasite tanımsız sayılır ve araç girişi hiçbir şekilde engellenmez.
            Kapasite girdiğinizde, dolduğunda personel onay ister; isterse yine de giriş alabilir.
          </Alert>
          <p className="text-sm text-slate-500">
            Şu anda otoparkta <strong>{aktifArac}</strong> araç kayıtlı.
          </p>
          <KapasiteFormu
            mevcutKapasite={kapasite?.totalCapacity ?? 0}
            mevcutEsik={kapasite?.warnThresholdPercent ?? 90}
          />
        </CardBody>
      </Card>

      <Alert tur="bilgi" baslik="Diğer işletme bilgileri Aşama 7'de eklenecek">
        İşletme adı, adres, telefon, WhatsApp, çalışma saatleri ve harita bilgileri kurumsal web
        sitesiyle birlikte (Aşama 7) yönetilecek. Bu bilgiler henüz girilmedi; varsayılmadı
        (bkz. docs/07 S18).
      </Alert>
    </div>
  );
}
