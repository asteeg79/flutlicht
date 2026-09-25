import { NextResponse } from "next/server";
import { listAllUserData, saveUserData } from "@/lib/storage";
import { sendPushNotification } from "@/lib/push";
import { toLocalYmd } from "@/lib/time-local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wird vom Vercel-Cron täglich aufgerufen. Schickt für fällige/überfällige
 * Tasks Push-Benachrichtigungen. Nur mit gültigem CRON_SECRET aufrufbar.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = toLocalYmd(new Date());
  const allData = await listAllUserData();
  let sent = 0;

  for (const data of allData) {
    if (!data.pushSubscription) continue;

    const dueTasks = data.boards.flatMap((board) =>
      board.tasks.filter(
        (t) => t.dueDate && t.dueDate.slice(0, 10) <= today,
      ),
    );
    if (dueTasks.length === 0) continue;

    let subscriptionValid = true;
    for (const task of dueTasks) {
      const ok = await sendPushNotification(data.pushSubscription, {
        title: "MyWorkgrid",
        body: `Fällig: ${task.title}`,
        url: `/board?taskId=${task.id}`,
      });
      if (ok) {
        sent++;
      } else {
        subscriptionValid = false;
        break;
      }
    }

    // Abgelaufene Subscription entfernen
    if (!subscriptionValid) {
      data.pushSubscription = undefined;
      await saveUserData(data.userId, data);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

// Vercel Cron nutzt standardmäßig GET
export async function GET(request: Request) {
  return POST(request);
}
