import { NextResponse } from "next/server";
import { deleteAccount } from "@/lib/admin";
import { withAdmin } from "@/lib/api-route";
import { listAllManagers } from "@/lib/storage";

/** Manager-Liste ohne Hashes; Konto löschen (KONZEPT 11, 15.4). */
export const GET = withAdmin(async () =>
  NextResponse.json(
    (await listAllManagers()).map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      teamName: m.teamName,
      email: m.email,
      role: m.role,
      firstMatchday: m.firstMatchday,
      hasSquad: m.squad.length > 0,
    })),
  ),
);

export const DELETE = withAdmin(async ({ user, request }) => {
  await deleteAccount(await request.json().catch(() => null), user.id);
  return NextResponse.json({ ok: true });
});
