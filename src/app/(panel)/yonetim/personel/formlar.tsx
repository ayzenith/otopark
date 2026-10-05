"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, Input } from "@/components/ui";
import { formatKurus } from "@/lib/money";
import {
  avansIptalAction,
  avansVerAction,
  izinAyarlaAction,
  maasOdeAction,
  parolaSifirlaAction,
  personelDurumAction,
  personelGuncelleAction,
  personelOlusturAction,
  profilKaydetAction,
} from "@/server/actions/personel";

function anahtar(onEk: string): string {
  return `${onEk}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function bugun(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul" }).format(new Date());
}

const SELECT_SINIFI =
  "h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-lacivert-800";

const ETIKET_SINIFI =
  "mb-1.5 block text-[13px] font-bold uppercase tracking-wide text-slate-600";

// ---------------------------------------------------------------------------
// HESAP AÇ
// ---------------------------------------------------------------------------

/**
 * PERSONEL HESABI AÇMA
 *
 * Başlangıç parolası sunucuda GÜVENLİ RASTGELE üretilir ve BİR KEZ gösterilir;
 * veritabanında yalnızca Argon2id özeti durur. Personel ilk girişte parolayı
 * değiştirmek ZORUNDADIR.
 *
 * Rol seçimi yalnızca Patron / Personel: MANAGER rolü karar gereği (05.10.2026)
 * aktif edilmedi.
 */
export function PersonelEkleFormu() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{
    kullaniciAdi: string;
    parola: string;
    uretildiMi: boolean;
  } | null>(null);
  const [bekliyor, basla] = useTransition();

  // Parola BİR KEZ gösterilir; sayfa tazelenirse kaybolur, bu yüzden
  // tazeleme personelin "ANLADIM" dokunuşuyla yapılır.
  if (sonuc) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hesap açıldı — parolayı şimdi iletin</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Alert tur="uyari" baslik="Bu parola bir daha gösterilmeyecek">
            Sistemde yalnızca şifrelenmiş özeti saklanıyor. Personel ilk girişte kendi
            parolasını belirleyecek.
          </Alert>
          <div className="rounded-xl border-2 border-lacivert-300 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Kullanıcı adı</div>
            <div className="rakam text-lg font-extrabold text-lacivert-800" data-test="yeni-kullanici-adi">
              {sonuc.kullaniciAdi}
            </div>
            <div className="mt-3 text-sm text-slate-500">Başlangıç parolası</div>
            <div className="rakam select-all break-all text-lg font-extrabold text-lacivert-800" data-test="yeni-parola">
              {sonuc.parola}
            </div>
          </div>
          <Button
            variant="birincil"
            size="ikincil"
            tamGenislik
            data-test="personel-parola-anladim"
            onClick={() => {
              setSonuc(null);
              setAcik(false);
              router.refresh();
            }}
          >
            PAROLAYI İLETTİM
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!acik) {
    return (
      <Button
        variant="birincil"
        size="islem"
        tamGenislik
        onClick={() => setAcik(true)}
        data-test="personel-ekle-ac"
      >
        + PERSONEL EKLE
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni personel hesabı</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            basla(async () => {
              const cevap = await personelOlusturAction(formData);
              if (!cevap.ok) {
                setHata(cevap.error);
                return;
              }
              setSonuc({
                kullaniciAdi: cevap.data.kullaniciAdi,
                parola: cevap.data.baslangicParolasi,
                uretildiMi: cevap.data.uretildiMi,
              });
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          <Input
            name="adSoyad"
            etiket="Ad soyad"
            required
            autoComplete="off"
            data-test="personel-ad"
          />
          <Input
            name="kullaniciAdi"
            etiket="Kullanıcı adı"
            required
            autoComplete="off"
            yardim="3–32 karakter; harf, rakam ve alt çizgi. Türkçe karakterler çevrilir."
            data-test="personel-kullanici-adi"
          />
          <div>
            <label htmlFor="personel-rol" className={ETIKET_SINIFI}>
              Rol
            </label>
            <select id="personel-rol" name="rol" className={SELECT_SINIFI} data-test="personel-rol">
              <option value="STAFF">Personel</option>
              <option value="OWNER">İşletme sahibi (patron)</option>
            </select>
            <p className="mt-1 text-sm text-slate-500">
              Vardiya sorumlusu (müdür) rolü şu anda kullanılmıyor. Belirli bir personele
              ek yetki vermek için hesabı açtıktan sonra yetki listesini kullanın.
            </p>
          </div>
          <Input name="gorevUnvani" etiket="Görev unvanı (isteğe bağlı)" />
          <Input name="telefon" etiket="Telefon (isteğe bağlı)" inputMode="tel" />
          <Input
            name="baslangicParolasi"
            etiket="Başlangıç parolası (isteğe bağlı)"
            autoComplete="new-password"
            yardim="Boş bırakırsanız güvenli bir parola üretilir ve bir kez gösterilir."
            data-test="personel-parola"
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="personel-kaydet"
            >
              {bekliyor ? "Açılıyor…" : "HESAP AÇ"}
            </Button>
            <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DURUM / PAROLA
// ---------------------------------------------------------------------------

export function PersonelDurumButonu({
  userId,
  aktif,
  adSoyad,
}: {
  userId: string;
  aktif: boolean;
  adSoyad: string;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="text-xs font-bold uppercase text-slate-500"
        data-test={`durum-ac-${userId}`}
      >
        {aktif ? "Hesabı kapat" : "Hesabı geri aç"}
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      action={(formData) => {
        setHata(null);
        formData.set("userId", userId);
        if (!aktif) formData.set("aktif", "on");
        basla(async () => {
          const cevap = await personelDurumAction(formData);
          if (!cevap.ok) setHata(cevap.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {aktif ? (
        <Alert tur="uyari" baslik={`${adSoyad} hesabı kapatılacak`}>
          Açık oturumları da sonlandırılır; işlem geçmişi ve tahsilatları olduğu gibi kalır.
        </Alert>
      ) : null}
      <Input name="sebep" etiket="Gerekçe (isteğe bağlı)" />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="submit"
          variant={aktif ? "tehlike" : "basari"}
          size="normal"
          disabled={bekliyor}
          data-test={`durum-kaydet-${userId}`}
        >
          {bekliyor ? "…" : aktif ? "Kapat" : "Geri aç"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function ParolaSifirlaButonu({ userId }: { userId: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [parola, setParola] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (parola) {
    return (
      <div className="mt-2 space-y-2">
        <Alert tur="uyari" baslik="Yeni parola bir daha gösterilmeyecek">
          <span className="rakam select-all break-all font-extrabold" data-test={`yeni-parola-${userId}`}>
            {parola}
          </span>
        </Alert>
        <Button
          variant="birincil"
          size="normal"
          onClick={() => {
            setParola(null);
            setAcik(false);
            router.refresh();
          }}
        >
          İLETTİM
        </Button>
      </div>
    );
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="text-xs font-bold uppercase text-slate-500"
        data-test={`parola-ac-${userId}`}
      >
        Parolayı sıfırla
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      action={(formData) => {
        setHata(null);
        formData.set("userId", userId);
        basla(async () => {
          const cevap = await parolaSifirlaAction(formData);
          if (!cevap.ok) setHata(cevap.error);
          else setParola(cevap.data.parola);
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Alert tur="bilgi" baslik="Açık oturumlar kapatılır">
        Personel ilk girişte kendi parolasını belirleyecek.
      </Alert>
      <Input
        name="yeniParola"
        etiket="Yeni parola (boş = otomatik üret)"
        autoComplete="new-password"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="submit"
          variant="uyari"
          size="normal"
          disabled={bekliyor}
          data-test={`parola-kaydet-${userId}`}
        >
          {bekliyor ? "…" : "Sıfırla"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

export function PersonelDuzenleFormu({
  userId,
  adSoyad,
  gorevUnvani,
  telefon,
  rol,
}: {
  userId: string;
  adSoyad: string;
  gorevUnvani: string | null;
  telefon: string | null;
  rol: string;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button variant="sade" size="ikincil" tamGenislik onClick={() => setAcik(true)}>
        Bilgileri düzenle
      </Button>
    );
  }

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        formData.set("userId", userId);
        basla(async () => {
          const cevap = await personelGuncelleAction(formData);
          if (!cevap.ok) setHata(cevap.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="adSoyad" etiket="Ad soyad" defaultValue={adSoyad} required />
      <Input name="gorevUnvani" etiket="Görev unvanı" defaultValue={gorevUnvani ?? ""} />
      <Input name="telefon" etiket="Telefon" defaultValue={telefon ?? ""} inputMode="tel" />
      <div>
        <label htmlFor="duzenle-rol" className={ETIKET_SINIFI}>
          Rol
        </label>
        <select id="duzenle-rol" name="rol" defaultValue={rol} className={SELECT_SINIFI}>
          <option value="STAFF">Personel</option>
          <option value="OWNER">İşletme sahibi (patron)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" variant="birincil" size="ikincil" disabled={bekliyor}>
          {bekliyor ? "Kaydediliyor…" : "KAYDET"}
        </Button>
        <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// İZİNLER
// ---------------------------------------------------------------------------

/**
 * İZİN ANAHTARI
 *
 * Üç durum vardır ve ekranda açıkça ayrılır:
 *   · Rolden geliyor / rolde yok  (taban)
 *   · Ek verildi                  (sapma = true)
 *   · Kaldırıldı                  (sapma = false)
 *
 * "Kasa kapatma" izni bu mekanizmanın ilk gerçek kullanımıdır: personel
 * rolünde yoktur, patron tek tek verir (karar 05.10.2026).
 */
export function IzinAnahtari({
  userId,
  izin,
  etiket,
  tabanda,
  sapma,
  etkin,
}: {
  userId: string;
  izin: string;
  etiket: string;
  tabanda: boolean;
  sapma: boolean | null;
  etkin: boolean;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function ayarla(durum: "ver" | "kaldir" | "taban") {
    basla(async () => {
      setHata(null);
      const cevap = await izinAyarlaAction({ userId, izin, durum });
      if (!cevap.ok) setHata(cevap.error);
      else router.refresh();
    });
  }

  return (
    <li className="py-2.5">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-lacivert-800">{etiket}</div>
          <div className="font-mono text-[11px] text-slate-400">{izin}</div>
          <div className="text-xs text-slate-500">
            {sapma === null
              ? tabanda
                ? "Rolden geliyor"
                : "Rolde yok"
              : sapma
                ? "Ek olarak verildi"
                : "Kaldırıldı"}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={bekliyor || etkin}
            onClick={() => ayarla("ver")}
            className={`h-12 rounded-lg px-3 text-xs font-bold uppercase ${
              etkin ? "bg-basari-acik text-green-900" : "border border-slate-300 text-slate-600"
            } disabled:opacity-60`}
            data-test={`izin-ver-${izin}`}
          >
            {etkin ? "✓ var" : "ver"}
          </button>
          <button
            type="button"
            disabled={bekliyor || !etkin}
            onClick={() => ayarla("kaldir")}
            className="h-12 rounded-lg border border-slate-300 px-3 text-xs font-bold uppercase text-slate-600 disabled:opacity-60"
            data-test={`izin-kaldir-${izin}`}
          >
            kaldır
          </button>
          {sapma !== null ? (
            <button
              type="button"
              disabled={bekliyor}
              onClick={() => ayarla("taban")}
              className="h-12 rounded-lg border border-slate-300 px-3 text-xs font-bold uppercase text-slate-600 disabled:opacity-60"
              data-test={`izin-taban-${izin}`}
            >
              role dön
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MALİYET PROFİLİ
// ---------------------------------------------------------------------------

/**
 * MAAŞ / SGK / YEMEK — YALNIZCA PATRON.
 *
 * Boş bırakılan alan 0 ₺ DEĞİL "girilmedi"dir: sistem maaş uydurmaz.
 */
export function MaliyetFormu({
  userId,
  maasKurus,
  sgkKurus,
  yemekKurus,
  iseGirisAt,
  ayrilisAt,
  not,
}: {
  userId: string;
  maasKurus: number | null;
  sgkKurus: number | null;
  yemekKurus: number | null;
  iseGirisAt: string | null;
  ayrilisAt: string | null;
  not: string | null;
}) {
  const router = useRouter();
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const lira = (kurus: number | null) => (kurus === null ? "" : (kurus / 100).toFixed(2).replace(".", ","));

  return (
    <form
      className="space-y-3"
      action={(formData) => {
        setHata(null);
        setBasari(null);
        formData.set("userId", userId);
        basla(async () => {
          const cevap = await profilKaydetAction(formData);
          if (!cevap.ok) setHata(cevap.error);
          else {
            setBasari("Maliyet bilgileri kaydedildi.");
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      {basari ? <Alert tur="basari" baslik={basari} data-test="maliyet-basari" /> : null}
      <Alert tur="bilgi" baslik="Bu bilgileri yalnızca siz görüyorsunuz">
        Personelin kendi ekranında maaş bilgisi görünmez. Boş bıraktığınız alan
        &quot;girilmedi&quot; sayılır, 0 ₺ olarak kaydedilmez.
      </Alert>
      <Input
        name="maas"
        etiket="Aylık maaş (₺)"
        inputMode="decimal"
        defaultValue={lira(maasKurus)}
        data-test="maliyet-maas"
      />
      <Input name="sgk" etiket="SGK / sigorta (₺)" inputMode="decimal" defaultValue={lira(sgkKurus)} />
      <Input name="yemek" etiket="Yemek (₺)" inputMode="decimal" defaultValue={lira(yemekKurus)} />
      <Input
        name="iseGirisTarihi"
        etiket="İşe giriş tarihi"
        type="date"
        defaultValue={iseGirisAt ?? ""}
      />
      <Input
        name="ayrilisTarihi"
        etiket="Ayrılış tarihi (varsa)"
        type="date"
        defaultValue={ayrilisAt ?? ""}
      />
      <Input name="not" etiket="Not" defaultValue={not ?? ""} />
      <Button
        type="submit"
        variant="birincil"
        size="ikincil"
        tamGenislik
        disabled={bekliyor}
        data-test="maliyet-kaydet"
      >
        {bekliyor ? "Kaydediliyor…" : "KAYDET"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// AVANS
// ---------------------------------------------------------------------------

/**
 * AVANS VER
 *
 * Avans GİDER DEĞİLDİR: kasadan para çıkar, işletmenin alacağı olur ve maaş
 * ödemesinde mahsup edilir. Bu ekranda açıkça yazılı.
 */
export function AvansFormu({
  personeller,
  seciliUserId,
}: {
  personeller: { id: string; ad: string; acikAvansKurus: number }[];
  seciliUserId?: string;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (personeller.length === 0) {
    return (
      <Alert tur="bilgi" baslik="Avans vermek için personel hesabı gerekiyor">
        Önce personel ekleyin.
      </Alert>
    );
  }

  if (!acik) {
    return (
      <div className="space-y-2">
        {basari ? <Alert tur="basari" baslik={basari} data-test="avans-basari" /> : null}
        <Button
          variant="sade"
          size="ikincil"
          tamGenislik
          onClick={() => setAcik(true)}
          data-test="avans-ac"
        >
          + Personel avansı ver
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personel avansı</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("idempotencyKey", anahtar("avans"));
            basla(async () => {
              const cevap = await avansVerAction(formData);
              if (!cevap.ok) {
                setHata(cevap.error);
                return;
              }
              setBasari(
                `Avans kaydedildi (${cevap.data.kod}). Açık avans borcu: ` +
                  `${formatKurus(cevap.data.acikBakiyeKurus)}`,
              );
              setAcik(false);
              router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}
          <Alert tur="bilgi" baslik="Avans gider değildir">
            Kasadan para çıkar ama gider raporuna girmez; işletmenin alacağı olarak
            izlenir ve maaş ödemesinde mahsup edilir.
          </Alert>

          <div>
            <label htmlFor="avans-personel" className={ETIKET_SINIFI}>
              Personel
            </label>
            <select
              id="avans-personel"
              name="userId"
              defaultValue={seciliUserId}
              className={SELECT_SINIFI}
              data-test="avans-personel"
            >
              {personeller.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad}
                  {p.acikAvansKurus > 0 ? ` — açık: ${formatKurus(p.acikAvansKurus)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <Input name="tutar" etiket="Avans tutarı (₺)" inputMode="decimal" required data-test="avans-tutar" />
          <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
            <input
              type="checkbox"
              name="kasadanVerildi"
              defaultChecked
              className="h-6 w-6"
              data-test="avans-kasadan"
            />
            <span className="text-sm text-lacivert-800">
              Kasadan verildi{" "}
              <span className="text-slate-500">(açık kasa varsa beklenen nakit azalır)</span>
            </span>
          </label>
          <Input name="not" etiket="Not (isteğe bağlı)" />

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="avans-kaydet"
            >
              {bekliyor ? "Kaydediliyor…" : "AVANS VER"}
            </Button>
            <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function AvansIptalButonu({ id }: { id: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => setAcik(true)}
        className="mt-1 text-xs font-bold uppercase text-hata"
        data-test={`avans-iptal-ac-${id}`}
      >
        İptal et
      </button>
    );
  }

  return (
    <form
      className="mt-2 space-y-2"
      action={(formData) => {
        setHata(null);
        formData.set("staffAdvanceId", id);
        basla(async () => {
          const cevap = await avansIptalAction(formData);
          if (!cevap.ok) setHata(cevap.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Input name="sebep" etiket="İptal gerekçesi (zorunlu)" required />
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="tehlike" size="normal" disabled={bekliyor}>
          {bekliyor ? "…" : "İptal et"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// MAAŞ ÖDEMESİ (avans mahsuplu)
// ---------------------------------------------------------------------------

/**
 * MAAŞ ÖDEMESİ
 *
 * Gider olarak MAAŞIN TAMAMI yazılır; seçilen avanslar mahsup edilir ve
 * kasadan o an çıkan para `maaş − mahsup` olur. Ekranda üç sayı da gösterilir
 * ki patron ne olduğunu görsün.
 */
export function MaasOdemeFormu({
  personeller,
}: {
  personeller: {
    id: string;
    ad: string;
    maasKurus: number | null;
    acikAvanslar: { id: string; kod: string; tutar: number }[];
  }[];
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [personelId, setPersonelId] = useState(personeller[0]?.id ?? "");
  const [maasMetni, setMaasMetni] = useState("");
  const [secilen, setSecilen] = useState<Set<string>>(new Set());
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  const personel = personeller.find((p) => p.id === personelId);

  // Maaş alanı boşsa profildeki maaş ön dolu gelir; profil de boşsa BOŞ kalır
  // (sistem maaş uydurmaz).
  const maasKurus = (() => {
    const temiz = maasMetni.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const sayi = Number(temiz);
    if (maasMetni.trim() !== "" && Number.isFinite(sayi) && sayi > 0) {
      return Math.round(sayi * 100);
    }
    return null;
  })();

  const mahsupKurus = (personel?.acikAvanslar ?? [])
    .filter((a) => secilen.has(a.id))
    .reduce((t, a) => t + a.tutar, 0);

  const odenecek = maasKurus === null ? null : maasKurus - mahsupKurus;

  function personelDegis(id: string) {
    setPersonelId(id);
    // Avans seçimi personele özeldir: değişince temizlenir, yoksa başka
    // personelin avansı mahsup edilmeye çalışılır (sunucu reddeder).
    setSecilen(new Set());
    const yeni = personeller.find((p) => p.id === id);
    setMaasMetni(yeni?.maasKurus != null ? (yeni.maasKurus / 100).toFixed(2).replace(".", ",") : "");
  }

  if (personeller.length === 0) {
    return (
      <Alert tur="bilgi" baslik="Maaş ödemesi için personel hesabı gerekiyor">
        Önce personel ekleyin.
      </Alert>
    );
  }

  if (!acik) {
    return (
      <div className="space-y-2">
        {basari ? <Alert tur="basari" baslik={basari} data-test="maas-basari" /> : null}
        <Button
          variant="sade"
          size="ikincil"
          tamGenislik
          onClick={() => {
            setAcik(true);
            personelDegis(personelId || personeller[0]!.id);
          }}
          data-test="maas-ac"
        >
          + Maaş ödemesi
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maaş ödemesi</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="space-y-3"
          action={(formData) => {
            setHata(null);
            setBasari(null);
            formData.set("userId", personelId);
            formData.set("maas", maasMetni);
            formData.set("mahsupAvansIdleri", [...secilen].join(","));
            formData.set("idempotencyKey", anahtar("maas"));
            basla(async () => {
              const cevap = await maasOdeAction(formData);
              if (!cevap.ok) {
                setHata(cevap.error);
                return;
              }
              setBasari(
                `Maaş gideri ${formatKurus(cevap.data.giderKurus)} kaydedildi; ` +
                  `${formatKurus(cevap.data.mahsupKurus)} avans mahsup edildi, ` +
                  `${formatKurus(cevap.data.odenenKurus)} ödendi (${cevap.data.kod}).`,
              );
              setAcik(false);
              setSecilen(new Set());
              router.refresh();
            });
          }}
        >
          {hata ? <Alert tur="hata" baslik={hata} /> : null}

          <div>
            <label htmlFor="maas-personel" className={ETIKET_SINIFI}>
              Personel
            </label>
            <select
              id="maas-personel"
              value={personelId}
              onChange={(e) => personelDegis(e.target.value)}
              className={SELECT_SINIFI}
              data-test="maas-personel"
            >
              {personeller.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ad}
                </option>
              ))}
            </select>
          </div>

          <Input
            name="maasGosterim"
            etiket="Maaş tutarı (₺) — giderin tamamı"
            inputMode="decimal"
            required
            value={maasMetni}
            onChange={(e) => setMaasMetni(e.target.value)}
            yardim="Profilde maaş kayıtlıysa ön dolu gelir; değiştirebilirsiniz."
            data-test="maas-tutar"
          />

          {/* --- AVANS MAHSUBU --- */}
          {personel && personel.acikAvanslar.length > 0 ? (
            <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-3">
              <div className={ETIKET_SINIFI}>Mahsup edilecek avanslar</div>
              <ul className="space-y-2">
                {personel.acikAvanslar.map((a) => (
                  <li key={a.id}>
                    <label className="flex min-h-12 items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-6 w-6"
                        checked={secilen.has(a.id)}
                        onChange={(e) => {
                          const yeni = new Set(secilen);
                          if (e.target.checked) yeni.add(a.id);
                          else yeni.delete(a.id);
                          setSecilen(yeni);
                        }}
                        data-test={`mahsup-${a.id}`}
                      />
                      <span className="text-sm text-lacivert-800">
                        {a.kod} — <strong>{formatKurus(a.tutar)}</strong>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Bu personelin açık avansı yok.</p>
          )}

          {/* --- ÜÇ SAYI AÇIKÇA --- */}
          <dl className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Gider (maaşın tamamı)</dt>
              <dd className="rakam font-bold" data-test="maas-gider">
                {maasKurus === null ? "—" : formatKurus(maasKurus)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Avans mahsubu</dt>
              <dd className="rakam font-bold" data-test="maas-mahsup">
                {formatKurus(mahsupKurus)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1">
              <dt className="font-bold text-lacivert-700">Şimdi ödenecek</dt>
              <dd className="rakam font-extrabold text-lacivert-800" data-test="maas-odenecek">
                {odenecek === null ? "—" : formatKurus(odenecek)}
              </dd>
            </div>
          </dl>

          <Input
            name="odemeTarihi"
            etiket="Ödeme tarihi"
            type="date"
            defaultValue={bugun()}
            required
          />
          <div>
            <label htmlFor="maas-yontem" className={ETIKET_SINIFI}>
              Ödeme yöntemi
            </label>
            <select
              id="maas-yontem"
              name="odemeYontemi"
              className={SELECT_SINIFI}
              data-test="maas-yontem"
            >
              <option value="CASH">Nakit</option>
              <option value="TRANSFER">Havale / EFT</option>
              <option value="CARD">Kart</option>
              <option value="OTHER">Diğer</option>
            </select>
          </div>
          <Input name="aciklama" etiket="Açıklama (isteğe bağlı)" />
          <label className="flex min-h-12 items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3">
            <input type="checkbox" name="kasadanOdendi" defaultChecked className="h-6 w-6" />
            <span className="text-sm text-lacivert-800">
              Nakitse kasadan ödendi{" "}
              <span className="text-slate-500">(beklenen nakitten mahsup sonrası tutar düşer)</span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="submit"
              variant="birincil"
              size="ikincil"
              disabled={bekliyor}
              data-test="maas-kaydet"
            >
              {bekliyor ? "Kaydediliyor…" : "MAAŞ ÖDE"}
            </Button>
            <Button variant="sade" size="ikincil" onClick={() => setAcik(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
