import { NextResponse } from "next/server";
import { readBody, withPublic } from "@/lib/api-route";
import { resetPassword } from "@/lib/accounts";

// Öffentlich (lib/public-api-paths.ts): wer sein Passwort vergessen hat, ist nicht angemeldet.
export const POST = withPublic(async (request) => {
  await resetPassword(await readBody(request), new Date());
  return NextResponse.json({ ok: true });
});
