export type PosState = "normal" | "partner" | "error";

const PITCH: Record<PosState, string> = {
  normal: "bg-kreide text-nacht",
  partner: "bg-lampe text-nacht",
  error:
    "arena-anim animate-[arena-shake_.45s_ease-in-out_both] bg-karte-tief text-white",
};

/**
 * Positions-Badge TW/ABW/MF/ST. Am Spielfeld schräg: normal, gültiger Tauschpartner
 * (gelb) oder Fehler (rot, schüttelt). In Listen im Theme-Tag-Look (`list`).
 */
export function PosBadge({
  label,
  state = "normal",
  variant = "pitch",
  errorKey,
  className = "",
}: {
  label: string;
  state?: PosState;
  variant?: "pitch" | "list";
  /** Neuer Wert startet das Schütteln erneut. */
  errorKey?: number;
  className?: string;
}) {
  if (variant === "list")
    return (
      <span
        className={`bg-tag-bg px-[5px] py-px font-display text-xs leading-[13px] font-black tracking-[0.04em] text-tag-text ${className}`}
      >
        {label}
      </span>
    );
  return (
    <span
      key={state === "error" ? errorKey : undefined}
      data-state={state}
      className={`slant-sm px-1.5 pt-0.5 pb-px font-display text-xs leading-[13px] font-black tracking-[0.05em] ${PITCH[state]} ${className}`}
    >
      {label}
    </span>
  );
}
