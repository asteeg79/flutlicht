"use client";

import {
  autoLineup,
  changeFormation,
  POSITION_LABELS,
  SCORING,
  setCaptain,
  swapPlayers,
  type Formation,
  type Lineup,
  type Position,
} from "@fm/core";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SectionTitle, TwoCol } from "@/components/arena/page-layout";
import {
  BenchCard,
  CaptainBar,
  Pitch,
  PlayerToken,
  ROW_SCALE,
  SwapLabel,
  type TokenAnim,
} from "@/components/arena/pitch";
import { Sheet } from "@/components/arena/overlay";
import { SavePill, useSaveState } from "@/components/arena/save-pill";
import { swapPartners } from "@/components/arena/swap-partners";
import { toast } from "@/components/arena/toast";
import { PlayerPhoto } from "@/components/player-photo";
import type { PointsInfo } from "@/components/player-points-info";
import { useServerClock } from "@/hooks/useServerClock";
import { callApi } from "@/lib/api-client";
import { formatWeekdayTime } from "@/lib/format";
import type { PublicManager } from "@/lib/squad";

export interface SquadEntry {
  id: number;
  name: string;
  shortName: string;
  /** Nachname fürs Namensschild. */
  lastName: string;
  position: Position;
  posLabel: string;
  price: number;
  club: string;
  /** Pfad des Spielerfotos; fehlt, wenn es (noch) keins gibt. */
  image?: string;
  clubLogo: string;
  /** "Bremen (H)"; null, wenn der Verein an diesem Spieltag nicht spielt. */
  opponent: string | null;
  /** "Dortmund – Stuttgart"; null ohne Spiel. */
  match: string | null;
  /** Sperrzeit (Anpfiff − 90 Min.) als ISO-String; null ohne Spiel. */
  lockAt: string | null;
  points: PointsInfo;
  /** Ø Basispunkte der letzten 5 Einsätze; null ohne Einsatz. */
  form: number | null;
}

const ROWS: Position[] = ["FWD", "MID", "DEF", "GK"];
/** Schnellwahl über dem Spielfeld; die übrigen erlaubten Formationen gehen per Tausch. */
const QUICK_FORMATIONS: Formation[] = ["4-4-2", "4-3-3", "3-5-2", "3-4-3"];

let seq = 0;
const nextKey = () => ++seq;

type Fx =
  | {
      kind: "swap";
      ids: [number, number];
      names: [string, string];
      key: number;
    }
  | { kind: "pop"; key: number };

/**
 * Spielfeld mit Formation, Bank, Kapitän und Sperren (KONZEPT 2.3–2.5, Arena 4 und 6).
 * Antippen wählt einen Spieler, gültige Partner (laut core) werden gelb, ein zweiter
 * Tipp tauscht. Jede Änderung wird sofort gespeichert; über Sperren entscheidet der Server.
 */
export function TeamLineup({
  initialManager,
  squad,
  serverNow,
}: {
  initialManager: PublicManager;
  squad: SquadEntry[];
  serverNow: string;
}) {
  const router = useRouter();
  const [manager, setManager] = useState(initialManager);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoBy, setAutoBy] = useState<"form" | "points">("form");
  const [fx, setFx] = useState<Fx | null>(null);
  const [shake, setShake] = useState<{ id: number; key: number } | null>(null);
  const [badgeError, setBadgeError] = useState<{
    ids: number[];
    key: number;
  } | null>(null);
  const [stamp, setStamp] = useState<{ id: number; key: number } | null>(null);
  const save = useSaveState();
  const now = useServerClock(serverNow);
  const [loadedAt] = useState(() => Date.parse(serverNow));

  const byId = new Map(squad.map((p) => [p.id, p]));
  const positionOf = (id: number) => byId.get(id)?.position;
  const lineup = manager.lineup!;
  const lockTime = (id: number) => {
    const at = byId.get(id)?.lockAt;
    return at ? Date.parse(at) : null;
  };
  const isLocked = (id: number) => {
    const at = lockTime(id);
    return at !== null && now >= at;
  };
  /** Schloss schnappt nur ein, wenn die Sperre fällt, während die Seite offen ist. */
  const snapKey = (id: number) => {
    const at = lockTime(id);
    return at !== null && at > loadedAt && now >= at ? 1 : undefined;
  };

  // Sperre fällt, während man zuschaut: Toast je neu fixiertem Spieler.
  const lockedIds = squad.filter((p) => isLocked(p.id)).map((p) => p.id);
  const lockedKey = lockedIds.join(",");
  const announced = useRef(new Set(lockedIds));
  useEffect(() => {
    for (const id of lockedKey ? lockedKey.split(",").map(Number) : []) {
      if (announced.current.has(id)) continue;
      announced.current.add(id);
      const p = byId.get(id);
      if (p)
        toast(
          `${p.shortName} ist jetzt fixiert${p.match ? ` (${p.match})` : ""}.`,
        );
    }
    // byId hängt nur an squad, das sich nicht ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedKey]);

  async function persist(next: Lineup) {
    const previous = manager;
    setManager({ ...manager, lineup: next });
    setBusy(true);
    save.begin();
    try {
      const r = await callApi<PublicManager>("/api/lineup", "PUT", {
        lineup: next,
        updatedAt: previous.updatedAt,
      });
      if (!r.ok) {
        setManager(previous);
        save.done(false);
        toast.error(
          r.error ?? "Die Aufstellung konnte nicht gespeichert werden.",
        );
        if (r.status === 409) router.refresh();
        return;
      }
      setManager(r.data);
      save.done(true);
    } finally {
      setBusy(false);
    }
  }

  function tap(id: number) {
    if (busy) return;
    const p = byId.get(id);
    if (isLocked(id)) {
      setSelected(null);
      setShake({ id, key: nextKey() });
      toast(
        `${p?.shortName} ist fixiert – sein Spiel beginnt bald oder läuft schon, er bleibt auf seinem Platz.`,
      );
      return;
    }
    if (selected === null) return setSelected(id);
    if (selected === id) return setSelected(null);
    const change = swapPlayers(lineup, selected, id, positionOf);
    const first = selected;
    setSelected(null);
    if (!change.ok) {
      setBadgeError({ ids: [first, id], key: nextKey() });
      toast.error(change.message);
      return;
    }
    if (change.lineup === lineup) return;
    setFx({
      kind: "swap",
      ids: [first, id],
      names: [byId.get(first)?.lastName ?? "", p?.lastName ?? ""],
      key: nextKey(),
    });
    void persist(change.lineup);
  }

  function autoPick() {
    if (busy) return;
    setSelected(null);
    const change = autoLineup(lineup, {
      positionOf,
      score: (id) => {
        const p = byId.get(id);
        return autoBy === "form"
          ? (p?.form ?? 0)
          : (p?.points.season?.points ?? 0);
      },
      price: (id) => byId.get(id)?.price ?? 0,
      hasMatch: (id) => byId.get(id)?.opponent != null,
      isLocked,
    });
    if (!change.ok) return void toast.error(change.message);
    if (JSON.stringify(change.lineup) === JSON.stringify(lineup))
      return void toast("Die Aufstellung ist schon die beste.");
    setFx({ kind: "pop", key: nextKey() });
    toast(
      `Aufgestellt nach ${autoBy === "form" ? "Form" : "Punkten"} – die beste Elf steht.${lockedIds.length > 0 ? " Fixierte blieben, wo sie sind." : ""}`,
    );
    void persist(change.lineup);
  }

  function pickFormation(target: Formation) {
    if (busy || target === lineup.formation) return;
    setSelected(null);
    const change = changeFormation(lineup, target, {
      positionOf,
      priceOf: (id) => byId.get(id)?.price ?? 0,
      isLocked,
    });
    if (!change.ok) return void toast.error(change.message);
    setFx({ kind: "pop", key: nextKey() });
    void persist(change.lineup);
  }

  function makeCaptain() {
    if (selected === null) return;
    const change = setCaptain(lineup, selected);
    const name = byId.get(selected)?.shortName;
    setSelected(null);
    if (!change.ok) return void toast.error(change.message);
    setStamp({ id: selected, key: nextKey() });
    toast(`${name} trägt die Binde – Punkte ×${SCORING.captainMultiplier}!`);
    void persist(change.lineup);
  }

  const partners =
    selected === null
      ? new Set<number>()
      : swapPartners(lineup, selected, positionOf, isLocked);
  let order = 0;
  const animFor = (id: number): TokenAnim | null => {
    const i = order++;
    if (shake?.id === id) return { kind: "shake", key: shake.key };
    if (fx?.kind === "swap" && fx.ids.includes(id))
      return { kind: fx.ids[0] === id ? "swap-l" : "swap-r", key: fx.key };
    if (fx?.kind === "pop") return { kind: "pop", key: fx.key, delay: i * 45 };
    return null;
  };
  const common = (id: number) => {
    const p = byId.get(id)!;
    const locked = isLocked(id);
    const captain = lineup.captain === id;
    const points =
      p.points.latest && p.points.latest.minutes > 0
        ? p.points.latest.base
        : null;
    return {
      player: p,
      locked,
      selected: selected === id,
      dimmed: selected !== null && selected !== id && !partners.has(id),
      posState: badgeError?.ids.includes(id)
        ? ("error" as const)
        : partners.has(id)
          ? ("partner" as const)
          : ("normal" as const),
      posErrorKey: badgeError?.key,
      anim: animFor(id),
      lockSnapKey: snapKey(id),
      ariaLabel: `${p.name}, ${POSITION_LABELS[p.position]}${captain ? ", Kapitän" : ""}${points !== null ? `, ${points} Punkte` : ""}${locked ? ", fixiert" : " – antippen zum Tauschen"}`,
      onTap: () => tap(id),
      points,
      captain,
    };
  };

  const rows = ROWS.map((pos, row) =>
    lineup.starters
      .filter((id) => positionOf(id) === pos)
      .map((id) => {
        const c = common(id);
        return (
          <PlayerToken
            key={id}
            {...c}
            sub={c.locked ? "fixiert" : (c.player.opponent ?? "kein Spiel")}
            captainStampKey={stamp?.id === id ? stamp.key : undefined}
            scale={ROW_SCALE[row]}
          />
        );
      }),
  );
  const bench = [
    ["TW", lineup.bench.gk] as const,
    ...lineup.bench.b.map((id, i) => [`B${i + 1}`, id] as const),
  ].map(([slot, id]) => {
    const { points: _p, captain: _c, ...c } = common(id);
    return <BenchCard key={id} slot={slot} {...c} />;
  });

  const sel = selected === null ? undefined : byId.get(selected);
  const cap = byId.get(lineup.captain);
  const canCap =
    sel !== undefined &&
    lineup.starters.includes(sel.id) &&
    lineup.captain !== sel.id &&
    !isLocked(lineup.captain);

  return (
    <div className={sel ? "pb-80 lg:pb-0" : undefined}>
      <TwoCol
        main={
          <>
            {lockedIds.length > 0 ? (
              <div
                role="status"
                className="mb-3.5 flex items-center gap-2.5 border-l-4 border-lampe bg-surface px-3 py-[9px] text-xs leading-snug font-semibold"
              >
                <Lock
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-accent"
                  strokeWidth={2.4}
                />
                {lockedIds.length} Spieler fixiert – ihr Spiel beginnt bald oder
                läuft, sie bleiben, wo sie sind. Alle anderen kannst du noch
                tauschen.
              </div>
            ) : null}
            <div className="mb-3 flex items-center justify-between gap-4 lg:mb-3.5">
              <div
                role="group"
                aria-label="Formation wählen"
                className="grid flex-1 grid-cols-4 gap-1.5 lg:flex-none lg:grid-cols-[repeat(4,96px)]"
              >
                {QUICK_FORMATIONS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => pickFormation(f)}
                    aria-pressed={lineup.formation === f}
                    className={`slant h-11 font-display text-[21px] font-black tracking-[0.02em] lg:text-[22px] ${
                      lineup.formation === f
                        ? "bg-lampe text-nacht"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <p className="hidden text-xs font-semibold text-muted lg:block">
                Klick auf einen Spieler, dann auf einen gelb markierten Partner
                – Tausch. Zahl = Punkte beim letzten Einsatz.
              </p>
            </div>
            <Pitch
              label={`Startelf, ${lineup.formation}`}
              rows={rows}
              overlay={
                <>
                  {QUICK_FORMATIONS.includes(lineup.formation) ? null : (
                    <p className="absolute top-3 right-6 font-display text-2xl font-black text-white/85">
                      {lineup.formation}
                    </p>
                  )}
                  {fx?.kind === "swap" ? (
                    <SwapLabel key={fx.key} a={fx.names[0]} b={fx.names[1]} />
                  ) : null}
                </>
              }
            />
          </>
        }
        side={
          <>
            {sel ? (
              <Sheet
                labelledBy="selected-player"
                onClose={() => setSelected(null)}
              >
                <Selection
                  player={sel}
                  locked={isLocked(sel.id)}
                  canCap={canCap}
                  onCaptain={makeCaptain}
                  onCancel={() => setSelected(null)}
                />
              </Sheet>
            ) : null}
            {cap ? (
              <CaptainBar
                name={cap.name}
                image={cap.image}
                multiplier={SCORING.captainMultiplier}
                popKey={stamp?.key}
              />
            ) : null}
            <section aria-label="Bank">
              <SectionTitle aside="rückt in Reihenfolge nach">
                Bank
              </SectionTitle>
              <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
                {bench}
              </div>
            </section>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={autoPick}
                className="slant h-[52px] flex-1 bg-lampe font-display text-[22px] font-black tracking-[0.04em] text-nacht uppercase shadow-[0_0_30px_rgb(255_213_74/0.35)] lg:h-[50px] lg:text-[21px]"
              >
                Auto-Aufstellung
              </button>
              <div
                role="radiogroup"
                aria-label="Aufstellen nach"
                className="flex border-2 border-line"
              >
                {(
                  [
                    ["form", "Form"],
                    ["points", "Punkte"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={autoBy === key}
                    onClick={() => setAutoBy(key)}
                    className={`h-12 px-3 font-display text-base font-extrabold uppercase lg:h-[46px] ${
                      autoBy === key
                        ? "bg-chip-on-bg text-chip-on-text"
                        : "text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-normal text-muted lg:hidden">
              Antippen, dann einen gelb markierten Spieler antippen – Tausch.
              Zahl oben rechts = Punkte beim letzten Einsatz. Schloss = fixiert
              (Sperre 90 Min. vor Anpfiff).
            </p>
          </>
        }
      />
      <SavePill state={save.state} />
    </div>
  );
}

/** Auswahl: Foto, Name, Gegner und Sperre, Kacheln, „Zum Kapitän“ / „Abbrechen“. */
function Selection({
  player,
  locked,
  canCap,
  onCaptain,
  onCancel,
}: {
  player: SquadEntry;
  locked: boolean;
  canCap: boolean;
  onCaptain: () => void;
  onCancel: () => void;
}) {
  const { latest, season } = player.points;
  const tile = "bg-white/[0.07] px-2.5 py-2";
  const tileLabel =
    "text-[11px] font-bold tracking-[0.1em] uppercase opacity-75";
  const tileValue =
    "font-display text-[30px] leading-none font-black lg:text-[26px]";
  const role = POSITION_LABELS[player.position];
  return (
    <>
      <div className="flex items-center gap-3.5">
        <PlayerPhoto
          src={player.image}
          className="h-[72px] w-[72px] border-[3px] border-lampe lg:h-16 lg:w-16"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] text-lampe uppercase">
            {role} · {player.club}
          </p>
          <p
            id="selected-player"
            className="mt-0.5 truncate font-display text-[34px] leading-[0.92] font-black uppercase lg:text-[30px]"
          >
            {player.name}
          </p>
          <p className="mt-1 flex items-center gap-[5px] text-xs font-semibold opacity-85">
            {player.lockAt ? (
              <Lock aria-hidden className="h-3 w-3" strokeWidth={2.6} />
            ) : null}
            {player.opponent ?? "kein Spiel"}
            {player.lockAt
              ? locked
                ? " · fixiert"
                : ` · fixiert ab ${formatWeekdayTime(player.lockAt)}`
              : ""}
          </p>
        </div>
      </div>
      <div className="mt-3.5 mb-3 grid grid-cols-3 gap-1.5">
        <div className={tile}>
          <p className={tileLabel}>
            {latest ? `${latest.matchday}. Spieltag` : "Zuletzt"}
          </p>
          <p className={`${tileValue} text-lampe`}>
            {latest && latest.minutes > 0 ? latest.base : "–"}
          </p>
        </div>
        <div className={tile}>
          <p className={tileLabel}>Saison</p>
          <p className={tileValue}>{season?.points ?? 0}</p>
        </div>
        <div className={tile}>
          <p className={tileLabel}>Form</p>
          <p className={tileValue}>
            {player.form === null
              ? "–"
              : player.form
                  .toLocaleString("de-DE", { maximumFractionDigits: 1 })
                  .replace("-", "−")}
          </p>
        </div>
      </div>
      <p className="mb-3 text-[13px] font-medium opacity-85">
        Tippe einen gelb markierten Spieler an, um zu tauschen.{" "}
        <Link
          href={`/spieler/${player.id}`}
          className="font-semibold text-lampe underline-offset-4 hover:underline"
        >
          Spielerprofil →
        </Link>
      </p>
      <div className="flex gap-2">
        {canCap ? (
          <button
            type="button"
            onClick={onCaptain}
            className="slant h-12 flex-[1.4] bg-lampe font-display text-xl font-black text-nacht uppercase lg:h-11 lg:text-[19px]"
          >
            Zum Kapitän
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 border-2 border-white/40 font-display text-xl font-black uppercase lg:h-11 lg:text-[19px]"
        >
          Abbrechen
        </button>
      </div>
    </>
  );
}
