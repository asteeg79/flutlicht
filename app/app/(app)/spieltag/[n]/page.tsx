import {
  formatMio,
  lockAt,
  MARKET,
  matchdayRanks,
  RULES,
  SCORING,
  type Fixture,
} from "@fm/core";
import { Check, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CountdownText } from "@/components/arena/countdown";
import { FixtureRow, type FixtureState } from "@/components/arena/fixture-row";
import { HeroHeader } from "@/components/arena/hero-header";
import { LiveBanner, LiveTotal } from "@/components/arena/live";
import type { LiveSlot } from "@/components/arena/live-diff";
import { PageBody, SectionTitle } from "@/components/arena/page-layout";
import { PulseDot } from "@/components/arena/slant-tag";
import { PlayerPhoto } from "@/components/player-photo";
import {
  formatNumber,
  PartsLine,
  signed,
  signedMio,
  STATUS_LABEL,
} from "@/components/points";
import { formatRating } from "@/components/player-points-info";
import { formatWeekdayTime, lastName } from "@/lib/format";
import { gameData, opponentLabel, playerById, teamById } from "@/lib/game-data";
import { POS_LABEL } from "@/lib/positions";
import { allManagers, currentManager } from "@/lib/session";
import {
  matchdayView,
  type ManagerMatchdayView,
  type MatchdayView,
  type SlotView,
} from "@/lib/standings";

export const metadata = { title: "Spieltag" };

type SlotStatus = "live" | "done" | "open";

export default async function MatchdayPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > RULES.matchdays) notFound();
  const [me, managers] = await Promise.all([currentManager(), allManagers()]);
  const now = new Date();
  const view = matchdayView(n, managers, me.userId, now);
  const own = view.managers.find((m) => m.own);
  const ranks = matchdayRanks(view.managers);
  // matchdayView liefert schon nach Punkten sortiert (eigener Manager zuerst).
  const others = view.managers.filter((m) => !m.own);
  const fixtures = gameData.fixtures.filter((f) => f.matchday === n);
  const team = (id: number) => teamById.get(id);
  const fixtureOf = (teamId: number | undefined) =>
    fixtures.find((f) => f.homeTeamId === teamId || f.awayTeamId === teamId);
  const live = view.status === "running" || view.status === "provisional";
  const rank = own ? ranks.get(own.userId) : undefined;
  const count = view.managers.length;

  /** Status eines Spielers im laufenden Spieltag aus dem Spiel seines Vereins. */
  const statusOf = (slot: SlotView): SlotStatus => {
    const f = fixtureOf((slot.player ?? slot.starter).teamId);
    if (!f || f.status === "finished" || f.dataState !== "none") return "done";
    return f.status === "live" || Date.parse(f.kickoffUtc) <= now.getTime()
      ? "live"
      : "open";
  };

  const nav = (
    <nav aria-label="Spieltage" className="flex gap-2">
      {n > 1 ? (
        <NavLink
          href={`/spieltag/${n - 1}`}
          label="Vorheriger Spieltag"
          icon="prev"
        />
      ) : null}
      {n < RULES.matchdays ? (
        <NavLink
          href={`/spieltag/${n + 1}`}
          label="Nächster Spieltag"
          icon="next"
        />
      ) : null}
    </nav>
  );

  const liveSlots: LiveSlot[] = own
    ? own.slots.map((s) => ({
        id: s.starter.id,
        name: lastName((s.player ?? s.starter).shortName),
        points: s.points,
        captain: s.captain,
      }))
    : [];
  const openSlots =
    own && live ? own.slots.filter((s) => statusOf(s) === "open") : [];
  const nextKickoff = openSlots
    .map((s) => fixtureOf((s.player ?? s.starter).teamId)?.kickoffUtc)
    .filter((k): k is string => k !== undefined)
    .sort((a, b) => a.localeCompare(b))[0];

  // ——— Kopf ———
  let hero: ReactNode;
  if (view.status === "upcoming") {
    const lineup = me.lineup;
    const starters = lineup?.starters ?? [];
    const firstGame = [...fixtures]
      .filter((f) => f.status !== "postponed" && lockAt(f) > now)
      .sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc))[0];
    const lockedThen = firstGame
      ? starters
          .map((id) => playerById.get(id))
          .filter(
            (p) =>
              p &&
              (p.teamId === firstGame.homeTeamId ||
                p.teamId === firstGame.awayTeamId),
          )
          .map((p) => lastName(p!.shortName))
      : [];
    hero = (
      <HeroHeader
        guide={{ chapter: "punkte", label: "So entstehen Punkte" }}
        tag={STATUS_LABEL.upcoming}
        right={nav}
        title={`${n}. Spieltag`}
        compact={{
          title: `${n}. Spieltag`,
          right: firstGame ? (
            <>
              Fixiert in{" "}
              <CountdownText
                target={lockAt(firstGame).toISOString()}
                serverNow={now.toISOString()}
              />
            </>
          ) : undefined,
        }}
      >
        {firstGame ? (
          <Board className="lg:min-w-[360px]">
            <p className={LABEL}>Erste Spieler fixiert in</p>
            <p className="mt-0.5 font-display text-[40px] leading-[0.95] font-black text-board-num">
              <CountdownText
                target={lockAt(firstGame).toISOString()}
                serverNow={now.toISOString()}
              />
            </p>
            <p className="mt-1.5 text-xs font-semibold opacity-85">
              Anpfiff {formatWeekdayTime(firstGame.kickoffUtc)} ·{" "}
              {team(firstGame.homeTeamId)?.shortName} –{" "}
              {team(firstGame.awayTeamId)?.shortName}
              {lockedThen.length > 0
                ? ` · dann fixiert: ${lockedThen.join(", ")}`
                : ""}
            </p>
          </Board>
        ) : null}
      </HeroHeader>
    );
  } else {
    const bonus = own?.bonus;
    hero = (
      <HeroHeader
        guide={{ chapter: "punkte", label: "So entstehen Punkte" }}
        tag={live ? "Live · läuft" : STATUS_LABEL[view.status]}
        tagVariant={live ? "live" : "hero"}
        right={nav}
        title={`${n}. Spieltag${live ? " · live" : ""}`}
        compact={{
          title: `${n}. Spieltag${live ? " · live" : ""}`,
          right: own ? `${own.total} P. · Platz ${rank}` : undefined,
        }}
      >
        {own ? (
          <div className="w-full lg:w-auto">
            <Board className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-4 lg:min-w-[420px]">
              <div>
                <p className={LABEL}>{live ? "Live-Punkte" : "Deine Punkte"}</p>
                <p className="font-display text-[52px] leading-[0.85] font-black text-board-num tabular-nums lg:text-[40px]">
                  {live ? (
                    <LiveTotal
                      matchday={n}
                      total={own.total}
                      slots={liveSlots}
                    />
                  ) : (
                    own.total
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-[5px] pb-0.5">
                <div>
                  <p className={LABEL}>Im Spieltag{live ? " · live" : ""}</p>
                  <p className="font-display text-xl leading-none font-black">
                    Platz {rank}{" "}
                    <span className="text-base opacity-70">von {count}</span>
                  </p>
                </div>
                {live && openSlots.length > 0 ? (
                  <div>
                    <p className={LABEL}>Noch offen</p>
                    <p className="font-display text-xl leading-none font-black">
                      {openSlots.length} Spieler{" "}
                      {nextKickoff ? (
                        <span className="text-base opacity-70">
                          ab {formatWeekdayTime(nextKickoff)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                ) : bonus ? (
                  <div>
                    <p className={LABEL}>
                      Prämie · {BONUS_SHORT[bonusState(view)]}
                    </p>
                    <p className="font-display text-xl leading-none font-black text-board-num">
                      {signedMio(bonus.bonus)}
                    </p>
                  </div>
                ) : null}
              </div>
            </Board>
            {live ? <LiveBanner matchday={n} slots={liveSlots} /> : null}
          </div>
        ) : null}
      </HeroHeader>
    );
  }

  // ——— Spalten ———
  const shadowNote =
    view.shadow && view.managers.length > 0 ? (
      <p className="mb-4 border-2 border-lampe bg-surface px-4 py-3 text-sm lg:col-span-3">
        <span className="font-semibold">Schattenbetrieb:</span> Dieser Spieltag
        zählt noch nicht. Punkte und Prämie siehst du zur Probe, gewertet und
        gutgeschrieben wird ab Spieltag {gameData.season.firstScoredMatchday}.
      </p>
    ) : null;

  let ownColumn: ReactNode;
  if (view.status === "upcoming") {
    const lineup = me.lineup;
    const noMatch = lineup
      ? lineup.starters.filter((id) => {
          const p = playerById.get(id);
          return p && !fixtureOf(p.teamId);
        }).length
      : 0;
    const locks = lineup
      ? lineup.starters
          .map((id) => fixtureOf(playerById.get(id)?.teamId))
          .filter((f): f is Fixture => f !== undefined)
          .map((f) => lockAt(f).getTime())
      : [];
    const firstLockAt = locks.length > 0 ? Math.min(...locks) : null;
    ownColumn = (
      <section>
        <SectionTitle
          aside={
            lineup ? (
              noMatch === 0 ? (
                <span className="flex items-center gap-1 text-xs font-bold tracking-normal text-up normal-case">
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />{" "}
                  vollständig
                </span>
              ) : (
                <span className="text-xs font-bold tracking-normal text-down normal-case">
                  {noMatch} Starter ohne Spiel
                </span>
              )
            ) : undefined
          }
        >
          Deine Elf
        </SectionTitle>
        {lineup ? (
          <>
            <ul>
              {lineup.starters.map((id) => {
                const p = playerById.get(id);
                if (!p) return null;
                const f = fixtureOf(p.teamId);
                const lock = f ? lockAt(f) : null;
                return (
                  <li
                    key={id}
                    className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line py-2"
                  >
                    <PlayerPhoto src={p.image} className="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-baseline gap-1.5 font-display text-lg leading-none font-black uppercase">
                        <span className="truncate">{p.name}</span>
                        {/* Position steht außerhalb der Kürzung, auch bei langen Namen. */}
                        <span className="shrink-0 text-[13px] text-muted">
                          {POS_LABEL[p.position]}
                          {lineup.captain === id ? " · C" : ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted">
                        {f ? opponentLabel(f, p.teamId) : "kein Spiel"}
                      </span>
                    </span>
                    {lock ? (
                      <span
                        className={`font-display text-sm font-extrabold tracking-[0.04em] whitespace-nowrap uppercase ${lock.getTime() === firstLockAt ? "text-down" : "text-muted"}`}
                      >
                        Fixiert {formatWeekdayTime(lock.toISOString())}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Link
              href="/team"
              className="slant mt-3.5 flex h-[50px] items-center justify-center bg-lampe font-display text-[21px] font-black text-nacht uppercase"
            >
              Aufstellung ändern
            </Link>
          </>
        ) : (
          <p className="text-muted">
            Noch kein Kader. Stell ihn auf dem{" "}
            <Link href="/markt" className="text-accent underline">
              Markt
            </Link>{" "}
            zusammen.
          </p>
        )}
      </section>
    );
  } else if (own) {
    ownColumn = (
      <section aria-label="Deine Punkte">
        <SectionTitle>Deine Elf</SectionTitle>
        <ul>
          {own.slots.map((s) => (
            <SlotRow
              key={s.starter.id}
              slot={s}
              status={live ? statusOf(s) : null}
              fixture={fixtureOf((s.player ?? s.starter).teamId)}
            />
          ))}
        </ul>
        <dl className="flex flex-col gap-1.5 pt-3 text-[13px] font-medium">
          {own.captainBonus !== 0 ? (
            <Sum label="Kapitän doppelt" value={signed(own.captainBonus)} />
          ) : null}
          {own.transferPenalty !== 0 ? (
            <Sum
              label="Transferabzug"
              value={signed(-own.transferPenalty)}
              tone="text-down"
            />
          ) : null}
          {own.bonus ? (
            <Sum
              label={
                <>
                  {BONUS_LABEL[bonusState(view)]}
                  <span className="block text-[11px]">
                    Median der Liga {formatNumber(own.bonus.median)} P. ·{" "}
                    {MARKET.bonusPerPoint.toLocaleString("de-DE")} Mio. je Punkt
                    darüber, höchstens {formatMio(MARKET.bonusCap)}
                  </span>
                </>
              }
              value={signedMio(own.bonus.bonus)}
              tone={own.bonus.bonus > 0 ? "text-up" : undefined}
            />
          ) : null}
        </dl>
        {live ? (
          <p className="mt-2.5 text-xs font-medium text-muted">
            Live-Punkte sind vorläufig. Final werden sie, wenn alle Spiele des
            Spieltags gewertet sind.
          </p>
        ) : null}
      </section>
    );
  } else {
    ownColumn = (
      <section>
        <SectionTitle>Deine Elf</SectionTitle>
        <p className="text-muted">
          {n < me.firstMatchday
            ? `Für dich zählt erst Spieltag ${me.firstMatchday}.`
            : "Ohne Kader gibt es keine Punkte. Stell ihn auf dem Markt zusammen."}
        </p>
      </section>
    );
  }

  const othersColumn = (
    <section>
      <SectionTitle>Die anderen{live ? " · live" : ""}</SectionTitle>
      {view.status === "upcoming" ? (
        <div className="flex items-center gap-3 bg-surface px-3.5 py-3">
          <EyeOff
            aria-hidden
            className="h-[22px] w-[22px] shrink-0 text-muted"
            strokeWidth={2.2}
          />
          <span className="text-[13px] leading-snug font-medium">
            Die Aufstellungen der anderen Manager sind verdeckt – jeder Spieler
            wird sichtbar, sobald sein Spiel gesperrt ist (90 Min. vor Anpfiff).
          </span>
        </div>
      ) : others.length === 0 ? (
        <p className="text-sm text-muted">
          Keine anderen Manager an diesem Spieltag.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {others.map((m) => (
            <OtherCard
              key={m.userId}
              view={m}
              rank={ranks.get(m.userId) ?? 0}
              state={bonusState(view)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  const fixturesColumn = (
    <section>
      <SectionTitle>Spiele</SectionTitle>
      <ul>
        {fixtures.map((f) => (
          <FixtureRow
            key={f.openligaMatchId}
            home={team(f.homeTeamId)?.shortName ?? ""}
            away={team(f.awayTeamId)?.shortName ?? ""}
            homeLogo={team(f.homeTeamId)?.logo}
            awayLogo={team(f.awayTeamId)?.logo}
            state={fixtureState(f, now)}
          />
        ))}
      </ul>
    </section>
  );

  return (
    <>
      {hero}
      <PageBody>
        {shadowNote}
        <div className="flex flex-col gap-[22px] lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-7">
          {ownColumn}
          {othersColumn}
          {fixturesColumn}
        </div>
      </PageBody>
    </>
  );
}

const LABEL = "text-[11px] font-bold tracking-[0.14em] uppercase opacity-80";

function Board({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-board-bg px-3 py-2 text-board-text lg:px-4 lg:py-2.5 ${className}`}
    >
      {children}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: "prev" | "next";
}) {
  const Icon = icon === "prev" ? ChevronLeft : ChevronRight;
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center border-2 border-hero-muted/60"
    >
      <Icon aria-hidden className="h-5 w-5" strokeWidth={2.4} />
    </Link>
  );
}

function fixtureState(f: Fixture, now: Date): FixtureState {
  if (f.status === "postponed") return { kind: "postponed" };
  const score = f.score ? `${f.score.home}:${f.score.away}` : null;
  if (f.status === "finished" && score) return { kind: "done", score };
  if (
    f.status === "live" ||
    (Date.parse(f.kickoffUtc) <= now.getTime() && f.status !== "finished")
  )
    return { kind: "live", score: score ?? "–:–", label: "läuft" };
  return { kind: "open", kickoff: formatWeekdayTime(f.kickoffUtc) };
}

type BonusState = "shadow" | "credited" | "expected";

function bonusState(view: MatchdayView): BonusState {
  if (view.shadow) return "shadow";
  return view.status === "final" ? "credited" : "expected";
}

const BONUS_LABEL: Record<BonusState, string> = {
  shadow: "Prämie (Schattenbetrieb, nicht gutgeschrieben)",
  credited: "Prämie gutgeschrieben",
  expected: "Prämie voraussichtlich",
};
const BONUS_SHORT: Record<BonusState, string> = {
  shadow: "zur Probe",
  credited: "gutgeschrieben",
  expected: "voraussichtlich",
};

/** Punkte-Tag rechts: ab 10 gelb, negativ rot. */
function pointsTag(points: number | null): string {
  if (points === null) return "bg-surface text-muted";
  if (points >= 10) return "bg-lampe text-nacht";
  return points < 0 ? "bg-karte-tief text-white" : "bg-surface text-text";
}

const STATUS_CHIP: Record<SlotStatus, string> = {
  live: "bg-karte-tief text-white",
  done: "bg-nacht text-kreide",
  open: "border border-muted text-muted",
};

function SlotRow({
  slot,
  status,
  fixture,
}: {
  slot: SlotView;
  status: SlotStatus | null;
  fixture: Fixture | undefined;
}) {
  const shown = slot.player ?? slot.starter;
  const open = status === "open";
  const meta = open
    ? `${shown.club}${fixture ? ` · ${formatWeekdayTime(fixture.kickoffUtc)}` : ""}`
    : slot.subbedIn
      ? `eingewechselt für ${slot.starter.shortName} · ${slot.minutes}′`
      : slot.player === null
        ? status === "live"
          ? `${shown.club} · noch keine Daten`
          : "kein Einsatz, niemand rückte nach"
        : `${shown.club} · ${slot.minutes}′${slot.rating !== null ? ` · Note ${formatRating(slot.rating)}` : ""}`;
  return (
    <li
      data-testid="slot-row"
      className={`grid grid-cols-[40px_minmax(0,1fr)_48px] items-center gap-3 border-b border-line py-2.5 ${open ? "opacity-60" : ""}`}
    >
      <span className="relative h-10 w-10">
        <PlayerPhoto src={shown.image} className="h-10 w-10" />
        <span className="absolute -right-2 -bottom-[3px] bg-kreide px-1 py-px font-display text-[11px] leading-[11px] font-black text-nacht">
          {POS_LABEL[shown.position]}
        </span>
      </span>
      <div className="min-w-0">
        <span className="flex items-center gap-1.5">
          <Link
            href={`/spieler/${shown.id}`}
            className="truncate font-display text-[19px] leading-none font-black uppercase hover:underline"
          >
            {shown.name}
          </Link>
          {slot.captain ? (
            <span className="shrink-0 bg-lampe px-[5px] py-px font-display text-xs font-black text-nacht">
              C ×{SCORING.captainMultiplier}
            </span>
          ) : null}
        </span>
        <span className="mt-[3px] flex min-w-0 items-center gap-1.5">
          {status ? (
            <span
              className={`flex shrink-0 items-center gap-1 px-1.5 py-px font-display text-xs font-extrabold tracking-[0.05em] uppercase ${STATUS_CHIP[status]}`}
            >
              {status === "live" ? (
                <PulseDot className="h-1.5 w-1.5 bg-white" />
              ) : null}
              {status === "live"
                ? "läuft"
                : status === "done"
                  ? "Ende"
                  : "offen"}
            </span>
          ) : null}
          <span className="truncate text-[11px] font-medium text-muted">
            {meta}
          </span>
        </span>
        {!open ? (
          <div className="opacity-85 [&_p]:truncate [&_p]:text-[11px]">
            <PartsLine parts={slot.parts} startBonus={slot.startBonus} />
          </div>
        ) : null}
      </div>
      <span
        className={`slant justify-self-end px-1.5 pt-[3px] pb-0.5 text-center font-display text-2xl leading-none font-black ${pointsTag(open ? null : slot.points)} min-w-10`}
      >
        {open ? "–" : signed(slot.points)}
      </span>
    </li>
  );
}

function Sum({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`font-display text-lg font-black ${tone ?? ""}`}>
        {value}
      </dd>
    </div>
  );
}

function OtherCard({
  view,
  rank,
  state,
}: {
  view: ManagerMatchdayView;
  rank: number;
  state: BonusState;
}) {
  const top = [...view.slots]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map(
      (s) =>
        `${lastName((s.player ?? s.starter).shortName)}${s.captain ? " (C)" : ""}`,
    );
  const line = [
    ...top,
    ...(view.hidden > 0 ? [`${view.hidden} verdeckt`] : []),
  ].join(" · ");
  return (
    <li
      className={`grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 border-l-4 bg-surface px-3 py-2.5 ${rank === 1 ? "border-lampe" : "border-line"}`}
    >
      <span className="font-display text-2xl font-black text-muted">
        {rank}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[19px] leading-none font-black uppercase">
          {view.displayName}{" "}
          <span className="text-xs font-medium tracking-normal text-muted normal-case">
            {view.teamName}
          </span>
        </span>
        <span className="mt-[3px] block truncate text-[11px] font-medium text-muted">
          {line || "noch nichts sichtbar"}
          {view.bonus && view.bonus.bonus > 0
            ? ` · Prämie ${signedMio(view.bonus.bonus)}${state === "expected" ? " (vorauss.)" : ""}`
            : ""}
        </span>
      </span>
      <span className="font-display text-[30px] leading-none font-black">
        {view.total}
      </span>
    </li>
  );
}
