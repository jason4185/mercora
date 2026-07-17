export interface ReconciliationOptions<T> {
  read: () => Promise<T>;
  matches: (value: T) => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

export interface ReconciliationResult<T> {
  matched: boolean;
  value?: T;
  lastError?: unknown;
}

const waitFor = (milliseconds: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export async function reconcileContractState<T>({
  read,
  matches,
  timeoutMs = 75_000,
  intervalMs = 2_000,
  wait = waitFor,
  now = Date.now,
}: ReconciliationOptions<T>): Promise<ReconciliationResult<T>> {
  const started = now();
  let lastError: unknown;
  do {
    try {
      const value = await read();
      if (matches(value)) return { matched: true, value };
    } catch (error) {
      lastError = error;
    }
    if (now() - started >= timeoutMs) break;
    await wait(intervalMs);
  } while (now() - started < timeoutMs);
  return { matched: false, lastError };
}

export interface CreatedMarketReader {
  getMarketIdByKey: (
    asset: string,
    candleStart: bigint,
  ) => Promise<{ exists: boolean; market_id: string }>;
  marketExists: (marketId: bigint) => Promise<boolean>;
  getMarket: (marketId: bigint) => Promise<unknown>;
}

export async function reconcileCreatedMarket(
  reader: CreatedMarketReader,
  asset: string,
  candleStart: bigint,
  options: Pick<
    ReconciliationOptions<string | null>,
    "timeoutMs" | "intervalMs" | "wait" | "now"
  > = {},
) {
  return reconcileContractState({
    read: async () => {
      const lookup = await reader.getMarketIdByKey(asset, candleStart);
      if (!lookup.exists || !lookup.market_id) return null;
      const id = BigInt(lookup.market_id);
      if (!(await reader.marketExists(id))) return null;
      await reader.getMarket(id);
      return lookup.market_id;
    },
    matches: (marketId) => Boolean(marketId),
    ...options,
  });
}

export interface PredictionReconciliationState {
  user: { position: string; total_stake: string };
  market: { total_pool: string };
}

export function predictionStateMatches(
  value: PredictionReconciliationState,
  expected: { position: "UP" | "DOWN"; minimumStake: bigint; minimumPool: bigint },
) {
  return (
    value.user.position === expected.position &&
    BigInt(value.user.total_stake) >= expected.minimumStake &&
    BigInt(value.market.total_pool) >= expected.minimumPool
  );
}

export function claimStateMatches(
  value: { user_result: string; amount: bigint },
  kind: "winnings" | "refund",
) {
  return (
    value.amount === 0n && value.user_result === (kind === "winnings" ? "CLAIMED" : "REFUNDED")
  );
}
