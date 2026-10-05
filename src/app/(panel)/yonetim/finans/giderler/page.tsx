import { Alert, Card, CardBody, CardHeader, CardTitle, Rozet } from "@/components/ui";
import { Tutar } from "@/components/panel/para";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { prisma } from "@/server/db";
import { giderKategorileri } from "@/server/finance/expense";
import { digerGelirListesi, giderListesi } from "@/server/finance/queries";
import {
  DigerGelirFormu,
  GelirIptalButonu,
  GiderFormu,
  GiderIptalButonu,
  KategoriEkleFormu,
} from "../formlar";

export const metadata = { title: "Giderler" };
export const dynamic = "force-dynamic";

const YONTEM_ETIKETLERI: Record<string, string> = {
  CASH: "Nakit",
  CARD: "Kart",
  TRANSFER: "Havale",
  OTHER: "Diğer",
};

/**
 * GIDER VE DIGER GELIR LISTESI (patron)
 *
 * IPTAL EDILEN KAYITLAR DA GOSTERILIR: finansal satir silinmez, gizlenmez.
 * Uzeri cizili gorunur, gerekcesi yazilir.
 */
export default async function GiderlerSayfasi() {
  // Son 90 gun: liste uzadikca mobilde kullanilamaz hale gelmesin.
  const baslangic = new Date(Date.now() - 90 * 86_400_000);

  const [giderler, gelirler, kategoriler, personeller] = await Promise.all([
    giderListesi({ baslangic, limit: 150 }),
    digerGelirListesi({ baslangic, limit: 50 }),
    giderKategorileri(true),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, username: true },
    }),
  ]);

  const toplam = giderler.filter((g) => !g.iptal).reduce((t, g) => t + g.tutar, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-lacivert-700">Giderler</h1>
        <p className="text-sm text-slate-500">
          Son 90 gün · {giderler.length} kayıt · toplam{" "}
          <Tutar kurus={toplam} boyut="kucuk" />
        </p>
      </div>

      <GiderFormu
        kategoriler={kategoriler.map((k) => ({ id: k.id, ad: k.name }))}
        personeller={personeller.map((p) => ({ id: p.id, ad: p.fullName || p.username }))}
      />
      <KategoriEkleFormu />

      <Card>
        <CardHeader>
          <CardTitle>Gider kayıtları</CardTitle>
        </CardHeader>
        <CardBody>
          {giderler.length === 0 ? (
            <p className="text-sm text-slate-500" data-test="gider-bos">
              Son 90 günde gider kaydı yok.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {giderler.map((g) => (
                <li key={g.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-lacivert-700">{g.kategori}</span>
                        <Rozet tur="notr">{YONTEM_ETIKETLERI[g.yontem] ?? g.yontem}</Rozet>
                        {g.iptal ? <Rozet tur="hata">İPTAL</Rozet> : null}
                        {g.kasaOturumuId ? <Rozet tur="mavi">KASADAN</Rozet> : null}
                      </div>
                      <div className="text-sm text-slate-600">{g.aciklama}</div>
                      <div className="text-xs text-slate-500">
                        {g.kod} · {formatDate(g.tarih)}
                        {g.tedarikci ? ` · ${g.tedarikci}` : ""}
                        {g.belgeNo ? ` · belge ${g.belgeNo}` : ""}
                        {g.girenKisi ? ` · ${g.girenKisi}` : ""}
                      </div>
                      {g.iptal && g.iptalSebebi ? (
                        <div className="text-xs font-semibold text-hata">
                          İptal gerekçesi: {g.iptalSebebi}
                        </div>
                      ) : null}
                      {!g.iptal ? <GiderIptalButonu id={g.id} /> : null}
                    </div>
                    <div className={`shrink-0 ${g.iptal ? "opacity-50 line-through" : ""}`}>
                      <Tutar kurus={g.tutar} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---- DİĞER GELİRLER ---- */}
      <DigerGelirFormu />

      <Card>
        <CardHeader>
          <CardTitle>Diğer gelirler</CardTitle>
        </CardHeader>
        <CardBody>
          {gelirler.length === 0 ? (
            <p className="text-sm text-slate-500">
              Otopark, yıkama ve abonman dışında gelir kaydı yok.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {gelirler.map((g) => (
                <li key={g.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-lacivert-700">{g.etiket}</span>
                        <Rozet tur="notr">{YONTEM_ETIKETLERI[g.yontem] ?? g.yontem}</Rozet>
                        {g.iptal ? <Rozet tur="hata">İPTAL</Rozet> : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {g.kod} · {formatDateTime(g.tarih)}
                        {g.girenKisi ? ` · ${g.girenKisi}` : ""}
                        {g.aciklama ? ` · ${g.aciklama}` : ""}
                      </div>
                      {g.iptal && g.iptalSebebi ? (
                        <div className="text-xs font-semibold text-hata">
                          İptal gerekçesi: {g.iptalSebebi}
                        </div>
                      ) : null}
                      {!g.iptal ? <GelirIptalButonu id={g.id} /> : null}
                    </div>
                    <div className={`shrink-0 ${g.iptal ? "opacity-50 line-through" : ""}`}>
                      <Tutar kurus={g.tutar} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Alert tur="bilgi" baslik="Finansal kayıt silinmez">
        Hatalı gider veya gelir iptal edilir; satır listede üzeri çizili olarak kalır ve
        gerekçesi görünür. Veritabanı silme girişimini reddeder.
      </Alert>
    </div>
  );
}
