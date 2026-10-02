import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";

/**
 * Kok adres.
 *
 * AŞAMA 1: kurumsal web sitesi henüz yok (Aşama 7). Şimdilik oturumu olan
 * kullanıcı vardiya ekranına, olmayan giriş ekranına yönlendirilir.
 * Aşama 7'de bu adres (public) grubundaki ana sayfaya devredilecek.
 */
export default async function KokSayfa() {
  const user = await getSession();
  redirect(user ? "/vardiya" : "/giris");
}
