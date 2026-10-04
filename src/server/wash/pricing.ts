/**
 * OTO YIKAMA FIYAT COZUMLEME
 *
 * ============================================================================
 * OTOPARK TARIFESINDEN TAMAMEN AYRIDIR
 * ----------------------------------------------------------------------------
 * Bu dosya `src/server/pricing/**` ile HICBIR SEY PAYLASMAZ: ne tablo, ne
 * fonksiyon, ne snapshot. Sebebi isletme karari (04.10.2026):
 *
 *   - Normal otoparkta ARAC SINIFINA GORE FIYAT FARKI YOKTUR.
 *   - Oto yikamada fiyat ARAC TIPINE GORE DEGISIR.
 *
 * Iki fiyatlandirmanin ayri kalmasi, birinde yapilan degisikligin digerini
 * kazara etkilemesini imkansiz kilar. Otopark tarifesi degistiginde yikama
 * fiyatlari degismez; yikama fiyati degistiginde park ucretleri degismez.
 *
 * ABONMAN INDIRIMI YOKTUR (karar 04.10.2026): bu dosya abonman tablolarina
 * hic bakmaz. Abonmanli musterinin yikama ucreti ile abonmansiz musterinin
 * ucreti aynidir.
 *
 * FIYAT KODA SABITLENMEZ: tum fiyatlar WashServicePriceVersion kayitlarindan
 * gelir ve patron panelinden degistirilir. Burada hicbir sayisal fiyat yoktur.
 * ============================================================================
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db";
import { toKurus } from "@/lib/money";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface YikamaFiyati {
  washServiceId: string;
  hizmetAdi: string;
  priceVersionId: string;
  fiyatKurus: number;
  /** Fiyat bu arac sinifina OZEL mi, yoksa genel fiyat mi? */
  sinifaOzelMi: boolean;
}

/**
 * Bir hizmetin, belirli bir arac sinifi icin, belirli bir andaki fiyatini
 * cozumler.
 *
 * Sira: once ARAC SINIFINA OZEL fiyat, yoksa GENEL fiyat (vehicleClassId null).
 * Ikisi de yoksa null doner - bu bir hata degildir, "patron bu hizmet icin bu
 * sinifa fiyat girmemis" demektir. Cagiran taraf ya islemi reddeder ya da
 * personelden acik onay ister; SESSIZCE baska bir sinifin fiyati kullanilmaz.
 */
export async function cozumleYikamaFiyati(
  washServiceId: string,
  vehicleClassId: string,
  anında: Date = new Date(),
  db: DbClient = prisma,
): Promise<YikamaFiyati | null> {
  const surumler = await db.washServicePriceVersion.findMany({
    where: {
      washServiceId,
      effectiveFrom: { lte: anında },
      washService: { isActive: true },
      // Iki bagimsiz "veya" kosulu: surum hala gecerli olmali VE fiyat ya
      // bu sinifa ozel ya da genel olmali. Ayni nesnede iki OR olamaz,
      // bu yuzden AND ile ifade edilir.
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gt: anında } }] },
        { OR: [{ vehicleClassId }, { vehicleClassId: null }] },
      ],
    },
    include: { washService: { select: { name: true } } },
    orderBy: { effectiveFrom: "desc" },
  });

  if (surumler.length === 0) return null;

  // Sinifa ozel fiyat genel fiyati EZER.
  const secilen =
    surumler.find((v) => v.vehicleClassId === vehicleClassId) ??
    surumler.find((v) => v.vehicleClassId === null);
  if (!secilen) return null;

  return {
    washServiceId,
    hizmetAdi: secilen.washService.name,
    priceVersionId: secilen.id,
    fiyatKurus: toKurus(secilen.price),
    sinifaOzelMi: secilen.vehicleClassId === vehicleClassId,
  };
}

/**
 * Bir arac sinifi icin TUM aktif hizmetlerin fiyat listesi.
 *
 * Personel ekraninda yikama olustururken gosterilir. Fiyati tanimsiz hizmetler
 * de listede kalir ama `fiyatKurus: null` ile isaretlenir: personel "bu
 * hizmetin fiyati girilmemis" oldugunu gorur, 0 TL sanmaz.
 */
export async function sinifIcinFiyatListesi(
  vehicleClassId: string,
  anında: Date = new Date(),
  db: DbClient = prisma,
) {
  const hizmetler = await db.washServiceCatalog.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const sonuc: {
    washServiceId: string;
    kod: string;
    ad: string;
    aciklama: string | null;
    tahminiDakika: number | null;
    fiyatKurus: number | null;
    priceVersionId: string | null;
    sinifaOzelMi: boolean;
  }[] = [];

  for (const h of hizmetler) {
    const fiyat = await cozumleYikamaFiyati(h.id, vehicleClassId, anında, db);
    sonuc.push({
      washServiceId: h.id,
      kod: h.code,
      ad: h.name,
      aciklama: h.description,
      tahminiDakika: h.estimatedMinutes,
      fiyatKurus: fiyat?.fiyatKurus ?? null,
      priceVersionId: fiyat?.priceVersionId ?? null,
      sinifaOzelMi: fiyat?.sinifaOzelMi ?? false,
    });
  }

  return sonuc;
}

/**
 * Fiyat tablosu: satirlar hizmet, kolonlar arac sinifi.
 *
 * Patron panelindeki fiyat duzenleme ekranini ve personelin gordugu fiyat
 * listesini besler. Hucre bos olabilir (fiyat tanimsiz) - uydurulmaz.
 */
export async function yikamaFiyatTablosu(anında: Date = new Date(), db: DbClient = prisma) {
  const [hizmetler, siniflar] = await Promise.all([
    db.washServiceCatalog.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const surumler = await db.washServicePriceVersion.findMany({
    where: {
      effectiveFrom: { lte: anında },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: anında } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });

  /** "hizmetId|sinifId" -> gecerli fiyat. */
  const harita = new Map<string, { fiyatKurus: number; priceVersionId: string }>();
  for (const v of surumler) {
    const anahtar = `${v.washServiceId}|${v.vehicleClassId ?? "GENEL"}`;
    // orderBy desc oldugu icin ilk gorulen en yeni gecerli surumdur.
    if (!harita.has(anahtar)) {
      harita.set(anahtar, { fiyatKurus: toKurus(v.price), priceVersionId: v.id });
    }
  }

  return {
    siniflar: siniflar.map((s) => ({ id: s.id, kod: s.code, ad: s.name })),
    hizmetler: hizmetler.map((h) => ({
      id: h.id,
      kod: h.code,
      ad: h.name,
      aciklama: h.description,
      tahminiDakika: h.estimatedMinutes,
      aktif: h.isActive,
      siteGorunur: h.isPublicOnWebsite,
      siraNo: h.sortOrder,
      genelFiyatKurus: harita.get(`${h.id}|GENEL`)?.fiyatKurus ?? null,
      sinifFiyatlari: Object.fromEntries(
        siniflar.map((s) => [s.id, harita.get(`${h.id}|${s.id}`)?.fiyatKurus ?? null]),
      ) as Record<string, number | null>,
    })),
  };
}
