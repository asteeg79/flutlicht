import {
  formatMio,
  matchdayLedger,
  priceBefore,
  scoreLeague,
  startPrice,
  sumPrices,
  tradeHistory,
  type LedgerRow,
} from "@fm/core";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PlayerPhoto } from "@/components/player-photo";
import { signedMio } from "@/components/points";
import { gameData, playerById, positionById } from "@/lib/game-data";
import { currentManager } from "@/lib/session";

export const metadata = { title: "Transfer-Historie" };

/** Gekaufte und verkaufte Spieler mit Preisdifferenz; Grundlage: Transfers im Manager-Dokument. */
export default async function HistoryPage() {
  const me = await currentManager();
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
  /** Preis vor Spieltag n: letzter Stand der Preis-Historie, sonst Startpreis. */
  const priceAt = (id: number, matchday: number) => {
    const p = playerById.get(id);
    const start =
      p?.startValueEur !== undefined
        ? startPrice(p.startValueEur, gameData.season.vMaxEur)
        : (p?.price ?? 0);
    return priceBefore(gameData.history[String(id)] ?? [], start, matchday);
  };
  // Ältere Konten ohne gespeicherte Kaufpreise: Preis vor dem ersten Spieltag des Managers.
  const initialPrice = (id: number) =>
    me.initialPrices?.[String(id)] ?? priceAt(id, me.firstMatchday);
  const h = tradeHistory({
    squad: me.squad,
    transfers: me.transfers,
    initialPrice,
    currentPrice: (id) => playerById.get(id)?.price ?? 0,
  });
  // Nur echte Daten: final gewertete Spieltage des Managers (2.7), Prämie wie gutgeschrieben.
  const first = gameData.season.firstScoredMatchday;
  const finals = new Set(
    gameData.points.filter((p) => p.status === "final").map((p) => p.matchday),
  );
  const scores =
    scoreLeague([me], gameData.points, positionById, first).get(me.userId) ??
    new Map();
  const ledger = matchdayLedger({
    squad: me.squad,
    transfers: me.transfers,
    sold: h.sold,
    priceAt,
    scored: new Map(
      [...scores]
        .filter(([md]) => finals.has(md))
        .map(([md, s]) => [
          md,
          { points: s.total, bonus: me.matchdayBonuses?.[String(md)] ?? 0 },
        ]),
    ),
  });
  const bonuses = sumPrices(Object.values(me.matchdayBonuses ?? {}));
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
        <h2 className="mb-3 text-sm font-semibold text-kreide-matt">Verlauf</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-kreide-matt">
            Noch keine Transfers und kein gewerteter Spieltag. Gewertet wird ab
            Spieltag {first}.
          </p>
        ) : (
          <>
            <ul
              aria-label="Verlauf"
              className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie bg-nacht-hoch"
            >
              {ledger.map((row) => (
                <LedgerItem key={row.matchday} row={row} />
              ))}
            </ul>
            <p className="mt-2 text-xs text-kreide-matt">
              Verdient = Kaderwert-Änderung + Prämie. Der Gewinn eines Verkaufs
              steckt schon in den Kaderwert-Änderungen davor.
            </p>
          </>
        )}
      </section>

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

function LedgerItem({ row }: { row: LedgerRow }) {
  const name = (id: number) => playerById.get(id)?.shortName ?? `#${id}`;
  const r = row.result;
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/spieltag/${row.matchday}`}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {row.matchday}. Spieltag
        </Link>
        {r ? (
          <span className={`font-semibold ${tone(r.earned)}`}>
            {signedMio(r.earned)}
          </span>
        ) : (
          <span className="text-xs text-kreide-matt">noch nicht gewertet</span>
        )}
      </div>
      {r ? (
        <p className="text-xs text-kreide-matt">
          {r.points} Punkte · Kaderwert {signedMio(r.valueChange)} · Prämie{" "}
          {signedMio(r.bonus)}
        </p>
      ) : null}
      {row.transfers.map((t) => (
        <p key={`${t.out}-${t.in}`} className="mt-1 text-xs">
          {name(t.out)} ({formatMio(t.priceOut)}) → {name(t.in)} (
          {formatMio(t.priceIn)}) ·{" "}
          <span className={tone(t.gain)}>{signedMio(t.gain)}</span> realisiert
        </p>
      ))}
    </li>
  );
}

function tone(n: number): string {
  return n > 0 ? "text-lampe" : n < 0 ? "text-karte" : "text-kreide-matt";
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
  const p = playerById.get(id);
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
