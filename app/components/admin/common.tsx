"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { callApi } from "@/lib/api-client";

/** Aufruf einer Admin-Route; Fehler als Toast, Rückgabe null bei Fehler. */
export async function adminCall<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T | null> {
  const r = await callApi<T>(url, method, body);
  if (!r.ok) {
    toast.error(r.error ?? `Fehler (HTTP ${r.status})`);
    return null;
  }
  return r.data;
}

export const COMMIT_HINT =
  "Gespeichert. Die Pipeline übernimmt es in etwa einer Minute.";

export function Section({
  id,
  title,
  children,
  collapsible = false,
  count,
}: {
  id: string;
  title: string;
  children: ReactNode;
  /** Zugeklappt starten; der Titel zeigt dann `count` offene Einträge. */
  collapsible?: boolean;
  count?: number;
}) {
  const heading = (
    <h2 className="font-display text-2xl font-bold uppercase">
      {title}
      {count !== undefined ? (
        <span className="ml-2 text-base text-muted">({count})</span>
      ) : null}
    </h2>
  );
  return (
    <section
      id={id}
      aria-label={title}
      className="mb-6 scroll-mt-4 rounded-xl border border-line bg-surface p-4"
    >
      {collapsible ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            {heading}
            <ChevronDown
              aria-hidden
              className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180"
            />
          </summary>
          <div className="mt-3">{children}</div>
        </details>
      ) : (
        <>
          <div className="mb-3">{heading}</div>
          {children}
        </>
      )}
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
        ? "border border-karte text-down"
        : "border border-text/40 text-text";
  return (
    <button
      type="button"
      className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${look} ${className}`}
      {...props}
    />
  );
}
