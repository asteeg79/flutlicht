import { NextResponse } from "next/server";
import { withPublic } from "@/lib/api-route";
import { resetPassword } from "@/lib/accounts";

// Öffentlich (lib/public-api-paths.ts): wer sein Passwort vergessen hat, ist nicht angemeldet.
export const POST = withPublic(async (request) => {
  await resetPassword(await request.json().catch(() => null), new Date());
  return NextResponse.json({ ok: true });
});
