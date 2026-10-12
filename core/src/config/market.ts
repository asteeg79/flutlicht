// Preise & Marktwerte (KONZEPT 4). Startwerte, werden nach den ersten Spieltagen kalibriert.
import type { Position } from "./rules";

export const MARKET = {
  /** Startpreis in Mio. für den wertvollsten Spieler (v = vMax). */
  startPriceScale: 25,
  startPriceMin: 0.5,
  startPriceMax: 25,
  /** Grenzen nach der Dynamik (4.3). */
  priceMin: 0.5,
  priceMax: 30,
  /** Stammspieler je Verein für das Startbudget (4.2). */
  regularsPerClub: 11,
  budgetFactor: 15,
  budgetStep: 5,
  /** Anzahl Einsätze für den Erwartungswert E. */
  formWindow: 5,
  defaultExpectation: { GK: 3, DEF: 2, MID: 3, FWD: 3 } as Record<
    Position,
    number
  >,
  deltaFactor: 0.02,
  deltaDivisor: 5,
  deltaCap: 0.08,
  /** Spieltagsprämie (2.7): Mio. je Punkt über dem Median der Liga, Deckel je Spieltag. */
  bonusPerPoint: 0.03,
  bonusCap: 2,
};
