import { formatKickoff, formatMio, MARKET, RULES } from "@fm/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubLogo } from "@/components/club-logo";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody } from "@/components/arena/page-layout";
import {
  formatNumber,
  PartsLine,
  signed,
  signedMio,
  STATUS_LABEL,
} from "@/components/points";
import { gameData, teamById } from "@/lib/game-data";
import { allManagers, currentManager } from "@/lib/session";
import {
  matchdayView,
  type ManagerMatchdayView,
  type MatchdayView,
  type SlotView,
} from "@/lib/standings";

export const metadata = { title: "Spieltag" };

export default async function MatchdayPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > RULES.matchdays) notFound();
  const [me, managers] = await Promise.all([currentManager(), allManagers()]);
  const view = matchdayView(n, managers, me.userId, new Date());
  const own = view.managers.find((m) => m.own);
  const others = view.managers.filter((m) => !m.own);
  const fixtures = gameData.fixtures.filter((f) => f.matchday === n);

  return (
    <>
      <HeroHeader
        tag={STATUS_LABEL[view.status]}
        title={`${n}. Spieltag`}
        compact={{ title: `${n}. Spieltag` }}
        right={
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
        }
      />
      <PageBody>
        {view.shadow && view.managers.length > 0 ? (
          <p className="mb-4 rounded-xl border border-lampe/60 bg-surface px-4 py-3 text-sm">
            <span className="font-semibold">Schattenbetrieb:</span> Dieser
            Spieltag zählt noch nicht. Punkte und Prämie siehst du zur Probe,
            gewertet und gutgeschrieben wird ab Spieltag{" "}
            {gameData.season.firstScoredMatchday}.
          </p>
        ) : null}
        {own ? (
          <OwnScore view={own} state={bonusState(view)} />
        ) : (
          <p className="mb-6 text-muted">
            {view.status === "upcoming"
              ? "Für diesen Spieltag gibt es noch keine Punkte."
              : n < me.firstMatchday
                ? `Für dich zählt erst Spieltag ${me.firstMatchday}.`
                : "Ohne Kader gibt es keine Punkte. Stell ihn auf dem Markt zusammen."}
          </p>
        )}

        {others.length > 0 ? (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-muted">
              Die anderen
            </h2>
            <ul className="space-y-3">
              {others.map((m) => (
                <OtherScore key={m.userId} view={m} state={bonusState(view)} />
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">Spiele</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {fixtures.map((f) => (
              <li
                key={f.openligaMatchId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  <span className="flex items-center gap-2">
                    <ClubLogo src={teamById.get(f.homeTeamId)?.logo} />
                    {teamById.get(f.homeTeamId)?.shortName}
                  </span>
                  <span className="text-muted">–</span>
                  <span className="flex items-center gap-2">
                    <ClubLogo src={teamById.get(f.awayTeamId)?.logo} />
                    {teamById.get(f.awayTeamId)?.shortName}
                  </span>
                </span>
                {f.score ? (
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {f.score.home}:{f.score.away}
                  </span>
                ) : (
                  <span className="text-sm text-muted">
                    {f.status === "postponed"
                      ? "verlegt"
                      : formatKickoff(f.kickoffUtc)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </PageBody>
    </>
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
      <Icon aria-hidden className="h-5 w-5" />
    </Link>
  );
}

type BonusState = "shadow" | "credited" | "expected";

function bonusState(view: MatchdayView): BonusState {
  if (view.shadow) return "shadow";
  return view.status === "final" ? "credited" : "expected";
}

const BONUS_LABEL: Record<BonusState, string> = {
  shadow: "Prämie (Schattenbetrieb, nicht gutgeschrieben)",
  credited: "Prämie (gutgeschrieben)",
  expected: "Prämie (voraussichtlich)",
};

function OwnScore({
  view,
  state,
}: {
  view: ManagerMatchdayView;
  state: BonusState;
}) {
  return (
    <section
      aria-label="Deine Punkte"
      className="mb-8 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-sm font-semibold text-muted">Deine Punkte</h2>
        <p className="font-display text-5xl leading-none font-extrabold text-accent tabular-nums">
          {view.total}
        </p>
      </div>
      <ul className="divide-y divide-line">
        {view.slots.map((s) => (
          <SlotRow key={s.starter.id} slot={s} />
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
        {view.captainBonus !== 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted">Kapitän doppelt</dt>
            <dd className="tabular-nums">{signed(view.captainBonus)}</dd>
          </div>
        ) : null}
        {view.transferPenalty !== 0 ? (
          <div className="flex justify-between">
            <dt className="text-muted">Transferabzug</dt>
            <dd className="text-down tabular-nums">
              {signed(-view.transferPenalty)}
            </dd>
          </div>
        ) : null}
        {view.bonus ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">
              {BONUS_LABEL[state]}
              <span className="block text-xs">
                Median der Liga {formatNumber(view.bonus.median)} P. ·{" "}
                {formatMio(MARKET.bonusPerPoint)} je Punkt darüber, höchstens{" "}
                {formatMio(MARKET.bonusCap)}
              </span>
            </dt>
            <dd className={view.bonus.bonus > 0 ? "text-accent" : undefined}>
              {signedMio(view.bonus.bonus)}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function SlotRow({ slot }: { slot: SlotView }) {
  const shown = slot.player ?? slot.starter;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          <Link
            href={`/spieler/${shown.id}`}
            className="underline-offset-4 hover:underline"
          >
            {shown.name}
          </Link>
          {slot.captain ? (
            <span className="ml-2 rounded bg-lampe px-1.5 text-[11px] font-extrabold text-nacht">
              C
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted">
          {slot.subbedIn ? (
            `eingewechselt für ${slot.starter.shortName} · ${slot.minutes}′`
          ) : slot.player === null ? (
            "kein Einsatz, niemand rückte nach"
          ) : (
            <>
              <ClubLogo
                src={shown.clubLogo}
                className="mr-1 h-3.5 w-3.5 align-[-2px]"
              />
              {shown.club} · {slot.minutes}′
            </>
          )}
        </p>
        <PartsLine parts={slot.parts} startBonus={slot.startBonus} />
      </div>
      <span className="font-display text-2xl font-bold tabular-nums">
        {slot.points}
      </span>
    </li>
  );
}

function OtherScore({
  view,
  state,
}: {
  view: ManagerMatchdayView;
  state: BonusState;
}) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate">
          <span className="font-semibold">{view.displayName}</span>{" "}
          <span className="text-sm text-muted">{view.teamName}</span>
        </p>
        <p className="font-display text-3xl font-bold tabular-nums">
          {view.total}
        </p>
      </div>
      {view.slots.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {view.slots
            .map(
              (s) =>
                `${(s.player ?? s.starter).shortName}${s.captain ? " (C)" : ""} ${s.points}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {view.bonus && view.bonus.bonus > 0 ? (
        <p className="mt-1 text-xs text-accent">
          {BONUS_LABEL[state]}: {signedMio(view.bonus.bonus)}
        </p>
      ) : null}
      {view.hidden > 0 ? (
        <p className="mt-1 text-xs text-muted/80">
          {view.hidden} {view.hidden === 1 ? "Spieler ist" : "Spieler sind"}{" "}
          noch verdeckt, sichtbar ab der Sperre.
        </p>
      ) : null}
    </li>
  );
}
