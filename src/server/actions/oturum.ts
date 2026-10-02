"use server";

import { redirect } from "next/navigation";
import { getSession, destroySession } from "@/server/auth/session";
import { writeAudit, AUDIT_ACTIONS } from "@/server/audit";

/** Oturumu kapatir ve denetim kaydi yazar. */
export async function cikisYap(): Promise<void> {
  const user = await getSession();
  if (user) {
    await writeAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entityType: "Session",
      entityId: user.sessionId,
      userId: user.id,
      actorLabel: user.username,
    });
  }
  await destroySession();
  redirect("/giris");
}
