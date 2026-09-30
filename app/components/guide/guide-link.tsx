"use client";

import { CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { guideUrl, type GuideChapterId } from "@/lib/guide";

/**
 * Wurde die Anleitung per Klick in der App geöffnet (eigener Verlaufseintrag), schließt
 * der Dialog mit history.back(); kam sie über einen geteilten Link, entfernt er nur den
 * Parameter.
 */
export const openedFromApp = { current: false };

function useOpenGuide(chapter: GuideChapterId) {
  const pathname = usePathname();
  return {
    href: guideUrl(pathname, "", chapter),
    onClick(e: MouseEvent<HTMLAnchorElement>) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      // Natives pushState: Next aktualisiert useSearchParams ohne Server-Abruf.
      history.pushState(null, "", guideUrl(pathname, location.search, chapter));
      openedFromApp.current = true;
    },
  };
}

/** Textlink, der die Anleitung an einem Kapitel öffnet. */
export function GuideLink({
  chapter = "idee",
  className = "",
  children,
}: {
  chapter?: GuideChapterId;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a {...useOpenGuide(chapter)} className={className}>
      {children}
    </a>
  );
}

/** „?“ neben einer Überschrift; 44 px Tippfläche. */
export function GuideHelpButton({
  chapter,
  label,
}: {
  chapter: GuideChapterId;
  label: string;
}) {
  return (
    <a
      {...useOpenGuide(chapter)}
      aria-label={label}
      title={label}
      className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center text-hero-muted hover:text-lampe"
    >
      <CircleHelp aria-hidden className="h-6 w-6" strokeWidth={2} />
    </a>
  );
}
