"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { parolaDegistir } from "./actions";

export function ParolaFormu() {
  const [hatalar, setHatalar] = useState<string[]>([]);
  const [bekliyor, basla] = useTransition();

  function gonder(formData: FormData) {
    setHatalar([]);
    basla(async () => {
      const sonuc = await parolaDegistir(formData);
      if (sonuc && !sonuc.ok) setHatalar(sonuc.errors);
    });
  }

  return (
    <form action={gonder} className="space-y-4">
      {hatalar.length > 0 ? (
        <Alert tur="hata" baslik="Parola değiştirilemedi">
          <ul className="list-disc space-y-0.5 pl-4">
            {hatalar.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Input
        name="currentPassword"
        type="password"
        etiket="Mevcut parola"
        autoComplete="current-password"
        required
        disabled={bekliyor}
      />
      <Input
        name="newPassword"
        type="password"
        etiket="Yeni parola"
        autoComplete="new-password"
        required
        disabled={bekliyor}
        yardim="En az 10 karakter; büyük harf, küçük harf ve rakam içermeli."
      />
      <Input
        name="newPassword2"
        type="password"
        etiket="Yeni parola (tekrar)"
        autoComplete="new-password"
        required
        disabled={bekliyor}
      />

      <Button type="submit" variant="birincil" size="islem" tamGenislik disabled={bekliyor}>
        {bekliyor ? "Kaydediliyor…" : "PAROLAYI DEĞİŞTİR"}
      </Button>
    </form>
  );
}
