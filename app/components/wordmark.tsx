/** Wortmarke in Stadion-Beschilderung: zwei Zeilen, schmal und schwer. */
export function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  const scale =
    size === "lg" ? "text-[3.6rem] leading-[0.82]" : "text-2xl leading-none";
  return (
    <p
      className={`font-display font-extrabold uppercase tracking-[0.01em] text-kreide ${scale}`}
    >
      Fußball
      {size === "lg" ? <br /> : " "}
      <span className="text-lampe">Manager</span>
    </p>
  );
}
