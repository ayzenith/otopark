import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { tarifePlanlari } from "@/server/pricing/admin";
import { prisma } from "@/server/db";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { toKurus } from "@/lib/money";
import { PlanOlusturFormu, SurumOlusturFormu } from "./formlar";

export const metadata = { title: "Tarifeler" };
export const dynamic = "force-dynamic";

/**
 * TARIFE YONETIMI (patron)
 *
 * TEMEL KURAL: aktif surum bile dogrudan duzenlenmez. Her fiyat degisikligi
 * YENI SURUM uretir; eski surumun fiyatlari hic degismez. Boylece gecmis park
 * ucretleri geriye donuk degismez.
 *
 * HICBIR FIYAT ONCEDEN DOLDURULMAMISTIR. Bos birakilan alan "tanimli degil"
 * demektir; sistem deger uydurmaz.
 */
export default async function TarifelerSayfasi() {
  const [planlar, siniflar] = await Promise.all([
    tarifePlanlari(),
    prisma.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const simdi = new Date();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Otopark tarifeleri</h1>

      <Alert tur="bilgi" baslik="Fiyat değişikliği her zaman yeni sürüm üretir">
        Eski sürümün fiyatlarına dokunulmaz. Hâlen otoparkta olan araçlar giriş anındaki
        tarifeyle ücretlendirilir; geçmiş tahsilatlar geriye dönük değişmez.
      </Alert>

      {planlar.length === 0 ? (
        <Alert tur="uyari" baslik="Henüz tarife planı yok">
          Araç çıkışlarında ücret hesaplanabilmesi için bir plan oluşturup fiyatları girmeniz
          gerekiyor. Tarife girilmeden araç girişi engellenmez, ancak tahsilat 0 ₺ olarak
          kaydedilir.
        </Alert>
      ) : null}

      {planlar.map((plan) => {
        const aktifSurum = plan.versions.find(
          (v) =>
            v.isActive &&
            v.effectiveFrom <= simdi &&
            (v.effectiveTo === null || v.effectiveTo > simdi),
        );

        return (
          <Card key={plan.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm normal-case tracking-normal text-lacivert-700">
                  {plan.name}
                </CardTitle>
                {plan.isDefault ? <Rozet tur="mavi">VARSAYILAN</Rozet> : null}
                {plan.isActive ? (
                  <Rozet tur="basari">AKTİF</Rozet>
                ) : (
                  <Rozet tur="hata">PASİF</Rozet>
                )}
                {plan.priority > 0 ? <Rozet>ÖNCELİK {plan.priority}</Rozet> : null}
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Sürüm geçmişi - eski sürümler SALT OKUNUR */}
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Sürüm geçmişi
                </div>
                {plan.versions.length === 0 ? (
                  <p className="text-sm text-slate-500">Henüz sürüm yok; fiyat girilmemiş.</p>
                ) : (
                  <ul className="space-y-2">
                    {plan.versions.map((v) => {
                      const guncel = v.id === aktifSurum?.id;
                      return (
                        <li
                          key={v.id}
                          className={`rounded-xl border px-3 py-2 ${
                            guncel ? "border-mavi-300 bg-mavi-50" : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-lacivert-700">
                              Sürüm {v.versionNo}
                              {guncel ? " · geçerli" : ""}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDateTime(v.effectiveFrom)}
                              {v.effectiveTo ? ` — ${formatDateTime(v.effectiveTo)}` : " — …"}
                            </span>
                          </div>
                          {v.changeNote ? (
                            <p className="mt-0.5 text-xs text-slate-500">{v.changeNote}</p>
                          ) : null}
                          {v._count.parkingSessions > 0 ? (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {v._count.parkingSessions} park kaydı bu sürümle ücretlendirildi
                              (değiştirilemez)
                            </p>
                          ) : null}

                          <ul className="mt-2 space-y-1.5">
                            {v.rules.map((r) => (
                              <li key={r.id} className="rounded-lg bg-white px-2.5 py-2 text-xs">
                                <div className="font-bold text-lacivert-700">
                                  {r.vehicleClass?.name ?? "Tüm araçlar"}
                                </div>
                                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-600">
                                  <Deger
                                    etiket="Ücretsiz süre"
                                    deger={
                                      r.freeMinutes > 0
                                        ? formatDuration(r.freeMinutes)
                                        : "—"
                                    }
                                  />
                                  <Deger
                                    etiket="İlk blok"
                                    deger={
                                      r.firstPeriodMinutes > 0
                                        ? `${formatDuration(r.firstPeriodMinutes)} / ${fmt(r.firstPeriodPrice)}`
                                        : "—"
                                    }
                                  />
                                  <Deger etiket="Saatlik" deger={fmt(r.hourlyPrice)} />
                                  <Deger etiket="Günlük" deger={fmt(r.dailyPrice)} />
                                  <Deger etiket="Günlük üst limit" deger={fmt(r.dailyCapPrice)} />
                                  <Deger etiket="Asgari ücret" deger={fmt(r.minCharge)} />
                                  {r.nightFlatPrice ? (
                                    <Deger
                                      etiket="Gece sabit"
                                      deger={`${fmt(r.nightFlatPrice)} (${saat(r.nightStartMinute)}–${saat(r.nightEndMinute)})`}
                                    />
                                  ) : null}
                                  {r.weekendMultiplier ? (
                                    <Deger
                                      etiket="Hafta sonu"
                                      deger={`×${Number(r.weekendMultiplier.toString())}`}
                                    />
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Yeni sürüm oluşturma formu */}
              <SurumOlusturFormu
                planId={plan.id}
                planAdi={plan.name}
                siniflar={siniflar.map((s) => ({ id: s.id, ad: s.name }))}
                mevcutKurallar={
                  aktifSurum?.rules.map((r) => ({
                    vehicleClassId: r.vehicleClassId,
                    ucretsizDakika: r.freeMinutes,
                    ucretsizDusulur: r.freeMinutesDeductible,
                    ilkBlokDakika: r.firstPeriodMinutes,
                    ilkBlokUcretKurus: toKurus(r.firstPeriodPrice),
                    saatlikUcretKurus: toKurus(r.hourlyPrice),
                    saatYuvarlamaDakika: r.hourlyRoundingMinutes,
                    gunlukUcretKurus: toKurus(r.dailyPrice),
                    gunlukUstLimitKurus: toKurus(r.dailyCapPrice),
                    geceSabitUcretKurus:
                      r.nightFlatPrice === null ? null : toKurus(r.nightFlatPrice),
                    geceBaslangicDakika: r.nightStartMinute,
                    geceBitisDakika: r.nightEndMinute,
                    haftaSonuKatsayisi:
                      r.weekendMultiplier === null
                        ? null
                        : Number(r.weekendMultiplier.toString()),
                    asgariUcretKurus: toKurus(r.minCharge),
                  })) ?? []
                }
              />
            </CardBody>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Yeni tarife planı</CardTitle>
        </CardHeader>
        <CardBody>
          <PlanOlusturFormu />
        </CardBody>
      </Card>
    </div>
  );
}

function fmt(deger: { toString(): string }) {
  const kurus = toKurus(deger);
  return kurus === 0 ? "—" : <Tutar kurus={kurus} boyut="kucuk" />;
}

function saat(dakika: number | null) {
  if (dakika === null) return "—";
  return `${String(Math.floor(dakika / 60)).padStart(2, "0")}:${String(dakika % 60).padStart(2, "0")}`;
}

function Deger({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400">{etiket}</span>
      <span className="font-semibold text-lacivert-700">{deger}</span>
    </div>
  );
}
