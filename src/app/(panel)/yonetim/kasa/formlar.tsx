"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { kasaMutabakatAction } from "@/server/actions/kasa";

/**
 * MUTABAKAT: kasa farki incelendi ve kapatildi.
 *
 * TUTARLARA DOKUNMAZ. Yalnizca oturumu RECONCILED isaretler; boylece patron
 * hangi farklari inceledigini takip eder.
 */
export function MutabakatButonu({ id }: { id: string }) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (!acik) {
    return (
      <Button
        variant="sade"
        size="normal"
        tamGenislik
        className="mt-3"
        onClick={() => setAcik(true)}
        data-test={`mutabakat-ac-${id}`}
      >
        Mutabakat yapıldı olarak işaretle
      </Button>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      action={(formData) => {
        setHata(null);
        formData.set("cashDrawerSessionId", id);
        basla(async () => {
          const sonuc = await kasaMutabakatAction(formData);
          if (!sonuc.ok) setHata(sonuc.error);
          else {
            setAcik(false);
            router.refresh();
          }
        });
      }}
    >
      {hata ? <Alert tur="hata" baslik={hata} /> : null}
      <Alert tur="bilgi" baslik="Tutarlar değişmez">
        Mutabakat yalnızca &quot;farkı inceledim&quot; demektir; kasa tutarlarına
        dokunulmaz.
      </Alert>
      <Input name="not" etiket="Mutabakat notu (isteğe bağlı)" />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="submit"
          variant="basari"
          size="normal"
          disabled={bekliyor}
          data-test={`mutabakat-kaydet-${id}`}
        >
          {bekliyor ? "…" : "İşaretle"}
        </Button>
        <Button variant="sade" size="normal" onClick={() => setAcik(false)}>
          Vazgeç
        </Button>
      </div>
    </form>
  );
}
