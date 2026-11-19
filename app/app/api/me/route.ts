import { NextResponse } from "next/server";
import { readBody, withUser } from "@/lib/api-route";
import { NotFound } from "@/lib/errors";
import { updateProfile } from "@/lib/accounts";
import { publicManager } from "@/lib/squad";
import { loadManager } from "@/lib/storage";

/** Manager-Dokument ohne Passwort-Hash (KONZEPT 8.2). */
export const GET = withUser(async ({ user }) => {
  const doc = await loadManager(user.id);
  if (!doc) throw new NotFound("Konto nicht gefunden");
  return NextResponse.json(publicManager(doc));
});

/** Eigenen Anzeige- und Teamnamen ändern. */
export const PUT = withUser(async ({ user, request }) => {
  const body = await readBody(request);
  const doc = await updateProfile(user.id, body);
  return NextResponse.json({
    displayName: doc.displayName,
    teamName: doc.teamName,
  });
});
