import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

/**
 * Anmeldung, Registrieren und Passwort-Reset (Arena 5 „Anmelden“): Wortmarke über
 * Flutlicht und Rasen (hell: Gelb mit schrägem Schnitt), darunter das Formular in
 * einer Karte mit abgeschnittener Ecke.
 */
export function Stadium({
  season,
  children,
}: {
  season: string;
  children: ReactNode;
}) {
  return (
    <main className="login-bg flex min-h-dvh flex-col px-6 pt-[calc(env(safe-area-inset-top)+72px)] pb-10 lg:justify-center lg:pt-10">
      <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col lg:flex-none">
        <header>
          <Wordmark />
          <p className="mt-[18px] text-xs font-bold tracking-[0.16em] text-hero-muted uppercase">
            Saison {season} · Private Bundesliga-Managerrunde
          </p>
        </header>
        <div className="min-h-8 flex-1 lg:min-h-10 lg:flex-none" />
        <section className="cut-corner bg-surface p-5 text-text">
          {children}
        </section>
      </div>
    </main>
  );
}
