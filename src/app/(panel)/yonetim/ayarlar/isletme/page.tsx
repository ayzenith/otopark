import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { prisma } from "@/server/db";
import { KapasiteFormu, VardiyaPencereleriFormu, IsletmeKunyesiFormu } from "./formlar";
import { dakikayiSaate, vardiyaPencereleri } from "@/server/settings/shift-windows";
import { isletmeKunyesi } from "@/server/settings/business";

export const metadata = { title: "İşletme ayarları" };
export const dynamic = "force-dynamic";

export default async function IsletmeAyarlariSayfasi() {
  const [kapasite, aktifArac, pencereler, kunye] = await Promise.all([
    prisma.parkingCapacitySetting.findUnique({ where: { id: "singleton" } }),
    prisma.parkingSession.count({ where: { status: "ACTIVE" } }),
    vardiyaPencereleri(),
    isletmeKunyesi(),
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

      <Card>
        <CardHeader>
          <CardTitle>Vardiya saatleri</CardTitle>
        </CardHeader>
        <CardBody>
          <VardiyaPencereleriFormu
            mevcut={pencereler.map((p) => ({
              ad: p.ad,
              baslangic: dakikayiSaate(p.baslangicDakika),
              bitis: dakikayiSaate(p.bitisDakika),
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İşletme bilgileri</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Alert tur="bilgi" baslik="Bu bilgiler kurumsal sitede görünür">
            Boş bıraktığınız alan sitede hiç gösterilmez. Hiçbiri varsayılmadı; ne yazarsanız o
            görünür.
          </Alert>
          <IsletmeKunyesiFormu
            mevcut={{
              isletmeAdi: kunye?.businessName ?? "",
              adres: kunye?.addressText ?? "",
              telefon: kunye?.phone ?? "",
              whatsapp: kunye?.whatsappPhone ?? "",
              calismaSaatleri: kunye?.workingHoursText ?? "",
              mapsUrl: kunye?.mapsUrl ?? "",
              instagramUrl: kunye?.instagramUrl ?? "",
            }}
          />
        </CardBody>
      </Card>

    </div>
  );
}
