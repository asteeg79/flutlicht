"use client";

import {
  autoLineup,
  changeFormation,
  setCaptain,
  swapPlayers,
  type Formation,
  type Lineup,
  type Position,
} from "@fm/core";
import { LoaderCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayerPhoto } from "@/components/player-photo";
import {
  PlayerPointsInfo,
  type PointsInfo,
} from "@/components/player-points-info";
import { POS_LABEL } from "@/lib/positions";
import type { PublicManager } from "@/lib/squad";

export interface SquadEntry {
  id: number;
  name: string;
  shortName: string;
  position: Position;
  price: number;
  club: string;
  /** Pfad des Spielerfotos; fehlt, wenn es (noch) keins gibt. */
  image?: string;
  clubLogo: string;
  /** "Bremen (H)"; null, wenn der Verein an diesem Spieltag nicht spielt. */
  opponent: string | null;
  /** Sperrzeit (Anpfiff − 90 Min.) als ISO-String; null ohne Spiel. */
  lockAt: string | null;
  points: PointsInfo;
  /** Ø Basispunkte der letzten 5 Einsätze; null ohne Einsatz. */
  form: number | null;
}

/** Wo der Hover-Tooltip sitzt: unter/über dem Spieler, bündig am Rand der Reihe. */
interface TipPlacement {
  below: boolean;
  align: "start" | "center" | "end";
}

const ROWS: Position[] = ["FWD", "MID", "DEF", "GK"];
/** Schnellwahl über dem Spielfeld; die übrigen erlaubten Formationen gehen per Tausch. */
const QUICK_FORMATIONS: Formation[] = ["4-4-2", "4-3-3", "3-5-2", "3-4-3"];

/**
 * Spielfeld mit Formation, Bank, Kapitän und Sperren (KONZEPT 2.3–2.5, 8.1).
 * Tippen wählt einen Spieler, ein zweiter Tipp tauscht die beiden. Jede Änderung
 * wird sofort gespeichert; über Sperren entscheidet der Server.
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
  const [saving, setSaving] = useState(false);
  const [autoBy, setAutoBy] = useState<"form" | "points">("form");
  const now = useServerClock(serverNow);

  const byId = new Map(squad.map((p) => [p.id, p]));
  const positionOf = (id: number) => byId.get(id)?.position;
  const lineup = manager.lineup!;
  const isLocked = (id: number) => {
    const at = byId.get(id)?.lockAt;
    return at !== null && at !== undefined && now >= Date.parse(at);
  };

  async function save(next: Lineup) {
    const previous = manager;
    setManager({ ...manager, lineup: next });
    setSaving(true);
    try {
      const res = await fetch("/api/lineup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineup: next, updatedAt: previous.updatedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManager(previous);
        toast.error(
          data.error ?? "Die Aufstellung konnte nicht gespeichert werden.",
        );
        if (res.status === 409) router.refresh();
        return;
      }
      setManager(data as PublicManager);
    } finally {
      setSaving(false);
    }
  }

  function tap(id: number) {
    if (saving) return;
    if (isLocked(id)) {
      toast.info(
        `${byId.get(id)?.shortName} ist gesperrt, sein Spiel beginnt bald oder läuft schon.`,
      );
      return;
    }
    if (selected === null) return setSelected(id);
    if (selected === id) return setSelected(null);
    const change = swapPlayers(lineup, selected, id, positionOf);
    setSelected(null);
    if (!change.ok) return void toast.error(change.message);
    if (change.lineup !== lineup) void save(change.lineup);
  }

  function autoPick() {
    if (saving) return;
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
      return void toast.info("Die Aufstellung ist schon die beste.");
    void save(change.lineup);
  }

  function pickFormation(target: Formation) {
    if (saving) return;
    setSelected(null);
    const change = changeFormation(lineup, target, {
      positionOf,
      priceOf: (id) => byId.get(id)?.price ?? 0,
      isLocked,
    });
    if (!change.ok) return void toast.error(change.message);
    if (change.lineup !== lineup) void save(change.lineup);
  }

  function makeCaptain() {
    if (selected === null) return;
    const change = setCaptain(lineup, selected);
    setSelected(null);
    if (!change.ok) return void toast.error(change.message);
    void save(change.lineup);
  }

  const token = (id: number, tip: TipPlacement, label?: string) => {
    const p = byId.get(id);
    if (!p) return null;
    return (
      <PlayerToken
        key={id}
        player={p}
        tip={tip}
        label={label}
        captain={lineup.captain === id}
        locked={isLocked(id)}
        selected={selected === id}
        countdown={countdown(p.lockAt, now)}
        onTap={() => tap(id)}
      />
    );
  };
  const sel = selected === null ? undefined : byId.get(selected);

  return (
    <div className={sel ? "pb-48" : undefined}>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={autoPick}
          className="h-10 flex-1 rounded-lg bg-lampe px-3 text-sm font-semibold text-nacht"
        >
          Automatisch aufstellen
        </button>
        <div
          role="radiogroup"
          aria-label="Aufstellen nach"
          className="flex h-10 overflow-hidden rounded-lg border border-nacht-linie text-sm"
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
              className={`px-3 font-semibold ${
                autoBy === key ? "bg-kreide text-nacht" : "text-kreide-matt"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        role="group"
        aria-label="Formation wählen"
        className="mb-3 grid grid-cols-4 gap-2"
      >
        {QUICK_FORMATIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => pickFormation(f)}
            aria-pressed={lineup.formation === f}
            className={`h-10 rounded-lg border font-display text-lg font-bold ${
              lineup.formation === f
                ? "border-lampe bg-lampe text-nacht"
                : "border-nacht-linie text-kreide"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {/* Spielfeld: Mähstreifen quer, Kreidelinien, Sturm oben, Tor unten */}
      <section
        aria-label={`Startelf, ${lineup.formation}`}
        className="relative overflow-hidden rounded-2xl border-2 border-kreide/60"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--color-rasen) 0 44px, var(--color-rasen-hell) 44px 88px)",
        }}
      >
        <div
          aria-hidden
          className="absolute top-0 left-1/2 h-16 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-kreide/50"
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-1/2 h-16 w-44 -translate-x-1/2 border-2 border-b-0 border-kreide/50"
        />
        {/* Nur für Formationen ohne Schnellwahl-Knopf; sonst zeigt die Leiste sie an. */}
        {QUICK_FORMATIONS.includes(lineup.formation) ? null : (
          <p className="absolute top-2 right-3 font-display text-2xl font-extrabold text-kreide/80">
            {lineup.formation}
          </p>
        )}
        <div className="relative flex flex-col gap-4 px-1 py-6">
          {ROWS.map((pos, row) => {
            const ids = lineup.starters.filter((id) => positionOf(id) === pos);
            return (
              <div key={pos} className="flex justify-evenly">
                {ids.map((id, i) =>
                  token(id, { below: row < 2, align: alignAt(i, ids.length) }),
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section
        aria-label="Bank"
        className="mt-4 rounded-2xl border border-nacht-linie bg-nacht-hoch px-1 pt-3 pb-4"
      >
        <h2 className="mb-2 px-3 text-xs font-semibold tracking-[0.18em] text-kreide-matt uppercase">
          Bank · rückt in dieser Reihenfolge nach
        </h2>
        <div className="flex justify-evenly">
          {token(lineup.bench.gk, { below: false, align: "start" }, "TW")}
          {lineup.bench.b.map((id, i) =>
            token(id, { below: false, align: alignAt(i + 1, 4) }, `B${i + 1}`),
          )}
        </div>
      </section>

      <p className="mt-4 text-sm text-kreide-matt">
        Tippe einen Spieler an und dann einen zweiten, um sie zu tauschen.
        Gesperrte Spieler (Schloss) bleiben, wo sie sind.
      </p>

      {sel ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t-2 border-lampe bg-nacht-hoch px-5 py-3">
          <div className="mx-auto mb-2 max-w-lg">
            <PlayerPointsInfo playerId={sel.id} info={sel.points} />
          </div>
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <p className="flex-1 text-sm">
              <span className="font-semibold">{sel.shortName}</span>: tippe
              einen Spieler zum Tauschen an.
            </p>
            {lineup.starters.includes(sel.id) && lineup.captain !== sel.id ? (
              <button
                type="button"
                onClick={makeCaptain}
                className="h-10 rounded-lg bg-lampe px-3 text-sm font-semibold text-nacht"
              >
                Zum Kapitän
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="h-10 rounded-lg border border-kreide/40 px-3 text-sm font-semibold"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : null}
      {saving ? (
        <p
          role="status"
          className="fixed top-3 right-4 z-20 flex items-center gap-2 text-xs text-kreide-matt"
        >
          <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin" />{" "}
          speichert
        </p>
      ) : null}
    </div>
  );
}

function PlayerToken({
  player,
  tip,
  label,
  captain,
  locked,
  selected,
  countdown,
  onTap,
}: {
  player: SquadEntry;
  tip: TipPlacement;
  label?: string;
  captain: boolean;
  locked: boolean;
  selected: boolean;
  countdown: string;
  onTap: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onTap}
        aria-pressed={selected}
        aria-label={`${player.name} (${player.club})${captain ? ", Kapitän" : ""}${locked ? ", gesperrt" : ""}`}
        className="flex w-[4.6rem] flex-col items-center gap-1 text-center"
      >
        <span
          className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-nacht ${
            selected
              ? "border-lampe shadow-[0_0_14px_3px_rgb(255_213_74/0.5)]"
              : "border-kreide/80"
          } ${locked ? "opacity-80" : ""}`}
        >
          <PlayerPhoto src={player.image} className="h-full w-full" />
          <img
            src={player.clubLogo}
            alt=""
            className="absolute -right-1 -bottom-1 h-5 w-5 rounded-full bg-kreide p-0.5"
          />
          <span className="absolute -top-1 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-kreide/60 bg-nacht px-1 text-[9px] font-bold text-kreide">
            {POS_LABEL[player.position]}
          </span>
          {captain ? (
            <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-lampe text-[11px] font-extrabold text-nacht">
              C
            </span>
          ) : null}
          {locked ? (
            <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-nacht-hoch">
              <Lock aria-hidden className="h-3 w-3 text-kreide" />
            </span>
          ) : null}
        </span>
        <span className="w-full truncate rounded bg-nacht/85 px-1 text-[11px] leading-5 font-semibold">
          {label ? `${label} · ` : ""}
          {player.shortName}
        </span>
        <span className="text-[10px] leading-3 text-kreide/85">
          {player.opponent ?? "kein Spiel"}
        </span>
        <span className="text-[10px] leading-3 text-kreide/70">
          {countdown}
        </span>
      </button>
      {/* Nur mit Maus (Tailwind v4: hover nur bei hover-fähigen Geräten); am Handy zeigt die Auswahlleiste dasselbe. */}
      <div
        className={`absolute z-20 hidden w-60 group-hover:block ${
          tip.below ? "top-full pt-1" : "bottom-full pb-1"
        } ${
          tip.align === "start"
            ? "left-0"
            : tip.align === "end"
              ? "right-0"
              : "left-1/2 -translate-x-1/2"
        }`}
      >
        <div className="rounded-xl border border-nacht-linie bg-nacht-hoch px-3 py-2 shadow-lg">
          <p className="mb-1 font-semibold">{player.name}</p>
          <PlayerPointsInfo playerId={player.id} info={player.points} />
        </div>
      </div>
    </div>
  );
}

function alignAt(index: number, count: number): TipPlacement["align"] {
  if (count === 1) return "center";
  if (index === 0) return "start";
  return index === count - 1 ? "end" : "center";
}

/** Uhr im Takt der Serverzeit: der Versatz zur Geräteuhr wird beim Laden gemessen. */
function useServerClock(serverNow: string): number {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(timer);
  }, [offset]);
  return now;
}

/** "gesperrt", "in 23 Min.", "in 5 Std. 12 Min." oder "Sa., 14:00". */
function countdown(lockAtIso: string | null, now: number): string {
  if (lockAtIso === null) return "";
  const ms = Date.parse(lockAtIso) - now;
  if (ms <= 0) return "gesperrt";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `Sperre in ${min} Min.`;
  if (min < 24 * 60)
    return `Sperre in ${Math.floor(min / 60)} Std. ${min % 60} Min.`;
  return `Sperre ${new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(lockAtIso))}`;
}
