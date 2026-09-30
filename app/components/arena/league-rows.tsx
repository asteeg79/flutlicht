"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";

export interface LeagueRow {
  userId: string;
  rank: number;
  displayName: string;
  teamName: string;
  total: number;
  wins: number;
  movement: number | null;
  byMatchday: Record<number, number>;
}

const SEEN_KEY = "flutlicht-seen-matchday";
const MEDAL = ["bg-lampe", "bg-podium-2", "bg-bronze"];

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) ?? 0);
  } catch {
    return 0;
  }
}
// Einmal je Seitenaufruf, damit das Schreiben unten die Animation nicht abbricht.
let seenOnLoad: number | null = null;

/**
 * Tabellenzeilen mobil (Liste) und Desktop (Spalten Sp 1…n). Nach einem neuen
 * Spieltag gleitet die eigene Zeile einmal um N Plätze hoch, überholte rutschen
 * nach (Arena 8, Punkt 8); gemerkt wird das in localStorage (`seenMatchday`).
 */
export function LeagueRows({
  rows,
  me,
  matchdays,
  winners,
}: {
  rows: LeagueRow[];
  me: string;
  matchdays: number[];
  /** Spieltag → Sieger-IDs (gelbe Werte). */
  winners: Record<number, string[]>;
}) {
  const last = matchdays.at(-1) ?? 0;
  const seen = useSyncExternalStore(
    () => () => {},
    () => (seenOnLoad ??= readSeen()),
    () => last,
  );
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(last));
    } catch {
      // ohne Speicher eben ohne Einmal-Animation
    }
  }, [last]);

  const meIndex = rows.findIndex((r) => r.userId === me);
  const climb =
    meIndex >= 0 && seen < last ? Math.max(0, rows[meIndex]!.movement ?? 0) : 0;
  const fx = (i: number): { className: string; style?: CSSProperties } => {
    if (climb > 0 && i === meIndex)
      return {
        className:
          "arena-anim relative z-[2] animate-[arena-row_.9s_.35s_cubic-bezier(.2,1,.4,1)_both]",
        style: { "--from": `calc(var(--row) * ${climb})` } as CSSProperties,
      };
    if (climb > 0 && i > meIndex && i <= meIndex + climb)
      return {
        className:
          "arena-anim relative z-[1] animate-[arena-sink_.9s_.35s_cubic-bezier(.2,1,.4,1)_both]",
        style: { "--from": "calc(var(--row) * -1)" } as CSSProperties,
      };
    return { className: "" };
  };
  const mv = (r: LeagueRow) =>
    r.movement === null || r.movement === 0 ? (
      <span className="text-muted">–</span>
    ) : r.movement > 0 ? (
      <span className="text-up">▲{r.movement}</span>
    ) : (
      <span className="text-down">▼{-r.movement}</span>
    );
  const winner = (md: number, id: string) => winners[md]?.includes(id) ?? false;
  const lastMd = matchdays.at(-1);

  return (
    <div className="[--row:58px] lg:[--row:65px]">
      <ol aria-label="Gesamttabelle" className="lg:hidden">
        {rows.map((r, i) => {
          const f = fx(i);
          const sub = [
            r.teamName,
            lastMd !== undefined && r.byMatchday[lastMd] !== undefined
              ? `zuletzt ${r.byMatchday[lastMd]}`
              : null,
            r.wins > 0 ? `${r.wins}× Sieger` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={r.userId}
              aria-current={r.userId === me ? "true" : undefined}
              style={f.style}
              className={`-mx-2.5 grid h-[58px] grid-cols-[28px_26px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line px-2.5 ${r.userId === me ? "bg-me-row" : ""} ${f.className}`}
            >
              <span
                className={`font-display text-[26px] font-black ${r.rank <= 3 ? "" : "text-muted"}`}
              >
                {r.rank}
              </span>
              <span className="font-display text-[13px] font-extrabold">
                {mv(r)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-xl leading-none font-black uppercase">
                  {r.displayName}
                </span>
                <span className="mt-[3px] block truncate text-[11px] font-medium text-muted">
                  {sub}
                </span>
              </span>
              <span className="font-display text-[30px] leading-none font-black tabular-nums">
                {r.total}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="hidden overflow-x-auto lg:block">
        <table
          aria-label="Gesamttabelle Desktop"
          className="w-full tabular-nums"
        >
          <thead>
            <tr className="border-b-2 border-text font-display text-[13px] font-extrabold tracking-[0.08em] text-muted uppercase">
              <th
                scope="col"
                className="w-11 px-3 pb-2 text-left font-extrabold"
              >
                #
              </th>
              <th scope="col" className="w-[30px] pb-2" aria-label="Medaille" />
              <th scope="col" className="w-[30px] pb-2" aria-label="Bewegung" />
              <th scope="col" className="px-2.5 pb-2 text-left font-extrabold">
                Manager
              </th>
              {matchdays.map((md) => (
                <th
                  key={md}
                  scope="col"
                  className="w-14 px-1 pb-2 text-right font-extrabold whitespace-nowrap"
                >
                  Sp {md}
                </th>
              ))}
              <th
                scope="col"
                className="w-[72px] px-3 pb-2 text-right font-extrabold"
              >
                Gesamt
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const f = fx(i);
              return (
                <tr
                  key={r.userId}
                  style={f.style}
                  className={`h-[65px] border-b border-line ${r.userId === me ? "bg-me-row" : ""} ${f.className}`}
                >
                  <td
                    className={`px-3 font-display text-[28px] leading-none font-black ${r.rank <= 3 ? "" : "text-muted"}`}
                  >
                    {r.rank}
                  </td>
                  <td>
                    {i < 3 && r.rank <= 3 ? (
                      <span
                        aria-hidden
                        className={`block h-[22px] w-[22px] rounded-full ${MEDAL[r.rank - 1]}`}
                      />
                    ) : null}
                  </td>
                  <td className="font-display text-sm font-extrabold">
                    {mv(r)}
                  </td>
                  <td className="px-2.5">
                    <span className="block font-display text-[21px] leading-none font-black uppercase">
                      {r.displayName}
                    </span>
                    <span className="mt-[3px] block text-xs font-medium text-muted">
                      {r.teamName}
                    </span>
                  </td>
                  {matchdays.map((md) => (
                    <td
                      key={md}
                      className="px-1 text-right font-display text-lg font-extrabold"
                    >
                      <span
                        className={
                          winner(md, r.userId)
                            ? "bg-win-bg px-1 text-win-text"
                            : ""
                        }
                      >
                        {r.byMatchday[md] ?? "–"}
                      </span>
                    </td>
                  ))}
                  <td className="px-3 text-right font-display text-[30px] leading-none font-black">
                    {r.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
