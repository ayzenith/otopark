import { formatKurus, formatKurusPlain } from "@/lib/money";

/** Tutar gosterimi - tabular rakamlar, tr-TR bicimi. */
export function Tutar({
  kurus,
  boyut = "normal",
  simge = true,
}: {
  kurus: number;
  boyut?: "buyuk" | "orta" | "normal" | "kucuk";
  simge?: boolean;
}) {
  const sinif = {
    buyuk: "tutar-buyuk",
    orta: "tutar-orta",
    normal: "rakam text-base font-bold",
    kucuk: "rakam text-sm font-semibold",
  }[boyut];

  return <span className={sinif}>{simge ? formatKurus(kurus) : formatKurusPlain(kurus)}</span>;
}
