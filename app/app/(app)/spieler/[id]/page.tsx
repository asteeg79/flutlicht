import {
  expectationFor,
  formatMio,
  lastPricedMatchday,
  MARKET,
  nextPrice,
  playerSeason,
  priceChange,
  ratingPoints,
  SCORING,
  startPrice,
} from "@fm/core";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/arena/back-link";
import { BoardTile } from "@/components/arena/board-tile";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody, SectionTitle, TwoCol } from "@/components/arena/page-layout";
import { Trend } from "@/components/arena/market-row";
import { PlayerPhoto } from "@/components/player-photo";
import { formatRating } from "@/components/player-points-info";
import {
  formatNumber,
  PartsLine,
  partEntries,
  signed,
} from "@/components/points";
import { mioNumber } from "@/lib/format";
import { gameData, playerById, statsById, teamById } from "@/lib/game-data";
import { POS_LABEL } from "@/lib/positions";
import { currentManager } from "@/lib/session";

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
  const me = await currentManager();
  const team = teamById.get(player.teamId);
  const club = team?.shortName ?? "";
  const stats = statsById.get(id);
  const season = playerSeason(gameData.points, id);
  const history = gameData.history[String(id)] ?? [];
  const start =
    player.startValueEur !== undefined
      ? startPrice(player.startValueEur, gameData.season.vMaxEur)
      : null;
  const delta = priceChange(
    history,
    player.price,
    start ?? player.price,
    lastPricedMatchday(gameData.history),
  );
  const appearances = gameData.points
    .map((md) => ({
      matchday: md.matchday,
      pp: md.players[String(id)],
    }))
    .filter(
      (a): a is { matchday: number; pp: NonNullable<typeof a.pp> } =>
        a.pp !== undefined,
    );
  const played = appearances.filter((a) => a.pp.minutes > 0);
  const opponent = (matchday: number) => {
    const f = gameData.fixtures.find(
      (x) =>
        x.matchday === matchday &&
        (x.homeTeamId === player.teamId || x.awayTeamId === player.teamId),
    );
    if (!f) return null;
    const home = f.homeTeamId === player.teamId;
    return `${teamById.get(home ? f.awayTeamId : f.homeTeamId)?.shortName} (${home ? "H" : "A"})`;
  };
  const inSquad = me.squad.includes(id);
  const captain = me.lineup?.captain === id;
  const meta = [
    club,
    POSITION[player.position],
    inSquad ? "im Kader" : null,
    captain ? "Kapitän" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const canBuy =
    !inSquad && me.squad.length > 0 && player.purchasable && player.active;

  // Formkurve: letzte 8 Einsätze, Höhe relativ zum Maximum.
  const bars = played.slice(-8);
  const barMax = Math.max(1, ...bars.map((a) => Math.abs(a.pp.base)));
  const parts = season ? partEntries(season.parts) : [];
  const partMax = Math.max(1, ...parts.map((p) => Math.abs(p.value)));
  const prices = [
    ...(start !== null
      ? [{ label: "Start", price: start, diff: null as number | null }]
      : []),
    ...history.map((h, i) => ({
      label: `nach ${h.matchday}.`,
      price: h.price,
      diff: h.price - (i === 0 ? (start ?? h.price) : history[i - 1]!.price),
    })),
  ];

  const holen = canBuy ? (
    <Link
      href={`/markt?holen=${id}`}
      className="slant flex h-[50px] items-center justify-center bg-lampe font-display text-[21px] font-black text-nacht uppercase shadow-[0_0_30px_rgb(255_213_74/0.35)]"
    >
      Holen · {mioNumber(player.price)} Mio
    </Link>
  ) : null;

  return (
    <>
      <HeroHeader
        above={<BackLink />}
        title={
          <span className="flex items-end gap-4">
            <span className="relative h-16 w-16 shrink-0">
              <PlayerPhoto
                src={player.image}
                className="h-16 w-16 border-[3px] border-lampe shadow-[0_0_30px_rgb(255_213_74/0.45)]"
              />
              <img
                src={team?.logo}
                alt=""
                className="absolute bottom-0 -left-1 h-7 w-7 rounded-full bg-white p-[3px]"
              />
              <span className="absolute -right-2.5 bottom-1 bg-kreide px-[7px] pt-0.5 pb-px font-display text-sm leading-[15px] font-black text-nacht">
                {POS_LABEL[player.position]}
              </span>
            </span>
            <span className="min-w-0">
              <span className="mb-1 block truncate font-sans text-[11px] font-bold tracking-[0.14em] text-hero-muted normal-case">
                {meta.toUpperCase()}
              </span>
              <span className="block truncate text-[34px] lg:text-5xl">
                {player.name}
              </span>
            </span>
          </span>
        }
        compact={{
          title: player.name,
          right: `${mioNumber(player.price)} Mio`,
        }}
        board="grid"
      >
        <div className="col-span-2 grid grid-cols-3 gap-1.5 lg:flex lg:gap-2">
          <BoardTile
            accent
            label="Preis"
            value={
              <>
                {mioNumber(player.price)}{" "}
                {delta !== 0 ? (
                  <span
                    className={`text-sm ${delta > 0 ? "text-gruen-hell" : "text-karte-hell"}`}
                  >
                    {delta > 0 ? "▲" : "▼"}
                    {mioNumber(Math.abs(delta))}
                  </span>
                ) : null}
              </>
            }
          />
          <BoardTile label="Punkte" value={stats?.points ?? 0} />
          <BoardTile
            label="Form"
            value={
              stats?.form != null
                ? formatNumber(stats.form).replace("-", "−")
                : "–"
            }
          />
        </div>
      </HeroHeader>
      <PageBody>
        {!player.active ? (
          <p className="mb-4 text-sm font-semibold text-down">
            Nicht mehr in der Bundesliga, kann nur noch verkauft werden.
          </p>
        ) : null}
        {holen ? <div className="mb-5 lg:hidden">{holen}</div> : null}
        <TwoCol
          main={
            <div className="flex flex-col gap-[22px]">
              <section>
                <SectionTitle>Formkurve</SectionTitle>
                {bars.length === 0 ? (
                  <p className="text-sm text-muted">Noch keine Einsätze.</p>
                ) : (
                  <>
                    <div
                      aria-label="Punkte je Einsatz"
                      role="img"
                      className="flex h-[150px] items-end gap-2.5 border-b-2 border-line px-1"
                    >
                      {bars.map((a) => (
                        <div
                          key={a.matchday}
                          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                        >
                          <span className="font-display text-xl font-black">
                            {a.pp.base < 0 ? `−${-a.pp.base}` : a.pp.base}
                          </span>
                          <div
                            style={{
                              height: `${Math.max(4, (Math.abs(a.pp.base) / barMax) * 100)}%`,
                            }}
                            className={`w-full slant-sm ${a.pp.base >= 10 ? "bg-lampe" : a.pp.base < 0 ? "bg-karte" : "bg-line"}`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2.5 px-1 pt-1.5">
                      {bars.map((a) => (
                        <span
                          key={a.matchday}
                          className="flex-1 text-center text-[11px] font-semibold text-muted"
                        >
                          {a.matchday}. Sp.
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section>
                <SectionTitle>Punkte je Spieltag</SectionTitle>
                {appearances.length === 0 ? (
                  <p className="text-sm text-muted">Noch keine Einsätze.</p>
                ) : (
                  <ul>
                    {[...appearances].reverse().map(({ matchday, pp }) => (
                      <li
                        key={matchday}
                        className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3 border-b border-line py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-display text-[19px] leading-none font-black uppercase">
                              {matchday}. Spieltag
                            </span>
                            <span className="text-xs font-medium text-muted">
                              {[
                                opponent(matchday),
                                `${pp.minutes}′`,
                                pp.rating !== null
                                  ? `Note ${formatRating(pp.rating)}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </p>
                          <div className="mt-[3px] [&_p]:text-[11px]">
                            {pp.minutes > 0 ? (
                              <PartsLine parts={pp.parts} />
                            ) : (
                              <p className="text-muted">nicht eingesetzt</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`slant justify-self-end px-1.5 pt-[3px] pb-0.5 text-center font-display text-2xl leading-none font-black min-w-10 ${pp.base >= 10 ? "bg-lampe text-nacht" : pp.base < 0 ? "bg-karte-tief text-white" : "bg-surface"}`}
                        >
                          {signed(pp.base)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <SectionTitle>Preisverlauf</SectionTitle>
                {prices.length > 1 ? (
                  <ul className="-mr-[18px] flex gap-1.5 overflow-x-auto pr-[18px] [scrollbar-width:none] lg:mr-0 lg:flex-wrap lg:pr-0">
                    {prices.map((p) => (
                      <li
                        key={p.label}
                        className={`min-w-16 shrink-0 border-b-[3px] bg-surface px-2.5 py-2 ${p.diff === null || p.diff === 0 ? "border-line" : p.diff > 0 ? "border-up" : "border-down"}`}
                      >
                        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                          {p.label}
                        </p>
                        <p className="mt-0.5 font-display text-[22px] leading-none font-black">
                          {mioNumber(p.price)}
                        </p>
                        {p.diff !== null ? (
                          <p className="mt-0.5 font-display text-[13px] font-extrabold">
                            {p.diff === 0 ? (
                              <span className="text-muted">±0</span>
                            ) : (
                              <Trend delta={Math.round(p.diff * 10) / 10} />
                            )}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">
                    {start !== null ? `Startpreis ${formatMio(start)}, ` : ""}
                    seit Saisonstart unverändert.
                  </p>
                )}
                <PriceHint
                  price={player.price}
                  start={start}
                  valueEur={player.startValueEur}
                  source={player.valueSource}
                  vMaxEur={gameData.season.vMaxEur}
                  E={expectationFor(gameData.points, id, player.position)}
                />
              </section>
            </div>
          }
          side={
            <>
              {holen ? <div className="hidden lg:block">{holen}</div> : null}
              {season ? (
                <section>
                  <SectionTitle>So kamen die Punkte</SectionTitle>
                  <p className="mb-2 text-[13px] font-medium text-muted">
                    {season.appearances}{" "}
                    {season.appearances === 1 ? "Einsatz" : "Einsätze"} ·{" "}
                    {season.minutes}′
                    {season.avgRating !== null
                      ? ` · Ø Note ${formatRating(season.avgRating)}`
                      : ""}
                  </p>
                  <ul>
                    {parts.map((p) => (
                      <li
                        key={p.key}
                        className="grid grid-cols-[90px_minmax(0,1fr)_44px] items-center gap-2.5 py-1.5"
                      >
                        <span className="text-[13px] font-semibold">
                          {p.label}
                        </span>
                        <span className="h-2.5 bg-surface">
                          <span
                            style={{
                              width: `${(Math.abs(p.value) / partMax) * 100}%`,
                            }}
                            className={`block h-full ${p.value > 0 ? "bg-lampe" : "bg-karte"}`}
                          />
                        </span>
                        <span
                          className={`text-right font-display text-lg font-black ${p.value < 0 ? "text-down" : ""}`}
                        >
                          {signed(p.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 flex justify-between border-t-2 border-line pt-2">
                    <span className="text-[13px] font-bold">
                      Summe (je Spiel gerundet)
                    </span>
                    <span className="font-display text-[22px] font-black">
                      {season.points} P.
                    </span>
                  </p>
                </section>
              ) : null}
              <RatingHint
                example={
                  [...played].reverse().find((a) => a.pp.rating !== null)?.pp ??
                  null
                }
              />
            </>
          }
        />
      </PageBody>
    </>
  );
}

const RATING_STEPS = [
  { range: "3–6", label: "schwach", look: "bg-karte-tief text-white" },
  { range: "6–7", label: "solide", look: "bg-line text-text" },
  { range: "7–8", label: "gut", look: "bg-gruen-hell text-nacht" },
  { range: "8–10", label: "sehr gut", look: "bg-lampe text-nacht" },
];

/**
 * Woher die Note kommt und was sie in Punkten bedeutet (KONZEPT 3.1), aufklappbar.
 * Beispiel ist der jüngste Einsatz mit Note; ohne einen solchen 7,4 über 90 Minuten.
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
  const pts = ratingPoints(rating, minutes);
  return (
    <details className="group border-l-4 border-lampe bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 px-3.5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center bg-lampe font-display text-base font-black text-nacht">
            ?
          </span>
          <span className="font-display text-lg font-black uppercase">
            Wie die Note zählt
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className="h-[18px] w-[18px] text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-3.5 pb-3.5 text-xs leading-relaxed text-muted">
        <p>
          Die Note stammt von <strong className="text-text">Sofascore</strong>{" "}
          und wird nach jedem Spiel automatisch aus den Spielstatistiken
          berechnet – etwa Pässe, Zweikämpfe, Torschüsse und Fehler.
        </p>
        <div className="my-2.5 grid grid-cols-4 gap-[3px]">
          {RATING_STEPS.map((s) => (
            <div key={s.range} className={`px-1 py-1.5 text-center ${s.look}`}>
              <p className="font-display text-base leading-none font-black">
                {s.range}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
        <p>
          Punkte:{" "}
          <strong className="text-text">
            (Note − {formatNumber(baseline)}) × {factor}
          </strong>
          . Voll zählt die Note ab {fullMinutes} Minuten, bei kürzeren Einsätzen
          anteilig.
        </p>
        <div className="mt-2.5 bg-bg px-3 py-2.5 text-text">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">
            {example ? "Letzter Einsatz" : "Beispiel"}
          </p>
          <p className="mt-1 font-display text-[17px] font-extrabold">
            Note {formatRating(rating)} in {minutes}′ → ({formatRating(rating)}{" "}
            − {formatNumber(baseline)}) × {factor}
            {partial ? ` × ${minutes}/${fullMinutes}` : ""} ={" "}
            <span className={pts >= 0 ? "text-up" : "text-down"}>
              {signed(pts)} Punkte
            </span>
          </p>
        </div>
      </div>
    </details>
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
    <details className="group mt-3 bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-[17px] font-black text-text uppercase [&::-webkit-details-marker]:hidden">
        Wie sich der Preis berechnet
        <ChevronDown
          aria-hidden
          className="h-[18px] w-[18px] text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="mt-2 font-semibold text-text">Startpreis</p>
      <p>
        Grundlage ist der {SOURCE_TEXT[source]}. Damit Stars nicht unbezahlbar
        werden, wird er per Wurzel gestaucht: {MARKET.startPriceScale} × √(Wert
        ÷ höchster Wert der Liga), zwischen {formatMio(MARKET.startPriceMin)}{" "}
        und {formatMio(MARKET.startPriceMax)}
      </p>
      {valueEur !== undefined && start !== null ? (
        <p className="mt-1 text-text">
          Hier: {MARKET.startPriceScale} × √({mioEur(valueEur)} ÷{" "}
          {mioEur(vMaxEur)}) = {formatMio(start)}
        </p>
      ) : null}
      <p className="mt-2 font-semibold text-text">Nach jedem Spieltag</p>
      <p>
        Wer gespielt hat, wird mit seiner Erwartung verglichen: dem Schnitt
        seiner letzten {MARKET.formWindow} Einsätze (ohne Einsätze{" "}
        {MARKET.defaultExpectation.MID} Punkte). Je {MARKET.deltaDivisor} Punkte
        über der Erwartung steigt der Preis um {pct(perStep)}, darunter fällt er
        entsprechend, höchstens um {pct(MARKET.deltaCap)} pro Spieltag. Ohne
        Einsatz bleibt er gleich. Der Preis bleibt zwischen{" "}
        {formatMio(MARKET.priceMin)} und {formatMio(MARKET.priceMax)}
      </p>
      <p className="mt-1 text-text">
        Hier: Erwartung {formatNumber(E)} Punkte. Mit {up} Punkten ginge es von{" "}
        {formatMio(price)} auf {formatMio(nextPrice(price, up, E))}, mit {down}{" "}
        auf {formatMio(nextPrice(price, down, E))}
      </p>
    </details>
  );
}
