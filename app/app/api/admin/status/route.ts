import { NextResponse } from "next/server";
import { adminStatus } from "@/lib/admin";
import { withAdmin } from "@/lib/api-route";
import { gameData } from "@/lib/game-data";
import { github } from "@/lib/github";
import { loadScraperSeenAt, loadSystemState } from "@/lib/storage";

/** Status-Übersicht: Scraper, Pipeline, offene Spiele, Tick (KONZEPT 11). */
export const GET = withAdmin(async () =>
  NextResponse.json(
    await adminStatus(
      github(),
      gameData.fixtures,
      (await loadSystemState()).done,
      await loadScraperSeenAt(),
      new Date(),
    ),
  ),
);
