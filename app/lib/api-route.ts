// Übernommen aus Workgrid lib/api-route.ts, angepasst: withAdmin, withPublic, Admin-Dokument
// im Kontext; RouteUser nur mit id. Die Fehlerklassen stehen in lib/errors.ts.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import type { ManagerDoc } from "@fm/core";
import { auth } from "@/lib/auth";
import { ApiError, BadRequest, Forbidden, parse } from "@/lib/errors";
import { loadManager } from "@/lib/storage";

/**
 * Die authentifizierte Route als Modul.
 *
 * Vorher trug jeder Handler dieselben vier Zeilen: Session holen, bei fehlender
 * Session 401, userId aus der Session ziehen — und dann meist KEIN try/catch,
 * sodass eine Exception aus dem Storage als Next-Default-Fehlerseite beim
 * Client landete statt als JSON.
 *
 * `withUser` schluckt das. Der Handler bekommt die Identität gereicht und baut
 * seine Antwort weiter selbst.
 *
 * Bewusst NICHT hier: Rate-Limiting (liegt in middleware.ts) und die Auth der
 * Routen, die absichtlich anders funktionieren — /api/health (öffentlich),
 * /api/auth/* (NextAuth), /api/cron/tick und /api/scraper/heartbeat (Bearer,
 * `hasBearer`), siehe lib/public-api-paths.ts.
 */

export interface RouteUser {
  id: string;
}

export interface RouteContext {
  user: RouteUser;
  request: Request;
}

type Handler = (ctx: RouteContext) => Response | Promise<Response>;

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Umschließt einen Route-Handler: besorgt die Session, beendet ohne sie mit
 * 401 und übersetzt geworfene Fehler in Status. Unerwartetes wird geloggt und
 * als generische 500 beantwortet — interne Meldungen gehören nicht zum Client.
 */
export function withUser(handler: Handler) {
  return async function route(request: Request): Promise<Response> {
    const session = await auth();
    if (!session?.user?.id) return errorResponse(401, "Unauthorized");

    return handleErrors(() =>
      handler({ user: { id: session.user.id }, request }),
    );
  };
}

/**
 * Wie withUser, verlangt zusätzlich role=admin. Die Rolle kommt aus dem
 * Manager-Dokument, nicht aus dem Token: ein entzogenes Admin-Recht wirkt sofort.
 * Der Handler bekommt das geladene Dokument als `admin` mit.
 */
export function withAdmin(
  handler: (
    ctx: RouteContext & { admin: ManagerDoc },
  ) => Response | Promise<Response>,
) {
  return withUser(async (ctx) => {
    const admin = await loadManager(ctx.user.id);
    if (admin?.role !== "admin") throw new Forbidden();
    return handler({ ...ctx, admin });
  });
}

/**
 * Für die ausdrücklich öffentlichen Routen (lib/public-api-paths.ts): nur die
 * Fehlerübersetzung, keine Session.
 */
export function withPublic(
  handler: (request: Request) => Response | Promise<Response>,
) {
  return (request: Request): Promise<Response> =>
    handleErrors(() => handler(request));
}

/** `Authorization: Bearer <secret>` in konstanter Zeit; ohne gesetztes Secret nie gültig. */
export function hasBearer(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handleErrors(
  run: () => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.detail !== undefined) console.error(err.message, err.detail);
      return errorResponse(err.status, err.message);
    }
    console.error("Unbehandelter Fehler im Route-Handler:", err);
    return errorResponse(500, "Interner Fehler");
  }
}

/**
 * Liest und validiert den Request-Body. Ersetzt das dreimal wortgleich
 * kopierte `safeParse(await request.json().catch(() => null))` — und deckt
 * dabei die zwei Handler mit ab, die bisher ungeprüftes JSON weiterreichten.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  message = "Ungültige Eingabe",
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequest(message);
  }
  return parse(schema, raw, message);
}
