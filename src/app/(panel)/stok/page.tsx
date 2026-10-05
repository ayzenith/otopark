import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { formatDateTime } from "@/lib/datetime";
import { businessDayRange } from "@/lib/datetime";
import {
  MalzemeDurumButonu,
  MalzemeEkleFormu,
  StokHareketFormu,
} from "./formlar";
import { bugunkuStokHareketleri, malzemeListesi } from "@/server/inventory/queries";
import { giderListesi } from "@/server/finance/queries";
import { BIRIM_ETIKETLERI } from "@/server/inventory/items";
import { HAREKET_ETIKETLERI } from "@/server/inventory/movement";

export const metadata = { title: "Malzeme stoğu" };
export const dynamic = "force-dynamic";

/**
 * MALZEME STOGU EKRANI
 *
 * Asama 4'ten Asama 5'e tasindi: alis hareketinin GIDERE baglanmasi gider
 * modulunu gerektiriyordu (docs/06).
 *
 * HICBIR MALZEME ONCEDEN TANIMLI DEGIL: isletme hangi malzemeleri
 * kullandigini bildirmedi, uydurulmadi. Liste bos baslar.
 */
export default async function StokSayfasi() {
  const user = await getSession();
  if (!user) redirect("/giris");

  if (!user.permissions.has(PERMISSIONS.INVENTORY_VIEW)) {
    return (
      <Alert tur="hata" baslik="Bu bölümü görme yetkiniz yok">
        Malzeme stoğunu görmek için yöneticinizden yetki isteyin.
      </Alert>
    );
  }

  const hareketGirebilir = user.permissions.has(PERMISSIONS.INVENTORY_MOVEMENT_CREATE);
  const giderGorebilir = user.permissions.has(PERMISSIONS.FINANCE_EXPENSE_VIEW);

  const { start, end } = businessDayRange();

  const [malzemeler, hareketler, giderler] = await Promise.all([
    malzemeListesi({ pasifleriDeGoster: true }),
    bugunkuStokHareketleri(),
    // Alisi gidere baglamak icin son giderler (yalnizca yetkisi olana).
    giderGorebilir && hareketGirebilir
      ? giderListesi({ baslangic: new Date(start.getTime() - 30 * 86_400_000), bitis: end, limit: 20 })
      : Promise.resolve([]),
  ]);

  const aktifler = malzemeler.filter((m) => m.aktif);
  const kritikler = aktifler.filter((m) => m.kritik);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Malzeme stoğu</h1>
        <p className="text-sm text-slate-500">
          {aktifler.length} malzeme · bugün {hareketler.length} hareket
        </p>
      </div>

      {kritikler.length > 0 ? (
        <Alert
          tur="uyari"
          baslik={`${kritikler.length} malzeme asgari stoğun altında`}
          data-test="kritik-stok"
        >
          {kritikler.map((m) => m.ad).join(", ")}
        </Alert>
      ) : null}

      {hareketGirebilir ? (
        <StokHareketFormu
          malzemeler={aktifler.map((m) => ({
            id: m.id,
            ad: m.ad,
            birim: m.birim,
            stok: m.stok,
          }))}
          giderler={giderler
            .filter((g) => !g.iptal)
            .map((g) => ({ id: g.id, kod: g.kod, etiket: `${g.kategori} · ${g.aciklama}` }))}
        />
      ) : null}

      {/* ---- MALZEME LİSTESİ ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Malzemeler</CardTitle>
        </CardHeader>
        <CardBody>
          {malzemeler.length === 0 ? (
            <p className="text-sm text-slate-500" data-test="stok-bos">
              Henüz malzeme kartı eklenmemiş. İşletmenin hangi malzemeleri kullandığı
              bildirilmediği için liste boş başlar; buradan ekleyebilirsiniz.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {malzemeler.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-lacivert-700">{m.ad}</span>
                      {m.kritik ? <Rozet tur="uyari">AZALDI</Rozet> : null}
                      {!m.aktif ? <Rozet tur="notr">KULLANIM DIŞI</Rozet> : null}
                    </div>
                    <div className="text-xs text-slate-500">
                      {m.asgariStok !== null
                        ? `Asgari ${m.asgariStok.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} ${BIRIM_ETIKETLERI[m.birim]}`
                        : "Asgari stok tanımlı değil"}
                      {m.sonHareketAt ? ` · son hareket ${formatDateTime(m.sonHareketAt)}` : ""}
                    </div>
                    {hareketGirebilir ? (
                      <MalzemeDurumButonu id={m.id} aktif={m.aktif} />
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`rakam text-lg font-extrabold ${m.kritik ? "text-uyari" : "text-lacivert-800"}`}
                      data-test={`stok-${m.ad}`}
                      // Makine okunur ham deger: ekranda tr-TR bicimli
                      // ("1.234,5") yazdigi icin testler metni ayristirmak
                      // zorunda kalmasin (E2E'de NaN'a dusuldu).
                      data-stok={m.stok}
                    >
                      {m.stok.toLocaleString("tr-TR", { maximumFractionDigits: 3 })}
                    </div>
                    <div className="text-xs text-slate-500">{BIRIM_ETIKETLERI[m.birim]}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {hareketGirebilir ? <MalzemeEkleFormu /> : null}

      {/* ---- BUGÜNÜN HAREKETLERİ ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Bugünün hareketleri</CardTitle>
        </CardHeader>
        <CardBody>
          {hareketler.length === 0 ? (
            <p className="text-sm text-slate-500">Bugün stok hareketi girilmedi.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hareketler.map((h) => (
                <li key={h.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-lacivert-700">
                      {h.malzemeAdi}{" "}
                      <span className="text-xs font-bold uppercase text-slate-400">
                        {HAREKET_ETIKETLERI[h.tip]}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {formatDateTime(h.at)}
                      {h.girenKisi ? ` · ${h.girenKisi}` : ""}
                      {h.giderKodu ? ` · gider ${h.giderKodu}` : ""}
                      {h.yikamaKodu ? ` · yıkama ${h.yikamaKodu}` : ""}
                      {h.not ? ` · ${h.not}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`rakam text-sm font-bold ${h.etki >= 0 ? "text-basari" : "text-hata"}`}
                    >
                      {h.etki >= 0 ? "+" : "−"}
                      {Math.abs(h.etki).toLocaleString("tr-TR", { maximumFractionDigits: 3 })}{" "}
                      {BIRIM_ETIKETLERI[h.birim]}
                    </div>
                    {h.toplamMaliyet !== null ? (
                      <div className="text-xs text-slate-500">
                        <Tutar kurus={h.toplamMaliyet} boyut="kucuk" />
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
