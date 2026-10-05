import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/authz";
import { formatDateTime } from "@/lib/datetime";
import {
  DahaFazla,
  DenetimAyrinti,
  DenetimFiltresi,
} from "@/components/panel/rapor-araclari";
import {
  EYLEM_GRUPLARI,
  denetimFiltreSecenekleri,
  denetimKayitlari,
} from "@/server/reports/audit-query";

export const metadata = { title: "Denetim kayıtları" };
export const dynamic = "force-dynamic";

/**
 * DENETİM KAYITLARI EKRANI
 *
 * ============================================================================
 * `AuditLog` append-only'dir: veritabanı tetikleyicisi UPDATE ve DELETE'i
 * reddeder. Bu ekran yalnızca OKUR.
 *
 * `audit.view` izni yalnızca patronun taban kümesindedir. Maaş değişikliği
 * gibi hassas tutarlar denetim kaydında durduğu için izin burada ayrıca
 * zorunlu kılınır (layout'un patron kontrolüne ek olarak).
 *
 * Mobilde 60 eylem tipini tek listede taramak kullanılamaz; bu yüzden filtre
 * GRUPLAR halinde sunulur (güvenlik, personel, para, iptal, fiyat).
 * ============================================================================
 */
export default async function DenetimSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ grup?: string; kisi?: string; imlec?: string }>;
}) {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const sp = await searchParams;

  const [sonuc, secenekler] = await Promise.all([
    denetimKayitlari({
      grup: sp.grup ?? null,
      userId: sp.kisi ?? null,
      imlecId: sp.imlec ?? null,
      limit: 50,
    }),
    denetimFiltreSecenekleri(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Denetim kayıtları</h1>
        <p className="text-sm text-slate-500">
          Kim, ne zaman, neyi değiştirdi. Kayıtlar silinemez ve değiştirilemez.
        </p>
      </div>

      <DenetimFiltresi
        gruplar={EYLEM_GRUPLARI.map((g) => ({ kod: g.kod, etiket: g.etiket }))}
        aktifGrup={sp.grup ?? null}
        kisiler={secenekler.kisiler}
        aktifKisi={sp.kisi ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle>{sonuc.satirlar.length} kayıt</CardTitle>
        </CardHeader>
        <CardBody>
          {sonuc.satirlar.length === 0 ? (
            <p className="text-sm text-slate-500" data-test="denetim-bos">
              Bu filtreyle kayıt bulunamadı.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100" data-test="denetim-listesi">
              {sonuc.satirlar.map((k) => (
                <li key={k.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-lacivert-700">{k.eylemEtiketi}</span>
                    <Rozet tur="notr">{k.kayitTuru}</Rozet>
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(k.at)} · {k.kisi}
                    {k.ip ? ` · ${k.ip}` : ""}
                  </div>
                  {k.not ? (
                    <div className="mt-0.5 text-sm text-slate-600">{k.not}</div>
                  ) : null}
                  <DenetimAyrinti oncesi={k.oncesi} sonrasi={k.sonrasi} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {sonuc.devamVarMi && sonuc.sonId ? <DahaFazla imlecId={sonuc.sonId} /> : null}

      <Alert tur="bilgi" baslik="Kayıtlar değiştirilemez">
        Denetim tablosu yalnızca ekleme kabul eder; veritabanı tetikleyicisi güncelleme ve
        silme girişimlerini reddeder. Parola ve oturum jetonu gibi hassas alanlar kayda
        <strong> gizlenmiş</strong> olarak yazılır.
      </Alert>
    </div>
  );
}
