/**
 * Spielerfoto (128-px-WebP aus public/img/players) oder Silhouette, wenn es keins gibt
 * (KONZEPT 6.3). `src` setzt die Pipeline nur, wenn die Datei existiert.
 */
export function PlayerPhoto({
  src,
  className = "h-10 w-10",
}: {
  src: string | undefined;
  className?: string;
}) {
  if (src) {
    return (
      // Kein next/image: die Bilder sind schon klein, die Optimierung kostet Vercel-Kontingent.
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`${className} shrink-0 rounded-full bg-white object-cover`}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className={`${className} shrink-0 rounded-full bg-surface text-muted/60`}
    >
      <circle cx="20" cy="15" r="7" fill="currentColor" />
      <path d="M6 38c1.5-8 7-12 14-12s12.5 4 14 12z" fill="currentColor" />
    </svg>
  );
}
