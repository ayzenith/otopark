"use client";

/**
 * ABONMAN FORMLARI
 *
 * ============================================================================
 * FIYAT UYDURULMAZ
 * ----------------------------------------------------------------------------
 * Hicbir ucret alani ON DOLU GELMEZ ve sistemde "genel abonman fiyati" yoktur.
 * Her abonmanin ucreti patron tarafindan O MUSTERI icin girilir (kural 5).
 * Yenilemede de ucret bos gelir; eski donemin fiyati bilgi olarak gosterilir
 * ama otomatik kopyalanmaz - "gecen ay 3.000'di, bu ay 3.500" durumu
 * sessizce yanlis kaydedilmesin.
 *
 * SURE DE UYDURULMAZ: bitis tarihi varsayilan olarak bos gelir. "+1 ay" gibi
 * butonlar yalnizca TAKVIM HESABI yapar; hangi sureyi secmek gerektigine
 * patron karar verir.
 * ============================================================================
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import {
  abonmanIptalAction,
  abonmanOlusturAction,
  abonmanTahsilatAction,
  abonmanTahsilatIptalAction,
  abonmanYenileAction,
  abonmanaAracEkleAction,
  abonmandanAracCikarAction,
  donemFiyatiDuzeltAction,
} from "@/server/actions/abonman";
import { formatKurusPlain } from "@/lib/money";

/** Her yazma islemi icin benzersiz anahtar: cift kayit engeli. */
function yeniAnahtar(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function bugun(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
}

/** YYYY-MM-DD metnine ay/yil ekler. Yalnizca takvim hesabi yapar. */
function tarihEkle(temel: string, ay: number): string {
  const [y, a, g] = temel.split("-").map(Number);
  if (!y || !a || !g) return temel;
  const d = new Date(Date.UTC(y, a - 1 + ay, g));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// YENI ABONMAN
// ---------------------------------------------------------------------------
export function AbonmanFormu({
  musteriId,
  musteriAdi,
  musteriPlakalari,
}: {
  musteriId: string;
  musteriAdi: string;
  musteriPlakalari: string[];
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [zorla, setZorla] = useState(false);
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState("");
  const [secili, setSecili] = useState<string[]>(musteriPlakalari.slice(0, 1));
  const [elleP, setElleP] = useState("");
  const [bekliyor, basla] = useTransition();

  const plakalar = [...new Set([...secili, ...elleP.split(/[,\s]+/).filter(Boolean)])];

  function gonder(formData: FormData, bicimiZorla: boolean) {
    setHata(null);
    basla(async () => {
      const sonuc = await abonmanOlusturAction({
        musteriId,
        planEtiketi: String(formData.get("planEtiketi") ?? ""),
        baslangic,
        bitis,
        ucret: String(formData.get("ucret") ?? ""),
        ucretNotu: String(formData.get("ucretNotu") ?? "") || null,
        aracSayisi: String(formData.get("aracSayisi") ?? "1"),
        plakalar,
        bicimiZorla,
        yoneticiNotu: String(formData.get("yoneticiNotu") ?? "") || null,
      });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        if (sonuc.code === "PLAKA_BICIMI") setZorla(true);
        return;
      }
      router.push(`/abonmanlar/${sonuc.data.id}`);
      router.refresh();
    });
  }

  return (
    <form className="space-y-3" action={(fd) => gonder(fd, zorla)}>
      {hata ? (
        <Alert tur="hata" baslik={hata}>
          {zorla ? (
            <Button
              size="normal"
              variant="uyari"
              className="mt-2"
              disabled={bekliyor}
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) gonder(new FormData(form), true);
              }}
            >
              Yine de kaydet
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <Alert tur="bilgi" baslik={`Müşteri: ${musteriAdi}`}>
        Abonman ücreti <strong>bu müşteriye özeldir</strong>. Sistemde genel bir abonman
        fiyatı yoktur.
      </Alert>

      <Input
        name="planEtiketi"
        etiket="Plan etiketi"
        placeholder="Aylık"
        defaultValue="Aylık"
        maxLength={60}
        required
        yardim="Serbest metindir; fiyatı etkilemez."
        data-test="plan-etiketi"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          name="baslangic"
          etiket="Başlangıç"
          type="date"
          value={baslangic}
          onChange={(e) => setBaslangic(e.target.value)}
          required
          data-test="abonman-baslangic"
        />
        <Input
          name="bitis"
          etiket="Bitiş"
          type="date"
          value={bitis}
          onChange={(e) => setBitis(e.target.value)}
          required
          data-test="abonman-bitis"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { etiket: "+1 ay", ay: 1 },
          { etiket: "+3 ay", ay: 3 },
          { etiket: "+6 ay", ay: 6 },
          { etiket: "+1 yıl", ay: 12 },
        ].map((s) => (
          <Button
            key={s.ay}
            size="normal"
            variant="sade"
            onClick={() => setBitis(tarihEkle(baslangic, s.ay))}
          >
            {s.etiket}
          </Button>
        ))}
      </div>

      <Input
        name="ucret"
        etiket="Anlaşılan ücret (₺)"
        inputMode="decimal"
        placeholder="Bu müşteriyle anlaşılan tutarı yazın"
        required
        className="rakam text-lg"
        yardim="Zorunludur ve varsayılanı yoktur."
        data-test="abonman-ucret"
      />
      <Input name="ucretNotu" etiket="Ücret notu (isteğe bağlı)" maxLength={300} />

      <Input
        name="aracSayisi"
        etiket="Dahil araç sayısı"
        type="number"
        min={1}
        max={50}
        defaultValue={Math.max(1, plakalar.length)}
        data-test="arac-sayisi"
      />

      {musteriPlakalari.length > 0 ? (
        <div>
          <div className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-slate-600">
            Müşterinin araçları
          </div>
          <div className="flex flex-wrap gap-2">
            {musteriPlakalari.map((p) => {
              const aktif = secili.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setSecili((s) => (aktif ? s.filter((x) => x !== p) : [...s, p]))
                  }
                  className={`h-12 rounded-xl border-2 px-3 font-mono text-base font-bold ${
                    aktif
                      ? "border-lacivert-600 bg-lacivert-600 text-white"
                      : "border-slate-300 bg-white text-lacivert-700"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Input
        etiket="Başka plaka (virgülle ayırın)"
        value={elleP}
        onChange={(e) => setElleP(e.target.value.toUpperCase())}
        placeholder="34 ABC 123"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="font-mono tracking-wider"
        data-test="ek-plaka"
      />

      <Input name="yoneticiNotu" etiket="Yönetici notu (isteğe bağlı)" maxLength={1000} />

      <Alert tur="uyari" baslik="Abonman oluşturmak tahsilat oluşturmaz">
        Kayıt <strong>ödenmedi</strong> olarak başlar. Tahsilatı abonman sayfasından ayrı
        işlem olarak kaydedersiniz; kaydı yapan kullanıcı sisteme yazılır.
      </Alert>

      <Button
        type="submit"
        variant="birincil"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        data-test="abonman-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : "ABONMANI OLUŞTUR"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// YENILEME
// ---------------------------------------------------------------------------
export function YenilemeFormu({
  subscriptionId,
  oncekiBitis,
  oncekiUcretKurus,
}: {
  subscriptionId: string;
  oncekiBitis: string;
  oncekiUcretKurus: number;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [baslangic, setBaslangic] = useState(oncekiBitis);
  const [bitis, setBitis] = useState("");
  const [bekliyor, basla] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        basla(async () => {
          const sonuc = await abonmanYenileAction({
            subscriptionId,
            baslangic,
            bitis,
            ucret: String(formData.get("ucret") ?? ""),
            not: String(formData.get("not") ?? "") || null,
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setBasari(`${sonuc.data.donemNo}. dönem açıldı. Önceki dönemin fiyatı değişmedi.`);
          setBitis("");
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} /> : null}

      <p className="text-sm text-slate-500">
        Önceki dönem {formatKurusPlain(oncekiUcretKurus)} ₺ idi.{" "}
        <strong>Bu tutar değişmeyecek.</strong> Yeni dönemin ücretini yazın.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Input
          etiket="Yeni başlangıç"
          type="date"
          value={baslangic}
          onChange={(e) => setBaslangic(e.target.value)}
          required
          data-test="yenileme-baslangic"
        />
        <Input
          etiket="Yeni bitiş"
          type="date"
          value={bitis}
          onChange={(e) => setBitis(e.target.value)}
          required
          data-test="yenileme-bitis"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[1, 3, 6, 12].map((ay) => (
          <Button
            key={ay}
            size="normal"
            variant="sade"
            onClick={() => setBitis(tarihEkle(baslangic, ay))}
          >
            {ay === 12 ? "+1 yıl" : `+${ay} ay`}
          </Button>
        ))}
      </div>

      <Input
        name="ucret"
        etiket="Yeni dönem ücreti (₺)"
        inputMode="decimal"
        placeholder="Yeni dönem için anlaşılan tutar"
        required
        className="rakam text-lg"
        data-test="yenileme-ucret"
      />
      <Input name="not" etiket="Not (isteğe bağlı)" maxLength={300} />

      <Button
        type="submit"
        variant="birincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="yenile"
      >
        {bekliyor ? "Kaydediliyor…" : "YENİ DÖNEM AÇ"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// TAHSILAT
// ---------------------------------------------------------------------------
export function TahsilatFormu({
  subscriptionId,
  periodId,
  donemNo,
  kalanKurus,
}: {
  subscriptionId: string;
  periodId: string;
  donemNo: number;
  kalanKurus: number;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [yontem, setYontem] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
  const [bekliyor, basla] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        basla(async () => {
          const sonuc = await abonmanTahsilatAction({
            subscriptionId,
            subscriptionPeriodId: periodId,
            tutar: String(formData.get("tutar") ?? ""),
            odemeYontemi: yontem,
            kartNotu: String(formData.get("kartNotu") ?? "") || null,
            not: String(formData.get("not") ?? "") || null,
            idempotencyKey: yeniAnahtar(),
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          const d = sonuc.data;
          setBasari(
            `Tahsilat kaydedildi (${d.tahsilatKodu}). ` +
              (d.kalanKurus > 0
                ? `Kalan: ${formatKurusPlain(d.kalanKurus)} ₺`
                : d.fazlaOdemeKurus > 0
                  ? `Fazla ödeme: ${formatKurusPlain(d.fazlaOdemeKurus)} ₺`
                  : "Dönem tamamen ödendi."),
          );
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} data-test="tahsilat-basari" /> : null}

      <p className="text-sm text-slate-500">
        {donemNo}. dönem · kalan{" "}
        <strong className="rakam">{formatKurusPlain(kalanKurus)} ₺</strong>
      </p>

      <Input
        name="tutar"
        etiket="Tahsil edilen tutar (₺)"
        inputMode="decimal"
        defaultValue={kalanKurus > 0 ? formatKurusPlain(kalanKurus) : ""}
        required
        className="rakam text-lg"
        data-test="tahsilat-tutar"
      />

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["CASH", "Nakit"],
            ["CARD", "Kart"],
            ["TRANSFER", "Havale"],
          ] as const
        ).map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            onClick={() => setYontem(deger)}
            className={`h-14 rounded-xl border-2 text-base font-bold ${
              yontem === deger
                ? "border-lacivert-600 bg-lacivert-600 text-white"
                : "border-slate-300 bg-white text-lacivert-700"
            }`}
            data-test={`yontem-${deger.toLowerCase()}`}
          >
            {etiket}
          </button>
        ))}
      </div>

      {yontem === "CARD" ? (
        <Input
          name="kartNotu"
          etiket="Kart / dekont notu"
          maxLength={100}
          yardim="POS bağlantısı yoktur; bu alan elle tutulan nottur."
        />
      ) : null}

      <Input name="not" etiket="Not (isteğe bağlı)" maxLength={300} />

      <Button
        type="submit"
        variant="basari"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        data-test="tahsilati-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : "TAHSİLATI KAYDET"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ARAC EKLE / CIKAR
// ---------------------------------------------------------------------------
export function AbonmanAracFormu({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [zorla, setZorla] = useState(false);
  const [bekliyor, basla] = useTransition();

  function gonder(formData: FormData, bicimiZorla: boolean) {
    setHata(null);
    basla(async () => {
      const sonuc = await abonmanaAracEkleAction({
        subscriptionId,
        plaka: String(formData.get("plaka") ?? ""),
        bicimiZorla,
      });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        if (sonuc.code === "PLAKA_BICIMI") setZorla(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form className="space-y-2" action={(fd) => gonder(fd, zorla)}>
      {hata ? (
        <Alert tur="uyari" baslik={hata} data-test="arac-ekle-hata">
          {zorla ? (
            <Button
              size="normal"
              variant="uyari"
              className="mt-2"
              disabled={bekliyor}
              onClick={(e) => {
                const form = e.currentTarget.closest("form");
                if (form) gonder(new FormData(form), true);
              }}
            >
              Yine de ekle
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <Input
        name="plaka"
        etiket="Abonmana araç ekle"
        placeholder="34 ABC 123"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={12}
        required
        className="font-mono tracking-wider"
        data-test="abonman-arac-plaka"
      />
      <Button
        type="submit"
        variant="ikincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="abonman-arac-ekle"
      >
        {bekliyor ? "…" : "ARAÇ EKLE"}
      </Button>
    </form>
  );
}

export function AracCikarButonu({
  subscriptionId,
  vehicleId,
  plaka,
}: {
  subscriptionId: string;
  vehicleId: string;
  plaka: string;
}) {
  const router = useRouter();
  const [onay, setOnay] = useState(false);
  const [bekliyor, basla] = useTransition();

  if (!onay) {
    return (
      <Button size="normal" variant="sade" onClick={() => setOnay(true)}>
        Çıkar
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-lacivert-700">{plaka} çıkarılsın mı?</span>
      <Button
        size="normal"
        variant="tehlike"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            await abonmandanAracCikarAction({ subscriptionId, vehicleId });
            setOnay(false);
            router.refresh();
          })
        }
      >
        {bekliyor ? "…" : "Evet"}
      </Button>
      <Button size="normal" variant="sade" onClick={() => setOnay(false)}>
        Vazgeç
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DONEM FIYATI DUZELTME (yalnizca son donem)
// ---------------------------------------------------------------------------
export function FiyatDuzeltFormu({
  subscriptionId,
  periodId,
  mevcutKurus,
}: {
  subscriptionId: string;
  periodId: string;
  mevcutKurus: number;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button size="normal" variant="sade" onClick={() => setAcik(true)}>
        Fiyatı düzelt
      </Button>
    );
  }

  return (
    <form
      className="space-y-2 rounded-xl border border-slate-200 p-3"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await donemFiyatiDuzeltAction({
            periodId,
            subscriptionId,
            ucret: String(formData.get("ucret") ?? ""),
            sebep: String(formData.get("sebep") ?? ""),
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setAcik(false);
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Alert tur="uyari" baslik="Yalnızca son dönem düzeltilebilir">
        Geçmiş dönemlerin fiyatı değiştirilemez. Düzeltme denetim kaydına yazılır.
      </Alert>
      <Input
        name="ucret"
        etiket="Doğru ücret (₺)"
        inputMode="decimal"
        defaultValue={formatKurusPlain(mevcutKurus)}
        required
        className="rakam"
      />
      <Input name="sebep" etiket="Gerekçe" required maxLength={300} data-test="fiyat-sebep" />
      <div className="flex gap-2">
        <Button type="submit" variant="birincil" size="normal" disabled={bekliyor}>
          {bekliyor ? "…" : "KAYDET"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// IPTALLER
// ---------------------------------------------------------------------------
export function AbonmanIptalFormu({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="tehlike"
        size="ikincil"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="abonman-iptal-ac"
      >
        ABONMANI İPTAL ET
      </Button>
    );
  }

  return (
    <form
      className="space-y-2"
      action={(formData) => {
        setHata(null);
        basla(async () => {
          const sonuc = await abonmanIptalAction({
            subscriptionId,
            sebep: String(formData.get("sebep") ?? ""),
          });
          if (!sonuc.ok) {
            setHata(sonuc.error);
            return;
          }
          setAcik(false);
          router.refresh();
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Alert tur="uyari" baslik="Tahsilat kayıtları silinmez">
        İptal yalnızca abonmanın bundan sonra geçerli olmamasını sağlar. Dönemler ve
        tahsilatlar kayıtlarda kalır.
      </Alert>
      <Input name="sebep" etiket="İptal gerekçesi" required maxLength={300} data-test="iptal-sebep" />
      <div className="flex gap-2">
        <Button type="submit" variant="tehlike" size="normal" disabled={bekliyor} data-test="iptal-onayla">
          {bekliyor ? "…" : "İPTAL ET"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

/**
 * TAHSILAT IPTALI
 *
 * Iki durum ayri ayri sorulur; cunku ikisi farkli muhasebe uretir:
 *   - para fiilen iade edildi  -> ters kayit (OUT)
 *   - para hic el degistirmedi -> kayit VOIDED
 */
export function TahsilatIptalButonu({
  paymentId,
  subscriptionId,
  tutarKurus,
}: {
  paymentId: string;
  subscriptionId: string;
  tutarKurus: number;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function gonder(sebep: string, iadeEdildi: boolean) {
    setHata(null);
    basla(async () => {
      const sonuc = await abonmanTahsilatIptalAction({
        paymentId,
        subscriptionId,
        sebep,
        iadeEdildi,
        idempotencyKey: yeniAnahtar(),
      });
      if (!sonuc.ok) {
        setHata(sonuc.error);
        return;
      }
      setAcik(false);
      router.refresh();
    });
  }

  if (!acik) {
    return (
      <Button size="normal" variant="sade" onClick={() => setAcik(true)}>
        İptal et
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-200 p-3">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input id={`sebep-${paymentId}`} etiket="Gerekçe" maxLength={300} />
      <p className="text-sm text-slate-600">
        {formatKurusPlain(tutarKurus)} ₺ tahsilatı iptal ediliyor. Para müşteriye fiilen geri
        verildi mi?
      </p>
      <div className="grid gap-2">
        <Button
          variant="uyari"
          size="normal"
          disabled={bekliyor}
          onClick={() => {
            const alan = document.getElementById(`sebep-${paymentId}`) as HTMLInputElement | null;
            gonder(alan?.value ?? "", true);
          }}
        >
          Para İADE EDİLDİ (ters kayıt)
        </Button>
        <Button
          variant="tehlike"
          size="normal"
          disabled={bekliyor}
          onClick={() => {
            const alan = document.getElementById(`sebep-${paymentId}`) as HTMLInputElement | null;
            gonder(alan?.value ?? "", false);
          }}
        >
          Para EL DEĞİŞTİRMEDİ (hatalı kayıt)
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}
