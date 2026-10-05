import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle } from "@/components/ui";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission } from "@/server/auth/authz";
import {
  siteSayfalariYonetim,
  siteFiyatlariYonetim,
  siteGalerisiYonetim,
  siteIcerigi,
} from "@/server/site/queries";
import { SayfaFormu, FiyatSatiriFormu, GorselFormu } from "./formlar";

export const metadata = { title: "Web sitesi" };
export const dynamic = "force-dynamic";

/**
 * WEB SİTESİ YÖNETİMİ (patron)
 *
 * Sitedeki tüm metin, fiyat ve görseller buradan girilir. Hiçbiri koda gömülü
 * değildir ve hiçbiri varsayılmamıştır: işletme adres/telefon/fiyat bilgisini
 * henüz vermedi (docs/07 S18-S19). Girilmeyen bölüm sitede HİÇ GÖRÜNMEZ.
 */
export default async function SiteYonetimiSayfasi() {
  // Kural 9: sayfanın ilk işi yetki kontrolü. Arayüzdeki gizleme güvenlik değildir.
  await requirePermission(PERMISSIONS.SITE_CONTENT_EDIT);

  const [sayfalar, fiyatlar, galeri, icerik] = await Promise.all([
    siteSayfalariYonetim(),
    siteFiyatlariYonetim(),
    siteGalerisiYonetim(),
    siteIcerigi(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Web sitesi</h1>

      {icerik.eksikler.length > 0 ? (
        <Alert tur="uyari" baslik={`Sitede ${icerik.eksikler.length} bilgi eksik`}>
          <ul className="list-disc space-y-0.5 pl-4">
            {icerik.eksikler.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p className="mt-2">
            Eksik bilgiler sitede hiç gösterilmiyor — yanlış bilgi yazmak yerine boş bırakıldı.
          </p>
        </Alert>
      ) : (
        <Alert tur="basari" baslik="Site bilgileri tamam" />
      )}

      <Alert tur="bilgi" baslik="Adres, telefon ve çalışma saatleri ayrı ekranda">
        <Link href="/yonetim/ayarlar/isletme" className="font-semibold underline">
          Yönetim → İşletme ayarları
        </Link>{" "}
        ekranından girilir; site oradan okur.
      </Alert>

      {sayfalar.map((s) => (
        <Card key={s.anahtar}>
          <CardHeader>
            <CardTitle>
              {s.varsayilanBaslik}
              {s.yayinda ? null : <span className="ml-2 text-sm text-slate-500">(yayında değil)</span>}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <SayfaFormu
              anahtar={s.anahtar}
              varsayilanBaslik={s.varsayilanBaslik}
              baslik={s.baslik}
              govde={s.govde}
              yayinda={s.yayinda}
            />
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Sitede gösterilecek fiyatlar</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Alert tur="bilgi" baslik="Buraya yazdığınız fiyat tarifeyi DEĞİŞTİRMEZ">
            Bu satırlar yalnızca sitedeki vitrin yazısıdır. Personelin tahsil ettiği ücret her
            zaman Yönetim → Tarifeler ekranından hesaplanır. Abonman fiyatı kişiye özel olduğu için
            sitede yazılması önerilmez.
          </Alert>

          {fiyatlar.map((f) => (
            <FiyatSatiriFormu key={f.id} mevcut={f} />
          ))}

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-500">YENİ FİYAT SATIRI</p>
            <FiyatSatiriFormu />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Galeri</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {galeri.map((g) => (
            <GorselFormu key={g.id} mevcut={g} />
          ))}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-500">YENİ GÖRSEL</p>
            <GorselFormu />
          </div>
        </CardBody>
      </Card>

      <Link
        href="/"
        className="flex h-14 items-center justify-center rounded-2xl border-2 border-lacivert-600 font-bold text-lacivert-700"
      >
        Siteyi görüntüle
      </Link>
    </div>
  );
}
