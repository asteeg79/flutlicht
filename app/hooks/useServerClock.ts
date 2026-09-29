"use client";

import { useEffect, useState } from "react";

/**
 * Uhr im Sekundentakt der Serverzeit: der Versatz zur Geräteuhr wird beim Laden
 * gemessen, maßgeblich für Sperren ist die Serverzeit (KONZEPT 2.5).
 */
export function useServerClock(serverNow: string): number {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.parse(serverNow));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(timer);
  }, [offset]);
  return now;
}
