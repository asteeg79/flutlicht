import { NextResponse } from "next/server";
import { createResetCode } from "@/lib/admin";
import { readBody, withAdmin } from "@/lib/api-route";

/** Reset-Code für einen Manager, 24 h gültig (KONZEPT 11). */
export const POST = withAdmin(async ({ request }) =>
  NextResponse.json(
    {
      code: await createResetCode(await readBody(request), new Date()),
    },
    { status: 201 },
  ),
);
