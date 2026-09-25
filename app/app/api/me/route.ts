import { NextResponse } from "next/server";
import { NotFound, withUser } from "@/lib/api-route";
import { publicManager } from "@/lib/squad";
import { loadManager } from "@/lib/storage";

/** Manager-Dokument ohne Passwort-Hash (KONZEPT 8.2). */
export const GET = withUser(async ({ user }) => {
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound("Konto nicht gefunden");
  return NextResponse.json(publicManager(doc));
});
