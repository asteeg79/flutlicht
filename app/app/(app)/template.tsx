import type { ReactNode } from "react";

/** Seitenwechsel: der Inhalt blendet von 10 px unten ein (Arena 8, Punkt 6). */
export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="arena-anim animate-[arena-page_.26s_ease-out_both]">
      {children}
    </div>
  );
}
