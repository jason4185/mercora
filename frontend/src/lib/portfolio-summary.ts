import type { MarketStatus, Outcome, UserMarketStatus, UserResult } from "./contract-parsers";
import { userMarketResult } from "./contract-ui";

export interface PortfolioSummaryEntry {
  market: {
    status: MarketStatus;
    outcome: Outcome;
  };
  user: UserMarketStatus;
}

export interface PortfolioSummary {
  openPositions: number;
  winnings: bigint;
  refunds: bigint;
  totalStaked: bigint;
}

const FINAL_USER_RESULTS = new Set<UserResult>([
  "WON",
  "LOST",
  "REFUND_AVAILABLE",
  "CLAIMED",
  "REFUNDED",
]);
const FINAL_MARKET_STATUSES = new Set<MarketStatus>(["SETTLED", "INCONCLUSIVE", "CANCELLED"]);
const FINAL_OUTCOMES = new Set<Outcome>(["UP", "DOWN", "INCONCLUSIVE", "CANCELLED"]);
const OPEN_RESULT_KINDS = new Set(["ACTIVE", "WAITING_FOR_RESULT"]);

export function isOpenPortfolioPosition(entry: PortfolioSummaryEntry): boolean {
  if (
    BigInt(entry.user.total_stake) <= 0n ||
    !entry.user.participated ||
    entry.user.position === "NONE"
  ) {
    return false;
  }

  const result = userMarketResult({
    status: entry.user,
    market: { status: entry.market.status, outcome: entry.market.outcome },
  });
  if (!OPEN_RESULT_KINDS.has(result.kind)) return false;
  if (FINAL_USER_RESULTS.has(entry.user.user_result)) return false;
  if (
    FINAL_MARKET_STATUSES.has(entry.user.display_status) ||
    FINAL_MARKET_STATUSES.has(entry.market.status)
  ) {
    return false;
  }
  if (FINAL_OUTCOMES.has(entry.user.final_outcome) || FINAL_OUTCOMES.has(entry.market.outcome)) {
    return false;
  }

  return true;
}

export function portfolioSummary(entries: PortfolioSummaryEntry[]): PortfolioSummary {
  return entries.reduce<PortfolioSummary>(
    (summary, entry) => ({
      openPositions: summary.openPositions + (isOpenPortfolioPosition(entry) ? 1 : 0),
      winnings: summary.winnings + BigInt(entry.user.claimable_amount),
      refunds: summary.refunds + BigInt(entry.user.refundable_amount),
      totalStaked: summary.totalStaked + BigInt(entry.user.total_stake),
    }),
    { openPositions: 0, winnings: 0n, refunds: 0n, totalStaked: 0n },
  );
}
