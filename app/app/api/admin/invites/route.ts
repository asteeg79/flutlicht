import { NextResponse } from "next/server";
import { createInvite, revokeInvite } from "@/lib/admin";
import { readBody, withAdmin } from "@/lib/api-route";
import { loadLeague } from "@/lib/storage";

/** Einladungscodes erzeugen, anzeigen, widerrufen (KONZEPT 11). */
export const GET = withAdmin(async () =>
  NextResponse.json((await loadLeague()).invites),
);

export const POST = withAdmin(async () =>
  NextResponse.json({ code: await createInvite(new Date()) }, { status: 201 }),
);

export const DELETE = withAdmin(async ({ request }) => {
  await revokeInvite(await readBody(request));
  return NextResponse.json({ ok: true });
});
