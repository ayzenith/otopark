import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Button, Card, CardBody, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { PERMISSIONS } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import {
  abonmanListesi,
  DURUM_ETIKETLERI,
  FILTRE_ETIKETLERI,
  ODEME_ETIKETLERI,
  type AbonmanFiltresi,
} from "@/server/subscription/queries";
import { formatDate } from "@/lib/datetime";

export const metadata = { title: "Abonmanlar" };
export const dynamic = "force-dynamic";

const FILTRELER: AbonmanFiltresi[] = ["tumu", "aktif", "yaklasan", "dolmus", "odenmemis", "iptal"];

/**
 * ABONMANLAR - filtreli liste.
 *
 * "Suresi yaklasanlar", "suresi dolanlar" ve "odenmemis abonmanlar" ayri
 * ekranlar olarak bu sayfanin filtreleridir (ayri URL'ler):
 *   /abonmanlar?filtre=yaklasan | dolmus | odenmemis
 * Boylece ayni liste bileseni kullanilir, sekmeler arasinda gecis tek
 * dokunustur ve baglantilar paylasilabilir.
 *
 * FIYAT: yalnizca subscription.price.set izni olan kullaniciya gosterilir.
 */
export default async function AbonmanlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/giris");
  if (!user.permissions.has(PERMISSIONS.SUBSCRIPTION_VIEW)) redirect("/vardiya");

  const { filtre: ham } = await searchParams;
  const filtre: AbonmanFiltresi = FILTRELER.includes(ham as AbonmanFiltresi)
    ? (ham as AbonmanFiltresi)
    : "tumu";

  const liste = await abonmanListesi(filtre);
  const fiyatGorebilir = user.permissions.has(PERMISSIONS.SUBSCRIPTION_PRICE_SET);
  const kurabilir =
    user.permissions.has(PERMISSIONS.SUBSCRIPTION_CREATE) && fiyatGorebilir;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-extrabold text-lacivert-700">Abonmanlar</h1>
        <span className="rakam text-sm font-bold text-slate-500">{liste.length}</span>
      </div>

      {kurabilir ? (
        <Link href="/musteriler" className="block">
          <Button variant="birincil" size="ikincil" tamGenislik>
            + YENİ ABONMAN (müşteri seç)
          </Button>
        </Link>
      ) : null}

      {/* Sekmeler: yatay kaydırma yok, sarmalanır. */}
      <nav className="flex flex-wrap gap-2" aria-label="Abonman filtreleri">
        {FILTRELER.map((f) => (
          <Link
            key={f}
            href={f === "tumu" ? "/abonmanlar" : `/abonmanlar?filtre=${f}`}
            aria-current={filtre === f ? "page" : undefined}
            className={`inline-flex h-12 items-center rounded-xl border-2 px-3 text-sm font-bold ${
              filtre === f
                ? "border-lacivert-600 bg-lacivert-600 text-white"
                : "border-slate-300 bg-white text-lacivert-700"
            }`}
            data-test={`filtre-${f}`}
          >
            {FILTRE_ETIKETLERI[f]}
          </Link>
        ))}
      </nav>

      {liste.length === 0 ? (
        <Alert tur="bilgi" baslik={`${FILTRE_ETIKETLERI[filtre]}: kayıt yok`}>
          {filtre === "tumu"
            ? "Henüz abonman tanımlanmadı. Müşteri seçip abonman oluşturabilirsiniz."
            : "Bu filtreye uyan abonman bulunmuyor."}
        </Alert>
      ) : (
        <ul className="space-y-2" data-test="abonman-listesi">
          {liste.map((a) => (
            <li key={a.id}>
              <Card>
                <CardBody className="pt-4">
                  <Link href={`/abonmanlar/${a.id}`} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-lacivert-700">{a.musteriAdi}</div>
                        <div className="truncate font-mono text-sm font-bold tracking-wider text-lacivert-800">
                          {a.plakalar.join(" · ") || "araç yok"}
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatDate(a.baslangic)} – {formatDate(a.bitis)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {a.kod} · {a.planEtiketi} · {a.donemSayisi} dönem
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <Rozet
                          tur={
                            a.durum === "ACTIVE"
                              ? "basari"
                              : a.durum === "CANCELLED"
                                ? "hata"
                                : "uyari"
                          }
                        >
                          {DURUM_ETIKETLERI[a.durum] ?? a.durum}
                        </Rozet>
                        {a.durum === "ACTIVE" ? (
                          <div className="rakam mt-1 text-sm font-bold text-lacivert-700">
                            {a.kalanGun <= 0 ? "son gün" : `${a.kalanGun} gün`}
                          </div>
                        ) : null}
                        <div
                          className={`mt-1 text-[11px] font-bold ${
                            a.odemeDurumu === "PAID" ? "text-slate-500" : "text-uyari"
                          }`}
                        >
                          {ODEME_ETIKETLERI[a.odemeDurumu] ?? a.odemeDurumu}
                        </div>
                        {fiyatGorebilir ? (
                          <div className="mt-1">
                            <Tutar kurus={a.ucretKurus} boyut="kucuk" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {filtre === "odenmemis" ? (
        <Alert tur="bilgi" baslik="Ödenmemiş abonman geçersiz değildir">
          Ödemesi alınmamış abonman <strong>geçerli sayılır</strong>; araç girişi engellenmez.
          Personel ekranında uyarı görünür (karar S9).
        </Alert>
      ) : null}
    </div>
  );
}
