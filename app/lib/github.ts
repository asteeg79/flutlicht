// GitHub-Anbindung für Admin-Aktionen (KONZEPT 11): Die App committet nach raw/manual/
// (löst compute.yml aus) und startet Neuberechnungen per repository_dispatch.
// Muster: fetch auf api.github.com wie im WM-Tipp-Worker. Fine-grained PAT, nur dieses
// Repo, Contents R/W + Actions R/W (GITHUB_PAT, GITHUB_REPO).
import { Conflict, Upstream } from "@/lib/api-route";

const API = "https://api.github.com";
const BRANCH = "main";

export interface GitHub {
  /** JSON-Datei lesen; null, wenn es sie nicht gibt. */
  getJson<T>(path: string): Promise<{ data: T; sha: string } | null>;
  /** JSON-Datei schreiben (ein Commit); sha = Stand beim Lesen, sonst Konflikt. */
  putJson(
    path: string,
    data: unknown,
    message: string,
    sha?: string,
  ): Promise<void>;
  dispatch(eventType: string): Promise<void>;
  lastCommit(path: string): Promise<{ date: string; message: string } | null>;
  lastRun(workflowFile: string): Promise<{
    status: string;
    conclusion: string | null;
    createdAt: string;
    url: string;
  } | null>;
}

export function github(fetchImpl: typeof fetch = fetch): GitHub {
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_PAT;

  async function call(path: string, init: RequestInit = {}): Promise<Response> {
    if (!repo || !token)
      throw new Upstream(
        "GitHub ist nicht eingerichtet (GITHUB_PAT, GITHUB_REPO).",
      );
    return fetchImpl(`${API}/repos/${repo}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fussballmanager-admin",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }

  async function fail(res: Response, what: string): Promise<never> {
    const detail = await res.text().catch(() => "");
    throw new Upstream(
      `GitHub: ${what} fehlgeschlagen (HTTP ${res.status})`,
      detail,
    );
  }

  return {
    async getJson<T>(path: string) {
      const res = await call(`/contents/${path}?ref=${BRANCH}`);
      if (res.status === 404) return null;
      if (!res.ok) return fail(res, "Lesen");
      const body = (await res.json()) as { content: string; sha: string };
      return {
        data: JSON.parse(
          Buffer.from(body.content, "base64").toString("utf8"),
        ) as T,
        sha: body.sha,
      };
    },

    async putJson(path, data, message, sha) {
      const content = Buffer.from(
        JSON.stringify(data, null, 2) + "\n",
        "utf8",
      ).toString("base64");
      const res = await call(`/contents/${path}`, {
        method: "PUT",
        body: JSON.stringify({
          message,
          content,
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      // 409/422: Die Datei wurde seit dem Lesen geändert (sha passt nicht).
      if (res.status === 409 || res.status === 422) {
        throw new Conflict(
          "Die Datei wurde gerade anderweitig geändert. Bitte lade die Seite neu.",
        );
      }
      if (!res.ok) await fail(res, "Schreiben");
    },

    async dispatch(eventType) {
      const res = await call("/dispatches", {
        method: "POST",
        body: JSON.stringify({ event_type: eventType }),
      });
      if (res.status !== 204) await fail(res, "Neuberechnung");
    },

    async lastCommit(path) {
      const res = await call(
        `/commits?sha=${BRANCH}&path=${encodeURIComponent(path)}&per_page=1`,
      );
      if (!res.ok) return fail(res, "Commit-Abfrage");
      const [c] = (await res.json()) as {
        commit: { message: string; committer: { date: string } };
      }[];
      return c
        ? {
            date: c.commit.committer.date,
            message: c.commit.message.split("\n")[0]!,
          }
        : null;
    },

    async lastRun(workflowFile) {
      const res = await call(
        `/actions/workflows/${workflowFile}/runs?per_page=1`,
      );
      if (!res.ok) return fail(res, "Workflow-Abfrage");
      const {
        workflow_runs: [run],
      } = (await res.json()) as {
        workflow_runs: {
          status: string;
          conclusion: string | null;
          created_at: string;
          html_url: string;
        }[];
      };
      return run
        ? {
            status: run.status,
            conclusion: run.conclusion,
            createdAt: run.created_at,
            url: run.html_url,
          }
        : null;
    },
  };
}
