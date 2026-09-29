import type { PointParts } from "@fm/core";
import Link from "next/link";
import { PartsLine } from "@/components/points";

/** Punkte-Kurzinfo eines Spielers für die Aufstellung (Tooltip und Auswahlleiste). */
export interface PointsInfo {
  latest: {
    matchday: number;
    minutes: number;
    rating: number | null;
    parts: PointParts;
    base: number;
  } | null;
  season: {
    points: number;
    appearances: number;
    avgRating: number | null;
  } | null;
}

export function formatRating(r: number): string {
  return r.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function PlayerPointsInfo({
  playerId,
  info,
}: {
  playerId: number;
  info: PointsInfo;
}) {
  const { latest, season } = info;
  return (
    <div className="space-y-1 text-left text-sm">
      {latest ? (
        <>
          <p className="flex justify-between gap-3">
            <span>
              {latest.matchday}. Spieltag · {latest.minutes}′
              {latest.rating !== null
                ? ` · Note ${formatRating(latest.rating)}`
                : ""}
            </span>
            <span className="font-semibold">{latest.base} P.</span>
          </p>
          {latest.minutes > 0 ? (
            <PartsLine parts={latest.parts} />
          ) : (
            <p className="text-xs text-muted">nicht eingesetzt</p>
          )}
        </>
      ) : null}
      <p className="text-xs text-muted">
        {season
          ? `Saison: ${season.points} P. · ${season.appearances} ${season.appearances === 1 ? "Einsatz" : "Einsätze"}${season.avgRating !== null ? ` · Ø Note ${formatRating(season.avgRating)}` : ""}`
          : "Noch keine Einsätze."}
      </p>
      <Link
        href={`/spieler/${playerId}`}
        className="inline-block text-xs font-semibold text-accent underline-offset-4 hover:underline"
      >
        Details →
      </Link>
    </div>
  );
}
