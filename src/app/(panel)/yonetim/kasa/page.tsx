import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { formatDateTime } from "@/lib/datetime";
import { formatKurus } from "@/lib/money";
import { kasaDisiTahsilat, kasaGecmisi } from "@/server/cash/queries";
import { MutabakatButonu } from "./formlar";

export const metadata = { title: "Kasa geçmişi" };
export const dynamic = "force-dynamic";

const DURUM_ETIKETLERI: Record<string, { etiket: string; tur: "notr" | "basari" | "mavi" }> = {
  OPEN: { etiket: "AÇIK", tur: "mavi" },
  CLOSED: { etiket: "KAPALI", tur: "notr" },
  RECONCILED: { etiket: "MUTABIK", tur: "basari" },
};

/**
 * KASA GECMISI VE FARKLAR (patron)
 *
 * Her kapanisin beklenen/sayilan tutari ve FARKI gosterilir. Fark gizlenmez:
 * gerekcesiyle birlikte listelenir. Patron farki inceleyip "mutabakat"
 * isaretleyebilir - bu tutarlara DOKUNMAZ, yalnizca "incelendi" demektir.
 */
export default async function KasaGecmisiSayfasi() {
  const [kasalar, kasaDisi] = await Promise.all([kasaGecmisi(40), kasaDisiTahsilat()]);

  const farkliOlanlar = kasalar.filter((k) => k.nakitFarki !== null && k.nakitFarki !== 0);
  const toplamFark = farkliOlanlar.reduce((t, k) => t + (k.nakitFarki ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Kasa geçmişi</h1>
        <p className="text-sm text-slate-500">
          {kasalar.length} kasa oturumu · {farkliOlanlar.length} tanesinde fark var
        </p>
      </div>

      {kasaDisi.adet > 0 ? (
        <Alert tur="uyari" baslik="Kasa dışı nakit tahsilat var">
          Bugün kasa oturumu açık değilken {kasaDisi.adet} nakit tahsilat yapıldı
          (<Tutar kurus={kasaDisi.tutar} boyut="kucuk" />). Personel kasayı açmayı
          atladığında olur; bu tutar hiçbir sayıma girmez.
        </Alert>
      ) : null}

      {farkliOlanlar.length > 0 ? (
        <Alert
          tur={toplamFark === 0 ? "bilgi" : "uyari"}
          baslik={`Farkların net toplamı: ${formatKurus(Math.abs(toplamFark))} ${
            toplamFark > 0 ? "fazla" : toplamFark < 0 ? "eksik" : ""
          }`}
        >
          Fark gerekçeleri aşağıda her oturumun altında görünür.
        </Alert>
      ) : null}

      {kasalar.length === 0 ? (
        <Card>
          <CardBody className="pt-4">
            <p className="text-sm text-slate-500" data-test="kasa-gecmisi-bos">
              Henüz kasa oturumu açılmamış.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {kasalar.map((k) => {
            const durum = DURUM_ETIKETLERI[k.durum] ?? { etiket: k.durum, tur: "notr" as const };
            return (
              <li key={k.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <span className="flex flex-wrap items-center gap-2">
                        {formatDateTime(k.acilisAt)}
                        <Rozet tur={durum.tur}>{durum.etiket}</Rozet>
                        {k.nakitFarki !== null && k.nakitFarki !== 0 ? (
                          <Rozet tur="uyari">FARK</Rozet>
                        ) : null}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardBody>
                    <p className="mb-2 text-xs text-slate-500">
                      Açan: {k.acanKisi}
                      {k.kapanisAt ? ` · kapanış ${formatDateTime(k.kapanisAt)}` : ""}
                      {k.kapatanKisi ? ` · kapatan ${k.kapatanKisi}` : ""}
                    </p>

                    <dl className="space-y-1 text-sm">
                      <Satir etiket="Açılış parası" kurus={k.acilisNakdi} />
                      {k.beklenenNakit !== null ? (
                        <Satir etiket="Beklenen nakit" kurus={k.beklenenNakit} />
                      ) : null}
                      {k.sayilanNakit !== null ? (
                        <Satir etiket="Sayılan nakit" kurus={k.sayilanNakit} />
                      ) : null}
                      {k.nakitFarki !== null ? (
                        <div className="flex justify-between border-t border-slate-200 pt-1">
                          <dt
                            className={`font-bold ${k.nakitFarki === 0 ? "text-basari" : "text-uyari"}`}
                          >
                            Nakit farkı
                          </dt>
                          <dd
                            className={`rakam font-bold ${
                              k.nakitFarki === 0 ? "text-basari" : "text-uyari"
                            }`}
                            data-test={`kasa-fark-${k.id}`}
                          >
                            {k.nakitFarki === 0
                              ? "Fark yok"
                              : `${k.nakitFarki > 0 ? "+" : "−"}${formatKurus(Math.abs(k.nakitFarki))}`}
                          </dd>
                        </div>
                      ) : null}
                      {k.beklenenKart !== null && k.beyanEdilenKart !== null ? (
                        <>
                          <Satir etiket="Beklenen kart" kurus={k.beklenenKart} />
                          <Satir etiket="POS dekont toplamı" kurus={k.beyanEdilenKart} />
                          {k.kartFarki !== null && k.kartFarki !== 0 ? (
                            <div className="flex justify-between">
                              <dt className="font-bold text-uyari">Kart farkı</dt>
                              <dd className="rakam font-bold text-uyari">
                                {k.kartFarki > 0 ? "+" : "−"}
                                {formatKurus(Math.abs(k.kartFarki))}
                              </dd>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </dl>

                    {k.farkSebebi ? (
                      <p className="mt-2 rounded-xl bg-uyari-acik px-3 py-2 text-sm text-amber-900">
                        <strong>Fark gerekçesi:</strong> {k.farkSebebi}
                      </p>
                    ) : null}
                    {k.not ? <p className="mt-2 text-xs text-slate-500">Not: {k.not}</p> : null}

                    {k.durum === "CLOSED" ? <MutabakatButonu id={k.id} /> : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Satir({ etiket, kurus }: { etiket: string; kurus: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{etiket}</dt>
      <dd>
        <Tutar kurus={kurus} boyut="kucuk" />
      </dd>
    </div>
  );
}
