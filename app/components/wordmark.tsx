/** Wortmarke in Stadion-Beschilderung: FLUT und LICHT, das Licht in Natriumgelb. */
export function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  const scale =
    size === "lg" ? "text-[4.6rem] leading-[0.85]" : "text-2xl leading-none";
  return (
    <p
      className={`font-display font-extrabold uppercase tracking-[0.01em] text-kreide ${scale}`}
    >
      Flut<span className="text-lampe">licht</span>
    </p>
  );
}
