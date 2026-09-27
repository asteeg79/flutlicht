import {
  expectation,
  formatMio,
  MARKET,
  nextPrice,
  playerSeason,
  ratingPoints,
  SCORING,
  startPrice,
} from "@fm/core";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PlayerPhoto } from "@/components/player-photo";
import { formatRating } from "@/components/player-points-info";
import {
  formatNumber,
  PartsLine,
  PartsTable,
  signed,
} from "@/components/points";
import { gameData, playerById, statsById, teamById } from "@/lib/game-data";

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
  const player = playerById.get(id);
  if (!player) notFound();
  const club = teamById.get(player.teamId)?.shortName ?? "";
  const stats = statsById.get(id);
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
          value={stats?.form != null ? formatNumber(stats.form) : "–"}
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
        <PriceHint
          price={player.price}
          start={start}
          valueEur={player.startValueEur}
          source={player.valueSource}
          vMaxEur={gameData.season.vMaxEur}
          E={expectation(
            [...appearances]
              .reverse()
              .filter((a) => a.pp!.minutes > 0)
              .map((a) => a.pp!.base),
            player.position,
          )}
        />
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
        Punkte: (Note − {formatNumber(baseline)}) × {factor}. Voll zählt die
        Note ab {fullMinutes} Minuten, bei kürzeren Einsätzen anteilig.
      </p>
      <p className="mt-1 text-kreide">
        {example ? "Letzter Einsatz" : "Beispiel"}: Note {formatRating(rating)}{" "}
        in {minutes}′ → ({formatRating(rating)} − {formatNumber(baseline)}) ×{" "}
        {factor}
        {partial ? ` × ${minutes}/${fullMinutes}` : ""} ={" "}
        {signed(ratingPoints(rating, minutes))} Punkte
      </p>
    </div>
  );
}

const SOURCE_TEXT = {
  "tm-crawl": "Transfermarkt-Marktwert zum Saisonstart",
  dcaribou: "Transfermarkt-Marktwert aus dem offenen Datensatz (Juni 2026)",
  sofascore:
    "Marktwert-Schätzung von Sofascore (kein Transfermarkt-Wert gefunden)",
  manual: "Marktwert, vom Admin eingetragen",
  missing: "noch kein Marktwert, deshalb vorerst nicht kaufbar",
} as const;

/**
 * Wie der Preis entsteht und sich entwickelt (KONZEPT 4.1, 4.3), zugeklappt. Die
 * Rechnungen kommen aus core (`startPrice`, `nextPrice`), Konstanten aus `MARKET`.
 */
function PriceHint({
  price,
  start,
  valueEur,
  source,
  vMaxEur,
  E,
}: {
  price: number;
  start: number | null;
  valueEur: number | undefined;
  source: keyof typeof SOURCE_TEXT;
  vMaxEur: number;
  E: number;
}) {
  const mioEur = (v: number) =>
    `${(v / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 2 })} Mio. €`;
  const pct = (n: number) => `${(n * 100).toLocaleString("de-DE")} %`;
  const perStep = MARKET.deltaFactor;
  const up = Math.round(E) + 10;
  const down = Math.round(E) - 10;
  return (
    <details className="group mt-4 rounded-xl border border-nacht-linie bg-nacht-hoch px-4 py-3 text-xs leading-relaxed text-kreide-matt">
      <summary className="cursor-pointer list-none font-semibold text-kreide [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>{" "}
        Wie sich der Preis berechnet
      </summary>
      <p className="mt-2 font-semibold text-kreide">Startpreis</p>
      <p>
        Grundlage ist der {SOURCE_TEXT[source]}. Damit Stars nicht unbezahlbar
        werden, wird er per Wurzel gestaucht: {MARKET.startPriceScale} × √(Wert
        ÷ höchster Wert der Liga), zwischen {formatMio(MARKET.startPriceMin)}{" "}
        und {formatMio(MARKET.startPriceMax)}
      </p>
      {valueEur !== undefined && start !== null ? (
        <p className="mt-1 text-kreide">
          Hier: {MARKET.startPriceScale} × √({mioEur(valueEur)} ÷{" "}
          {mioEur(vMaxEur)}) = {formatMio(start)}
        </p>
      ) : null}
      <p className="mt-2 font-semibold text-kreide">Nach jedem Spieltag</p>
      <p>
        Wer gespielt hat, wird mit seiner Erwartung verglichen: dem Schnitt
        seiner letzten {MARKET.formWindow} Einsätze (ohne Einsätze{" "}
        {MARKET.defaultExpectation.MID} Punkte). Je {MARKET.deltaDivisor} Punkte
        über der Erwartung steigt der Preis um {pct(perStep)}, darunter fällt er
        entsprechend, höchstens um {pct(MARKET.deltaCap)} pro Spieltag. Ohne
        Einsatz bleibt er gleich. Der Preis bleibt zwischen{" "}
        {formatMio(MARKET.priceMin)} und {formatMio(MARKET.priceMax)}
      </p>
      <p className="mt-1 text-kreide">
        Hier: Erwartung {formatNumber(E)} Punkte. Mit {up} Punkten ginge es von{" "}
        {formatMio(price)} auf {formatMio(nextPrice(price, up, E))}, mit {down}{" "}
        auf {formatMio(nextPrice(price, down, E))}
      </p>
    </details>
  );
}
