"use client";

/**
 * PERSONEL ISLEM PANELI - projenin en kritik arayuzu.
 *
 * Gercek kullanim hizi hedefi (docs/04 4.2-4.4):
 *   1. Plaka gir
 *   2. Araç girişini tamamla        -> 2 dokunuş
 *   3. Çıkış için plakayı ara
 *   4. Ücreti açık ve anlaşılır gör
 *   5. Nakit veya kart seç
 *   6. Ödemeyi tamamla
 *   7. Başarı onayını gör
 *
 * Mobil davranis kurallari:
 *  - Plaka alani otomatik odaklanmaz (klavye acilip sayaclari gizlemesin)
 *  - Butonlar basildiktan sonra kilitlenir (cift kayit engeli)
 *  - Her istek idempotency anahtari tasir
 *  - Islem sonrasi tam ekran, renk kodlu onay
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, PlakaInput, Rozet } from "@/components/ui";
import { Tutar } from "./para";
import { cikisSorgulaAction, cikisYapAction, girisYapAction } from "@/server/actions/park";
import { formatDateTime, formatDuration, formatTime } from "@/lib/datetime";

type Durum =
  | { ad: "bos" }
  | { ad: "yukleniyor" }
  | { ad: "hata"; mesaj: string; kod?: string; eylem?: Eylem }
  | { ad: "cikisPaneli"; veri: CikisVerisi }
  | { ad: "girisOnay"; veri: GirisOnayVerisi }
  | { ad: "cikisOnay"; veri: CikisOnayVerisi };

type Eylem =
  | { tur: "bicimiZorla" }
  | { tur: "kapasiteyiZorla" }
  | { tur: "cikisaGit" };

interface CikisVerisi {
  parkingSessionId: string;
  kod: string;
  plakaGosterim: string;
  aracSinifiAdi: string;
  girisAt: string;
  sureDakika: number;
  tutar: number;
  dokum: { aciklama: string; tutar: number }[];
  abonmanKapsaminda: boolean;
  abonmanMusteriAdi: string | null;
  tarifeAdi: string | null;
  tarifeSurumNo: number | null;
  ucretsizMi: boolean;
  tarifeTanimsiz: boolean;
}

interface GirisOnayVerisi {
  kod: string;
  plakaGosterim: string;
  girisAt: string;
  aracSinifiAdi: string;
  abonmanDurumu: string;
  abonmanMusteriAdi: string | null;
  abonmanUyari: string | null;
  abonmanlimi: boolean;
  tarifeTanimsiz: boolean;
  uyarilar: string[];
}

interface CikisOnayVerisi {
  kod: string;
  plakaGosterim: string;
  sureDakika: number;
  odenenTutar: number;
  odemeYontemi: string | null;
  tahsilatKodu: string | null;
  abonmanKapsaminda: boolean;
  tarifeTanimsiz: boolean;
}

export interface AracSinifi {
  id: string;
  ad: string;
}

/** Her islem icin benzersiz anahtar: cift kayit engeli. */
function yeniAnahtar(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function IslemPaneli({
  vardiyaAcik,
  aracSiniflari,
  cikisYetkisi,
}: {
  vardiyaAcik: boolean;
  aracSiniflari: AracSinifi[];
  cikisYetkisi: boolean;
}) {
  const router = useRouter();
  const [plaka, setPlaka] = useState("");
  const [sinifId, setSinifId] = useState<string | undefined>(undefined);
  const [sinifSecimiAcik, setSinifSecimiAcik] = useState(false);
  const [durum, setDurum] = useState<Durum>({ ad: "bos" });
  const plakaRef = useRef<HTMLInputElement>(null);

  const mesgul = durum.ad === "yukleniyor";

  /** Onay ekranlarini otomatik kapatir ve plaka alanini temizler. */
  const sifirla = useCallback(() => {
    setDurum({ ad: "bos" });
    setPlaka("");
    setSinifId(undefined);
    setSinifSecimiAcik(false);
    router.refresh();
  }, [router]);

  // Basari onayi 4 saniye sonra kendini kapatir; personel beklemek zorunda kalmaz.
  useEffect(() => {
    if (durum.ad !== "girisOnay" && durum.ad !== "cikisOnay") return;
    const zaman = setTimeout(sifirla, 4000);
    return () => clearTimeout(zaman);
  }, [durum.ad, sifirla]);

  // ---- 1-2. ADIM: PLAKA GIR -> ARAC GIRISI ----
  async function girisYap(zorla?: { bicim?: boolean; kapasite?: boolean }) {
    if (!plaka.trim() || mesgul) return;
    setDurum({ ad: "yukleniyor" });

    const sonuc = await girisYapAction({
      plaka,
      aracSinifiId: sinifId,
      bicimiZorla: zorla?.bicim,
      kapasiteyiZorla: zorla?.kapasite,
      idempotencyKey: yeniAnahtar(),
    });

    if (!sonuc.ok) {
      setDurum({
        ad: "hata",
        mesaj: sonuc.error,
        kod: sonuc.code,
        eylem:
          sonuc.code === "PLAKA_BICIMI"
            ? { tur: "bicimiZorla" }
            : sonuc.code === "KAPASITE_DOLU"
              ? { tur: "kapasiteyiZorla" }
              : sonuc.code === "ZATEN_ICERIDE"
                ? { tur: "cikisaGit" }
                : undefined,
      });
      return;
    }

    const d = sonuc.data;
    setDurum({
      ad: "girisOnay",
      veri: {
        kod: d.kod,
        plakaGosterim: d.plakaGosterim,
        girisAt: formatTime(new Date(d.girisAt)),
        aracSinifiAdi: d.aracSinifiAdi,
        abonmanDurumu: d.abonman.durum,
        abonmanMusteriAdi: d.abonman.musteriAdi,
        abonmanUyari: d.abonman.uyari,
        abonmanlimi: d.abonman.ucretsizMi,
        tarifeTanimsiz: d.tarifeTanimsiz,
        uyarilar: d.uyarilar,
      },
    });
  }

  // ---- 3-4. ADIM: CIKIS SORGULA -> UCRETI GOSTER ----
  async function cikisSorgula() {
    if (!plaka.trim() || mesgul) return;
    setDurum({ ad: "yukleniyor" });

    const sonuc = await cikisSorgulaAction({ plaka });
    if (!sonuc.ok) {
      setDurum({ ad: "hata", mesaj: sonuc.error, kod: sonuc.code });
      return;
    }

    const d = sonuc.data;
    setDurum({
      ad: "cikisPaneli",
      veri: {
        parkingSessionId: d.parkingSessionId,
        kod: d.kod,
        plakaGosterim: d.plakaGosterim,
        aracSinifiAdi: d.aracSinifiAdi,
        girisAt: formatDateTime(new Date(d.girisAt)),
        sureDakika: d.sureDakika,
        tutar: d.tutar,
        dokum: d.dokum,
        abonmanKapsaminda: d.abonmanKapsaminda,
        abonmanMusteriAdi: d.abonmanMusteriAdi,
        tarifeAdi: d.tarifeAdi,
        tarifeSurumNo: d.tarifeSurumNo,
        ucretsizMi: d.ucretsizMi,
        tarifeTanimsiz: d.tarifeTanimsiz,
      },
    });
  }

  // ---- 5-6-7. ADIM: ODEME YONTEMI SEC -> TAHSIL ET -> ONAY ----
  async function tahsilEt(yontem: "CASH" | "CARD") {
    if (durum.ad !== "cikisPaneli" || mesgul) return;
    const veri = durum.veri;
    setDurum({ ad: "yukleniyor" });

    const sonuc = await cikisYapAction({
      parkingSessionId: veri.parkingSessionId,
      odemeYontemi: yontem,
      idempotencyKey: yeniAnahtar(),
    });

    if (!sonuc.ok) {
      setDurum({ ad: "hata", mesaj: sonuc.error, kod: sonuc.code });
      return;
    }

    const d = sonuc.data;
    setDurum({
      ad: "cikisOnay",
      veri: {
        kod: d.kod,
        plakaGosterim: d.plakaGosterim,
        sureDakika: d.sureDakika,
        odenenTutar: d.odenenTutar,
        odemeYontemi: d.odemeYontemi,
        tahsilatKodu: d.tahsilatKodu,
        abonmanKapsaminda: d.abonmanKapsaminda,
        tarifeTanimsiz: d.tarifeTanimsiz,
      },
    });
  }

  // ---- ONAY EKRANLARI (tam ekran, renk kodlu) ----
  if (durum.ad === "girisOnay") {
    return <GirisOnayEkrani veri={durum.veri} kapat={sifirla} />;
  }
  if (durum.ad === "cikisOnay") {
    return <CikisOnayEkrani veri={durum.veri} kapat={sifirla} />;
  }

  // ---- CIKIS / TAHSILAT PANELI ----
  if (durum.ad === "cikisPaneli") {
    return (
      <CikisPaneli
        veri={durum.veri}
        mesgul={mesgul}
        tahsilEt={tahsilEt}
        vazgec={() => setDurum({ ad: "bos" })}
      />
    );
  }

  // ---- ANA GIRIS EKRANI ----
  return (
    <div className="space-y-3">
      {!vardiyaAcik ? (
        <Alert tur="uyari" baslik="Vardiyanız açık değil">
          İşlem yapabilmek için önce vardiyanızı başlatın.
        </Alert>
      ) : null}

      {durum.ad === "hata" ? (
        <Alert tur={durum.kod === "ZATEN_ICERIDE" ? "uyari" : "hata"} baslik={durum.mesaj}>
          <div className="mt-2 flex flex-wrap gap-2">
            {durum.eylem?.tur === "bicimiZorla" ? (
              <Button
                size="normal"
                variant="uyari"
                onClick={() => girisYap({ bicim: true })}
                disabled={mesgul}
              >
                Yine de kaydet
              </Button>
            ) : null}
            {durum.eylem?.tur === "kapasiteyiZorla" ? (
              <Button
                size="normal"
                variant="uyari"
                onClick={() => girisYap({ bicim: true, kapasite: true })}
                disabled={mesgul}
              >
                Yine de giriş al
              </Button>
            ) : null}
            {durum.eylem?.tur === "cikisaGit" && cikisYetkisi ? (
              <Button size="normal" variant="ikincil" onClick={cikisSorgula} disabled={mesgul}>
                Çıkışa git
              </Button>
            ) : null}
            <Button size="normal" variant="sade" onClick={() => setDurum({ ad: "bos" })}>
              Kapat
            </Button>
          </div>
        </Alert>
      ) : null}

      <PlakaInput
        ref={plakaRef}
        value={plaka}
        onChange={(e) => setPlaka(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void girisYap();
          }
        }}
        disabled={!vardiyaAcik || mesgul}
        data-test="plaka-girisi"
      />

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="birincil"
          size="islem"
          onClick={() => girisYap()}
          disabled={!vardiyaAcik || mesgul || !plaka.trim()}
          data-test="arac-girisi"
        >
          {mesgul ? "…" : "↓ ARAÇ GİRİŞİ"}
        </Button>
        <Button
          variant="ikincil"
          size="islem"
          onClick={cikisSorgula}
          disabled={!vardiyaAcik || mesgul || !plaka.trim() || !cikisYetkisi}
          data-test="cikis-sorgula"
        >
          {mesgul ? "…" : "↑ ÇIKIŞ / SORGULA"}
        </Button>
      </div>

      {/* Araç sınıfı: normal akışta gizli, tek dokunuşla açılır. Böylece
          olağan giriş 2 dokunuşta kalır. */}
      {aracSiniflari.length > 1 ? (
        <div>
          {sinifSecimiAcik ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {aracSiniflari.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSinifId(s.id);
                    setSinifSecimiAcik(false);
                  }}
                  className={`h-12 rounded-xl border-2 px-3 text-sm font-semibold ${
                    sinifId === s.id
                      ? "border-lacivert-600 bg-lacivert-600 text-white"
                      : "border-slate-300 bg-white text-lacivert-700"
                  }`}
                >
                  {s.ad}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSinifSecimiAcik(true)}
              className="flex h-12 w-full items-center justify-center gap-1 text-sm font-semibold text-mavi-600"
            >
              Araç sınıfı:{" "}
              <strong>
                {sinifId ? (aracSiniflari.find((s) => s.id === sinifId)?.ad ?? "—") : "otomatik"}
              </strong>{" "}
              · değiştir
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CIKIS / TAHSILAT PANELI - 4. ve 5. adim
// ---------------------------------------------------------------------------
function CikisPaneli({
  veri,
  mesgul,
  tahsilEt,
  vazgec,
}: {
  veri: CikisVerisi;
  mesgul: boolean;
  tahsilEt: (y: "CASH" | "CARD") => void;
  vazgec: () => void;
}) {
  return (
    <div className="space-y-3" data-test="cikis-paneli">
      <div className="rounded-2xl border-2 border-lacivert-200 bg-white p-4">
        <div className="text-center">
          <div className="font-mono text-3xl font-bold tracking-wider text-lacivert-800">
            {veri.plakaGosterim}
          </div>
          <div className="mt-0.5 text-sm text-slate-500">{veri.aracSinifiAdi}</div>
        </div>

        {veri.abonmanKapsaminda ? (
          <div className="mt-3 rounded-xl bg-basari-acik px-3 py-2 text-center">
            <Rozet tur="basari">ABONMAN KAPSAMINDA</Rozet>
            {veri.abonmanMusteriAdi ? (
              <div className="mt-1 text-sm font-semibold text-green-900">
                {veri.abonmanMusteriAdi}
              </div>
            ) : null}
          </div>
        ) : null}

        {veri.tarifeTanimsiz ? (
          <Alert tur="uyari" baslik="TARİFE TANIMLI DEĞİL" className="mt-3">
            Ücret hesaplanamadı. Patron panelinden tarife girilmeli. Bu işlem 0 ₺ olarak
            kaydedilecek ve kayda not düşülecek.
          </Alert>
        ) : null}

        <dl className="mt-4 space-y-1.5 text-sm">
          <Satir etiket="Giriş" deger={veri.girisAt} />
          <Satir etiket="Süre" deger={formatDuration(veri.sureDakika)} vurgulu />
          {veri.tarifeAdi ? (
            <Satir
              etiket="Tarife"
              deger={`${veri.tarifeAdi}${veri.tarifeSurumNo ? ` (s.${veri.tarifeSurumNo})` : ""}`}
            />
          ) : null}
        </dl>

        {/* Hesap dökümü: personel müşteriye açıklayabilsin diye şeffaf. */}
        {veri.dokum.length > 0 && !veri.abonmanKapsaminda ? (
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Hesap
            </div>
            <ul className="space-y-1 text-sm">
              {veri.dokum.map((d, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-slate-600">{d.aciklama}</span>
                  <span className="rakam shrink-0 font-semibold text-lacivert-700">
                    <Tutar kurus={d.tutar} boyut="kucuk" simge={false} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl bg-lacivert-600 px-4 py-4 text-center text-white">
          <div className="text-[11px] font-bold uppercase tracking-wide text-mavi-200">
            {veri.tutar === 0 ? "Tahsil edilecek tutar yok" : "Tahsil edilecek"}
          </div>
          <div className="mt-1" data-test="odenecek-tutar">
            <Tutar kurus={veri.tutar} boyut="buyuk" />
          </div>
        </div>
      </div>

      {/* 5. ADIM: nakit veya kart */}
      {veri.tutar > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="basari"
            size="islem"
            onClick={() => tahsilEt("CASH")}
            disabled={mesgul}
            data-test="nakit"
          >
            {mesgul ? "…" : "💵 NAKİT"}
          </Button>
          <Button
            variant="ikincil"
            size="islem"
            onClick={() => tahsilEt("CARD")}
            disabled={mesgul}
            data-test="kart"
          >
            {mesgul ? "…" : "💳 KART"}
          </Button>
        </div>
      ) : (
        <Button
          variant="basari"
          size="islem"
          tamGenislik
          onClick={() => tahsilEt("CASH")}
          disabled={mesgul}
          data-test="cikisi-tamamla"
        >
          {mesgul ? "…" : "✓ ÇIKIŞI TAMAMLA"}
        </Button>
      )}

      <Button variant="sade" size="ikincil" tamGenislik onClick={vazgec} disabled={mesgul}>
        Vazgeç
      </Button>

      {veri.tutar > 0 ? (
        <p className="pb-2 text-center text-xs text-slate-400">
          Kart ödemeleri elle kaydedilir; sistemde POS bağlantısı yoktur.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ONAY EKRANLARI - 7. adim
// ---------------------------------------------------------------------------
function GirisOnayEkrani({ veri, kapat }: { veri: GirisOnayVerisi; kapat: () => void }) {
  const abonmanSorunlu =
    veri.abonmanDurumu === "SURESI_DOLMUS" || veri.abonmanDurumu === "IPTAL_VEYA_ASKIDA";

  return (
    <div
      className="rounded-2xl border-2 border-green-300 bg-basari-acik p-5 text-center"
      role="status"
      data-test="giris-onay"
    >
      <div className="text-5xl" aria-hidden>
        ✓
      </div>
      <div className="mt-2 text-2xl font-extrabold text-green-900">GİRİŞ ALINDI</div>
      <div className="mt-3 font-mono text-3xl font-bold tracking-wider text-lacivert-800">
        {veri.plakaGosterim}
      </div>
      <div className="mt-1 text-sm text-green-900">
        {veri.aracSinifiAdi} · Giriş {veri.girisAt}
      </div>
      <div className="mt-1 text-xs text-green-800">Fiş no: {veri.kod}</div>

      {veri.abonmanlimi ? (
        <div className="mt-4">
          <Rozet tur="basari">ABONMANLI</Rozet>
          {veri.abonmanMusteriAdi ? (
            <div className="mt-1 font-semibold text-green-900">{veri.abonmanMusteriAdi}</div>
          ) : null}
        </div>
      ) : null}

      {veri.abonmanUyari ? (
        <Alert
          tur={abonmanSorunlu ? "uyari" : "bilgi"}
          baslik={veri.abonmanUyari}
          className="mt-4 text-left"
        />
      ) : null}

      {veri.tarifeTanimsiz ? (
        <Alert tur="uyari" baslik="Tarife tanımlı değil" className="mt-3 text-left">
          Çıkışta ücret hesaplanamayacak. Patron panelinden tarife girilmeli.
        </Alert>
      ) : null}

      <Button variant="birincil" size="islem" tamGenislik className="mt-5" onClick={kapat}>
        YENİ İŞLEM
      </Button>
    </div>
  );
}

function CikisOnayEkrani({ veri, kapat }: { veri: CikisOnayVerisi; kapat: () => void }) {
  const tahsilatVar = veri.odenenTutar > 0;

  return (
    <div
      className="rounded-2xl border-2 border-green-300 bg-basari-acik p-5 text-center"
      role="status"
      data-test="cikis-onay"
    >
      <div className="text-5xl" aria-hidden>
        ✓
      </div>
      <div className="mt-2 text-2xl font-extrabold text-green-900">
        {tahsilatVar ? "TAHSİL EDİLDİ" : "ÇIKIŞ TAMAMLANDI"}
      </div>

      {tahsilatVar ? (
        <div className="mt-3" data-test="onay-tutar">
          <Tutar kurus={veri.odenenTutar} boyut="buyuk" />
          <div className="mt-1 text-sm font-bold text-green-900">
            {veri.odemeYontemi === "CASH" ? "Nakit" : "Kart"}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-base font-semibold text-green-900">
          {veri.abonmanKapsaminda ? "Abonman kapsamında — ücret alınmadı" : "Ücret alınmadı"}
        </div>
      )}

      <div className="mt-4 font-mono text-2xl font-bold tracking-wider text-lacivert-800">
        {veri.plakaGosterim}
      </div>
      <div className="mt-1 text-sm text-green-900">{formatDuration(veri.sureDakika)}</div>
      <div className="mt-1 text-xs text-green-800">
        Fiş no: {veri.kod}
        {veri.tahsilatKodu ? ` · Tahsilat: ${veri.tahsilatKodu}` : ""}
      </div>

      {veri.tarifeTanimsiz ? (
        <Alert tur="uyari" baslik="Tarife tanımlı olmadığı için ücret hesaplanamadı" className="mt-4 text-left" />
      ) : null}

      <Button variant="birincil" size="islem" tamGenislik className="mt-5" onClick={kapat}>
        YENİ İŞLEM
      </Button>
    </div>
  );
}

function Satir({
  etiket,
  deger,
  vurgulu,
}: {
  etiket: string;
  deger: string;
  vurgulu?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{etiket}</dt>
      <dd
        className={
          vurgulu ? "text-right text-lg font-bold text-lacivert-700" : "text-right font-semibold text-lacivert-700"
        }
      >
        {deger}
      </dd>
    </div>
  );
}
