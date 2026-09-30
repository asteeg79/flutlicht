"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** „‹ Zurück“ zur Herkunft (router.back); ohne Verlauf zum Markt. */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/markt"
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="-mt-2.5 mb-0.5 inline-flex min-h-11 items-center gap-1 font-display text-[15px] font-extrabold tracking-[0.06em] uppercase"
    >
      <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2.6} />
      Zurück
    </Link>
  );
}
