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
import { BoardTile } from "@/components/arena/board-tile";
import { HeroHeader } from "@/components/arena/hero-header";
import { PageBody, SectionTitle, TwoCol } from "@/components/arena/page-layout";
import { PlayerPhoto } from "@/components/player-photo";
import { signedMio } from "@/components/points";
import { lastName, mioNumber } from "@/lib/format";
import { gameData, playerById, positionById } from "@/lib/game-data";
import { currentManager } from "@/lib/session";

export const metadata = { title: "Transfer-Historie" };

/** Mio.-Differenz ohne Einheit: „+0,6“, „−1,2“, „±0“. */
function signedNumber(n: number): string {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${mioNumber(Math.abs(n))}`;
}

/** Gekaufte und verkaufte Spieler mit Preisdifferenz; Grundlage: Transfers im Manager-Dokument. */
export default async function HistoryPage() {
  const me = await currentManager();
  if (me.squad.length === 0) {
    return (
      <>
        <HeroHeader
          tag="Transfers"
          title="Historie"
          compact={{ title: "Historie" }}
        />
        <PageBody>
          <p className="text-muted">
            Noch kein Kader. Stell ihn auf dem{" "}
            <Link href="/markt" className="text-accent underline">
              Markt
            </Link>{" "}
            zusammen.
          </p>
        </PageBody>
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
  const earned = sumPrices(ledger.map((r) => r.result?.earned ?? 0));
  const when = (md: number | null) => (md === null ? "Erstkader" : `Sp. ${md}`);
  const held = [...h.held].sort((a, b) => b.diff - a.diff);

  const tile = (label: string, value: number) => (
    <BoardTile
      label={label}
      value={
        <span className={value < 0 ? "text-karte-hell" : "text-board-num"}>
          {signedNumber(value)}
        </span>
      }
    />
  );

  return (
    <>
      <HeroHeader
        tag="Transfers"
        title="Historie"
        compact={{ title: "Historie", right: `${signedMio(earned)} verdient` }}
        board="grid"
      >
        <div className="col-span-2 grid grid-cols-3 gap-1.5 lg:flex lg:gap-2">
          {tile("Verkäufe", h.realized)}
          {tile("Im Kader", h.unrealized)}
          {tile("Prämien", bonuses)}
        </div>
        <p className="col-span-2 text-[11px] font-semibold text-hero-muted lg:hidden">
          Beträge in Mio.
        </p>
      </HeroHeader>
      <PageBody>
        <TwoCol
          sideWidth={380}
          main={
            <section>
              <SectionTitle>Verlauf</SectionTitle>
              {ledger.length === 0 ? (
                <p className="text-sm text-muted">
                  Noch keine Transfers und kein gewerteter Spieltag. Gewertet
                  wird ab Spieltag {first}.
                </p>
              ) : (
                <>
                  <ul aria-label="Verlauf" className="flex flex-col gap-2">
                    {ledger.map((row) => (
                      <LedgerItem key={row.matchday} row={row} />
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] font-medium text-muted">
                    Verdient = Kaderwert-Änderung + Prämie. Der Gewinn eines
                    Verkaufs steckt schon in den Kaderwert-Änderungen davor.
                  </p>
                </>
              )}
            </section>
          }
          side={
            <>
              <section>
                <SectionTitle>
                  Im Kader <span className="text-muted">{held.length}</span>
                </SectionTitle>
                <ul>
                  {held.map((s) => (
                    <Row
                      key={s.playerId}
                      id={s.playerId}
                      detail={`${when(s.boughtMatchday)} für ${formatMio(s.buyPrice)} · jetzt ${formatMio(s.currentPrice)}`}
                      diff={s.diff}
                    />
                  ))}
                </ul>
              </section>
              <section>
                <SectionTitle>Verkauft</SectionTitle>
                {h.sold.length === 0 ? (
                  <p className="text-sm text-muted">Noch keine Verkäufe.</p>
                ) : (
                  <ul>
                    {h.sold.map((s) => (
                      <Row
                        key={`${s.playerId}-${s.soldMatchday}`}
                        id={s.playerId}
                        detail={`${when(s.boughtMatchday)} für ${formatMio(s.buyPrice)} → Sp. ${s.soldMatchday} für ${formatMio(s.sellPrice)}`}
                        diff={s.diff}
                        sold
                      />
                    ))}
                  </ul>
                )}
              </section>
            </>
          }
        />
      </PageBody>
    </>
  );
}

function tone(n: number): string {
  return n > 0 ? "text-up" : n < 0 ? "text-down" : "text-muted";
}

function LedgerItem({ row }: { row: LedgerRow }) {
  const name = (id: number) => {
    const p = playerById.get(id);
    return p ? lastName(p.shortName) : `#${id}`;
  };
  const r = row.result;
  return (
    <li className="bg-surface px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Link
          href={`/spieltag/${row.matchday}`}
          className="font-display text-[22px] font-black uppercase hover:underline"
        >
          {row.matchday}. Spieltag
        </Link>
        {r ? (
          <span
            className={`font-display text-[26px] font-black ${tone(r.earned)}`}
          >
            {signedNumber(r.earned)}
          </span>
        ) : (
          <span className="text-xs text-muted">noch nicht gewertet</span>
        )}
      </div>
      {r ? (
        <p className="mt-0.5 text-xs font-medium text-muted">
          {r.points} Punkte · Kaderwert {signedNumber(r.valueChange)} · Prämie{" "}
          {signedNumber(r.bonus)}
        </p>
      ) : null}
      {row.transfers.map((t) => (
        <p
          key={`${t.out}-${t.in}`}
          className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs font-semibold"
        >
          <span className="font-display text-[15px] font-extrabold uppercase line-through opacity-60">
            {name(t.out)} {mioNumber(t.priceOut)}
          </span>
          <span
            aria-label="gegen"
            className="font-display text-base font-black text-accent"
          >
            →
          </span>
          <span className="font-display text-[15px] font-extrabold uppercase">
            {name(t.in)} {mioNumber(t.priceIn)}
          </span>
          <span className={`ml-auto whitespace-nowrap ${tone(t.gain)}`}>
            {signedNumber(t.gain)} realisiert
          </span>
        </p>
      ))}
    </li>
  );
}

function Row({
  id,
  detail,
  diff,
  sold = false,
}: {
  id: number;
  detail: string;
  diff: number;
  sold?: boolean;
}) {
  const p = playerById.get(id);
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-2.5">
      <PlayerPhoto
        src={p?.image}
        className={`h-10 w-10 ${sold ? "grayscale-[.5]" : ""}`}
      />
      <span className="min-w-0">
        <Link
          href={`/spieler/${id}`}
          className="block truncate font-display text-[19px] leading-none font-black uppercase hover:underline"
        >
          {p?.name ?? `Spieler ${id}`}
        </Link>
        <span className="mt-[3px] block text-[11px] font-medium text-muted">
          {detail}
        </span>
      </span>
      <span className={`font-display text-[22px] font-black ${tone(diff)}`}>
        {signedNumber(diff)}
      </span>
    </li>
  );
}
