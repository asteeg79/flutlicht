import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: async () => null }));
const { github } = await import("@/lib/github");

beforeEach(() => {
  vi.stubEnv("GITHUB_PAT", "pat-geheim");
  vi.stubEnv("GITHUB_REPO", "asteeg79/flutlicht");
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("github (Contents-API, Dispatch)", () => {
  it("liest JSON aus base64 und meldet fehlende Dateien als null", async () => {
    const content = Buffer.from('{"12":"4711"}').toString("base64");
    const fetch = vi.fn(async (url: string) =>
      url.includes("mapping")
        ? json({ content, sha: "abc" })
        : new Response("", { status: 404 }),
    );
    const gh = github(fetch as unknown as typeof globalThis.fetch);
    expect(await gh.getJson("raw/manual/mapping.json")).toEqual({
      data: { "12": "4711" },
      sha: "abc",
    });
    expect(await gh.getJson("raw/manual/values.json")).toBeNull();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.github.com/repos/asteeg79/flutlicht/contents/raw/manual/mapping.json?ref=main",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer pat-geheim",
    );
  });

  it("schreibt mit Nachricht, sha und base64-Inhalt; Konflikte werden 409", async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({}, 200),
    );
    const gh = github(fetch as unknown as typeof globalThis.fetch);
    await gh.putJson(
      "raw/manual/values.json",
      { "1": 5 },
      "raw(manual): Wert",
      "abc",
    );
    const body = JSON.parse(String(fetch.mock.calls[0]![1]!.body));
    expect(body).toMatchObject({
      message: "raw(manual): Wert",
      branch: "main",
      sha: "abc",
    });
    expect(Buffer.from(body.content, "base64").toString("utf8")).toBe(
      '{\n  "1": 5\n}\n',
    );

    const conflict = github((async () =>
      json({}, 409)) as unknown as typeof globalThis.fetch);
    await expect(
      conflict.putJson("x.json", {}, "m", "old"),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("löst die Neuberechnung aus und meldet Fehler als 502", async () => {
    const ok = vi.fn(async () => new Response(null, { status: 204 }));
    await github(ok as unknown as typeof globalThis.fetch).dispatch(
      "recompute",
    );
    expect(
      JSON.parse(
        String((ok.mock.calls[0] as unknown as [string, RequestInit])[1].body),
      ),
    ).toEqual({ event_type: "recompute" });
    const bad = github((async () =>
      json({ message: "no" }, 403)) as unknown as typeof globalThis.fetch);
    await expect(bad.dispatch("recompute")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("liest letzten Commit und letzten Workflow-Lauf", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.includes("/commits")
        ? json([
            {
              commit: {
                message: "raw: squads\n\nDetails",
                committer: { date: "2026-11-07T10:00:00Z" },
              },
            },
          ])
        : json({
            workflow_runs: [
              {
                status: "completed",
                conclusion: "success",
                created_at: "2026-11-07T10:02:00Z",
                html_url: "https://run",
              },
            ],
          }),
    );
    const gh = github(fetch as unknown as typeof globalThis.fetch);
    expect(await gh.lastCommit("raw/sofascore")).toEqual({
      date: "2026-11-07T10:00:00Z",
      message: "raw: squads",
    });
    expect(await gh.lastRun("compute.yml")).toEqual({
      status: "completed",
      conclusion: "success",
      createdAt: "2026-11-07T10:02:00Z",
      url: "https://run",
    });
  });

  it("verlangt GITHUB_PAT und GITHUB_REPO", async () => {
    vi.stubEnv("GITHUB_PAT", "");
    await expect(
      github(vi.fn() as never).dispatch("recompute"),
    ).rejects.toMatchObject({ status: 502 });
  });
});
