import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { anlasmaListesi } from "@/server/parking/agreement";
import { formatKurusPlain } from "@/lib/money";
import { AnlasmaEkleFormu, AnlasmaSatiri } from "./formlar";

export const metadata = { title: "Kurum anlaşmaları" };
export const dynamic = "force-dynamic";

/**
 * KURUM ANLAŞMALARI (patron) — 11.10.2026
 *
 * Otoparkın kurumlarla sabit fiyat anlaşmaları. Personel çıkışta, müşteri
 * kartını gösterince anlaşmayı seçer; ücret KALIŞ SÜRESİNDEN BAĞIMSIZ
 * anlaşmanın fiyatıdır. Ad ve fiyatı yalnızca tarife düzenleme izni olan
 * (patron) değiştirir. Anlaşma silinmez, pasife alınır.
 */
export default async function AnlasmalarSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.TARIFF_EDIT)) redirect("/vardiya");

  const anlasmalar = await anlasmaListesi();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Kurum anlaşmaları</h1>

      <Alert tur="bilgi" baslik="Sabit ücret, süre fark etmez">
        Personel çıkışta müşterinin kartını görünce anlaşmayı seçer; araç ne kadar kalmış
        olursa olsun anlaşmanın ücreti alınır. Fiyatı değiştirdiğinizde yalnızca bundan sonraki
        çıkışlar etkilenir; geçmiş tahsilatlar değişmez.
      </Alert>

      {anlasmalar.length === 0 ? (
        <Alert tur="uyari" baslik="Henüz anlaşma yok">
          Aşağıdan ilk anlaşmayı ekleyin. Anlaşma yokken çıkış ekranında bu seçenek görünmez.
        </Alert>
      ) : null}

      {anlasmalar.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <CardTitle>
              <span className="flex flex-wrap items-center gap-2">
                {a.ad}
                {a.aktif ? <Rozet tur="basari">AKTİF</Rozet> : <Rozet tur="notr">PASİF</Rozet>}
                <span className="rakam text-base font-semibold text-slate-600">
                  {a.fiyatKurus !== null ? `${formatKurusPlain(a.fiyatKurus)} ₺` : "fiyat girilmemiş"}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody>
            {a.fiyatKurus === null ? (
              <Alert tur="uyari" baslik="Fiyat girilmemiş" className="mb-3">
                Fiyatı olmayan anlaşma çıkış ekranında gösterilmez; 0 ₺ olarak uygulanmaz.
              </Alert>
            ) : null}
            <AnlasmaSatiri id={a.id} ad={a.ad} aktif={a.aktif} fiyatKurus={a.fiyatKurus} />
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Yeni anlaşma</CardTitle>
        </CardHeader>
        <CardBody>
          <AnlasmaEkleFormu />
        </CardBody>
      </Card>
    </div>
  );
}
