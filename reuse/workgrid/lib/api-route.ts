import { NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/lib/auth";

/**
 * Die authentifizierte Route als Modul.
 *
 * Vorher trug jeder Handler dieselben vier Zeilen: Session holen, bei fehlender
 * Session 401, userId aus der Session ziehen — und dann meist KEIN try/catch,
 * sodass eine Exception aus dem Storage als Next-Default-Fehlerseite beim
 * Client landete statt als JSON.
 *
 * `withUser` schluckt das. Der Handler bekommt die Identität gereicht und baut
 * seine Antwort weiter selbst — dadurch funktionieren auch die Sonderfälle
 * (CSV-Download mit Content-Disposition, Cookie-setzende Passkey-Routen), die
 * bei einem „Handler gibt Daten zurück"-Wrapper Ausnahmen gebraucht hätten.
 *
 * Bewusst NICHT hier: Rate-Limiting (liegt in middleware.ts) und die Auth der
 * vier Routen, die absichtlich anders funktionieren — /api/health (öffentlich),
 * /api/auth/* (NextAuth), /api/passkey/authenticate/options (usernameless
 * Login, da gibt es per Definition noch keine Session) und /api/push/send
 * (CRON-Bearer). Für Letzteres kein eigener Wrapper: ein Wrapper für genau
 * einen Aufrufer wäre eine Naht mit nur einer Implementierung.
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

export class Unauthorized extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, message);
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
  image?: string | null;
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
      image: session.user.image,
    };

    try {
      return await handler({ user, request });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail !== undefined) console.error(err.message, err.detail);
        return errorResponse(err.status, err.message);
      }
      console.error("Unbehandelter Fehler im Route-Handler:", err);
      return errorResponse(500, "Interner Fehler");
    }
  };
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
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new BadRequest(message);
  return parsed.data;
}
