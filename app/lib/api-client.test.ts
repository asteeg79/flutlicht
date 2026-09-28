import { afterEach, describe, expect, it, vi } from "vitest";
import { callApi } from "./api-client";

afterEach(() => vi.unstubAllGlobals());

describe("callApi", () => {
  it("schickt JSON und liefert die Antwort", async () => {
    const fetch = vi.fn(async () => Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetch);
    expect(await callApi("/api/x", "PUT", { a: 1 })).toEqual({
      ok: true,
      data: { id: 1 },
    });
    expect(fetch).toHaveBeenCalledWith("/api/x", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("ohne Body keinen Content-Type", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    expect(await callApi("/api/x", "POST")).toEqual({ ok: true, data: {} });
    expect(fetch).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: undefined,
      body: undefined,
    });
  });

  it("liefert Status und Fehlermeldung des Servers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Zu spät." }, { status: 409 })),
    );
    expect(await callApi("/api/x", "POST", {})).toEqual({
      ok: false,
      status: 409,
      error: "Zu spät.",
    });
  });

  it("ohne lesbare Meldung error = null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("kaputt", { status: 500 })),
    );
    expect(await callApi("/api/x", "POST", {})).toEqual({
      ok: false,
      status: 500,
      error: null,
    });
  });
});
