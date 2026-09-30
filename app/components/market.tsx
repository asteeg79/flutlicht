"use client";

import {
  draftAddViolation,
  foldDiacritics,
  POSITION_LABELS,
  POSITIONS,
  RULES,
  sumPrices,
  toTenths,
  transferQuote,
  transferViolation,
  validateSquad,
  type Player,
  type PlayerStats,
  type Position,
  type TransferQuote,
  type TransferWindow,
  type Violation,
} from "@fm/core";
import { Lock, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { BoardTile } from "@/components/arena/board-tile";
import {
  Celebration,
  type CelebrationData,
} from "@/components/arena/celebration";
import { CountUp } from "@/components/arena/count-up";
import { HeroCountdown } from "@/components/arena/countdown";
import { HeroHeader } from "@/components/arena/hero-header";
import { HotCard, HotRow, type HotPlayer } from "@/components/arena/hot";
import {
  draftExplanation,
  hotPlayers,
  missingCash,
  shortReason,
  sorter,
  tickerPlayers,
  type Sort,
} from "@/components/arena/market-logic";
import {
  ClosedTag,
  MarketRow,
  MarketTable,
  MarketTableRow,
  OutlineAction,
  OwnedTag,
  PrimaryAction,
  ReasonAction,
  type RowPlayer,
} from "@/components/arena/market-row";
import { Modal, Sheet } from "@/components/arena/overlay";
import { PageBody, TwoCol } from "@/components/arena/page-layout";
import { SavePill, useSaveState } from "@/components/arena/save-pill";
import { PulseDot } from "@/components/arena/slant-tag";
import { Ticker } from "@/components/arena/ticker";
import { toast } from "@/components/arena/toast";
import { transferBoard } from "@/components/arena/transfer-chips";
import { TransferChips } from "@/components/arena/transfer-chips-view";
import { PlayerPhoto } from "@/components/player-photo";
import { DESKTOP, useMediaQuery } from "@/hooks/useMediaQuery";
import { callApi } from "@/lib/api-client";
import { mioNumber } from "@/lib/format";
import { POS_LABEL } from "@/lib/positions";
import type { PublicManager } from "@/lib/squad";

export type MarketWindow =
  | { open: false; reopensAfter: number | null }
  | { open: true; matchday: number; closesAt: string; isBreak: boolean };

/** Nur die Felder, die der Markt braucht; der Rest bleibt auf dem Server. */
export type MarketPlayer = Pick<
  Player,
  | "id"
  | "name"
  | "shortName"
  | "teamId"
  | "position"
  | "price"
  | "purchasable"
  | "active"
  | "image"
> & {
  lastName: string;
  /** Kursänderung seit dem letzten Spieltag (core/priceChange). */
  delta: number;
};

interface Props {
  players: MarketPlayer[];
  teams: { id: number; shortName: string; logo: string }[];
  stats: Record<string, PlayerStats>;
  initialManager: PublicManager;
  budget: number;
  window: MarketWindow;
  serverNow: string;
  /** Aus dem Spielerprofil: „Holen“ öffnet gleich „Wen gibst du ab?“. */
  initialPick?: number | null;
}

const GROUP_TITLE: Record<Position, string> = {
  GK: "Tor",
  DEF: "Abwehr",
  MID: "Mittelfeld",
  FWD: "Sturm",
};

let seq = 0;
const nextKey = () => ++seq;

/**
 * Transfermarkt (KONZEPT 2.2, 2.6, 2.7; Arena 5–7). Kaufen ist immer ein Tausch
 * gleicher Position: „Holen“ → „Wen gibst du ab?“ → Bestätigung, oder wie bisher
 * über „Abgeben“ im Kader. Mit leerem Kader: Erstkader-Aufbau. Die Regeln stehen in core.
 */
export function Market({
  players,
  teams,
  stats,
  initialManager,
  budget,
  window,
  serverNow,
  initialPick = null,
}: Props) {
  const router = useRouter();
  const desktop = useMediaQuery(DESKTOP);
  const [manager, setManager] = useState(initialManager);
  const [draft, setDraft] = useState<number[]>([]);
  const [tab, setTab] = useState<"markt" | "kader">("markt");
  const [pickId, setPickId] = useState<number | null>(initialPick);
  const [sellId, setSellId] = useState<number | null>(null);
  const [buyId, setBuyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [team, setTeam] = useState<number | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("price-desc");
  const [query, setQuery] = useState("");
  const [celebration, setCelebration] = useState<
    (CelebrationData & { after: () => void }) | null
  >(null);
  const [cashShown, setCashShown] = useState<number | null>(null);
  const [chipAnim, setChipAnim] = useState<{
    kind: "flip" | "drop";
    key: number;
  } | null>(null);
  const [deny, setDeny] = useState<{ target: string; key: number } | null>(
    null,
  );
  const [popPos, setPopPos] = useState<{ pos: Position; key: number } | null>(
    null,
  );
  const save = useSaveState();

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  // Suchschlüssel ohne Akzente: „kobbing“ findet „Köbbing“.
  const searchKey = useMemo(
    () =>
      new Map(
        players.map((p) => [p.id, foldDiacritics(`${p.name} ${p.shortName}`)]),
      ),
    [players],
  );
  const club = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const draftMode = manager.squad.length === 0;
  const squadIds = draftMode ? draft : manager.squad;
  const inSquad = new Set(squadIds);
  const squad = squadIds
    .map((id) => byId.get(id))
    .filter((p): p is MarketPlayer => p !== undefined);
  const posCount = (p: Position) =>
    squad.filter((s) => s.position === p).length;
  const remaining =
    (toTenths(budget) - toTenths(sumPrices(squad.map((p) => p.price)))) / 10;
  const sell = sellId === null ? undefined : byId.get(sellId);
  const buy = buyId === null ? undefined : byId.get(buyId);
  const pick = pickId === null ? undefined : byId.get(pickId);

  const coreWindow: TransferWindow = window.open
    ? { ...window, closesAt: new Date(window.closesAt) }
    : { open: false };
  const quote = coreWindow.open
    ? transferQuote(manager.transferBank, coreWindow, manager.firstMatchday)
    : null;
  const bankStale =
    quote !== null &&
    window.open &&
    !quote.unlimited &&
    manager.transferBank.matchday !== window.matchday;
  const canTrade = !draftMode && window.open && !bankStale;
  const ctx = { players: byId, window: coreWindow };
  const clubName = (p: MarketPlayer) => club.get(p.teamId)?.shortName;

  const activePos = sell ? sell.position : pos;
  const listKey = `${activePos}|${team}|${sort}|${sell?.id ?? ""}`;
  const list = useMemo(() => {
    const q = foldDiacritics(query.trim());
    return players
      .filter(
        (p) =>
          (activePos === "ALL" || p.position === activePos) &&
          (team === "ALL" || p.teamId === team) &&
          !(sell && squadIds.includes(p.id)) &&
          searchKey.get(p.id)!.includes(q),
      )
      .sort(sorter(sort, stats));
  }, [players, activePos, team, sell, squadIds, sort, stats, query, searchKey]);

  const toRow = (p: MarketPlayer): RowPlayer => ({
    id: p.id,
    name: p.name,
    image: p.image,
    club: clubName(p) ?? "",
    clubLogo: club.get(p.teamId)?.logo ?? "",
    posLabel: POS_LABEL[p.position],
    price: p.price,
    points: stats[p.id]?.points ?? 0,
    form: stats[p.id]?.form ?? null,
    delta: p.delta,
    inactive: !p.active,
  });
  const toHot = (p: MarketPlayer): HotPlayer => ({
    id: p.id,
    lastName: p.lastName,
    image: p.image,
    clubLogo: club.get(p.teamId)?.logo ?? "",
    club: clubName(p) ?? "",
    posLabel: POS_LABEL[p.position],
    price: p.price,
    delta: p.delta,
  });

  async function post<T>(url: string, body: unknown): Promise<T | null> {
    setBusy(true);
    save.begin();
    try {
      const r = await callApi<T>(url, "POST", body);
      save.done(r.ok);
      if (r.ok) return r.data;
      toast.error(
        r.error ??
          (r.status === 409
            ? "Deine Daten haben sich geändert."
            : "Das hat nicht geklappt. Bitte versuche es erneut."),
      );
      if (r.status === 409) router.refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  // ——— Erstkader ———
  function addToDraft(p: MarketPlayer) {
    setDraft([...draft, p.id]);
    setPopPos({ pos: p.position, key: nextKey() });
  }
  function removeFromDraft(p: MarketPlayer) {
    setDraft(draft.filter((id) => id !== p.id));
    setPopPos({ pos: p.position, key: nextKey() });
  }
  function explainDraft(p: MarketPlayer, v: Violation) {
    const target =
      v.code === "budget"
        ? "budget"
        : v.code === "squad-composition"
          ? p.position
          : null;
    if (target) setDeny({ target, key: nextKey() });
    toast(draftExplanation(v, p, { club: clubName(p), remaining }));
  }
  const draftViolations = draftMode ? validateSquad(squad, budget) : [];
  const draftValid =
    draftMode &&
    draft.length === RULES.squadSize &&
    draftViolations.length === 0;

  async function saveSquad() {
    const m = await post<PublicManager>("/api/squad/initial", {
      players: draft,
      updatedAt: manager.updatedAt,
    });
    if (!m) return;
    const top = [...squad].sort((a, b) => b.price - a.price)[0];
    setCelebration({
      kind: "squad",
      title: "Kader steht!",
      name: manager.teamName,
      sub: `${RULES.squadSize} Spieler · ${mioNumber(sumPrices(squad.map((p) => p.price)))} Mio investiert · gewertet ab Spieltag ${m.firstMatchday}`,
      image: top?.image,
      faces: squad.map((p) => p.image),
      after: () => {
        setManager(m);
        setDraft([]);
        router.refresh();
      },
    });
  }

  // ——— Transfers ———
  function startPick(p: MarketPlayer) {
    if (!canTrade) return void toast(closedText(window, bankStale));
    setSellId(null);
    setBuyId(null);
    setPickId(p.id);
  }
  function startSell(p: MarketPlayer) {
    if (!canTrade) return void toast(closedText(window, bankStale));
    setPickId(null);
    setBuyId(null);
    setSellId(p.id);
    setTab("markt");
    setQuery("");
  }
  function cancelDeal() {
    setPickId(null);
    setSellId(null);
    setBuyId(null);
  }

  async function confirmTransfer() {
    if (!sell || !buy) return;
    const cashBefore = manager.cash;
    const r = await post<{
      manager: PublicManager;
      captainChanged: boolean;
      free: boolean;
    }>("/api/transfer", {
      out: sell.id,
      in: buy.id,
      updatedAt: manager.updatedAt,
    });
    if (!r) return;
    const role = POSITION_LABELS[buy.position];
    const captain = r.manager.lineup
      ? byId.get(r.manager.lineup.captain)?.shortName
      : undefined;
    const counted = quote !== null && !quote.unlimited;
    // Guthaben und Chips erst nach der Feier ändern, sonst verpuffen sie darunter.
    setCashShown(cashBefore);
    setManager(r.manager);
    cancelDeal();
    setCelebration({
      kind: "deal",
      title: "Deal!",
      name: buy.name,
      sub: `Dein neuer ${role} · ${mioNumber(buy.price)} Mio · ${r.free ? "freier Transfer" : `−${RULES.extraTransferPenalty} Punkte`}`,
      image: buy.image,
      out: { name: sell.lastName, image: sell.image },
      after: () => {
        setCashShown(null);
        if (counted)
          setChipAnim({ kind: r.free ? "flip" : "drop", key: nextKey() });
        toast(`Deal! ${buy.shortName} ist dein neuer ${role}.`);
        if (r.captainChanged && captain)
          toast(`${captain} ist jetzt Kapitän (teuerster Starter).`);
      },
    });
  }

  function closeCelebration() {
    celebration?.after();
    setCelebration(null);
  }

  // ——— Aktionen je Zeile ———
  function rowAction(p: MarketPlayer): ReactNode {
    if (draftMode) {
      if (inSquad.has(p.id))
        return (
          <OutlineAction onClick={() => removeFromDraft(p)}>Raus</OutlineAction>
        );
      const v = draftAddViolation(squad, p, budget);
      if (v)
        return (
          <ReasonAction onClick={() => explainDraft(p, v)}>
            {shortReason(v, { club: clubName(p) })}
          </ReasonAction>
        );
      return <PrimaryAction onClick={() => addToDraft(p)}>Holen</PrimaryAction>;
    }
    if (sell) {
      const v = transferViolation(manager, sell.id, p.id, ctx);
      if (v)
        return (
          <ReasonAction onClick={() => toast(v.message)}>
            {shortReason(v, {
              club: clubName(p),
              missing: missingCash(manager.cash, sell.price, p.price),
            })}
          </ReasonAction>
        );
      return (
        <PrimaryAction disabled={busy} onClick={() => setBuyId(p.id)}>
          Holen
        </PrimaryAction>
      );
    }
    if (inSquad.has(p.id)) return <OwnedTag />;
    if (!canTrade) return <ClosedTag />;
    if (!p.purchasable || !p.active)
      return (
        <ReasonAction
          onClick={() => toast("Dieser Spieler ist derzeit nicht kaufbar.")}
        >
          nicht kaufbar
        </ReasonAction>
      );
    return <PrimaryAction onClick={() => startPick(p)}>Holen</PrimaryAction>;
  }

  // ——— Kopf ———
  const board = bankStale
    ? transferBoard(null, [], { open: false, reopensAfter: null })
    : transferBoard(
        quote,
        manager.transfers,
        window.open
          ? { open: true, matchday: window.matchday }
          : { open: false, reopensAfter: window.reopensAfter },
      );
  const cash = cashShown ?? manager.cash;
  const hero = draftMode ? (
    <HeroHeader
      tag="Erstkader"
      right={
        <>
          <PulseDot />
          Gewertet ab{" "}
          <span className="font-display text-lg font-extrabold tracking-[0.04em]">
            Spieltag {manager.firstMatchday}
          </span>
        </>
      }
      title="Dein Kader"
      compact={{
        title: "Dein Kader",
        right: `${mioNumber(remaining)} Mio · ${draft.length}/${RULES.squadSize}`,
      }}
      board="grid"
    >
      <div
        key={deny?.target === "budget" ? deny.key : undefined}
        className={
          deny?.target === "budget"
            ? "arena-anim animate-[arena-deny_.5s_ease-in-out_both]"
            : ""
        }
      >
        <BoardTile
          accent
          label="Budget übrig"
          value={<CountUp value={remaining} decimals={1} flash />}
          unit=" MIO"
        />
      </div>
      <BoardTile
        label="Kader"
        value={<CountUp value={draft.length} flash />}
        unit={`/${RULES.squadSize}`}
      />
      <div className="col-span-2 grid grid-cols-4 gap-1 lg:hidden">
        {POSITIONS.map((p) => (
          <PosTile
            key={p}
            pos={p}
            count={posCount(p)}
            deny={deny}
            pop={popPos}
          />
        ))}
      </div>
      <p className="col-span-2 text-[11px] font-semibold text-hero-muted lg:hidden">
        {RULES.squadComposition.GK} TW · {RULES.squadComposition.DEF} ABW ·{" "}
        {RULES.squadComposition.MID} MF · {RULES.squadComposition.FWD} ST ·
        höchstens {RULES.maxPerClub} Spieler je Verein
      </p>
    </HeroHeader>
  ) : (
    <HeroHeader
      tag={canTrade ? "Fenster offen" : "Fenster zu"}
      tagVariant={canTrade ? "hero" : "off"}
      right={
        window.open ? (
          <HeroCountdown
            label="schließt in"
            target={window.closesAt}
            serverNow={serverNow}
          />
        ) : window.reopensAfter !== null ? (
          <>
            Öffnet nach{" "}
            <span className="font-display text-lg font-extrabold tracking-[0.04em]">
              Spieltag {window.reopensAfter}
            </span>
          </>
        ) : undefined
      }
      title="Transfermarkt"
      compact={{
        title: "Transfermarkt",
        right: canTrade
          ? `${mioNumber(cash)} Mio · ${board.big === "∞" ? "∞" : `${board.big} ${board.unit}`}`
          : "Fenster zu",
      }}
      board="grid"
    >
      <BoardTile
        accent
        label="Guthaben"
        value={<CountUp value={cash} decimals={1} flash />}
        unit=" MIO"
        className="lg:min-w-[150px]"
      />
      <BoardTile
        label={
          <>
            Transfers{" "}
            <span className="tracking-normal normal-case">· {board.note}</span>
          </>
        }
        value={null}
        className="lg:min-w-[230px]"
      >
        <div className="mt-0.5 flex items-center gap-2 lg:gap-2.5">
          <p
            data-testid="transfer-big"
            className={`font-display text-[28px] leading-[0.95] font-black whitespace-nowrap lg:text-[32px] ${
              board.tone === "free"
                ? "text-board-num"
                : board.tone === "penalty"
                  ? "text-karte-hell"
                  : "text-board-text/75"
            }`}
          >
            {board.big}
            {board.unit ? (
              <span className="text-sm lg:text-base"> {board.unit}</span>
            ) : null}
          </p>
          <TransferChips chips={board.chips} animate={chipAnim} />
        </div>
      </BoardTile>
    </HeroHeader>
  );

  // ——— Bausteine ———
  const hot = draftMode ? [] : hotPlayers(players, inSquad);
  const ticker = draftMode ? [] : tickerPlayers(players);
  const onHot = (p: MarketPlayer) => startPick(p);

  const filters = (
    <div className="mb-1">
      <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-2 lg:grid-cols-[minmax(0,1fr)_180px]">
        <label className="flex h-[46px] items-center gap-2 border-2 border-line bg-surface px-3 lg:h-11">
          <Search
            aria-hidden
            className="h-[18px] w-[18px] shrink-0 text-muted"
            strokeWidth={2.4}
          />
          <input
            type="search"
            aria-label="Spieler suchen"
            placeholder="Spieler suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-muted"
          />
        </label>
        <select
          aria-label="Verein"
          value={String(team)}
          onChange={(e) =>
            setTeam(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
          }
          className={`h-[46px] min-w-0 border-2 bg-surface px-2 text-[13px] font-bold text-text lg:h-11 ${team === "ALL" ? "border-line" : "border-lampe"}`}
        >
          <option value="ALL">Alle Vereine</option>
          {[...teams]
            .sort((a, b) => a.shortName.localeCompare(b.shortName, "de"))
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
        </select>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 lg:mt-2">
        {!sell ? (
          <div
            role="group"
            aria-label="Position"
            className="flex flex-1 gap-1.5 lg:flex-none lg:gap-1"
          >
            {(["ALL", ...POSITIONS] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={pos === p}
                onClick={() => setPos(p)}
                className={`h-11 flex-1 border-2 font-display text-[17px] font-black tracking-[0.04em] lg:min-w-[52px] lg:flex-none lg:px-2 lg:text-base ${
                  pos === p
                    ? "border-chip-on-bg bg-chip-on-bg text-chip-on-text"
                    : "border-line text-text"
                }`}
              >
                {p === "ALL" ? "ALLE" : POS_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
        <select
          aria-label="Sortierung"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="hidden h-11 border-2 border-line bg-surface px-2 text-[13px] font-bold text-text lg:block"
        >
          <SortOptions />
        </select>
      </div>
      <div className="mt-3 mb-1 flex items-center justify-between lg:hidden">
        <span className="font-display text-lg font-black uppercase">
          {list.length} Spieler
        </span>
        <select
          aria-label="Sortierung mobil"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-11 border-2 border-line bg-surface px-1.5 text-xs font-bold text-text"
        >
          <SortOptions />
        </select>
      </div>
    </div>
  );

  const listView = (
    <div
      key={listKey}
      className="arena-anim animate-[arena-list0_.22s_ease-out_both]"
    >
      {desktop ? (
        <MarketTable count={list.length}>
          {list.map((p) => (
            <MarketTableRow
              key={p.id}
              p={toRow(p)}
              picked={draftMode && inSquad.has(p.id)}
              action={rowAction(p)}
            />
          ))}
        </MarketTable>
      ) : (
        <ul aria-label="Spielerliste">
          {list.map((p) => (
            <MarketRow
              key={p.id}
              p={toRow(p)}
              picked={draftMode && inSquad.has(p.id)}
              action={rowAction(p)}
            />
          ))}
        </ul>
      )}
    </div>
  );

  const sellBanner = sell ? (
    <div className="arena-anim mb-3 flex animate-[arena-rise_.3s_ease-out_both] items-center gap-3 bg-karte px-3 py-2.5 text-white lg:px-3.5">
      <PlayerPhoto
        src={sell.image}
        className="h-[42px] w-[42px] border-2 border-white lg:h-10 lg:w-10"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.12em] uppercase">
          Abgabe · Ersatz gesucht
        </p>
        <p className="truncate font-display text-2xl leading-none font-black uppercase lg:text-[22px]">
          {sell.lastName}{" "}
          <span className="text-base">
            · bis {mioNumber(sumPrices([manager.cash, sell.price]))} Mio · nur{" "}
            {POS_LABEL[sell.position]}
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={cancelDeal}
        className="h-11 border-2 border-white px-3 font-display text-base font-extrabold uppercase lg:h-10"
      >
        Stopp
      </button>
    </div>
  ) : null;

  const squadGroups = (compact: boolean) =>
    POSITIONS.map((p) => {
      const members = squad
        .filter((s) => s.position === p)
        .sort((a, b) => b.price - a.price);
      return (
        <section key={p} className={compact ? "" : "mt-3.5"}>
          <h3
            className={
              compact
                ? "mt-3 mb-0.5 font-display text-[13px] font-extrabold tracking-[0.1em] text-muted uppercase"
                : "mb-1 font-display text-2xl font-black uppercase"
            }
          >
            {GROUP_TITLE[p]}{" "}
            {compact ? null : (
              <span className="text-muted">{members.length}</span>
            )}
          </h3>
          <ul>
            {members.map((s) => (
              <li
                key={s.id}
                className={`grid items-center border-b border-line ${compact ? "grid-cols-[30px_minmax(0,1fr)_auto_auto] gap-2 py-[5px]" : "grid-cols-[42px_minmax(0,1fr)_auto_auto] gap-2.5 py-[9px]"}`}
              >
                <PlayerPhoto
                  src={s.image}
                  className={
                    compact ? "h-[30px] w-[30px]" : "h-[42px] w-[42px]"
                  }
                />
                <span className="min-w-0">
                  <span
                    className={`block truncate font-display leading-none font-black uppercase ${compact ? "text-base" : "text-[19px]"}`}
                  >
                    {s.name}
                  </span>
                  {compact ? null : (
                    <span className="mt-0.5 block text-xs font-medium text-muted">
                      {clubName(s)} · {stats[s.id]?.points ?? 0} P.
                    </span>
                  )}
                </span>
                <span
                  className={`font-display font-black ${compact ? "text-[17px]" : "text-[22px]"}`}
                >
                  {mioNumber(s.price)}
                </span>
                {draftMode ? (
                  <OutlineAction
                    className={compact ? "h-11 px-2 text-[13px] lg:h-7" : ""}
                    onClick={() => removeFromDraft(s)}
                  >
                    Raus
                  </OutlineAction>
                ) : (
                  <OutlineAction
                    aria-disabled={!canTrade}
                    className={`${compact ? "h-11 border-[1.5px] px-2 text-[13px] lg:h-7" : ""} ${canTrade ? "" : "border-line text-muted"}`}
                    onClick={() => startSell(s)}
                  >
                    {canTrade ? "Abgeben" : "Zu"}
                  </OutlineAction>
                )}
              </li>
            ))}
          </ul>
        </section>
      );
    });

  const pickSheet = pick ? (
    <Sheet labelledBy="pick-title" onClose={cancelDeal}>
      <div className="flex items-center gap-3">
        <PlayerPhoto
          src={pick.image}
          className="h-14 w-14 border-[3px] border-lampe shadow-[0_0_18px_rgb(255_213_74/0.5)]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] text-lampe uppercase">
            Holen · {mioNumber(pick.price)} Mio
          </p>
          <p
            id="pick-title"
            className="mt-0.5 truncate font-display text-3xl leading-[0.95] font-black uppercase lg:text-[28px]"
          >
            {pick.name}
          </p>
        </div>
      </div>
      <p className="mt-3 mb-1.5 text-[13px] font-semibold opacity-85">
        Wen gibst du dafür ab? Der Kader hat immer {RULES.squadSize} Spieler –
        getauscht wird {POS_LABEL[pick.position]} gegen{" "}
        {POS_LABEL[pick.position]}.
      </p>
      <ul className="max-h-[236px] overflow-y-auto lg:max-h-none">
        {squad
          .filter((q) => q.position === pick.position)
          .sort((a, b) => a.price - b.price)
          .map((q) => {
            const v = transferViolation(manager, q.id, pick.id, ctx);
            return (
              <li
                key={q.id}
                className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-white/10 py-2 lg:grid-cols-[36px_minmax(0,1fr)_auto] lg:py-[7px]"
              >
                <PlayerPhoto
                  src={q.image}
                  className="h-10 w-10 lg:h-9 lg:w-9"
                />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[19px] leading-none font-black uppercase lg:text-lg">
                    {q.name}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium opacity-75">
                    {clubName(q)} · {mioNumber(q.price)} Mio ·{" "}
                    {stats[q.id]?.points ?? 0} P.
                  </span>
                </span>
                {v ? (
                  <span className="w-[96px] text-right text-[11px] leading-tight font-semibold text-karte-hell">
                    {shortReason(v, {
                      club: clubName(pick),
                      missing: missingCash(manager.cash, q.price, pick.price),
                    })}
                  </span>
                ) : (
                  <PrimaryAction
                    className="lg:h-[34px]"
                    onClick={() => {
                      setSellId(q.id);
                      setBuyId(pick.id);
                      setPickId(null);
                    }}
                  >
                    Abgeben
                  </PrimaryAction>
                )}
              </li>
            );
          })}
      </ul>
      <button
        type="button"
        onClick={cancelDeal}
        className="mt-3 h-11 w-full border-2 border-white/40 font-display text-[19px] font-black uppercase lg:h-[42px] lg:text-lg"
      >
        Abbrechen
      </button>
    </Sheet>
  ) : null;

  const confirm =
    sell && buy ? (
      <Modal labelledBy="deal-title" onClose={() => setBuyId(null)}>
        <p
          id="deal-title"
          className="text-[11px] font-bold tracking-[0.14em] text-lampe uppercase"
        >
          Deal bestätigen
        </p>
        <div className="my-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <PlayerPhoto
              src={sell.image}
              className="h-16 w-16 border-[3px] border-karte grayscale-[.6]"
            />
            <span className="font-display text-[22px] leading-none font-black uppercase">
              {sell.lastName}
            </span>
            <span className="font-display text-[15px] font-extrabold text-karte-hell">
              +{mioNumber(sell.price)}
            </span>
          </div>
          <span
            aria-hidden
            className="font-display text-[40px] font-black text-lampe"
          >
            →
          </span>
          <div className="flex flex-col items-center gap-1.5">
            <PlayerPhoto
              src={buy.image}
              className="h-16 w-16 border-[3px] border-lampe shadow-[0_0_18px_rgb(255_213_74/0.6)]"
            />
            <span className="font-display text-[22px] leading-none font-black uppercase">
              {buy.lastName}
            </span>
            <span className="font-display text-[15px] font-extrabold text-gruen-hell">
              −{mioNumber(buy.price)}
            </span>
          </div>
        </div>
        <p className="mb-3 text-center text-[13px] font-medium opacity-85">
          Guthaben danach{" "}
          {mioNumber(
            (toTenths(manager.cash) +
              toTenths(sell.price) -
              toTenths(buy.price)) /
              10,
          )}{" "}
          Mio ·{" "}
          <span
            className={`font-bold ${quote && quote.nextCost > 0 ? "text-karte-hell" : "text-gruen-hell"}`}
          >
            {costText(quote)}
          </span>
        </p>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <button
            type="button"
            onClick={() => setBuyId(null)}
            className="h-[50px] border-2 border-white/40 font-display text-xl font-black uppercase"
          >
            Zurück
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirmTransfer}
            className="slant h-[50px] bg-lampe font-display text-2xl font-black text-nacht uppercase shadow-[0_0_30px_rgb(255_213_74/0.4)] disabled:opacity-60"
          >
            Deal!
          </button>
        </div>
      </Modal>
    ) : null;

  const closedNote =
    !draftMode && !canTrade ? (
      <div className="flex items-center gap-2.5 border-b border-line bg-surface px-[18px] py-2.5 lg:px-9">
        <Lock
          aria-hidden
          className="h-[18px] w-[18px] shrink-0 text-muted"
          strokeWidth={2.4}
        />
        <span className="text-xs leading-snug font-semibold">
          {closedText(window, bankStale)} Stöbern geht trotzdem.
        </span>
      </div>
    ) : null;

  const draftBar = draftMode ? (
    <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 border-t-4 border-lampe bg-sheet-bg text-sheet-text shadow-[0_-10px_30px_rgb(0_0_0/0.35)] lg:bottom-0 lg:left-60">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 px-[18px] py-2.5 lg:max-w-none lg:px-9">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[22px] leading-none font-black uppercase">
            {draft.length < RULES.squadSize
              ? `Noch ${RULES.squadSize - draft.length} Spieler`
              : draftValid
                ? "Kader komplett!"
                : "Kader passt noch nicht"}
          </p>
          <p className="mt-0.5 truncate text-xs font-medium opacity-80">
            {draft.length < RULES.squadSize
              ? `${mioNumber(remaining)} Mio übrig · Ø ${mioNumber(remaining / (RULES.squadSize - draft.length))} Mio pro Platz`
              : draftValid
                ? "Speichern – deine Startelf steht dann auf der Team-Seite"
                : draftViolations[0]?.message}
          </p>
        </div>
        <button
          type="button"
          disabled={!draftValid || busy}
          onClick={saveSquad}
          className="slant h-12 shrink-0 bg-lampe px-4 font-display text-xl font-black text-nacht uppercase disabled:bg-white/10 disabled:text-white/55"
        >
          Kader speichern
        </button>
      </div>
    </div>
  ) : null;

  const mobileTabs =
    !draftMode && !desktop ? (
      <div
        role="tablist"
        aria-label="Markt oder Kader"
        className="mb-1 flex gap-1"
      >
        {(
          [
            ["markt", "Markt"],
            ["kader", "Mein Kader"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`slant h-11 flex-1 font-display text-xl font-black tracking-[0.03em] uppercase ${
              tab === key
                ? "bg-tag-bg text-tag-text"
                : "bg-surface-alt text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    ) : null;

  const showKaderTab = !draftMode && !desktop && tab === "kader";

  return (
    <div className={draftMode ? "pb-24" : pick ? "pb-80 lg:pb-0" : undefined}>
      {hero}
      {closedNote}
      <Ticker
        items={ticker.map((p) => ({
          id: p.id,
          lastName: p.lastName,
          delta: p.delta,
        }))}
      />
      <PageBody className="pt-3.5">
        {mobileTabs}
        {showKaderTab ? (
          squadGroups(false)
        ) : (
          <TwoCol
            sideWidth={340}
            main={
              <>
                {sellBanner}
                {!desktop && !sell && hot.length > 0 ? (
                  <section className="mt-2 mb-4 -mr-[18px]">
                    <h2 className="mb-2 font-display text-[26px] font-black uppercase">
                      Heiß gerade
                    </h2>
                    <div className="flex gap-2.5 overflow-x-auto pr-[18px] pb-1 [scrollbar-width:none]">
                      {hot.map((p) => (
                        <HotCard
                          key={p.id}
                          player={toHot(p)}
                          onClick={() => onHot(p)}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
                {filters}
                {listView}
              </>
            }
            side={
              desktop
                ? (pickSheet ?? (
                    <>
                      {!draftMode && hot.length > 0 ? (
                        <section>
                          <h2 className="mb-2 font-display text-[26px] font-black uppercase">
                            Heiß gerade
                          </h2>
                          <div className="space-y-1.5">
                            {hot.map((p) => (
                              <HotRow
                                key={p.id}
                                player={toHot(p)}
                                onClick={() => onHot(p)}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}
                      <section aria-label="Mein Kader">
                        <h2 className="mb-1 font-display text-[26px] font-black uppercase">
                          {draftMode ? "Dein Kader" : "Mein Kader"}{" "}
                          <span className="text-muted">{squad.length}</span>
                        </h2>
                        {draftMode ? (
                          <div className="mb-2 grid grid-cols-4 gap-1">
                            {POSITIONS.map((p) => (
                              <PosTile
                                key={p}
                                pos={p}
                                count={posCount(p)}
                                deny={deny}
                                pop={popPos}
                              />
                            ))}
                          </div>
                        ) : null}
                        {squadGroups(true)}
                      </section>
                    </>
                  ))
                : pickSheet
            }
          />
        )}
      </PageBody>
      {confirm}
      {draftBar}
      <SavePill state={save.state} />
      {celebration ? (
        <Celebration data={celebration} onClose={closeCelebration} />
      ) : null}
    </div>
  );
}

function SortOptions() {
  return (
    <>
      <option value="price-desc">Preis ↓</option>
      <option value="price-asc">Preis ↑</option>
      <option value="points">Punkte</option>
      <option value="form">Form</option>
    </>
  );
}

/** Positions-Kachel im Erstkader: voll = gelb; ploppt beim Holen/Raus, pulsiert rot bei „voll“. */
function PosTile({
  pos,
  count,
  deny,
  pop,
}: {
  pos: Position;
  count: number;
  deny: { target: string; key: number } | null;
  pop: { pos: Position; key: number } | null;
}) {
  const max = RULES.squadComposition[pos];
  const denied = deny?.target === pos;
  const popped = pop?.pos === pos;
  return (
    <div
      key={denied ? `d${deny.key}` : popped ? `p${pop.key}` : "still"}
      className={`arena-anim flex items-baseline justify-center gap-[5px] px-1 pt-1.5 pb-[5px] ${
        count >= max ? "bg-lampe text-nacht" : "bg-pos-open-bg text-board-text"
      } ${denied ? "animate-[arena-deny_.5s_ease-in-out_both]" : popped ? "animate-[arena-pop_.4s_cubic-bezier(.2,1.4,.4,1)_both]" : ""}`}
    >
      <span className="font-display text-sm font-black tracking-[0.06em]">
        {POS_LABEL[pos]}
      </span>
      <span className="font-display text-lg font-black tabular-nums">
        {count}/{max}
      </span>
    </div>
  );
}

function closedText(window: MarketWindow, bankStale: boolean): string {
  if (bankStale)
    return "Das Transferfenster wird gerade vorbereitet. Bitte schau in ein paar Minuten wieder vorbei.";
  if (!window.open && window.reopensAfter !== null)
    return `Das Transferfenster ist zu. Es öffnet, sobald Spieltag ${window.reopensAfter} final ist.`;
  return "Das Transferfenster ist zu.";
}

function costText(quote: TransferQuote | null): string {
  if (!quote) return "";
  if (quote.unlimited) return "zählt nicht (unbegrenzt)";
  return quote.nextCost === 0
    ? "freier Transfer"
    : `kostet ${quote.nextCost} Punkte`;
}
