import type { ReactNode } from "react";

/**
 * Seitenwechsel: der Inhalt blendet von 10 px unten ein (Arena 8, Punkt 6).
 * Nur „backwards“: eine nachwirkende Transform-Animation machte den Wrapper sonst
 * dauerhaft zum Bezugsrahmen für position: fixed (Sheets, Modal, kompakte Leiste).
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="arena-anim animate-[arena-page_.26s_ease-out_backwards]">
      {children}
    </div>
  );
}
