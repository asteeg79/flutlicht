import { playerStats, transferWindow } from "@fm/core";
import { Market, type MarketWindow } from "@/components/market";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { gameData } from "@/lib/game-data";
import { currentManager } from "@/lib/session";
import { liveContext, publicManager } from "@/lib/squad";

export const metadata = { title: "Markt" };

export default async function MarketPage() {
  const manager = await currentManager();
  const ctx = liveContext();
  const w = transferWindow(ctx.fixtures, ctx.finals, ctx.now);
  const window: MarketWindow = w.open
    ? {
        open: true,
        matchday: w.matchday,
        closesAt: w.closesAt.toISOString(),
        isBreak: w.isBreak,
      }
    : { open: false };
  // Auf dem Markt: aktive Spieler und alle, die schon im eigenen Kader stehen.
  const inSquad = new Set(manager.squad);
  const players = gameData.players.filter((p) => p.active || inSquad.has(p.id));

  return (
    <>
      <PageHeader
        context={
          manager.squad.length === 0
            ? "Erstkader"
            : `Spieltag ${window.open ? window.matchday : "läuft"}`
        }
        title="Markt"
      />
      {manager.squad.length > 0 ? (
        <Link
          href="/historie"
          className="-mt-3 mb-4 inline-block text-sm font-semibold text-lampe underline-offset-4 hover:underline"
        >
          Transfer-Historie →
        </Link>
      ) : null}
      <Market
        players={players}
        teams={gameData.teams.map((t) => ({
          id: t.id,
          shortName: t.shortName,
        }))}
        stats={Object.fromEntries(playerStats(gameData.points))}
        initialManager={publicManager(manager)}
        budget={gameData.season.startBudget}
        window={window}
      />
    </>
  );
}
