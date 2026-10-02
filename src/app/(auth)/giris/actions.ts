"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { authenticate } from "@/server/auth/login";
import { createSession } from "@/server/auth/session";

const GirisSemasi = z.object({
  username: z.string().trim().min(1, "Kullanıcı adı zorunludur.").max(64),
  password: z.string().min(1, "Parola zorunludur.").max(256),
});

/** Istek ustbilgilerinden IP ve tarayici bilgisi (denetim kaydi icin). */
async function istekBilgisi() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  return { ip, userAgent: h.get("user-agent") };
}

export async function girisYap(formData: FormData): Promise<{ ok: false; error: string } | void> {
  const parsed = GirisSemasi.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Kullanıcı adı ve parola zorunludur." };
  }

  const meta = await istekBilgisi();
  const sonuc = await authenticate(parsed.data.username, parsed.data.password, meta);

  if (!sonuc.ok) {
    return { ok: false, error: sonuc.message };
  }

  await createSession(sonuc.userId, meta);

  // Baslangic parolasi kullaniliyorsa once parola degistirme ekrani.
  if (sonuc.mustChangePassword) redirect("/parola-degistir");
  redirect("/vardiya");
}
