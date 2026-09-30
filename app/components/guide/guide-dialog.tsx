"use client";

import { ArrowRight, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useDialogFocus } from "@/components/arena/overlay";
import {
  GuideChapter,
  type GuideFacts,
} from "@/components/guide/guide-content";
import { openedFromApp } from "@/components/guide/guide-link";
import {
  chapterFromParam,
  GUIDE_CHAPTERS,
  GUIDE_PARAM,
  guideUrl,
  nextChapter,
  type GuideChapterId,
} from "@/lib/guide";

/**
 * Anleitung als Dialog über jeder Seite, gesteuert allein über ?anleitung=<kapitel>.
 * Mobil Vollbild, ab 1024 px ein Modal mit Kapitelliste links. Kapitelwechsel
 * ersetzen den Verlaufseintrag, damit „Zurück“ den Dialog schließt.
 */
export function GuideDialog({ facts }: { facts: GuideFacts }) {
  const chapter = chapterFromParam(useSearchParams().get(GUIDE_PARAM));
  return chapter ? <GuideOverlay chapter={chapter} facts={facts} /> : null;
}

function GuideOverlay({
  chapter,
  facts,
}: {
  chapter: GuideChapterId;
  facts: GuideFacts;
}) {
  const pathname = usePathname();
  const body = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);

  function close() {
    if (openedFromApp.current) history.back();
    else
      history.replaceState(null, "", guideUrl(pathname, location.search, null));
  }
  const ref = useDialogFocus(close);

  function show(id: GuideChapterId) {
    history.replaceState(null, "", guideUrl(pathname, location.search, id));
  }

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      openedFromApp.current = false;
    };
  }, []);

  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
    chip.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [chapter]);

  const title = GUIDE_CHAPTERS.find((c) => c.id === chapter)!.title;
  const next = nextChapter(chapter);

  return (
    <div
      className="fixed inset-0 z-50 lg:flex lg:items-center lg:justify-center lg:bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
        data-testid="guide"
        className="arena-anim flex h-dvh animate-[arena-sheet_.22s_ease-out_both] flex-col border-t-4 border-lampe bg-sheet-bg text-sheet-text outline-none lg:h-[min(760px,88dvh)] lg:w-[min(920px,92vw)] lg:animate-[arena-modal_.22s_ease-out_both] lg:shadow-[0_30px_60px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-center justify-between gap-3 px-[18px] pt-[calc(env(safe-area-inset-top)+12px)] pb-2 lg:px-6 lg:pt-4">
          <p className="text-[11px] font-bold tracking-[0.14em] text-kreide-matt uppercase">
            Anleitung
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Anleitung schließen"
            className="-mr-2.5 flex h-11 w-11 items-center justify-center text-kreide hover:text-lampe"
          >
            <X aria-hidden className="h-6 w-6" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav
            aria-label="Kapitel"
            className="flex shrink-0 gap-2 overflow-x-auto px-[18px] pb-3 [scrollbar-width:none] lg:w-56 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-r lg:border-white/10 lg:px-3 lg:pb-6"
          >
            {GUIDE_CHAPTERS.map((c) => {
              const active = c.id === chapter;
              return (
                <button
                  key={c.id}
                  ref={active ? chip : undefined}
                  type="button"
                  onClick={() => show(c.id)}
                  aria-current={active ? "true" : undefined}
                  className={`h-11 shrink-0 px-3.5 text-left font-display text-lg font-extrabold tracking-[0.04em] whitespace-nowrap uppercase transition-colors ${
                    active
                      ? "bg-lampe text-nacht"
                      : "border border-white/20 text-kreide-matt hover:text-kreide lg:border-0"
                  }`}
                >
                  {c.title}
                </button>
              );
            })}
          </nav>
          <div
            ref={body}
            className="min-h-0 flex-1 overflow-y-auto border-t border-white/10 px-[18px] pt-5 pb-[calc(env(safe-area-inset-bottom)+24px)] lg:border-t-0 lg:px-8 lg:pt-2"
          >
            <div className="mx-auto max-w-[560px] lg:mx-0 lg:max-w-[600px]">
              <h2
                id="guide-title"
                className="mb-3 text-[11px] font-bold tracking-[0.14em] text-kreide-matt uppercase"
              >
                {title}
              </h2>
              <GuideChapter id={chapter} facts={facts} />
              <button
                type="button"
                onClick={next ? () => show(next.id) : close}
                className="slant mt-4 inline-flex h-12 items-center gap-2 bg-lampe px-5 font-display text-xl font-black tracking-[0.04em] text-nacht uppercase"
              >
                {next ? `Weiter: ${next.title}` : "Alles klar"}
                {next ? <ArrowRight aria-hidden className="h-5 w-5" /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
