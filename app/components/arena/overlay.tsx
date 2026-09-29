"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fokus hinein beim Öffnen, Esc schließt, beim Schließen Fokus zurück (Arena 9). */
function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    (el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return ref;
}

/**
 * Mobil ein Sheet von unten über der Navigation (immer dunkel, 4 px gelbe Oberkante);
 * ab 1024 px ein Panel an der Stelle, an der die Seite es einsetzt (Seitenspalte).
 */
export function Sheet({
  labelledBy,
  onClose,
  children,
  className = "",
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useDialogFocus(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={`arena-anim fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-40 max-h-[80dvh] animate-[arena-sheet_.22s_ease-out_both] overflow-y-auto border-t-4 border-lampe bg-sheet-bg px-[18px] py-4 text-sheet-text shadow-[0_-14px_40px_rgb(0_0_0/0.45)] outline-none lg:static lg:z-auto lg:max-h-none lg:animate-[arena-rise_.22s_ease-out_both] lg:overflow-visible lg:p-4 lg:shadow-none ${className}`}
    >
      <div className="mx-auto max-w-[560px] lg:max-w-none">{children}</div>
    </div>
  );
}

/** Bestätigung: mobil als Sheet, ab 1024 px als Modal (460 px) über dem Inhalt. */
export function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useDialogFocus(onClose);
  return (
    <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-40 lg:inset-0 lg:left-60 lg:flex lg:items-center lg:justify-center lg:bg-black/55">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="arena-anim animate-[arena-sheet_.22s_ease-out_both] border-t-4 border-lampe bg-sheet-bg px-[18px] py-4 text-sheet-text shadow-[0_-14px_40px_rgb(0_0_0/0.45)] outline-none lg:w-[460px] lg:animate-[arena-modal_.22s_ease-out_both] lg:p-6 lg:shadow-[0_30px_60px_rgb(0_0_0/0.45)]"
      >
        <div className="mx-auto max-w-[560px]">{children}</div>
      </div>
    </div>
  );
}
