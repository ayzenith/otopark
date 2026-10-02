import Link from "next/link";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";

/**
 * Ust bar - 44px. Mobilde ekranin ustunde minimum yer kaplar;
 * asil alan islem ekranina ayrilir.
 */
export function UstBar({
  kullanici,
}: {
  kullanici: { fullName: string; role: RoleName; jobTitle: string | null };
}) {
  const ilkAd = kullanici.fullName.split(" ")[0] ?? kullanici.fullName;

  return (
    <header className="sticky top-0 z-20 bg-lacivert-600 text-white shadow-md">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/vardiya" className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight">Londra Camping</div>
          <div className="truncate text-[11px] leading-tight text-mavi-200">
            {kullanici.jobTitle || ROLE_LABELS[kullanici.role]}
          </div>
        </Link>

        <Link
          href="/hesabim"
          className="flex h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"
        >
          <span className="max-w-[9rem] truncate">{ilkAd}</span>
          <span aria-hidden className="text-mavi-200">
            ▾
          </span>
        </Link>
      </div>
    </header>
  );
}
