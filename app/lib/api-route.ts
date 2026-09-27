// Übernommen aus Workgrid lib/api-route.ts, angepasst: withAdmin, withPublic, Conflict (409),
// Forbidden (403); ohne Profilbild im RouteUser.
import { NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/lib/auth";
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
 * /api/auth/* (NextAuth) und /api/cron/tick (CRON-Bearer), siehe
 * lib/public-api-paths.ts.
 */

/** Fehler, die der Handler wirft, statt Status selbst zu kennen. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Interne Ursache — wird geloggt, aber NIE an den Client gegeben. */
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class BadRequest extends ApiError {
  constructor(message = "Ungültige Eingabe") {
    super(400, message);
  }
}

export class NotFound extends ApiError {
  constructor(message = "Keine Daten") {
    super(404, message);
  }
}

export class Forbidden extends ApiError {
  constructor(message = "Keine Berechtigung") {
    super(403, message);
  }
}

/** Der Stand hat sich seit dem Laden geändert (optimistische Sperre, KONZEPT 7.3). */
export class Conflict extends ApiError {
  constructor(
    message = "Deine Daten haben sich inzwischen geändert. Bitte neu laden.",
  ) {
    super(409, message);
  }
}

/** Ein Dienst hinter uns hat versagt (Google, KI-Provider). */
export class Upstream extends ApiError {
  constructor(message: string, detail?: unknown) {
    super(502, message, detail);
  }
}

export interface RouteUser {
  id: string;
  email?: string | null;
  name?: string | null;
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

    const user: RouteUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };

    return handleErrors(() => handler({ user, request }));
  };
}

/**
 * Wie withUser, verlangt zusätzlich role=admin. Die Rolle kommt aus dem
 * Manager-Dokument, nicht aus dem Token: ein entzogenes Admin-Recht wirkt sofort.
 */
export function withAdmin(handler: Handler) {
  return withUser(async (ctx) => {
    const doc = await loadManager(ctx.user.id);
    if (doc?.role !== "admin") throw new Forbidden();
    return handler(ctx);
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
 * Validiert Eingaben; ohne `message` gilt die erste zod-Meldung (deutsch formulierte
 * Schemas), mit `message` eine feste, wenn Details nicht nach außen sollen.
 */
export function parse<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  message?: string,
): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new BadRequest(
      message ?? result.error.issues[0]?.message ?? "Ungültige Eingabe",
    );
  return result.data;
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
