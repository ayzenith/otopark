import { redirect } from "next/navigation";
import Link from "next/link";
import { Alert, Card, CardBody, SayacKarti } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import {
  YikamaPaneli,
  type YikamaHizmetSecenegi,
} from "@/components/panel/yikama-paneli";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { acikVardiya } from "@/server/shift";
import { sinifIcinFiyatListesi } from "@/server/wash/pricing";
import { yikamaKuyrugu, yikamaOzeti } from "@/server/wash/queries";
import { aracSiniflari } from "@/server/wash/admin";

export const metadata = { title: "Oto Yıkama" };
export const dynamic = "force-dynamic";

/**
 * PERSONEL OTO YIKAMA EKRANI
 *
 * Yikama fiyati ARAC TIPINE BAGLIDIR (otopark tarifesinde sinif farki yoktur).
 * Bu yuzden fiyat listesi her sinif icin ayri hazirlanir ve istemciye sinif
 * bazinda gecirilir: personel tipi degistirdiginde fiyatlar aninda guncellenir,
 * sunucuya yeni istek gitmez.
 */
export default async function YikamaSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  const vardiya = await acikVardiya(user.id);
  const [siniflar, kuyruk, ozet] = await Promise.all([
    aracSiniflari(),
    yikamaKuyrugu(),
    yikamaOzeti(),
  ]);

  // Her arac sinifi icin fiyat listesi.
  const hizmetHaritasi: Record<string, YikamaHizmetSecenegi[]> = {};
  for (const s of siniflar) {
    const liste = await sinifIcinFiyatListesi(s.id);
    hizmetHaritasi[s.id] = liste.map((h) => ({
      washServiceId: h.washServiceId,
      ad: h.ad,
      tahminiDakika: h.tahminiDakika,
      fiyatKurus: h.fiyatKurus,
    }));
  }

  const otomobil = siniflar.find((s) => s.code === "OTOMOBIL");
  const varsayilanSinifId = otomobil?.id ?? siniflar[0]?.id ?? null;
  const hizmetVarMi = Object.values(hizmetHaritasi).some((l) => l.length > 0);
  const fiyatVarMi = Object.values(hizmetHaritasi).some((l) =>
    l.some((h) => h.fiyatKurus !== null),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Oto yıkama</h1>

      {!hizmetVarMi ? (
        <Alert tur="uyari" baslik="Yıkama hizmeti tanımlı değil">
          Patron panelinden <strong>Yönetim → Ayarlar → Oto yıkama</strong> bölümünde hizmet ve
          fiyat girilmesi gerekiyor.
        </Alert>
      ) : !fiyatVarMi ? (
        <Alert tur="uyari" baslik="Yıkama fiyatları girilmemiş">
          Hizmetler tanımlı ama hiçbir araç tipi için fiyat yok. Yıkama kaydedilebilir ama
          0 ₺ olarak işlenir ve işe not düşülür.
        </Alert>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <SayacKarti etiket="Sırada" deger={ozet.sirada} renk="lacivert" />
        <SayacKarti etiket="Yıkamada" deger={ozet.yikamada} renk="mavi" />
        <SayacKarti etiket="Biten bugün" deger={ozet.tamamlanan} renk="basari" />
      </div>

      <YikamaPaneli
        vardiyaAcik={vardiya !== null}
        siniflar={siniflar.map((s) => ({ id: s.id, ad: s.name }))}
        varsayilanSinifId={varsayilanSinifId}
        hizmetler={hizmetHaritasi}
        kuyruk={kuyruk.map((i) => ({
          id: i.id,
          kod: i.kod,
          plaka: i.plaka,
          aracSinifi: i.aracSinifi,
          durum: i.durum,
          siradaBeri: i.siradaBeri.toISOString(),
          hizmetler: i.hizmetler,
          toplamKurus: i.toplamKurus,
          odemeDurumu: i.odemeDurumu,
          fiyatTanimsizMi: i.fiyatTanimsizMi,
          atananKisi: i.atananKisi,
        }))}
        olusturabilir={user.permissions.has(PERMISSIONS.WASH_CREATE)}
        durumDegistirebilir={user.permissions.has(PERMISSIONS.WASH_UPDATE_STATUS)}
        tahsilEdebilir={user.permissions.has(PERMISSIONS.WASH_COLLECT)}
      />

      {ozet.ciroKurus > 0 || ozet.tahsilEdilmeyen > 0 ? (
        <Card>
          <CardBody className="pt-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-slate-600">Bugünkü yıkama tahsilatı</span>
              <Tutar kurus={ozet.ciroKurus} />
            </div>
            {ozet.tahsilEdilmeyen > 0 ? (
              <p className="mt-2 text-sm font-bold text-uyari">
                ⚠ {ozet.tahsilEdilmeyen} tamamlanmış yıkamanın tahsilatı yapılmadı.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-400">
              Bu tutar yalnızca yıkamadır; otopark tahsilatı ayrı tutulur.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Link href="/tarife" className="block text-center text-sm font-semibold text-mavi-600">
        Fiyat listesini gör →
      </Link>
    </div>
  );
}
