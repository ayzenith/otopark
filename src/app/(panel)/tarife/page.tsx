import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { gecerliTarifeler } from "@/server/pricing/admin";
import { formatDateTime, formatDuration } from "@/lib/datetime";

export const metadata = { title: "Fiyat listesi" };
export const dynamic = "force-dynamic";

/** Personelin musteriye fiyat soyleyebilmesi icin SALT OKUNUR liste. */
export default async function TarifeSayfasi() {
  const tarifeler = await gecerliTarifeler();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Geçerli fiyatlar</h1>

      {tarifeler.length === 0 ? (
        <Alert tur="uyari" baslik="Henüz tarife girilmemiş">
          Fiyatlar patron tarafından girilecek. Girilmeden önce çıkışlarda ücret hesaplanamaz.
        </Alert>
      ) : (
        tarifeler.map((t) => (
          <Card key={`${t.planAdi}-${t.surumNo}`}>
            <CardHeader>
              <CardTitle className="normal-case tracking-normal text-lacivert-700">
                {t.planAdi} · sürüm {t.surumNo}
              </CardTitle>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatDateTime(t.gecerlilikBaslangici)} tarihinden geçerli
              </p>
            </CardHeader>
            <CardBody>
              <ul className="space-y-3">
                {t.kurallar.map((k) => (
                  <li key={k.aracSinifi} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="font-bold text-lacivert-700">{k.aracSinifi}</div>
                    <dl className="mt-1.5 space-y-1 text-sm">
                      {k.ucretsizDakika > 0 ? (
                        <Satir
                          etiket="Ücretsiz süre"
                          deger={formatDuration(k.ucretsizDakika)}
                        />
                      ) : null}
                      {k.ilkBlokUcret > 0 ? (
                        <Satir
                          etiket={`İlk ${formatDuration(k.ilkBlokDakika)}`}
                          deger={<Tutar kurus={k.ilkBlokUcret} boyut="kucuk" />}
                        />
                      ) : null}
                      {k.saatlikUcret > 0 ? (
                        <Satir
                          etiket="Saatlik"
                          deger={<Tutar kurus={k.saatlikUcret} boyut="kucuk" />}
                        />
                      ) : null}
                      {k.gunlukUcret > 0 ? (
                        <Satir
                          etiket="Günlük (24 sa)"
                          deger={<Tutar kurus={k.gunlukUcret} boyut="kucuk" />}
                        />
                      ) : null}
                      {k.gunlukUstLimit > 0 ? (
                        <Satir
                          etiket="Günlük üst limit"
                          deger={<Tutar kurus={k.gunlukUstLimit} boyut="kucuk" />}
                        />
                      ) : null}
                      {k.asgariUcret > 0 ? (
                        <Satir
                          etiket="Asgari ücret"
                          deger={<Tutar kurus={k.asgariUcret} boyut="kucuk" />}
                        />
                      ) : null}
                    </dl>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

function Satir({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{etiket}</dt>
      <dd className="font-semibold text-lacivert-700">{deger}</dd>
    </div>
  );
}
