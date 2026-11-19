import { matchdayCalendar } from "@fm/core";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SideNav, type SideInfo } from "@/components/arena/side-nav";
import { BottomNav } from "@/components/bottom-nav";
import { FreshnessBanner } from "@/components/freshness-banner";
import { UpdateNotice } from "@/components/update-notice";
import { auth } from "@/lib/auth";
import { formatWeekdayTime } from "@/lib/format";
import { finals, gameData, teamById } from "@/lib/game-data";
import { currentLeagueTable, currentManager } from "@/lib/session";
import { lockLabel } from "@/lib/shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Die Middleware leitet schon um; das hier deckt Pfade ab, die ihr Matcher verfehlt.
  if (!(await auth())) redirect("/login");
  return (
    <div className="lg:flex">
      <SideNav info={await sideInfo()} />
      <div className="min-w-0 flex-1 pb-[calc(62px+env(safe-area-inset-bottom))] lg:pb-0">
        <UpdateNotice />
        <FreshnessBanner />
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

/** Team-Karte und Countdown der Desktop-Seitenleiste. */
async function sideInfo(): Promise<SideInfo> {
  const [me, table] = await Promise.all([
    currentManager(),
    currentLeagueTable(),
  ]);
  const now = new Date();
  const row = table.rows.find((r) => r.userId === me.userId);
  const lock = matchdayCalendar(gameData.fixtures, finals()).nextLock(now);
  const name = (id: number) => teamById.get(id)?.shortName ?? "";
  return {
    season: gameData.season.season,
    teamName: me.teamName,
    teamLine:
      row && table.matchdays.length > 0
        ? `${me.displayName} · Platz ${row.rank} von ${table.rows.length} · ${row.total} P.`
        : `${me.displayName} · gewertet ab Spieltag ${me.firstMatchday}`,
    lock: lock && {
      label: lockLabel(lock),
      target: lock.at.toISOString(),
      detail: `Anpfiff ${formatWeekdayTime(lock.fixture.kickoffUtc)} · ${name(lock.fixture.homeTeamId)} – ${name(lock.fixture.awayTeamId)}`,
    },
    serverNow: now.toISOString(),
  };
}
