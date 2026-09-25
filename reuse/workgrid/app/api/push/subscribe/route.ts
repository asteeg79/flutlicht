import { NextResponse } from "next/server";
import { z } from "zod";
import { NotFound, parseBody, withUser } from "@/lib/api-route";
import { loadUserData, saveUserData } from "@/lib/storage";

export const runtime = "nodejs";

const SubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().max(500),
    auth: z.string().max(500),
  }),
});

export const POST = withUser(async ({ user, request }) => {
  const subscription = await parseBody(
    request,
    SubscriptionSchema,
    "Ungültige Subscription",
  );

  const data = await loadUserData(user.id);
  if (!data) throw new NotFound();
  data.pushSubscription = subscription;
  await saveUserData(user.id, data);

  return NextResponse.json({ ok: true });
});

export const DELETE = withUser(async ({ user }) => {
  const data = await loadUserData(user.id);
  if (data) {
    data.pushSubscription = undefined;
    await saveUserData(user.id, data);
  }
  return NextResponse.json({ ok: true });
});
