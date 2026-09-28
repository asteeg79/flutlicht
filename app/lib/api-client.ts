// Aufrufe der eigenen API aus dem Browser: JSON rein, JSON oder Fehlermeldung raus.

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string | null };

export async function callApi<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = typeof data?.error === "string" ? data.error : null;
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: data as T };
}
