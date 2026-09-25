import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

/**
 * Blick von der Tribüne: Nachthimmel mit den Lichtkegeln zweier Masten, unten
 * der Rasen mit Mähstreifen und Seitenlinie. Darauf liegt die „Anzeigetafel“
 * mit dem Formular.
 */
export function Stadium({
  season,
  children,
}: {
  season: string;
  children: ReactNode;
}) {
  return (
    <main className="flutlicht relative isolate flex min-h-dvh flex-col overflow-hidden px-5 pt-12 pb-10">
      <div
        aria-hidden
        className="flutlicht flutlicht-an absolute inset-0 -z-10"
      />
      <div
        aria-hidden
        className="absolute inset-x-[-60%] top-[62%] -bottom-[20%] -z-10"
      >
        <div className="maehstreifen absolute inset-0 border-t-2 border-kreide/70" />
      </div>

      <header className="mx-auto w-full max-w-sm">
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-lampe uppercase">
          Saison {season}
        </p>
        <Wordmark />
      </header>

      <section className="mx-auto mt-8 w-full max-w-sm rounded-2xl border border-nacht-linie bg-nacht/90 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        {children}
      </section>
    </main>
  );
}
