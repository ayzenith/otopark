"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { girisYap } from "./actions";

export function GirisFormu() {
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function gonder(formData: FormData) {
    setHata(null);
    basla(async () => {
      const sonuc = await girisYap(formData);
      // Basarili girişte sunucu yonlendirir; buraya yalnizca hata donerse gelinir.
      if (sonuc && !sonuc.ok) setHata(sonuc.error);
    });
  }

  return (
    <form action={gonder} className="space-y-4">
      {hata ? <Alert tur="hata" baslik={hata} /> : null}

      <Input
        name="username"
        etiket="Kullanıcı adı"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        spellCheck={false}
        required
        disabled={bekliyor}
      />

      <Input
        name="password"
        type="password"
        etiket="Parola"
        autoComplete="current-password"
        required
        disabled={bekliyor}
      />

      <Button
        type="submit"
        variant="birincil"
        size="islem"
        tamGenislik
        disabled={bekliyor}
        aria-busy={bekliyor}
      >
        {bekliyor ? "Giriş yapılıyor…" : "GİRİŞ YAP"}
      </Button>
    </form>
  );
}
