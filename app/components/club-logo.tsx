/** Vereinslogo (128-px-WebP aus public/img/clubs), dekorativ neben dem Vereinsnamen. */
export function ClubLogo({
  src,
  className = "h-5 w-5",
}: {
  src: string | undefined;
  className?: string;
}) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${className} inline-block shrink-0 object-contain`}
    />
  );
}
