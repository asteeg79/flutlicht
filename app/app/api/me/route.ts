import { NextResponse } from "next/server";
import { NotFound, withUser } from "@/lib/api-route";
import { loadManager } from "@/lib/storage";

/** Manager-Dokument ohne Passwort-Hash (KONZEPT 8.2). */
export const GET = withUser(async ({ user }) => {
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound("Konto nicht gefunden");
  const { passwordHash: _hash, ...rest } = doc;
  return NextResponse.json(rest);
});
