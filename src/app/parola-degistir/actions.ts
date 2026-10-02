"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { requireUser } from "@/server/auth/authz";
import { changePassword } from "@/server/auth/login";

const Semasi = z
  .object({
    currentPassword: z.string().min(1, "Mevcut parola zorunludur."),
    newPassword: z.string().min(1, "Yeni parola zorunludur."),
    newPassword2: z.string().min(1, "Parola tekrarı zorunludur."),
  })
  .refine((d) => d.newPassword === d.newPassword2, {
    message: "Yeni parolalar birbiriyle aynı değil.",
    path: ["newPassword2"],
  });

export async function parolaDegistir(
  formData: FormData,
): Promise<{ ok: false; errors: string[] } | void> {
  const user = await requireUser();

  const parsed = Semasi.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPassword2: formData.get("newPassword2"),
  });

  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  const h = await headers();
  const sonuc = await changePassword(
    user.id,
    parsed.data.currentPassword,
    parsed.data.newPassword,
    {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    },
  );

  if (!sonuc.ok) return { ok: false, errors: sonuc.errors };

  // Parola degisiminde tum oturumlar dusurulur; kullanici yeniden giris yapar.
  redirect("/giris?parola=degisti");
}
