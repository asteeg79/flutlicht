"use client";

import {
  formatDate,
  TIMEZONE,
  type MappingReviewEntry,
  type MissingValueEntry,
  type Position,
} from "@fm/core";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  adminCall,
  COMMIT_HINT,
  Section,
  SmallButton,
} from "@/components/admin/common";
import type { AdminStatus } from "@/lib/admin";
import { parseDecimal } from "@/lib/decimal";
import { POS_LABEL } from "@/lib/positions";

/** Status: letzter Scraper-Commit, Pipeline-Läufe, offene Spiele, Tick (KONZEPT 11). */
export function Status() {
  const [status, setStatus] = useState<AdminStatus | "error" | null>(null);
  useEffect(() => {
    void (async () =>
      setStatus(
        (await adminCall<AdminStatus>("/api/admin/status", "GET")) ?? "error",
      ))();
  }, []);
  const when = (iso: string) =>
    `${formatDate(iso)}, ${new Date(iso).toLocaleTimeString("de-DE", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit" })}`;
  const run = (r: AdminStatus["compute"]) =>
    r
      ? `${r.conclusion === "success" ? "✓" : r.conclusion === "failure" ? "✗" : "…"} ${when(r.createdAt)}`
      : "–";

  return (
    <Section id="status" title="Status">
      {status === null ? (
        <p className="text-sm text-kreide-matt">Lädt …</p>
      ) : status === "error" ? (
        <p className="text-sm text-kreide-matt">
          GitHub ist nicht erreichbar oder nicht eingerichtet.
        </p>
      ) : (
        <dl className="space-y-1 text-sm">
          <Row
            label="Letzter Scraper-Commit"
            value={
              status.scraper
                ? `${when(status.scraper.date)} · ${status.scraper.message}`
                : "–"
            }
          />
          <Row label="Pipeline (compute)" value={run(status.compute)} />
          <Row label="Spielplan (fixtures)" value={run(status.fixtures)} />
          <Row label="Spiele ohne Daten" value={String(status.pending)} />
          <Row
            label="Tick zuletzt"
            value={status.tick.map((t) => t.key).join(", ") || "–"}
          />
        </dl>
      )}
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-kreide-matt">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

/** Erster gewerteter Spieltag und Startbudget, nur vor dem Saisonstart (KONZEPT 11). */
export function Season({
  firstScored,
  budget,
  editable,
}: {
  firstScored: number;
  budget: number;
  editable: boolean;
}) {
  const [md, setMd] = useState(String(firstScored));
  const [startBudget, setStartBudget] = useState("");

  async function save() {
    const budgetMio = parseDecimal(startBudget);
    if (startBudget.trim() && !(budgetMio > 0))
      return toast.error("Bitte ein Startbudget in Mio. eingeben, z. B. 64,5.");
    const body = {
      kind: "season",
      firstScoredMatchday: Number(md),
      ...(startBudget.trim() ? { startBudget: budgetMio } : {}),
    };
    if (await adminCall("/api/admin/manual", "PUT", body))
      toast.success(COMMIT_HINT);
  }

  return (
    <Section id="saison" title="Saison">
      <p className="mb-3 text-sm text-kreide-matt">
        Gewertet ab Spieltag {firstScored}, Startbudget {budget} Mio.
        {editable ? "" : " Die Saison läuft; beides ist fest."}
      </p>
      {editable ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-kreide-matt">Erster Spieltag</span>
            <input
              value={md}
              onChange={(e) => setMd(e.target.value)}
              inputMode="numeric"
              className="h-9 w-20 rounded-lg border border-nacht-linie bg-nacht px-2"
            />
          </label>
          <label className="text-sm">
            <span className="block text-kreide-matt">
              Startbudget (Mio., leer = berechnet)
            </span>
            <input
              value={startBudget}
              onChange={(e) => setStartBudget(e.target.value)}
              inputMode="decimal"
              className="h-9 w-28 rounded-lg border border-nacht-linie bg-nacht px-2"
            />
          </label>
          <SmallButton variant="primary" onClick={save}>
            Speichern
          </SmallButton>
        </div>
      ) : null}
    </Section>
  );
}

/** Spieler-Zuordnung zu Transfermarkt klären (data/review/mapping.json → raw/manual/mapping.json). */
export function Mapping({
  entries,
  clubs,
}: {
  entries: MappingReviewEntry[];
  clubs: Record<number, string>;
}) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const open = entries.filter((e) => !done.has(e.playerId));

  async function decide(playerId: number, tmId: string | null) {
    if (
      !(await adminCall("/api/admin/manual", "PUT", {
        kind: "mapping",
        playerId,
        tmId,
      }))
    )
      return;
    setDone(new Set(done).add(playerId));
    toast.success(COMMIT_HINT);
  }

  return (
    <Section id="zuordnung" title="Zuordnung">
      <p className="mb-3 text-sm text-kreide-matt">
        {open.length} Spieler ohne sichere Transfermarkt-Zuordnung. Ohne
        Zuordnung gilt der Sofascore-Wert.
      </p>
      <ul className="divide-y divide-nacht-linie">
        {open.map((e) => (
          <li key={e.playerId} className="py-3">
            <p className="font-semibold">
              {e.name}{" "}
              <span className="text-sm font-normal text-kreide-matt">
                {clubs[e.teamId]} · geb.{" "}
                {formatDate(`${e.birthDate}T12:00:00Z`)}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {e.candidates.map((c) => (
                <SmallButton
                  key={c.tmId}
                  onClick={() => decide(e.playerId, c.tmId)}
                >
                  = {c.name}
                  {c.birthDate
                    ? ` (${formatDate(`${c.birthDate}T12:00:00Z`)})`
                    : ""}
                </SmallButton>
              ))}
              <TmIdInput onSave={(tmId) => decide(e.playerId, tmId)} />
              <SmallButton onClick={() => decide(e.playerId, null)}>
                Ohne Transfermarkt
              </SmallButton>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TmIdInput({ onSave }: { onSave: (tmId: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <span className="flex gap-1">
      <input
        aria-label="Transfermarkt-ID"
        placeholder="TM-ID"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className="h-9 w-24 rounded-lg border border-nacht-linie bg-nacht px-2 text-sm"
      />
      <SmallButton disabled={!value} onClick={() => onSave(value)}>
        Zuordnen
      </SmallButton>
    </span>
  );
}

/** Fehlende Marktwerte setzen (data/review/missing-values.json → raw/manual/values.json). */
export function MissingValues({
  entries,
  clubs,
}: {
  entries: MissingValueEntry[];
  clubs: Record<number, string>;
}) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [done, setDone] = useState<Set<number>>(new Set());

  async function save(playerId: number) {
    const mio = parseDecimal(values[playerId] ?? "");
    if (!(mio > 0))
      return toast.error("Bitte einen Marktwert in Mio. eingeben, z. B. 0,3.");
    if (
      !(await adminCall("/api/admin/manual", "PUT", {
        kind: "value",
        playerId,
        valueEur: Math.round(mio * 1_000_000),
      }))
    )
      return;
    setDone(new Set(done).add(playerId));
    toast.success(COMMIT_HINT);
  }

  const open = entries.filter((e) => !done.has(e.playerId));
  return (
    <Section id="werte" title="Fehlende Werte">
      <p className="mb-3 text-sm text-kreide-matt">
        {open.length} Spieler ohne Marktwert sind nicht kaufbar.
      </p>
      <ul className="space-y-2">
        {open.map((e) => (
          <li key={e.playerId} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {e.name}{" "}
              <span className="text-kreide-matt">
                {clubs[e.teamId]} · {POS_LABEL[e.position]}
              </span>
            </span>
            <input
              aria-label={`Marktwert ${e.name} in Mio.`}
              placeholder="Mio."
              inputMode="decimal"
              value={values[e.playerId] ?? ""}
              onChange={(ev) =>
                setValues({ ...values, [e.playerId]: ev.target.value })
              }
              className="h-9 w-20 rounded-lg border border-nacht-linie bg-nacht px-2 text-sm"
            />
            <SmallButton onClick={() => save(e.playerId)}>Setzen</SmallButton>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Position eines Spielers korrigieren (raw/manual/positions.json, KONZEPT 2.2). */
export function Positions({
  players,
  clubs,
}: {
  players: { id: number; name: string; teamId: number; position: Position }[];
  clubs: Record<number, string>;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits =
    q.length < 3
      ? []
      : players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);

  async function save(playerId: number, position: Position) {
    if (
      await adminCall("/api/admin/manual", "PUT", {
        kind: "position",
        playerId,
        position,
      })
    )
      toast.success(COMMIT_HINT);
  }

  return (
    <Section id="positionen" title="Positionen">
      <input
        aria-label="Spieler suchen"
        placeholder="Spieler suchen (ab 3 Zeichen)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3 h-10 w-full rounded-lg border border-nacht-linie bg-nacht px-3"
      />
      <ul className="space-y-2">
        {hits.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {p.name}{" "}
              <span className="text-kreide-matt">{clubs[p.teamId]}</span>
            </span>
            <select
              aria-label={`Position ${p.name}`}
              defaultValue={p.position}
              onChange={(e) => save(p.id, e.target.value as Position)}
              className="h-9 rounded-lg border border-nacht-linie bg-nacht px-2 text-sm"
            >
              {(Object.keys(POS_LABEL) as Position[]).map((pos) => (
                <option key={pos} value={pos}>
                  {POS_LABEL[pos]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Recompute() {
  async function run() {
    if (await adminCall("/api/admin/recompute", "POST"))
      toast.success("Neuberechnung gestartet. Das dauert etwa eine Minute.");
  }
  return (
    <Section id="neuberechnung" title="Neuberechnung">
      <p className="mb-3 text-sm text-kreide-matt">
        Rechnet data/ komplett aus raw/ neu, etwa nach einer Korrektur.
      </p>
      <SmallButton variant="primary" onClick={run}>
        Neu berechnen
      </SmallButton>
    </Section>
  );
}
