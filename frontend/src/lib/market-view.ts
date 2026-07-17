import type {
  ContractMarket,
  MarketProbabilities,
  MarketStatus,
  Outcome,
  SourceEvidence,
} from "./contract-parsers";
import { unixSecondsToDate, weiToGen } from "./contract-parsers";

export interface MarketView {
  id: string;
  asset: ContractMarket["asset"];
  pair: string;
  question: string;
  openTime: number;
  closeTime: number;
  bettingCloseTime: number;
  settleAfterTime: number;
  status: MarketStatus;
  outcome: Outcome;
  upPool: string;
  downPool: string;
  totalPool: string;
  bettorCount: number;
  upPercent: number;
  downPercent: number;
  hasPredictions: boolean;
  evidence: SourceEvidence[];
  settlementReason?: string;
  resolvedAt: number;
  contract: ContractMarket;
}

const assetNames: Record<ContractMarket["asset"], string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
};

export function shortMarketQuestion(asset: ContractMarket["asset"]): string {
  return `Will ${assetNames[asset]} finish higher than it started?`;
}

export function marketDetailQuestion(market: Pick<MarketView, "asset" | "openTime" | "closeTime">) {
  const start = new Date(market.openTime);
  const end = new Date(market.closeTime);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(start);
  const time = (value: Date) => value.toISOString().slice(11, 16);
  return `Will ${assetNames[market.asset]} finish higher than it started between ${time(start)} and ${time(end)} UTC on ${date}?`;
}

export function participantLabel(count: number): string {
  return `${count} ${count === 1 ? "participant" : "participants"}`;
}

export function poolDisplay(
  upStake: string,
  downStake: string,
  probabilities?: MarketProbabilities,
) {
  const up = BigInt(upStake);
  const down = BigInt(downStake);
  const total = up + down;
  if (total === 0n) return { upPercent: 0, downPercent: 0, hasPredictions: false };
  const calculatedUpBps = (up * 10_000n) / total;
  const calculatedDownBps = 10_000n - calculatedUpBps;

  if (probabilities) {
    const upBps = BigInt(probabilities.up_bps);
    const downBps = BigInt(probabilities.down_bps);
    if (upBps === calculatedUpBps && downBps === calculatedDownBps) {
      return {
        upPercent: Number(upBps) / 100,
        downPercent: Number(downBps) / 100,
        hasPredictions: true,
      };
    }
  }

  return {
    upPercent: Number(calculatedUpBps) / 100,
    downPercent: Number(calculatedDownBps) / 100,
    hasPredictions: true,
  };
}

export function toMarketView(
  market: ContractMarket,
  probabilities: MarketProbabilities,
): MarketView {
  const pool = poolDisplay(market.total_up_pool, market.total_down_pool, probabilities);
  return {
    id: market.market_id,
    asset: market.asset,
    pair: market.pair,
    question: market.question,
    openTime: unixSecondsToDate(market.candle_start).getTime(),
    closeTime: unixSecondsToDate(market.candle_end).getTime(),
    bettingCloseTime: unixSecondsToDate(market.betting_close).getTime(),
    settleAfterTime: unixSecondsToDate(market.settle_after).getTime(),
    status: market.display_status,
    outcome: market.final_outcome,
    upPool: weiToGen(market.total_up_pool, 4),
    downPool: weiToGen(market.total_down_pool, 4),
    totalPool: weiToGen(market.total_pool, 4),
    bettorCount: Number(market.number_of_bettors),
    upPercent: pool.upPercent,
    downPercent: pool.downPercent,
    hasPredictions: pool.hasPredictions,
    evidence: market.settlement.sources,
    settlementReason: market.settlement.reason,
    resolvedAt: Number(market.resolved_at) * 1000,
    contract: market,
  };
}

export function totalPool(market: MarketView) {
  return market.totalPool;
}

export function marketPercentages(market: MarketView) {
  return { up: market.upPercent / 100, down: market.downPercent / 100 };
}
