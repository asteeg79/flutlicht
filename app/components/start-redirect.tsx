"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Von der statischen Startseite weiter zu /team; die Startseite bleibt stehen, bis /team da ist. */
export function StartRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/team");
  }, [router]);
  return null;
}
