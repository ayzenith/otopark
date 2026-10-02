"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui";
import { cikisYap } from "@/server/actions/oturum";

export function CikisButonu() {
  const [bekliyor, basla] = useTransition();
  return (
    <Button
      variant="sade"
      size="ikincil"
      tamGenislik
      disabled={bekliyor}
      onClick={() => basla(() => cikisYap())}
      className="text-hata"
    >
      {bekliyor ? "Çıkış yapılıyor…" : "ÇIKIŞ YAP"}
    </Button>
  );
}
