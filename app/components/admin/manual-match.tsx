"use client";

import type { ManualMatchPlayer, Position } from "@fm/core";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminCall,
  COMMIT_HINT,
  Section,
  SmallButton,
} from "@/components/admin/common";
import { POS_LABEL } from "@/lib/positions";

export interface MatchOption {
  eventId: number;
  matchday: number;
  label: string;
  homeTeamId: number;
  awayTeamId: number;
  homeName: string;
  awayName: string;
  /** Steht in data/review/manual-needed.json (seit > 3 Tagen ohne Daten). */
  needed: boolean;
}

type PlayerOption = { id: number; name: string; position: Position };
type Row = Omit<ManualMatchPlayer, "playerId">;
type Card = "none" | "yellow" | "yellowRed" | "red" | "yellow+red";

const EMPTY: Row = {
  started: true,
  minutes: 90,
  rating: null,
  goals: 0,
  assists: 0,
  ownGoals: 0,
  yellow: false,
  yellowRed: false,
  red: false,
  penMissed: 0,
  penSaved: 0,
};

/** Spieldaten von Hand nachtragen, Felder wie KONZEPT 7.4 (Sofascore-lite). */
export function ManualMatchForm({
  matches,
  squads,
}: {
  matches: MatchOption[];
  squads: Record<number, PlayerOption[]>;
}) {
  const [eventId, setEventId] = useState<number | null>(null);
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [busy, setBusy] = useState(false);
  const match = matches.find((m) => m.eventId === eventId);

  const set = (id: number, patch: Partial<Row>) =>
    setRows({ ...rows, [id]: { ...(rows[id] ?? EMPTY), ...patch } });
  const toggle = (id: number) => {
    const { [id]: existing, ...rest } = rows;
    setRows(existing ? rest : { ...rows, [id]: EMPTY });
  };

  async function submit() {
    if (!match) return;
    const players = Object.entries(rows).map(([id, r]) => ({
      ...r,
      playerId: Number(id),
    }));
    if (players.length === 0)
      return toast.error("Markiere mindestens einen Spieler als „gespielt“.");
    setBusy(true);
    const ok = await adminCall("/api/admin/matches", "PUT", {
      eventId: match.eventId,
      score,
      players,
    });
    setBusy(false);
    if (ok) toast.success(COMMIT_HINT);
  }

  return (
    <Section id="nachtrag" title="Spiel nachtragen">
      <select
        aria-label="Spiel"
        value={eventId ?? ""}
        onChange={(e) => {
          setEventId(e.target.value ? Number(e.target.value) : null);
          setRows({});
          setScore({ home: 0, away: 0 });
        }}
        className="mb-3 h-10 w-full rounded-lg border border-nacht-linie bg-nacht px-2"
      >
        <option value="">Spiel wählen …</option>
        {matches.map((m) => (
          <option key={m.eventId} value={m.eventId}>
            {m.needed ? "⚠ " : ""}
            {m.matchday}. Sp. · {m.label}
          </option>
        ))}
      </select>

      {match ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-kreide-matt">Endstand</span>
            <NumberInput
              label="Tore Heim"
              value={score.home}
              onChange={(home) => setScore({ ...score, home })}
            />
            <span>:</span>
            <NumberInput
              label="Tore Gast"
              value={score.away}
              onChange={(away) => setScore({ ...score, away })}
            />
          </div>
          {[
            [match.homeTeamId, match.homeName],
            [match.awayTeamId, match.awayName],
          ].map(([teamId, name]) => (
            <div key={teamId} className="mb-4">
              <h3 className="mb-1 text-sm font-semibold">{name}</h3>
              <ul className="divide-y divide-nacht-linie rounded-lg border border-nacht-linie">
                {(squads[teamId as number] ?? []).map((p) => {
                  const r = rows[p.id];
                  return (
                    <li key={p.id} className="px-3 py-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!r}
                          onChange={() => toggle(p.id)}
                        />
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-kreide-matt">
                          {POS_LABEL[p.position]}
                        </span>
                      </label>
                      {r ? (
                        <PlayerFields
                          row={r}
                          isGk={p.position === "GK"}
                          onChange={(patch) => set(p.id, patch)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <SmallButton variant="primary" disabled={busy} onClick={submit}>
            Nachtrag speichern
          </SmallButton>
        </>
      ) : null}
    </Section>
  );
}

function PlayerFields({
  row,
  isGk,
  onChange,
}: {
  row: Row;
  isGk: boolean;
  onChange: (patch: Partial<Row>) => void;
}) {
  const card: Card = row.yellowRed
    ? "yellowRed"
    : row.yellow && row.red
      ? "yellow+red"
      : row.red
        ? "red"
        : row.yellow
          ? "yellow"
          : "none";
  const setCard = (c: Card) =>
    onChange({
      yellow: c === "yellow" || c === "yellowRed" || c === "yellow+red",
      yellowRed: c === "yellowRed",
      red: c === "red" || c === "yellow+red",
    });
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={row.started}
          onChange={(e) => onChange({ started: e.target.checked })}
        />{" "}
        Startelf
      </label>
      <NumberInput
        label="Minuten"
        value={row.minutes}
        onChange={(minutes) => onChange({ minutes })}
      />
      <label className="flex flex-col">
        Note
        <input
          aria-label="Note"
          inputMode="decimal"
          placeholder="–"
          defaultValue={row.rating ?? ""}
          onBlur={(e) => {
            const v = Number(e.target.value.replace(",", "."));
            onChange({
              rating: e.target.value.trim() === "" || !(v > 0) ? null : v,
            });
          }}
          className="h-8 rounded border border-nacht-linie bg-nacht px-1"
        />
      </label>
      <NumberInput
        label="Tore"
        value={row.goals}
        onChange={(goals) => onChange({ goals })}
      />
      <NumberInput
        label="Vorlagen"
        value={row.assists}
        onChange={(assists) => onChange({ assists })}
      />
      <NumberInput
        label="Eigentore"
        value={row.ownGoals}
        onChange={(ownGoals) => onChange({ ownGoals })}
      />
      <label className="flex flex-col">
        Karte
        <select
          value={card}
          onChange={(e) => setCard(e.target.value as Card)}
          className="h-8 rounded border border-nacht-linie bg-nacht"
        >
          <option value="none">–</option>
          <option value="yellow">Gelb</option>
          <option value="yellowRed">Gelb-Rot</option>
          <option value="red">Rot</option>
          <option value="yellow+red">Gelb + Rot</option>
        </select>
      </label>
      <NumberInput
        label="Elfer verschossen"
        value={row.penMissed}
        onChange={(penMissed) => onChange({ penMissed })}
      />
      {isGk ? (
        <NumberInput
          label="Elfer gehalten"
          value={row.penSaved}
          onChange={(penSaved) => onChange({ penSaved })}
        />
      ) : null}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col text-xs">
      {label}
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) =>
          onChange(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))
        }
        className="h-8 w-full rounded border border-nacht-linie bg-nacht px-1"
      />
    </label>
  );
}
