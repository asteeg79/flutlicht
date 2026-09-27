import {
  formatMio,
  playerSeason,
  playerStats,
  ratingPoints,
  SCORING,
  startPrice,
} from "@fm/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PlayerPhoto } from "@/components/player-photo";
import { formatRating } from "@/components/player-points-info";
import { PartsLine, PartsTable, signed } from "@/components/points";
import { gameData } from "@/lib/game-data";

export const metadata = { title: "Spieler" };

const POSITION = {
  GK: "Torhüter",
  DEF: "Abwehr",
  MID: "Mittelfeld",
  FWD: "Sturm",
} as const;

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  const player = gameData.players.find((p) => p.id === id);
  if (!player) notFound();
  const club =
    gameData.teams.find((t) => t.id === player.teamId)?.shortName ?? "";
  const stats = playerStats(gameData.points).get(id);
  const season = playerSeason(gameData.points, id);
  const history = gameData.history[String(id)] ?? [];
  const start =
    player.startValueEur !== undefined
      ? startPrice(player.startValueEur, gameData.season.vMaxEur)
      : null;
  const appearances = gameData.points
    .map((md) => ({
      matchday: md.matchday,
      status: md.status,
      pp: md.players[String(id)],
    }))
    .filter((a) => a.pp !== undefined)
    .reverse();

  return (
    <>
      <div className="flex items-end gap-4">
        <PlayerPhoto src={player.image} className="mb-6 h-20 w-20" />
        <PageHeader
          context={`${club} · ${POSITION[player.position]}`}
          title={player.name}
        />
      </div>
      <dl className="mb-8 grid grid-cols-3 gap-3">
        <Stat label="Preis" value={formatMio(player.price)} />
        <Stat label="Punkte" value={String(stats?.points ?? 0)} />
        <Stat
          label="Form"
          value={
            stats?.form != null
              ? stats.form.toLocaleString("de-DE", { maximumFractionDigits: 1 })
              : "–"
          }
        />
      </dl>
      {!player.active ? (
        <p className="mb-6 text-sm text-karte">
          Nicht mehr in der Bundesliga, kann nur noch verkauft werden.
        </p>
      ) : null}

      {season ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
            So kamen die Punkte zustande
          </h2>
          <p className="mb-2 text-sm">
            {season.appearances}{" "}
            {season.appearances === 1 ? "Einsatz" : "Einsätze"} ·{" "}
            {season.minutes}′
            {season.avgRating !== null
              ? ` · Ø Note ${formatRating(season.avgRating)}`
              : ""}
          </p>
          <PartsTable parts={season.parts} />
          <p className="mt-2 flex justify-between border-t border-nacht-linie pt-2 text-sm font-semibold">
            <span>Summe (je Spiel gerundet)</span>
            <span>{season.points} P.</span>
          </p>
          <RatingHint
            example={
              appearances.find(
                (a) => a.pp!.rating !== null && a.pp!.minutes > 0,
              )?.pp ?? null
            }
          />
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
          Preisverlauf
        </h2>
        <ul className="space-y-1 text-sm tabular-nums">
          {start !== null ? (
            <li className="flex justify-between">
              <span className="text-kreide-matt">Startpreis</span>
              <span>{formatMio(start)}</span>
            </li>
          ) : null}
          {history.map((h) => (
            <li key={h.matchday} className="flex justify-between">
              <span className="text-kreide-matt">
                nach {h.matchday}. Spieltag
              </span>
              <span>{formatMio(h.price)}</span>
            </li>
          ))}
          {history.length === 0 ? (
            <li className="text-kreide-matt">Seit Saisonstart unverändert.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
          Punkte je Spieltag
        </h2>
        {appearances.length === 0 ? (
          <p className="text-sm text-kreide-matt">Noch keine Einsätze.</p>
        ) : (
          <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch">
            {appearances.map(({ matchday, pp }) => (
              <li key={matchday} className="flex items-start gap-3 px-4 py-2.5">
                <div className="flex-1">
                  <p className="font-medium">
                    {matchday}. Spieltag{" "}
                    <span className="text-sm text-kreide-matt">
                      · {pp!.minutes}′
                      {pp!.rating !== null
                        ? ` · Note ${formatRating(pp!.rating)}`
                        : ""}
                    </span>
                  </p>
                  <PartsLine parts={pp!.parts} />
                </div>
                <span className="font-display text-2xl font-bold tabular-nums">
                  {pp!.base}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-nacht-linie bg-nacht-hoch p-3">
      <dt className="text-xs text-kreide-matt">{label}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Woher die Note kommt und was sie in Punkten bedeutet (KONZEPT 3.1). Beispiel ist der
 * jüngste Einsatz mit Note; ohne einen solchen eine Note von 7,4 über 90 Minuten.
 */
function RatingHint({
  example,
}: {
  example: { rating: number | null; minutes: number } | null;
}) {
  const { baseline, factor, fullMinutes } = SCORING.rating;
  const rating = example?.rating ?? 7.4;
  const minutes = example?.minutes ?? 90;
  const partial = minutes < fullMinutes;
  const fmt = (n: number) => n.toLocaleString("de-DE");
  return (
    <div className="mt-4 rounded-xl border border-nacht-linie bg-nacht-hoch px-4 py-3 text-xs leading-relaxed text-kreide-matt">
      <p className="mb-1 font-semibold text-kreide">Wie die Note zählt</p>
      <p>
        Die Note stammt von Sofascore und wird nach jedem Spiel automatisch aus
        den Spielstatistiken berechnet, etwa Pässe, Zweikämpfe, Torschüsse und
        Fehler. Die Skala reicht von 3 bis 10, die meisten Noten liegen zwischen
        6 und 8: unter 6 ist schwach, ab 7 gut, ab 8 sehr gut.
      </p>
      <p className="mt-1">
        Punkte: (Note − {fmt(baseline)}) × {factor}. Voll zählt die Note ab{" "}
        {fullMinutes} Minuten, bei kürzeren Einsätzen anteilig.
      </p>
      <p className="mt-1 text-kreide">
        {example ? "Letzter Einsatz" : "Beispiel"}: Note {formatRating(rating)}{" "}
        in {minutes}′ → ({formatRating(rating)} − {fmt(baseline)}) × {factor}
        {partial ? ` × ${minutes}/${fullMinutes}` : ""} ={" "}
        {signed(ratingPoints(rating, minutes))} Punkte
      </p>
    </div>
  );
}
