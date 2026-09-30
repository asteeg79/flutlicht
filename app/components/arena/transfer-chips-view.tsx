import type { Chip, ChipKind } from "@/components/arena/transfer-chips";

const LOOK: Record<ChipKind, string> = {
  used: "border-transparent bg-white/15 text-white/80",
  paid: "border-karte-tief bg-karte-tief text-white",
  free: "border-lampe bg-lampe text-nacht",
  next: "border-dashed border-karte-hell text-karte-hell",
  closed: "border-white/35 text-white/75",
};

/**
 * Marken je Transfer (18 px) in der Transfers-Kachel. `animate`: nach einem Deal
 * klappt der letzte ✓ um bzw. fällt der neue −5 mit Nachfedern ein.
 */
export function TransferChips({
  chips,
  animate,
}: {
  chips: Chip[];
  animate?: { kind: "flip" | "drop"; key: number } | null;
}) {
  const lastUsed = chips.findLastIndex((c) => c.kind === "used");
  const lastPaid = chips.findLastIndex((c) => c.kind === "paid");
  const target =
    animate?.kind === "flip"
      ? lastUsed
      : animate?.kind === "drop"
        ? lastPaid
        : -1;
  return (
    <span className="flex flex-wrap gap-[3px]" data-testid="transfer-chips">
      {chips.map((chip, i) => (
        <span
          key={i === target ? `a${animate!.key}` : i}
          data-kind={chip.kind}
          className={`slant-sm flex h-[18px] items-center border-[1.5px] px-1.5 font-display text-xs font-black tracking-[0.04em] whitespace-nowrap uppercase lg:h-5 lg:px-[7px] lg:text-[13px] ${LOOK[chip.kind]} ${
            i === target
              ? animate!.kind === "flip"
                ? "arena-anim animate-[arena-flip_.5s_ease-in-out_both]"
                : "arena-anim animate-[arena-drop_.6s_cubic-bezier(.2,1.3,.4,1)_both]"
              : ""
          }`}
        >
          {chip.label}
        </span>
      ))}
    </span>
  );
}
