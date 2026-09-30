"use client";

import { RULES } from "@fm/core";
import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { GuideLink } from "@/components/guide/guide-link";

/** Kurzer Anreißer unter der Wortmarke auf Login und Registrieren, mit Link zur Anleitung. */
export function AuthIntro({ startBudget }: { startBudget: number }) {
  const pathname = usePathname();
  if (pathname !== "/login" && pathname !== "/registrieren") return null;
  const login = pathname === "/login";
  return (
    <div className="mt-5 max-w-[360px] text-hero-text">
      {login ? (
        <p className="font-display text-[22px] leading-[1.05] font-black uppercase">
          Deine Bundesliga. Deine Elf. Deine Freunde als Gegner.
        </p>
      ) : null}
      {/* Login auf kleinen Handys (iPhone SE): Formular soll sichtbar bleiben. */}
      <p
        className={`mt-2 text-sm leading-relaxed text-hero-muted ${login ? "[@media(max-height:700px)]:hidden" : ""}`}
      >
        {login
          ? "Stell aus allen Bundesliga-Spielern dein Team zusammen, setz auf den richtigen Kapitän und sammle Punkte aus echten Spieldaten. Jeden Spieltag neu, nur um die Ehre."
          : `Mit deinem Einladungscode bist du in fünf Minuten dabei: Konto anlegen, ${RULES.squadSize} Spieler für ${startBudget.toLocaleString("de-DE")} Mio. kaufen, Kapitän wählen, fertig.`}
      </p>
      <GuideLink className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-hero-text underline decoration-2 underline-offset-4">
        {login ? "Wie läuft Flutlicht?" : "Erst mal die Regeln lesen"}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </GuideLink>
    </div>
  );
}
