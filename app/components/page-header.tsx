import type { ReactNode } from "react";

/** Seitentitel in Stadion-Schrift; die Zeile darüber sagt, worauf sich die Seite bezieht. */
export function PageHeader({
  context,
  title,
}: {
  context?: ReactNode;
  title: string;
}) {
  return (
    <header className="mb-6">
      {context ? (
        <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-lampe uppercase">
          {context}
        </p>
      ) : null}
      <h1 className="font-display text-5xl leading-none font-extrabold text-kreide uppercase">
        {title}
      </h1>
    </header>
  );
}
