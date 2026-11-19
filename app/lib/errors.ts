// Übernommen aus Workgrid lib/api-route.ts, angepasst: aus lib/api-route.ts herausgelöst,
// damit Fachmodule und ihre Tests nicht an NextAuth hängen; Conflict (409), Forbidden (403).
import type { z } from "zod";

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
