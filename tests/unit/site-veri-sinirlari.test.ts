/**
 * SITE VERI SINIRLARI (Asama 7 tamamlanma kriteri)
 *
 * Kurumsal site HERKESE ACIKTIR: oturum sorulmaz. Bu yuzden public tarafin
 * musteri, abonman, tahsilat, kasa veya personel verisine ERISMEMESI gerekir.
 * Gozden kacan tek bir sorgu, plakalari ya da ciroyu internete acar.
 *
 * Bu test kaynak kodu TARAYARAK bunu garanti eder: `src/app/(site)` altindaki
 * dosyalar yalnizca site okuma katmanini (`@/server/site/queries`) ve saf
 * yardimcilari kullanabilir; `prisma` ya da baska bir sunucu modulu
 * ice aktaramaz.
 *
 * Yeni bir site sayfasi eklenirse bu test onu kendiliginde kapsar.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SITE_KLASORU = join(process.cwd(), "src/app/(site)");

/** Site tarafinin ice aktarmasina IZIN VERILEN moduller. */
const IZINLI_ICE_AKTARMALAR = [
  "react",
  "next",
  "next/link",
  "next/navigation",
  "@/server/site/queries",
  "@/lib/site-metin",
  "@/lib/telefon",
];

function tsxDosyalari(klasor: string): string[] {
  return readdirSync(klasor).flatMap((ad) => {
    const yol = join(klasor, ad);
    if (statSync(yol).isDirectory()) return tsxDosyalari(yol);
    return ad.endsWith(".tsx") || ad.endsWith(".ts") ? [yol] : [];
  });
}

function iceAktarmalar(kaynak: string): string[] {
  const sonuc: string[] = [];
  const kalip = /from\s+["']([^"']+)["']/g;
  let eslesme: RegExpExecArray | null;
  while ((eslesme = kalip.exec(kaynak)) !== null) sonuc.push(eslesme[1]!);
  return sonuc;
}

describe("kurumsal site veri sınırları", () => {
  const dosyalar = tsxDosyalari(SITE_KLASORU);

  it("site klasöründe en az bir sayfa vardır", () => {
    expect(dosyalar.length).toBeGreaterThan(0);
  });

  it("site dosyaları yalnızca izin verilen modülleri içe aktarır", () => {
    for (const dosya of dosyalar) {
      const kaynak = readFileSync(dosya, "utf8");
      for (const modul of iceAktarmalar(kaynak)) {
        // Ayni klasordeki goreli dosyalar (./metin gibi) serbesttir; onlar da
        // bu testin kapsaminda oldugu icin ayrica taranir.
        if (modul.startsWith(".")) continue;
        expect(
          IZINLI_ICE_AKTARMALAR.includes(modul),
          `${dosya} dosyası "${modul}" modülünü içe aktarıyor. Kurumsal site yalnızca ` +
            `@/server/site/queries üzerinden veri okuyabilir.`,
        ).toBe(true);
      }
    }
  });

  it("site dosyaları doğrudan prisma kullanmaz", () => {
    for (const dosya of dosyalar) {
      const kaynak = readFileSync(dosya, "utf8");
      expect(kaynak.includes("prisma."), `${dosya} doğrudan prisma sorgusu içeriyor`).toBe(false);
    }
  });

  it("site okuma katmanı müşteri/finans tablolarına dokunmaz", () => {
    const kaynak = readFileSync(join(process.cwd(), "src/server/site/queries.ts"), "utf8");

    const YASAKLI = [
      "prisma.customer",
      "prisma.subscription",
      "prisma.payment",
      "prisma.parkingSession",
      "prisma.cashDrawerSession",
      "prisma.cashMovement",
      "prisma.washJob",
      "prisma.user",
      "prisma.expense",
      "prisma.staffAdvance",
      "prisma.auditLog",
      "prisma.tariff",
    ];

    for (const yasak of YASAKLI) {
      expect(kaynak.includes(yasak), `site okuma katmanı ${yasak} kullanıyor`).toBe(false);
    }
  });
});
