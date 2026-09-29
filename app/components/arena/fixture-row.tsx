import { ClubLogo } from "@/components/club-logo";

export type FixtureState =
  | { kind: "live"; score: string; label: string }
  | { kind: "done"; score: string }
  | { kind: "open"; kickoff: string }
  | { kind: "postponed" };

/** Spielzeile: Heim · Ergebnis-Block (live rot, fertig dunkel, offen Anstoßzeit) · Auswärts. */
export function FixtureRow({
  home,
  away,
  homeLogo,
  awayLogo,
  state,
}: {
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  state: FixtureState;
}) {
  const name = "truncate font-display text-[15px] font-extrabold uppercase";
  return (
    <li
      data-testid="fixture-row"
      className="grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-center gap-2 border-b border-line py-[9px]"
    >
      <span className="flex min-w-0 items-center justify-end gap-1.5">
        <span className={name}>{home}</span>
        <ClubLogo src={homeLogo} />
      </span>
      <span className="flex flex-col items-center gap-0.5">
        {state.kind === "open" || state.kind === "postponed" ? (
          <span className="font-display text-[15px] font-extrabold whitespace-nowrap text-muted">
            {state.kind === "open" ? state.kickoff : "verlegt"}
          </span>
        ) : (
          <>
            <span
              className={`w-full pt-1 pb-0.5 text-center font-display text-[22px] leading-none font-black ${state.kind === "live" ? "bg-karte text-white" : "bg-nacht text-kreide"}`}
            >
              {state.score}
            </span>
            <span
              className={`font-display text-[11px] font-extrabold uppercase ${state.kind === "live" ? "text-down" : "text-muted"}`}
            >
              {state.kind === "live" ? state.label : "Ende"}
            </span>
          </>
        )}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <ClubLogo src={awayLogo} />
        <span className={name}>{away}</span>
      </span>
    </li>
  );
}
