import type { ReactNode } from "react";
import { Stadium } from "@/components/stadium";
import { gameData } from "@/lib/game-data";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Stadium
      season={gameData.season.season}
      startBudget={gameData.season.startBudget}
    >
      {children}
    </Stadium>
  );
}
