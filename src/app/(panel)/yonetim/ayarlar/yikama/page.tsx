import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { yikamaFiyatTablosu } from "@/server/wash/pricing";
import { yikamaFiyatGecmisi } from "@/server/wash/admin";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatKurusPlain } from "@/lib/money";
import {
  FiyatIzgarasi,
  HizmetDurumButonu,
  HizmetEkleFormu,
  SinifEkleFormu,
} from "./formlar";

export const metadata = { title: "Oto yıkama fiyatları" };
export const dynamic = "force-dynamic";

/**
 * OTO YIKAMA AYARLARI (patron)
 *
 * Isletme karari (04.10.2026): arac tipine gore fiyatlandirma YALNIZCA
 * yikamada vardir. Normal otopark tarifesinde tip farki yoktur ve o ekran
 * ayridir (Yonetim → Ayarlar → Tarifeler).
 */
export default async function YikamaAyarlariSayfasi() {
  const tablo = await yikamaFiyatTablosu();

  // Fiyat gecmisi: her hizmetin son degisiklikleri (salt okunur).
  const gecmisler = await Promise.all(
    tablo.hizmetler.map(async (h) => ({
      hizmetId: h.id,
      hizmetAdi: h.ad,
      kayitlar: (await yikamaFiyatGecmisi(h.id)).slice(0, 6),
    })),
  );

  const fiyatiOlanVarMi = tablo.hizmetler.some(
    (h) => h.genelFiyatKurus !== null || Object.values(h.sinifFiyatlari).some((f) => f !== null),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold text-lacivert-700">Oto yıkama fiyatları</h1>

      <Alert tur="bilgi" baslik="Araç tipine göre fiyat YALNIZCA yıkamada geçerlidir">
        Normal otopark tarifesinde araç tipine göre fiyat farkı yoktur ve o fiyatlar{" "}
        <Link href="/yonetim/ayarlar/tarifeler" className="underline">
          Tarifeler
        </Link>{" "}
        ekranından yönetilir. İki fiyatlandırma tamamen ayrıdır: birinde yaptığınız
        değişiklik diğerini etkilemez.
      </Alert>

      {!fiyatiOlanVarMi && tablo.hizmetler.length > 0 ? (
        <Alert tur="uyari" baslik="Hiçbir yıkama fiyatı girilmemiş">
          Personel yıkama kaydedebilir ama tutar 0 ₺ olarak işlenir ve işe not düşülür.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Fiyatlar</CardTitle>
        </CardHeader>
        <CardBody>
          <FiyatIzgarasi hizmetler={tablo.hizmetler} siniflar={tablo.siniflar} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hizmetler</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {tablo.hizmetler.length === 0 ? (
            <p className="text-sm text-slate-500">Henüz yıkama hizmeti tanımlanmadı.</p>
          ) : (
            <ul className="space-y-2">
              {tablo.hizmetler.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-lacivert-700">{h.ad}</div>
                    <div className="text-xs text-slate-400">
                      {h.kod}
                      {h.tahminiDakika ? ` · ~${h.tahminiDakika} dk` : ""}
                      {h.siteGorunur ? " · sitede görünür" : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {h.aktif ? null : <Rozet tur="uyari">PASİF</Rozet>}
                    <HizmetDurumButonu
                      washServiceId={h.id}
                      ad={h.ad}
                      aciklama={h.aciklama}
                      tahminiDakika={h.tahminiDakika}
                      siteGorunur={h.siteGorunur}
                      siraNo={h.siraNo}
                      aktif={h.aktif}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <HizmetEkleFormu />

          <p className="text-xs text-slate-400">
            Hizmet <strong>silinmez</strong>, pasife alınır. Böylece geçmiş iş emirleri ve
            ciro raporları bozulmaz.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Araç tipleri ({tablo.siniflar.length})</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ul className="flex flex-wrap gap-2">
            {tablo.siniflar.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-sm font-bold text-lacivert-700"
              >
                {s.ad}
              </li>
            ))}
          </ul>
          <SinifEkleFormu />
          <p className="text-xs text-slate-400">
            Yeni tip eklediğinizde yıkama fiyatını yukarıdaki ızgaradan girersiniz.
          </p>
        </CardBody>
      </Card>

      {/* ---- FIYAT GECMISI ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Fiyat değişiklik geçmişi</CardTitle>
        </CardHeader>
        <CardBody>
          {gecmisler.every((g) => g.kayitlar.length === 0) ? (
            <p className="text-sm text-slate-500">Henüz fiyat kaydı yok.</p>
          ) : (
            <ul className="space-y-3">
              {gecmisler
                .filter((g) => g.kayitlar.length > 0)
                .map((g) => (
                  <li key={g.hizmetId}>
                    <div className="mb-1 font-bold text-lacivert-700">{g.hizmetAdi}</div>
                    <ul className="space-y-1 text-sm">
                      {g.kayitlar.map((k) => (
                        <li key={k.id} className="flex justify-between gap-3">
                          <span className="min-w-0 text-slate-500">
                            {k.aracSinifiAdi} · {formatDate(k.baslangic)}
                            {k.bitis ? ` – ${formatDate(k.bitis)}` : " – halen"}
                          </span>
                          <span className="rakam shrink-0 font-semibold text-lacivert-700">
                            {formatKurusPlain(k.fiyatKurus)} ₺
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Fiyat değiştiğinde yeni kayıt açılır, eskisi kapanır. Geçmiş iş emirlerinin
            tutarı değişmez.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
