"use client";

import { useTheme } from "@/hooks/useTheme";

/** Hält html[data-theme] aktuell, wenn „System“ gewählt ist und das System umschaltet. */
export function ThemeWatcher() {
  useTheme();
  return null;
}
