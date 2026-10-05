import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/authz";
import { DonemFiltresi } from "@/components/panel/rapor-araclari";
import { formatDate } from "@/lib/datetime";
import {
  DONEM_ETIKETLERI,
  aralikCozumle,
  donemGecerliMi,
} from "@/server/reports/range";
import { personelTahsilatRaporu } from "@/server/reports/dashboard";
import { acikAvansOzeti } from "@/server/staff/advance";

export const metadata = { title: "Personel bazlı tahsilat" };
export const dynamic = "force-dynamic";

/**
 * PERSONEL BAZLI TAHSİLAT RAPORU (Aşama 5'ten devredildi)
 *
 * ============================================================================
 * "Kim ne kadar tahsil etti" sorusunu yanıtlar; kasa farkı araştırmasının ilk
 * adımıdır.
 *
 * İADELER AYRI GÖSTERİLİR ve toplamdan düşülür: bir personelin çok iade
 * yapması, tahsilat toplamının içinde kaybolmamalı.
 *
 * Bu rapor PERFORMANS DEĞERLENDİRME ARACI DEĞİLDİR ve öyle sunulmaz: tahsilat
 * tutarı vardiyanın yoğunluğuna bağlıdır. Ekranda bu açıkça yazılı.
 * ============================================================================
 */
export default async function PersonelTahsilatSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; baslangic?: string; bitis?: string }>;
}) {
  await requirePermission(PERMISSIONS.CASH_REPORT_ALL);
  const sp = await searchParams;

  const donem = donemGecerliMi(sp.donem);
  const aralik = aralikCozumle(donem, {
    baslangicMetni: sp.baslangic ?? null,
    bitisMetni: sp.bitis ?? null,
  });

  const [satirlar, avanslar] = await Promise.all([
    personelTahsilatRaporu(aralik),
    acikAvansOzeti(),
  ]);

  const toplam = satirlar.reduce((t, s) => t + s.toplam, 0);
  const bitisGosterim = new Date(aralik.bitis.getTime() - 1);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Personel bazlı tahsilat</h1>
        <p className="text-sm text-slate-500">
          {DONEM_ETIKETLERI[donem]} · {formatDate(aralik.baslangic)}
          {formatDate(aralik.baslangic) !== formatDate(bitisGosterim)
            ? ` – ${formatDate(bitisGosterim)}`
            : ""}
        </p>
      </div>

      <DonemFiltresi aktif={donem} baslangic={sp.baslangic ?? null} bitis={sp.bitis ?? null} />

      <Card>
        <CardHeader>
          <CardTitle>
            Tahsilat dağılımı · toplam <Tutar kurus={toplam} boyut="kucuk" />
          </CardTitle>
        </CardHeader>
        <CardBody>
          {satirlar.length === 0 ? (
            <p className="text-sm text-slate-500" data-test="personel-tahsilat-bos">
              Bu dönemde tahsilat kaydı yok.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100" data-test="personel-tahsilat">
              {satirlar.map((s) => (
                <li key={s.userId} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-lacivert-700">{s.personel}</div>
                      <div className="text-xs text-slate-500">
                        {s.islemSayisi} işlem · {s.vardiyaSayisi} vardiya
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Otopark <Tutar kurus={s.park} boyut="kucuk" /> · Yıkama{" "}
                        <Tutar kurus={s.yikama} boyut="kucuk" /> · Abonman{" "}
                        <Tutar kurus={s.abonman} boyut="kucuk" />
                      </div>
                      <div className="text-xs text-slate-500">
                        Nakit <Tutar kurus={s.nakit} boyut="kucuk" /> · Kart{" "}
                        <Tutar kurus={s.kart} boyut="kucuk" />
                        {s.diger !== 0 ? (
                          <>
                            {" "}
                            · Diğer <Tutar kurus={s.diger} boyut="kucuk" />
                          </>
                        ) : null}
                      </div>
                      {s.iade > 0 ? (
                        <div className="text-xs font-semibold text-hata">
                          İade / ters kayıt: <Tutar kurus={s.iade} boyut="kucuk" />
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <Tutar kurus={s.toplam} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {avanslar.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Açık personel avansları</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-2 text-xs text-slate-500">
              Avans gider değildir; işletmenin alacağıdır ve maaş ödemesinde mahsup edilir.
            </p>
            <ul className="divide-y divide-slate-100" data-test="acik-avans-ozeti">
              {avanslar.map((a) => (
                <li key={a.personelId} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/yonetim/personel/${a.personelId}`}
                    className="font-semibold text-lacivert-700 underline"
                  >
                    {a.personelAdi}
                  </Link>
                  <span className="text-sm text-slate-500">
                    {a.adet} avans · <Tutar kurus={a.tutar} boyut="kucuk" />
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Alert tur="bilgi" baslik="Bu bir performans değerlendirmesi değildir">
        Tahsilat tutarı vardiyanın yoğunluğuna bağlıdır; yoğun vardiyada çalışan personel
        daha çok tahsilat yapar. Rapor kasa farkı araştırmasında &quot;hangi tahsilat
        kimde&quot; sorusunu yanıtlamak için vardır.
      </Alert>
    </div>
  );
}
