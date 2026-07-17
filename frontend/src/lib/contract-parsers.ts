export type Asset = "BTC" | "ETH" | "BNB" | "SOL";
export type MarketStatus =
  | "OPEN"
  | "CLOSED"
  | "READY_FOR_SETTLEMENT"
  | "SETTLED"
  | "INCONCLUSIVE"
  | "CANCELLED";
export type Outcome = "UP" | "DOWN" | "INCONCLUSIVE" | "CANCELLED" | "NONE";
export type UserResult =
  | "NOT_PARTICIPATED"
  | "PENDING"
  | "WON"
  | "LOST"
  | "REFUND_AVAILABLE"
  | "CLAIMED"
  | "REFUNDED";

export interface SourceEvidence {
  provider: string;
  status: "VALID" | "UNAVAILABLE";
  reason?: string;
  symbol?: string;
  interval?: string;
  candle_start?: string;
  candle_end?: string;
  open?: string;
  close?: string;
  direction?: "UP" | "DOWN";
}

export interface SettlementEvidence {
  final_outcome: Outcome;
  valid_source_count: number;
  up_votes: number;
  down_votes: number;
  unavailable_votes: number;
  reason?: string;
  sources: SourceEvidence[];
}

export interface ContractMarket {
  market_id: string;
  market_key: string;
  created_by: string;
  asset: Asset;
  pair: string;
  category: string;
  market_type: string;
  quote_asset: string;
  interval: string;
  timezone: string;
  question: string;
  up_label: string;
  down_label: string;
  up_rule: string;
  down_rule: string;
  betting_close: string;
  candle_start: string;
  candle_end: string;
  settle_after: string;
  created_at: string;
  resolved_at: string;
  status: "OPEN" | "SETTLED" | "INCONCLUSIVE" | "CANCELLED";
  display_status: MarketStatus;
  final_outcome: Outcome;
  total_up_pool: string;
  total_down_pool: string;
  total_pool: string;
  number_of_bettors: string;
  settlement: SettlementEvidence;
}

export interface IdPage {
  market_ids: string[];
  next_cursor: string;
  has_more: boolean;
  count?: string;
}

export interface MarketProbabilities {
  up_bps: string;
  down_bps: string;
}

export interface UserMarketStatus {
  market_id: string;
  wallet: string;
  participated: boolean;
  position: "UP" | "DOWN" | "NONE";
  up_stake: string;
  down_stake: string;
  total_stake: string;
  market_status: string;
  display_status: MarketStatus;
  final_outcome: Outcome;
  user_result: UserResult;
  claimable_amount: string;
  refundable_amount: string;
  claimed: boolean;
  claimed_amount: string;
}

export interface UserPosition {
  market_id: string;
  wallet: string;
  position: "UP" | "DOWN" | "NONE";
  up_stake: string;
  down_stake: string;
  total_stake: string;
  claimed: boolean;
  claimed_amount: string;
}

export interface UserMarketIds {
  market_ids: string[];
  count: string;
  truncated: boolean;
}

export interface MarketConfiguration {
  category: string;
  market_type: string;
  supported_assets: Asset[];
  quote_asset: string;
  interval: string;
  interval_seconds: string;
  timezone: string;
  minimum_creation_lead_time_seconds: string;
  settlement_safety_delay_seconds: string;
  minimum_stake: string;
  maximum_stake_per_wallet: string;
  configured_source_count: string;
  required_matching_votes: string;
  providers: string[];
  up_rule: string;
  down_rule: string;
}

export interface ProtocolStats {
  owner: string;
  market_operator: string;
  market_count: string;
  open_market_count: string;
  settled_market_count: string;
  cancelled_market_count: string;
  inconclusive_market_count: string;
  total_market_volume: string;
  total_claimed_amount: string;
  total_refunded_amount: string;
  minimum_stake: string;
  maximum_stake_per_wallet: string;
}

export interface CreationValidation {
  valid: boolean;
  reason: string;
  asset: string;
  pair: string;
  candle_start: string;
  candle_end: string;
  settle_after: string;
  minimum_allowed_candle_start: string;
  duplicate_market_id: string;
}

export interface MarketLookup {
  exists: boolean;
  market_id: string;
}

function record(value: unknown, label: string): Record<string, unknown> {
  const decoded = typeof value === "string" ? JSON.parse(value) : value;
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error(`${label} returned an invalid response.`);
  }
  return decoded as Record<string, unknown>;
}

function text(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`Missing ${key}.`);
  }
  return String(value);
}

function bool(obj: Record<string, unknown>, key: string) {
  if (typeof obj[key] !== "boolean") throw new Error(`Missing ${key}.`);
  return obj[key] as boolean;
}

function stringList(obj: Record<string, unknown>, key: string) {
  if (
    !Array.isArray(obj[key]) ||
    !(obj[key] as unknown[]).every((item) => typeof item === "string")
  ) {
    throw new Error(`Invalid ${key}.`);
  }
  return obj[key] as string[];
}

const STATUSES = new Set<MarketStatus>([
  "OPEN",
  "CLOSED",
  "READY_FOR_SETTLEMENT",
  "SETTLED",
  "INCONCLUSIVE",
  "CANCELLED",
]);
const OUTCOMES = new Set<Outcome>(["UP", "DOWN", "INCONCLUSIVE", "CANCELLED", "NONE"]);
const USER_RESULTS = new Set<UserResult>([
  "NOT_PARTICIPATED",
  "PENDING",
  "WON",
  "LOST",
  "REFUND_AVAILABLE",
  "CLAIMED",
  "REFUNDED",
]);

export function parseIdPage(value: unknown): IdPage {
  const obj = record(value, "Market page");
  return {
    market_ids: stringList(obj, "market_ids"),
    next_cursor: text(obj, "next_cursor"),
    has_more: bool(obj, "has_more"),
    count: obj.count === undefined ? undefined : text(obj, "count"),
  };
}

function parseSettlement(value: unknown): SettlementEvidence {
  const obj = record(value, "Settlement evidence");
  const sourcesObject =
    obj.sources && typeof obj.sources === "object" && !Array.isArray(obj.sources)
      ? (obj.sources as Record<string, unknown>)
      : {};
  const sources = Object.entries(sourcesObject).map(([provider, sourceValue]) => {
    const source = record(sourceValue, provider);
    const status = text(source, "status");
    if (status !== "VALID" && status !== "UNAVAILABLE") throw new Error("Invalid exchange status.");
    return {
      provider,
      status,
      reason: source.reason === undefined ? undefined : text(source, "reason"),
      symbol: source.symbol === undefined ? undefined : text(source, "symbol"),
      interval: source.interval === undefined ? undefined : text(source, "interval"),
      candle_start: source.candle_start === undefined ? undefined : text(source, "candle_start"),
      candle_end: source.candle_end === undefined ? undefined : text(source, "candle_end"),
      open: source.open === undefined ? undefined : text(source, "open"),
      close: source.close === undefined ? undefined : text(source, "close"),
      direction:
        source.direction === "UP" || source.direction === "DOWN" ? source.direction : undefined,
    } satisfies SourceEvidence;
  });
  const outcome = text(obj, "final_outcome") as Outcome;
  if (!OUTCOMES.has(outcome)) throw new Error("Invalid final outcome.");
  return {
    final_outcome: outcome,
    valid_source_count: Number(text(obj, "valid_source_count")),
    up_votes: Number(text(obj, "up_votes")),
    down_votes: Number(text(obj, "down_votes")),
    unavailable_votes: Number(text(obj, "unavailable_votes")),
    reason: obj.reason === undefined ? undefined : text(obj, "reason"),
    sources,
  };
}

export function parseMarket(value: unknown, displayStatus?: string): ContractMarket {
  const obj = record(value, "Market");
  const asset = text(obj, "asset") as Asset;
  if (!["BTC", "ETH", "BNB", "SOL"].includes(asset)) throw new Error("Unsupported market asset.");
  const storedStatus = text(obj, "status") as ContractMarket["status"];
  const shown = (displayStatus ?? storedStatus) as MarketStatus;
  const outcome = text(obj, "final_outcome") as Outcome;
  if (!STATUSES.has(shown) || !OUTCOMES.has(outcome)) throw new Error("Invalid market status.");
  return {
    market_id: text(obj, "market_id"),
    market_key: text(obj, "market_key"),
    created_by: text(obj, "created_by"),
    asset,
    pair: text(obj, "pair"),
    category: text(obj, "category"),
    market_type: text(obj, "market_type"),
    quote_asset: text(obj, "quote_asset"),
    interval: text(obj, "interval"),
    timezone: text(obj, "timezone"),
    question: text(obj, "question"),
    up_label: text(obj, "up_label"),
    down_label: text(obj, "down_label"),
    up_rule: text(obj, "up_rule"),
    down_rule: text(obj, "down_rule"),
    betting_close: text(obj, "betting_close"),
    candle_start: text(obj, "candle_start"),
    candle_end: text(obj, "candle_end"),
    settle_after: text(obj, "settle_after"),
    created_at: text(obj, "created_at"),
    resolved_at: text(obj, "resolved_at"),
    status: storedStatus,
    display_status: shown,
    final_outcome: outcome,
    total_up_pool: text(obj, "total_up_pool"),
    total_down_pool: text(obj, "total_down_pool"),
    total_pool: text(obj, "total_pool"),
    number_of_bettors: text(obj, "number_of_bettors"),
    settlement: parseSettlement(obj.settlement),
  };
}

export function parseProbabilities(value: unknown): MarketProbabilities {
  const obj = record(value, "Market probabilities");
  return { up_bps: text(obj, "up_bps"), down_bps: text(obj, "down_bps") };
}

export function parseUserMarketStatus(value: unknown): UserMarketStatus {
  const obj = record(value, "User market status");
  const position = text(obj, "position") as UserMarketStatus["position"];
  const displayStatus = text(obj, "display_status") as MarketStatus;
  const finalOutcome = text(obj, "final_outcome") as Outcome;
  const userResult = text(obj, "user_result") as UserResult;
  if (
    !["UP", "DOWN", "NONE"].includes(position) ||
    !STATUSES.has(displayStatus) ||
    !OUTCOMES.has(finalOutcome) ||
    !USER_RESULTS.has(userResult)
  ) {
    throw new Error("User market status returned an invalid state.");
  }
  return {
    market_id: text(obj, "market_id"),
    wallet: text(obj, "wallet"),
    participated: bool(obj, "participated"),
    position,
    up_stake: text(obj, "up_stake"),
    down_stake: text(obj, "down_stake"),
    total_stake: text(obj, "total_stake"),
    market_status: text(obj, "market_status"),
    display_status: displayStatus,
    final_outcome: finalOutcome,
    user_result: userResult,
    claimable_amount: text(obj, "claimable_amount"),
    refundable_amount: text(obj, "refundable_amount"),
    claimed: bool(obj, "claimed"),
    claimed_amount: text(obj, "claimed_amount"),
  };
}

export function parseUserPosition(value: unknown): UserPosition {
  const obj = record(value, "User position");
  const position = text(obj, "position") as UserPosition["position"];
  if (!["UP", "DOWN", "NONE"].includes(position)) throw new Error("Invalid user position.");
  return {
    market_id: text(obj, "market_id"),
    wallet: text(obj, "wallet"),
    position,
    up_stake: text(obj, "up_stake"),
    down_stake: text(obj, "down_stake"),
    total_stake: text(obj, "total_stake"),
    claimed: bool(obj, "claimed"),
    claimed_amount: text(obj, "claimed_amount"),
  };
}

export function parseUserMarketIds(value: unknown): UserMarketIds {
  const obj = record(value, "User market IDs");
  return {
    market_ids: stringList(obj, "market_ids"),
    count: text(obj, "count"),
    truncated: bool(obj, "truncated"),
  };
}

export function parseConfiguration(value: unknown): MarketConfiguration {
  const obj = record(value, "Market configuration");
  return {
    category: text(obj, "category"),
    market_type: text(obj, "market_type"),
    supported_assets: stringList(obj, "supported_assets") as Asset[],
    quote_asset: text(obj, "quote_asset"),
    interval: text(obj, "interval"),
    interval_seconds: text(obj, "interval_seconds"),
    timezone: text(obj, "timezone"),
    minimum_creation_lead_time_seconds: text(obj, "minimum_creation_lead_time_seconds"),
    settlement_safety_delay_seconds: text(obj, "settlement_safety_delay_seconds"),
    minimum_stake: text(obj, "minimum_stake"),
    maximum_stake_per_wallet: text(obj, "maximum_stake_per_wallet"),
    configured_source_count: text(obj, "configured_source_count"),
    required_matching_votes: text(obj, "required_matching_votes"),
    providers: stringList(obj, "providers"),
    up_rule: text(obj, "up_rule"),
    down_rule: text(obj, "down_rule"),
  };
}

export function parseProtocolStats(value: unknown): ProtocolStats {
  const obj = record(value, "Protocol statistics");
  return {
    owner: text(obj, "owner"),
    market_operator: text(obj, "market_operator"),
    market_count: text(obj, "market_count"),
    open_market_count: text(obj, "open_market_count"),
    settled_market_count: text(obj, "settled_market_count"),
    cancelled_market_count: text(obj, "cancelled_market_count"),
    inconclusive_market_count: text(obj, "inconclusive_market_count"),
    total_market_volume: text(obj, "total_market_volume"),
    total_claimed_amount: text(obj, "total_claimed_amount"),
    total_refunded_amount: text(obj, "total_refunded_amount"),
    minimum_stake: text(obj, "minimum_stake"),
    maximum_stake_per_wallet: text(obj, "maximum_stake_per_wallet"),
  };
}

export function parseCreationValidation(value: unknown): CreationValidation {
  const obj = record(value, "Market validation");
  return {
    valid: bool(obj, "valid"),
    reason: text(obj, "reason"),
    asset: text(obj, "asset"),
    pair: text(obj, "pair"),
    candle_start: text(obj, "candle_start"),
    candle_end: text(obj, "candle_end"),
    settle_after: text(obj, "settle_after"),
    minimum_allowed_candle_start: text(obj, "minimum_allowed_candle_start"),
    duplicate_market_id: text(obj, "duplicate_market_id"),
  };
}

export function parseMarketLookup(value: unknown): MarketLookup {
  const obj = record(value, "Market lookup");
  return { exists: bool(obj, "exists"), market_id: text(obj, "market_id") };
}

export const WEI_PER_GEN = 10n ** 18n;

export function genToWei(input: string): bigint {
  const clean = input.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(clean)) throw new Error("Enter a valid GEN amount.");
  const [whole, fraction = ""] = clean.split(".");
  if (fraction.length > 18) throw new Error("GEN supports up to 18 decimal places.");
  const wei = BigInt(whole) * WEI_PER_GEN + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  if (wei <= 0n) throw new Error("Enter a GEN amount greater than zero.");
  return wei;
}

export function weiToGen(value: string | bigint, maximumDecimals = 4): string {
  const wei = typeof value === "bigint" ? value : BigInt(value);
  const whole = wei / WEI_PER_GEN;
  const fraction = (wei % WEI_PER_GEN)
    .toString()
    .padStart(18, "0")
    .slice(0, maximumDecimals)
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function bpsToPercent(value: string): number {
  const bps = BigInt(value);
  return Number(bps) / 100;
}

export function unixSecondsToDate(value: string | bigint) {
  return new Date(Number(BigInt(value)) * 1000);
}
