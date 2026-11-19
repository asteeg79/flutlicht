import { NextResponse } from "next/server";
import { readBody, withPublic } from "@/lib/api-route";
import { registerManager } from "@/lib/accounts";

// Öffentlich (lib/public-api-paths.ts): vor der Registrierung gibt es keine Session.
export const POST = withPublic(async (request) => {
  const body = await readBody(request);
  const doc = await registerManager(body, new Date());
  return NextResponse.json({ userId: doc.userId }, { status: 201 });
});
