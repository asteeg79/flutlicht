import {
  currentMatchday,
  lastPricedMatchday,
  priceChange,
  startPrice,
  transferWindow,
} from "@fm/core";
import {
  Market,
  type MarketPlayer,
  type MarketWindow,
} from "@/components/market";
import { lastName } from "@/lib/format";
import { gameData, statsById } from "@/lib/game-data";
import { currentManager } from "@/lib/session";
import { liveContext, publicManager } from "@/lib/squad";

export const metadata = { title: "Markt" };

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ holen?: string }>;
}) {
  const [manager, { holen }] = await Promise.all([
    currentManager(),
    searchParams,
  ]);
  const ctx = liveContext();
  const w = transferWindow(ctx.fixtures, ctx.finals, ctx.now);
  const window: MarketWindow = w.open
    ? {
        open: true,
        matchday: w.matchday,
        closesAt: w.closesAt.toISOString(),
        isBreak: w.isBreak,
      }
    : { open: false, reopensAfter: currentMatchday(ctx.finals) };
  // Auf dem Markt: aktive Spieler und alle, die schon im eigenen Kader stehen.
  // Nur die Felder und Statistiken, die der Markt anzeigt (spart rund ein Drittel).
  const inSquad = new Set(manager.squad);
  const priced = lastPricedMatchday(gameData.history);
  const players: MarketPlayer[] = gameData.players
    .filter((p) => p.active || inSquad.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      shortName: p.shortName,
      lastName: lastName(p.shortName),
      teamId: p.teamId,
      position: p.position,
      price: p.price,
      purchasable: p.purchasable,
      active: p.active,
      image: p.image,
      delta: priceChange(
        gameData.history[String(p.id)],
        p.price,
        p.startValueEur !== undefined
          ? startPrice(p.startValueEur, gameData.season.vMaxEur)
          : p.price,
        priced,
      ),
    }));
  const stats = Object.fromEntries(
    players.flatMap((p) => {
      const s = statsById.get(p.id);
      return s ? [[p.id, s]] : [];
    }),
  );

  return (
    <Market
      players={players}
      teams={gameData.teams.map((t) => ({
        id: t.id,
        shortName: t.shortName,
        logo: t.logo,
      }))}
      stats={stats}
      initialManager={publicManager(manager)}
      budget={gameData.season.startBudget}
      window={window}
      serverNow={ctx.now.toISOString()}
      initialPick={holen && w.open ? Number(holen) : null}
    />
  );
}
