import { formatMio, priceBefore, startPrice, tradeHistory } from "@fm/core";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PlayerPhoto } from "@/components/player-photo";
import { gameData } from "@/lib/game-data";
import { currentManager } from "@/lib/session";

export const metadata = { title: "Transfer-Historie" };

/** Gekaufte und verkaufte Spieler mit Preisdifferenz; Grundlage: Transfers im Manager-Dokument. */
export default async function HistoryPage() {
  const me = await currentManager();
  const byId = new Map(gameData.players.map((p) => [p.id, p]));
  if (me.squad.length === 0) {
    return (
      <>
        <PageHeader context="Transfers" title="Historie" />
        <p className="text-kreide-matt">
          Noch kein Kader. Stell ihn auf dem{" "}
          <Link href="/markt" className="text-lampe underline">
            Markt
          </Link>{" "}
          zusammen.
        </p>
      </>
    );
  }
  // Ältere Konten ohne gespeicherte Kaufpreise: Preis vor dem ersten Spieltag des Managers.
  const initialPrice = (id: number) => {
    const stored = me.initialPrices?.[String(id)];
    if (stored !== undefined) return stored;
    const p = byId.get(id);
    const start =
      p?.startValueEur !== undefined
        ? startPrice(p.startValueEur, gameData.season.vMaxEur)
        : (p?.price ?? 0);
    return priceBefore(
      gameData.history[String(id)] ?? [],
      start,
      me.firstMatchday,
    );
  };
  const h = tradeHistory({
    squad: me.squad,
    transfers: me.transfers,
    initialPrice,
    currentPrice: (id) => byId.get(id)?.price ?? 0,
  });
  const bonuses = Object.values(me.matchdayBonuses ?? {}).reduce(
    (a, b) => a + b,
    0,
  );
  const when = (md: number | null) => (md === null ? "Erstkader" : `Sp. ${md}`);

  return (
    <>
      <PageHeader context="Transfers" title="Historie" />
      <dl className="mb-8 grid grid-cols-3 gap-3">
        <Summary label="Verkäufe" value={h.realized} />
        <Summary label="Im Kader" value={h.unrealized} />
        <Summary label="Prämien" value={bonuses} />
      </dl>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
          Verkauft
        </h2>
        {h.sold.length === 0 ? (
          <p className="text-sm text-kreide-matt">Noch keine Verkäufe.</p>
        ) : (
          <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch">
            {h.sold.map((s) => (
              <Row
                key={`${s.playerId}-${s.soldMatchday}`}
                id={s.playerId}
                detail={`${when(s.boughtMatchday)} für ${formatMio(s.buyPrice)} → Sp. ${s.soldMatchday} für ${formatMio(s.sellPrice)}`}
                diff={s.diff}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">
          Im Kader
        </h2>
        <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch">
          {h.held.map((s) => (
            <Row
              key={s.playerId}
              id={s.playerId}
              detail={`${when(s.boughtMatchday)} für ${formatMio(s.buyPrice)} · jetzt ${formatMio(s.currentPrice)}`}
              diff={s.diff}
            />
          ))}
        </ul>
      </section>
    </>
  );
}

function signedMio(n: number): string {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${formatMio(Math.abs(n))}`;
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-nacht-linie bg-nacht-hoch p-3">
      <dt className="text-xs text-kreide-matt">{label}</dt>
      <dd
        className={`font-display text-2xl font-bold ${value > 0 ? "text-lampe" : value < 0 ? "text-karte" : ""}`}
      >
        {signedMio(value)}
      </dd>
    </div>
  );
}

function Row({
  id,
  detail,
  diff,
}: {
  id: number;
  detail: string;
  diff: number;
}) {
  const p = gameData.players.find((x) => x.id === id);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <PlayerPhoto src={p?.image} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          <Link
            href={`/spieler/${id}`}
            className="underline-offset-4 hover:underline"
          >
            {p?.name ?? `Spieler ${id}`}
          </Link>
        </p>
        <p className="text-xs text-kreide-matt">{detail}</p>
      </div>
      <span
        className={`font-semibold ${diff > 0 ? "text-lampe" : diff < 0 ? "text-karte" : "text-kreide-matt"}`}
      >
        {signedMio(diff)}
      </span>
    </li>
  );
}
