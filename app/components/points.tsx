import type { PointParts } from "@fm/core";

const PART_LABELS: Record<keyof PointParts, string> = {
  rating: "Note",
  goals: "Tore",
  assists: "Vorlagen",
  cleanSheet: "Zu null",
  conceded: "Gegentore",
  penSaved: "Elfer gehalten",
  penMissed: "Elfer verschossen",
  ownGoals: "Eigentor",
  cards: "Karten",
};

export function signed(n: number): string {
  const s = n.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return n > 0 ? `+${s}` : s.replace("-", "−");
}

/** Aufschlüsselung der Basispunkte (KONZEPT 3.4): nur die Teile, die etwas beitragen. */
export function PartsLine({
  parts,
  startBonus = 0,
}: {
  parts: PointParts | null;
  startBonus?: number;
}) {
  if (!parts) return null;
  const items = (Object.keys(PART_LABELS) as (keyof PointParts)[])
    .filter((k) => parts[k] !== 0)
    .map((k) => `${PART_LABELS[k]} ${signed(parts[k])}`);
  if (startBonus) items.push(`Startelf ${signed(startBonus)}`);
  if (items.length === 0) return null;
  return <p className="text-xs text-kreide-matt">{items.join(" · ")}</p>;
}

/** Saisonsumme je Kategorie als Tabelle, nur Teile, die etwas beitragen. */
export function PartsTable({ parts }: { parts: PointParts }) {
  const keys = (Object.keys(PART_LABELS) as (keyof PointParts)[]).filter(
    (k) => parts[k] !== 0,
  );
  return (
    <ul className="space-y-1 text-sm tabular-nums">
      {keys.map((k) => (
        <li key={k} className="flex justify-between">
          <span className="text-kreide-matt">{PART_LABELS[k]}</span>
          <span>{signed(parts[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export const STATUS_LABEL = {
  running: "läuft",
  provisional: "vorläufig",
  final: "final",
  upcoming: "noch nicht begonnen",
} as const;
