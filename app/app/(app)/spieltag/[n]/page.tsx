import { formatKickoff, RULES } from "@fm/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClubLogo } from "@/components/club-logo";
import { PageHeader } from "@/components/page-header";
import { PartsLine, signed, STATUS_LABEL } from "@/components/points";
import { gameData } from "@/lib/game-data";
import { currentManager } from "@/lib/session";
import {
  matchdayView,
  type ManagerMatchdayView,
  type SlotView,
} from "@/lib/standings";
import { listAllManagers } from "@/lib/storage";

export const metadata = { title: "Spieltag" };

export default async function MatchdayPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > RULES.matchdays) notFound();
  const me = await currentManager();
  const view = matchdayView(n, await listAllManagers(), me.userId, new Date());
  const own = view.managers.find((m) => m.own);
  const others = view.managers.filter((m) => !m.own);
  const club = new Map(gameData.teams.map((t) => [t.id, t]));
  const fixtures = gameData.fixtures.filter((f) => f.matchday === n);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          context={STATUS_LABEL[view.status]}
          title={`${n}. Spieltag`}
        />
        <nav aria-label="Spieltage" className="flex gap-1 pt-6">
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
      </div>

      {own ? (
        <OwnScore view={own} />
      ) : (
        <p className="mb-6 text-kreide-matt">
          {view.status === "upcoming"
            ? "Für diesen Spieltag gibt es noch keine Punkte."
            : n < me.firstMatchday
              ? `Für dich zählt erst Spieltag ${me.firstMatchday}.`
              : "Ohne Kader gibt es keine Punkte. Stell ihn auf dem Markt zusammen."}
        </p>
      )}

      {others.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
            Die anderen
          </h2>
          <ul className="space-y-3">
            {others.map((m) => (
              <OtherScore key={m.userId} view={m} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">Spiele</h2>
        <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch">
          {fixtures.map((f) => (
            <li
              key={f.openligaMatchId}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                <span className="flex items-center gap-2">
                  <ClubLogo src={club.get(f.homeTeamId)?.logo} />
                  {club.get(f.homeTeamId)?.shortName}
                </span>
                <span className="text-kreide-matt">–</span>
                <span className="flex items-center gap-2">
                  <ClubLogo src={club.get(f.awayTeamId)?.logo} />
                  {club.get(f.awayTeamId)?.shortName}
                </span>
              </span>
              {f.score ? (
                <span className="font-display text-2xl font-bold tabular-nums">
                  {f.score.home}:{f.score.away}
                </span>
              ) : (
                <span className="text-sm text-kreide-matt">
                  {f.status === "postponed"
                    ? "verlegt"
                    : formatKickoff(f.kickoffUtc)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
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
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-nacht-linie"
    >
      <Icon aria-hidden className="h-5 w-5" />
    </Link>
  );
}

function OwnScore({ view }: { view: ManagerMatchdayView }) {
  return (
    <section
      aria-label="Deine Punkte"
      className="mb-8 rounded-2xl border border-nacht-linie bg-nacht-hoch p-4"
    >
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-sm font-semibold text-kreide-matt">Deine Punkte</h2>
        <p className="font-display text-5xl leading-none font-extrabold text-lampe tabular-nums">
          {view.total}
        </p>
      </div>
      <ul className="divide-y divide-nacht-linie">
        {view.slots.map((s) => (
          <SlotRow key={s.starter.id} slot={s} />
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-nacht-linie pt-3 text-sm">
        {view.captainBonus !== 0 ? (
          <div className="flex justify-between">
            <dt className="text-kreide-matt">Kapitän doppelt</dt>
            <dd className="tabular-nums">{signed(view.captainBonus)}</dd>
          </div>
        ) : null}
        {view.transferPenalty !== 0 ? (
          <div className="flex justify-between">
            <dt className="text-kreide-matt">Transferabzug</dt>
            <dd className="text-karte tabular-nums">
              {signed(-view.transferPenalty)}
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
        <p className="text-xs text-kreide-matt">
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

function OtherScore({ view }: { view: ManagerMatchdayView }) {
  return (
    <li className="rounded-xl border border-nacht-linie bg-nacht-hoch p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate">
          <span className="font-semibold">{view.displayName}</span>{" "}
          <span className="text-sm text-kreide-matt">{view.teamName}</span>
        </p>
        <p className="font-display text-3xl font-bold tabular-nums">
          {view.total}
        </p>
      </div>
      {view.slots.length > 0 ? (
        <p className="mt-2 text-sm text-kreide-matt">
          {view.slots
            .map(
              (s) =>
                `${(s.player ?? s.starter).shortName}${s.captain ? " (C)" : ""} ${s.points}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {view.hidden > 0 ? (
        <p className="mt-1 text-xs text-kreide-matt/80">
          {view.hidden} {view.hidden === 1 ? "Spieler ist" : "Spieler sind"}{" "}
          noch verdeckt, sichtbar ab der Sperre.
        </p>
      ) : null}
    </li>
  );
}
