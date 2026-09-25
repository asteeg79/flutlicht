import { NextResponse } from "next/server";
import { createResetCode } from "@/lib/admin";
import { withAdmin } from "@/lib/api-route";

/** Reset-Code für einen Manager, 24 h gültig (KONZEPT 11). */
export const POST = withAdmin(async ({ request }) =>
  NextResponse.json(
    {
      code: await createResetCode(
        await request.json().catch(() => null),
        new Date(),
      ),
    },
    { status: 201 },
  ),
);
