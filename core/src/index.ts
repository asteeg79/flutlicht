// Öffentliche Schnittstelle von @fm/core: reine Regeln, Punkte, Preise, Schemas.
// Nur was App, Pipeline oder Skripte brauchen; Interna importieren die Tests direkt
// aus ihrem Modul. Ein neuer Name von außen gehört hier ausdrücklich dazu.
export { MARKET } from "./config/market";
export {
  FORMATIONS,
  POSITIONS,
  RULES,
  SELECTABLE_FORMATIONS,
} from "./config/rules";
export type { Formation, Position } from "./config/rules";
export { SCORING } from "./config/scoring";
export {
  autoLineup,
  changeFormation,
  defaultLineup,
  diffLineupRespectsLocks,
  lineupPlayers,
  setCaptain,
  swapPlayers,
  validateLineup,
} from "./lineup";
export { finalizedAt, lockAt, matchdayCalendar } from "./calendar";
export type { CalendarFixture, NextLock } from "./calendar";
export {
  applyInitialSquad,
  moveToSeasonStart,
  newManagerState,
  seasonChangeViolation,
} from "./lifecycle";
export { playerMatchPoints, ratingPoints } from "./points";
export {
  chooseStartValue,
  expectationFor,
  initialPricing,
  lastPricedMatchday,
  nextPrice,
  priceChange,
  priceTimeline,
  selectRegulars,
  startBudget,
  startPrice,
} from "./prices";
export type { ValueSourceName } from "./prices";
export { clamp, median, subtractMio } from "./rounding";
export {
  Fixture,
  Fixtures,
  MarketHistory,
  MatchdayPoints,
  Meta,
  Player,
  PlayerPoints,
  Players,
  PointParts,
  Season,
  Team,
  Teams,
} from "./schemas/data";
export {
  CODE_ALPHABET,
  DEFAULT_PUSH_PREFS,
  EmailIndex,
  InviteCode,
  League,
  Lineup,
  ManagerDoc,
  PushPrefs,
  MAX_PUSH_DEVICES,
  PushSubscriptionJson,
  SystemState,
  Transfer,
} from "./schemas/manager";
export { ManualMatch, ManualMatchPlayer } from "./schemas/manual";
export {
  draftAddViolation,
  isBuyable,
  POSITION_LABELS,
  sumPrices,
  validateSquad,
} from "./squad";
export {
  applyTransfer,
  cashAfterTransfer,
  tradeBlocker,
  transferQuote,
  transferViolation,
} from "./transfers";
export type { TransferQuote, TransferWindow } from "./transfers";
export { formatMio } from "./violations";
export type { Violation } from "./violations";
export {
  finalScoreFromIncidents,
  positionFromSofascore,
  readSofascoreMatch,
} from "./sofascore";
export {
  ManualMapping,
  ManualNeeded,
  ManualNeededEntry,
  ManualPositions,
  ManualSeason,
  ManualTeam,
  ManualTeams,
  ManualValues,
  MappingReview,
  MappingReviewEntry,
  MissingValueEntry,
  MissingValues,
} from "./schemas/admin";
export { ScraperHeartbeat, ScraperStatus } from "./schemas/scraper";
export { alnumKey, foldDiacritics } from "./text";
export { readManualMatch } from "./manual-match";
export { fixtureCounts, HAS_DATA, matchdayStatus } from "./matchday";
export { findInvite, findReset, normalizeCode } from "./league";
export { formatDate, pad2, TIMEZONE } from "./time";
export { latestAppearance, playerSeason, playerStats } from "./stats";
export type { PlayerStats } from "./stats";
export {
  matchdayRanks,
  roundScore,
  scoreLeague,
  standings,
  visibleScore,
} from "./standings";
export { matchdayFinalizer, planTick } from "./tick";
export { matchdayBonuses } from "./bonus";
export type { MatchdayBonus } from "./bonus";
export { isScoredMatchday, isShadowMatchday } from "./participation";
export { matchdayLedger, priceBefore, tradeHistory } from "./trades";
export type { LedgerRow } from "./trades";
export {
  awaitingData,
  DATA_ALARM_AFTER_MS,
  DATA_HINT_AFTER_MS,
  DATA_WINDOW_MS,
  scraperSilent,
} from "./freshness";
export { bundesligaTable } from "./bundesliga";
