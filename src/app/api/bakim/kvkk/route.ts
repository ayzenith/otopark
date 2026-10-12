import { NextResponse } from "next/server";
import { plakalariTemizle, PLAKA_SAKLAMA_AYI } from "@/server/privacy/retention";

export const dynamic = "force-dynamic";

/**
 * GECE BAKIMI — süresi geçmiş plakaların maskelenmesi (12.10.2026).
 *
 * Vercel Cron her gece bu adrese istek atar (`vercel.json` → crons) ve
 * `Authorization: Bearer <CRON_SECRET>` başlığını ekler.
 *
 * GÜVENLİK: `CRON_SECRET` ortam değişkeni GİRİLMEMİŞSE uç KAPALIDIR.
 * Açık bırakılsa internetten herkes tetikleyebilirdi; bu iş geri alınamaz
 * (plaka silinir), o yüzden "ayar yoksa çalışmaz" tarafında hata verir.
 */
export async function GET(istek: Request) {
  const sir = process.env.CRON_SECRET?.trim();
  if (!sir) {
    return NextResponse.json(
      { ok: false, hata: "CRON_SECRET tanımlı değil; bakım görevi kapalı." },
      { status: 503 },
    );
  }
  if (istek.headers.get("authorization") !== `Bearer ${sir}`) {
    return NextResponse.json({ ok: false, hata: "Yetkisiz." }, { status: 401 });
  }

  const sonuc = await plakalariTemizle();
  return NextResponse.json({
    ok: true,
    saklamaAyi: PLAKA_SAKLAMA_AYI,
    sinir: sonuc.sinir.toISOString(),
    maskelenen: {
      parkKaydi: sonuc.parkKaydi,
      yikamaIsEmri: sonuc.yikamaIsEmri,
      arac: sonuc.arac,
    },
  });
}
