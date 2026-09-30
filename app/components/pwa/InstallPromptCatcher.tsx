"use client";

import { useEffect } from "react";
import { catchInstallPrompt } from "@/hooks/useInstall";

/** Hebt das Installations-Angebot des Browsers auf, egal auf welcher Seite es kommt. */
export function InstallPromptCatcher() {
  useEffect(() => catchInstallPrompt(), []);
  return null;
}
