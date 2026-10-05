/**
 * CSV DISA AKTARMA UC NOKTASI
 *
 * ============================================================================
 * GUVENLIK: Bu bir Route Handler'dir ve (panel) layout'undan GECMEZ - yani
 * layout'taki patron kontrolu BURADA UYGULANMAZ. Yetki bu dosyada ayrica
 * zorunlu kilinir (`finance.report.export`). Aksi halde dogrudan URL'e giden
 * herkes finansal veriyi indirebilirdi.
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermission, AuthenticationError, AuthorizationError } from "@/server/auth/authz";
import { businessDayRange } from "@/lib/datetime";
import {
  csvDosyaAdi,
  digerGelirlerCsv,
  finansRaporuCsv,
  giderlerCsv,
} from "@/server/finance/export";
import {
  aylikFinansRaporu,
  digerGelirListesi,
  finansRaporu,
  giderListesi,
  gunlukFinansRaporu,
} from "@/server/finance/queries";

export const dynamic = "force-dynamic";

export async function GET(istek: Request) {
  try {
    await requirePermission(PERMISSIONS.FINANCE_REPORT_EXPORT);
  } catch (hata) {
    if (hata instanceof AuthenticationError) {
      return NextResponse.json({ hata: hata.message }, { status: 401 });
    }
    if (hata instanceof AuthorizationError) {
      return NextResponse.json({ hata: hata.message }, { status: 403 });
    }
    throw hata;
  }

  const url = new URL(istek.url);
  const tur = url.searchParams.get("tur") ?? "ozet";
  const donem = url.searchParams.get("donem") ?? "ay";

  let icerik: string;
  let onEk: string;

  if (tur === "gider") {
    const { start } = businessDayRange();
    const baslangic =
      donem === "gun" ? start : new Date(Date.now() - 90 * 86_400_000);
    icerik = giderlerCsv(await giderListesi({ baslangic, limit: 1000 }));
    onEk = "gider";
  } else if (tur === "gelir") {
    const baslangic = new Date(Date.now() - 90 * 86_400_000);
    icerik = digerGelirlerCsv(await digerGelirListesi({ baslangic, limit: 1000 }));
    onEk = "diger-gelir";
  } else {
    const rapor =
      donem === "gun"
        ? await gunlukFinansRaporu()
        : donem === "yil"
          ? await finansRaporu(
              businessDayRange(new Date(new Date().getFullYear(), 0, 1)).start,
              businessDayRange().end,
            )
          : await aylikFinansRaporu();
    icerik = finansRaporuCsv(rapor);
    onEk = `gelir-gider-${donem}`;
  }

  return new NextResponse(icerik, {
    status: 200,
    headers: {
      // charset=utf-8 + dosyadaki BOM: Excel tr-TR'de karakterler bozulmaz.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvDosyaAdi(onEk)}"`,
      // Finansal veri onbellege alinmaz.
      "Cache-Control": "no-store",
    },
  });
}
