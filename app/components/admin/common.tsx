"use client";

import type { ReactNode } from "react";
import { toast } from "sonner";

/** Aufruf einer Admin-Route; Fehler als Toast, Rückgabe null bei Fehler. */
export async function adminCall<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(data.error ?? `Fehler (HTTP ${res.status})`);
    return null;
  }
  return data as T;
}

export const COMMIT_HINT =
  "Gespeichert. Die Pipeline übernimmt es in etwa einer Minute.";

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="mb-6 scroll-mt-4 rounded-xl border border-nacht-linie bg-nacht-hoch p-4"
    >
      <h2 className="mb-3 font-display text-2xl font-bold uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SmallButton({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const look =
    variant === "primary"
      ? "bg-lampe text-nacht"
      : variant === "danger"
        ? "border border-karte text-karte"
        : "border border-kreide/40 text-kreide";
  return (
    <button
      type="button"
      className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}
