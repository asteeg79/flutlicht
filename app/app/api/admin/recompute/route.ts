import { NextResponse } from "next/server";
import { recompute } from "@/lib/admin";
import { withAdmin } from "@/lib/api-route";
import { github } from "@/lib/github";

/** Neuberechnung: repository_dispatch recompute → compute.yml (KONZEPT 11). */
export const POST = withAdmin(async () => {
  await recompute(github());
  return NextResponse.json({ ok: true });
});
