"use client";

import {
  formatKickoff,
  formatMio,
  RULES,
  sumPrices,
  toTenths,
  transferQuote,
  validateSquad,
  type Player,
  type PlayerStats,
  type Position,
} from "@fm/core";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import type { PublicManager } from "@/lib/squad";

export type MarketWindow =
  | { open: false }
  | { open: true; matchday: number; closesAt: string; isBreak: boolean };

const POS_LABEL: Record<Position, string> = {
  GK: "TW",
  DEF: "ABW",
  MID: "MF",
  FWD: "ST",
};
const POS_ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];
type Sort = "price-desc" | "price-asc" | "points" | "form";

interface Props {
  players: Player[];
  teams: { id: number; shortName: string }[];
  stats: Record<string, PlayerStats>;
  initialManager: PublicManager;
  budget: number;
  window: MarketWindow;
}

export function Market({
  players,
  teams,
  stats,
  initialManager,
  budget,
  window,
}: Props) {
  const router = useRouter();
  const [manager, setManager] = useState(initialManager);
  const [draft, setDraft] = useState<number[]>([]);
  const [sellId, setSellId] = useState<number | null>(null);
  const [buyId, setBuyId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [team, setTeam] = useState<number | "ALL">("ALL");
  const [maxPrice, setMaxPrice] = useState<number | "ALL">("ALL");
  const [sort, setSort] = useState<Sort>("price-desc");

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const club = useMemo(
    () => new Map(teams.map((t) => [t.id, t.shortName])),
    [teams],
  );
  const draftMode = manager.squad.length === 0;
  const squadIds = draftMode ? draft : manager.squad;
  const squad = squadIds
    .map((id) => byId.get(id))
    .filter((p): p is Player => p !== undefined);
  const clubCount = countBy(squad, (p) => p.teamId);
  const posCount = countBy(squad, (p) => p.position);
  const remaining =
    (toTenths(budget) - toTenths(sumPrices(squad.map((p) => p.price)))) / 10;
  const sell = sellId === null ? undefined : byId.get(sellId);
  const buy = buyId === null ? undefined : byId.get(buyId);

  const quote = window.open
    ? transferQuote(
        manager.transferBank,
        { ...window, closesAt: new Date(window.closesAt) },
        manager.firstMatchday,
      )
    : null;
  const bankStale =
    quote !== null &&
    window.open &&
    !quote.unlimited &&
    manager.transferBank.matchday !== window.matchday;
  const canTrade = !draftMode && window.open && !bankStale;

  const activePos = sell ? sell.position : pos;
  const inSquad = new Set(squadIds);
  const list = players
    .filter(
      (p) =>
        (activePos === "ALL" || p.position === activePos) &&
        (team === "ALL" || p.teamId === team),
    )
    .filter((p) => maxPrice === "ALL" || p.price <= maxPrice)
    .filter((p) => !(sell && inSquad.has(p.id)))
    .sort(sorter(sort, stats));

  /** Warum ein Spieler gerade nicht gewählt werden kann; null = möglich. */
  function blockReason(p: Player): string | null {
    if (!p.purchasable || !p.active) return "nicht kaufbar";
    if (draftMode) {
      if ((posCount.get(p.position) ?? 0) >= RULES.squadComposition[p.position])
        return "Position voll";
      if ((clubCount.get(p.teamId) ?? 0) >= RULES.maxPerClub)
        return `schon 5 von ${club.get(p.teamId)}`;
      if (p.price > remaining) return "zu teuer";
      return null;
    }
    if (!sell) return null;
    const sameClub =
      (clubCount.get(p.teamId) ?? 0) - (sell.teamId === p.teamId ? 1 : 0);
    if (sameClub >= RULES.maxPerClub)
      return `schon 5 von ${club.get(p.teamId)}`;
    if (toTenths(manager.cash) + toTenths(sell.price) - toTenths(p.price) < 0)
      return "Guthaben reicht nicht";
    return null;
  }

  async function post<T>(url: string, body: unknown): Promise<T | null> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error(data.error ?? "Deine Daten haben sich geändert.");
        router.refresh();
        return null;
      }
      if (!res.ok) {
        toast.error(
          data.error ?? "Das hat nicht geklappt. Bitte versuche es erneut.",
        );
        return null;
      }
      return data as T;
    } finally {
      setBusy(false);
    }
  }

  async function saveSquad() {
    const m = await post<PublicManager>("/api/squad/initial", {
      players: draft,
      updatedAt: manager.updatedAt,
    });
    if (!m) return;
    setManager(m);
    setDraft([]);
    toast.success(
      "Kader gespeichert. Deine Startelf steht auf der Team-Seite.",
    );
    router.refresh();
  }

  async function confirmTransfer() {
    if (!sell || !buy) return;
    const r = await post<{ manager: PublicManager; captainChanged: boolean }>(
      "/api/transfer",
      {
        out: sell.id,
        in: buy.id,
        updatedAt: manager.updatedAt,
      },
    );
    if (!r) return;
    setManager(r.manager);
    setSellId(null);
    setBuyId(null);
    const captain = r.manager.lineup
      ? byId.get(r.manager.lineup.captain)?.shortName
      : undefined;
    toast.success(`Transfer gebucht: ${sell.shortName} → ${buy.shortName}`);
    if (r.captainChanged && captain)
      toast.info(`${captain} ist jetzt Kapitän (teuerster Starter).`);
    router.refresh();
  }

  const draftValid =
    draftMode &&
    draft.length === RULES.squadSize &&
    validateSquad(squad, budget).length === 0;
  const squadValue = sumPrices(squad.map((p) => p.price));

  return (
    <div className={draftMode || buy ? "pb-24" : undefined}>
      {/* Stand: im Erstkader-Modus Budget und Positionen, sonst Guthaben und Transfers */}
      <section className="mb-5 rounded-xl border border-nacht-linie bg-nacht-hoch p-4">
        {draftMode ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-kreide-matt">Budget übrig</p>
                <p className="font-display text-4xl font-bold tabular-nums">
                  {formatMio(remaining)}
                </p>
              </div>
              <p className="font-display text-2xl font-bold tabular-nums">
                {draft.length}/{RULES.squadSize}
              </p>
            </div>
            <ul className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
              {POS_ORDER.map((p) => (
                <li key={p} className="rounded-lg bg-nacht px-2 py-1.5">
                  <span className="text-kreide-matt">{POS_LABEL[p]}</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {posCount.get(p) ?? 0}/{RULES.squadComposition[p]}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-kreide-matt">
              2 Torhüter, 5 Abwehr, 5 Mittelfeld, 3 Sturm · höchstens 5 Spieler
              je Verein
            </p>
          </>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-kreide-matt">Guthaben</dt>
                <dd className="font-display text-3xl font-bold tabular-nums">
                  {formatMio(manager.cash)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-kreide-matt">Kaderwert</dt>
                <dd className="font-display text-3xl font-bold tabular-nums">
                  {formatMio(squadValue)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm">
              {windowText(window, quote, bankStale)}
            </p>
          </>
        )}
      </section>

      {/* Tausch-Modus: erst abgeben, dann passenden Ersatz wählen */}
      {!draftMode ? (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-kreide-matt">
            {sell
              ? `${sell.name} abgeben – wähle einen ${positionName(sell.position)}`
              : "Dein Kader"}
          </h2>
          {sell ? (
            <Button
              variant="secondary"
              onClick={() => (setSellId(null), setBuyId(null))}
              className="h-10"
            >
              Abgabe abbrechen
            </Button>
          ) : (
            <ul className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie">
              {[...squad]
                .sort(sorter("price-desc", stats))
                .sort(byPosition)
                .map((p) => (
                  <PlayerRow
                    key={p.id}
                    p={p}
                    club={club.get(p.teamId)}
                    stats={stats[p.id]}
                  >
                    {canTrade ? (
                      <RowButton onClick={() => setSellId(p.id)}>
                        Abgeben
                      </RowButton>
                    ) : null}
                  </PlayerRow>
                ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Filter */}
      <div className="mb-3 space-y-3">
        {!sell ? (
          <div
            role="group"
            aria-label="Position"
            className="grid grid-cols-5 gap-1.5"
          >
            {(["ALL", ...POS_ORDER] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={pos === p}
                onClick={() => setPos(p)}
                className={`h-9 rounded-lg text-sm font-semibold ${
                  pos === p
                    ? "bg-kreide text-nacht"
                    : "border border-nacht-linie text-kreide-matt"
                }`}
              >
                {p === "ALL" ? "Alle" : POS_LABEL[p]}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <Select
            label="Verein"
            value={String(team)}
            onChange={(v) => setTeam(v === "ALL" ? "ALL" : Number(v))}
          >
            <option value="ALL">Alle Vereine</option>
            {[...teams]
              .sort((a, b) => a.shortName.localeCompare(b.shortName, "de"))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.shortName}
                </option>
              ))}
          </Select>
          <Select
            label="Preis"
            value={String(maxPrice)}
            onChange={(v) => setMaxPrice(v === "ALL" ? "ALL" : Number(v))}
          >
            <option value="ALL">Jeder Preis</option>
            {[3, 5, 8, 12, 16].map((n) => (
              <option key={n} value={n}>
                bis {n} Mio.
              </option>
            ))}
          </Select>
          <Select
            label="Sortierung"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
          >
            <option value="price-desc">Preis ↓</option>
            <option value="price-asc">Preis ↑</option>
            <option value="points">Punkte</option>
            <option value="form">Form</option>
          </Select>
        </div>
      </div>

      <p className="mb-2 text-xs text-kreide-matt">{list.length} Spieler</p>
      <ul
        aria-label="Spielerliste"
        className="divide-y divide-nacht-linie rounded-xl border border-nacht-linie"
      >
        {list.map((p) => {
          const picked = draftMode && inSquad.has(p.id);
          const reason = blockReason(p);
          return (
            <PlayerRow
              key={p.id}
              p={p}
              club={club.get(p.teamId)}
              stats={stats[p.id]}
              picked={picked}
            >
              {draftMode ? (
                picked ? (
                  <RowButton
                    onClick={() => setDraft(draft.filter((id) => id !== p.id))}
                  >
                    Entfernen
                  </RowButton>
                ) : (
                  <RowButton
                    primary
                    disabled={reason !== null}
                    title={reason ?? undefined}
                    onClick={() => setDraft([...draft, p.id])}
                  >
                    Hinzufügen
                  </RowButton>
                )
              ) : sell ? (
                <RowButton
                  primary
                  disabled={reason !== null || busy}
                  title={reason ?? undefined}
                  onClick={() => setBuyId(p.id)}
                >
                  Tauschen
                </RowButton>
              ) : null}
              {reason && (draftMode ? !picked : sell) ? (
                <span className="text-[11px] text-kreide-matt">{reason}</span>
              ) : null}
            </PlayerRow>
          );
        })}
      </ul>

      {/* Leiste über der Navigation: Erstkader speichern oder Tausch bestätigen */}
      {draftMode ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-nacht-linie bg-nacht/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <p className="flex-1 text-sm text-kreide-matt">
              {draft.length < RULES.squadSize
                ? `Noch ${RULES.squadSize - draft.length} Spieler`
                : draftValid
                  ? "Kader vollständig"
                  : validateSquad(squad, budget)[0]?.message}
            </p>
            <div className="w-44 shrink-0">
              <Button
                className="w-auto"
                disabled={!draftValid || busy}
                onClick={saveSquad}
              >
                {busy ? (
                  <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
                ) : null}
                Kader speichern
              </Button>
            </div>
          </div>
        </div>
      ) : sell && buy ? (
        <div
          role="dialog"
          aria-label="Tausch bestätigen"
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t-2 border-lampe bg-nacht-hoch px-5 py-4"
        >
          <div className="mx-auto max-w-lg space-y-3">
            <p className="flex items-center gap-2 font-semibold">
              {sell.shortName}{" "}
              <ArrowRight aria-hidden className="h-4 w-4 text-lampe" />{" "}
              {buy.shortName}
            </p>
            <p className="text-sm text-kreide-matt">
              Guthaben danach{" "}
              {formatMio(
                (toTenths(manager.cash) +
                  toTenths(sell.price) -
                  toTenths(buy.price)) /
                  10,
              )}{" "}
              · {costText(quote)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setBuyId(null)}>
                Abbrechen
              </Button>
              <Button onClick={confirmTransfer} disabled={busy}>
                {busy ? (
                  <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
                ) : null}
                Tausch bestätigen
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlayerRow({
  p,
  club,
  stats,
  picked = false,
  children,
}: {
  p: Player;
  club: string | undefined;
  stats: PlayerStats | undefined;
  picked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 ${picked ? "bg-rasen/25" : ""}`}
    >
      <span className="w-9 shrink-0 rounded bg-nacht px-1 py-0.5 text-center text-[11px] font-semibold text-kreide-matt">
        {POS_LABEL[p.position]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.name}</p>
        <p className="text-xs text-kreide-matt">
          {club} · {stats ? `${stats.points} P.` : "0 P."}
          {stats?.form !== null && stats?.form !== undefined
            ? ` · Form ${stats.form.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`
            : ""}
          {!p.active ? " · nicht mehr in der Liga" : ""}
        </p>
      </div>
      <span className="font-display text-xl font-bold tabular-nums">
        {p.price.toLocaleString("de-DE", { minimumFractionDigits: 1 })}
      </span>
      <div className="flex w-24 shrink-0 flex-col items-end gap-0.5">
        {children}
      </div>
    </li>
  );
}

function RowButton({
  primary = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return (
    <button
      type="button"
      className={`h-8 w-full rounded-lg text-xs font-semibold disabled:opacity-70 ${
        primary
          ? "bg-lampe text-nacht disabled:border disabled:border-nacht-linie disabled:bg-transparent disabled:text-kreide-matt"
          : "border border-kreide/40 text-kreide"
      } ${className}`}
      {...props}
    />
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-nacht-linie bg-nacht px-2 text-sm text-kreide"
      >
        {children}
      </select>
    </label>
  );
}

function countBy<T, K>(
  items: readonly T[],
  key: (item: T) => K,
): Map<K, number> {
  const out = new Map<K, number>();
  for (const item of items) out.set(key(item), (out.get(key(item)) ?? 0) + 1);
  return out;
}

function byPosition(a: Player, b: Player): number {
  return POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position);
}

function sorter(sort: Sort, stats: Record<string, PlayerStats>) {
  return (a: Player, b: Player): number => {
    if (sort === "price-asc") return a.price - b.price || a.id - b.id;
    if (sort === "points")
      return (
        (stats[b.id]?.points ?? 0) - (stats[a.id]?.points ?? 0) ||
        b.price - a.price
      );
    if (sort === "form")
      return (
        (stats[b.id]?.form ?? -Infinity) - (stats[a.id]?.form ?? -Infinity) ||
        b.price - a.price
      );
    return b.price - a.price || a.id - b.id;
  };
}

function positionName(p: Position): string {
  return {
    GK: "Torhüter",
    DEF: "Abwehrspieler",
    MID: "Mittelfeldspieler",
    FWD: "Stürmer",
  }[p];
}

type Quote = ReturnType<typeof transferQuote> | null;

function windowText(
  window: MarketWindow,
  quote: Quote,
  bankStale: boolean,
): string {
  if (!window.open || !quote)
    return "Das Transferfenster ist zu. Es öffnet, sobald der laufende Spieltag final ist.";
  const until = `bis ${formatKickoff(window.closesAt)}`;
  if (quote.unlimited)
    return `Transfers für Spieltag ${window.matchday} unbegrenzt und ohne Abzug, ${until}.`;
  if (bankStale)
    return "Das Transferfenster wird gerade vorbereitet. Bitte schau in ein paar Minuten wieder vorbei.";
  return `${quote.freeLeft} freie Transfers für Spieltag ${window.matchday}, ${until}. Jeder weitere kostet 5 Punkte.`;
}

function costText(quote: Quote): string {
  if (!quote) return "";
  if (quote.unlimited) return "zählt nicht (unbegrenzt)";
  return quote.nextCost === 0
    ? "freier Transfer"
    : `kostet ${quote.nextCost} Punkte`;
}
