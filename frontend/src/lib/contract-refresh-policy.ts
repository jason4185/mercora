import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { MarketStatus, UserMarketStatus } from "./contract-parsers";
import { userMarketResult } from "./contract-ui";
import { contractReadCooldownRemaining } from "./contract-read-policy";

export const contractPolling = {
  activeMarketList: 18_000,
  allMarketList: 20_000,
  dueMarketList: 15_000,
  completedMarketList: 60_000,
  activeMarket: 15_000,
  finalMarket: 60_000,
  activeUser: 15_000,
  stableUser: 60_000,
  protocolConfig: 300_000,
  protocolStats: 60_000,
  validation: 15_000,
} as const;

export function isFinalMarketStatus(status: MarketStatus | undefined): boolean {
  return status === "SETTLED" || status === "INCONCLUSIVE" || status === "CANCELLED";
}

export function marketListRefetchInterval(kind: string): number {
  if (kind === "completed") return contractPolling.completedMarketList;
  if (kind === "all") return contractPolling.allMarketList;
  if (kind === "due") return contractPolling.dueMarketList;
  return contractPolling.activeMarketList;
}

export function rateLimitAwareInterval(interval: number): number {
  const remaining = contractReadCooldownRemaining();
  return remaining > 0 ? Math.max(interval, remaining + 1_000) : interval;
}

export function marketRefetchInterval(status: MarketStatus | undefined): number {
  return isFinalMarketStatus(status) ? contractPolling.finalMarket : contractPolling.activeMarket;
}

export function userStatusRefetchInterval(status: UserMarketStatus | undefined): number {
  if (!status) return contractPolling.activeUser;
  const result = userMarketResult(status);
  return ["LOST", "WON_CLAIMED", "REFUNDED"].includes(result.kind)
    ? contractPolling.stableUser
    : contractPolling.activeUser;
}

export function amountRefetchInterval(input: {
  amount: bigint | undefined;
  fast: boolean;
  marketStatus?: MarketStatus;
}): number {
  if (input.fast || input.amount === undefined || input.amount > 0n)
    return contractPolling.activeUser;
  return isFinalMarketStatus(input.marketStatus)
    ? contractPolling.stableUser
    : contractPolling.activeUser;
}

export function portfolioRefetchInterval(
  rows:
    | Array<{
        user: UserMarketStatus;
      }>
    | undefined,
): number {
  if (!rows) return contractPolling.activeUser;
  return rows.some(({ user }) => userStatusRefetchInterval(user) === contractPolling.activeUser)
    ? contractPolling.activeUser
    : contractPolling.stableUser;
}

export function isMercoraUserQueryKey(queryKey: QueryKey, address: string): boolean {
  const normalized = address.toLowerCase();
  return Array.isArray(queryKey) && queryKey.some((part) => part === normalized);
}

export async function invalidateAfterMarketCreation(
  queryClient: QueryClient,
  keys: {
    all: readonly unknown[];
    stats: readonly unknown[];
    markets: (kind: string, pageSize?: number) => readonly unknown[];
    market: (id: string) => readonly unknown[];
    lookup: (asset: string, start: bigint) => readonly unknown[];
    validation: (asset: string, start: bigint) => readonly unknown[];
  },
  input: { marketId: string; asset: string; candleStart: bigint },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.stats }),
    queryClient.invalidateQueries({ queryKey: keys.markets("all") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("active") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("due") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("completed") }),
    queryClient.invalidateQueries({ queryKey: keys.lookup(input.asset, input.candleStart) }),
    queryClient.invalidateQueries({ queryKey: keys.validation(input.asset, input.candleStart) }),
    queryClient.invalidateQueries({ queryKey: keys.market(input.marketId) }),
  ]);
}

export async function invalidateAfterUserWrite(
  queryClient: QueryClient,
  keys: {
    market: (id: string) => readonly unknown[];
    markets: (kind: string, pageSize?: number) => readonly unknown[];
    user: (address: string) => readonly unknown[];
    userStatus: (id: string, address: string) => readonly unknown[];
    claimable: (id: string, address: string) => readonly unknown[];
    refundable: (id: string, address: string) => readonly unknown[];
  },
  input: { marketId: string; address: string },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.market(input.marketId) }),
    queryClient.invalidateQueries({ queryKey: keys.markets("all") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("active") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("due") }),
    queryClient.invalidateQueries({ queryKey: keys.markets("completed") }),
    queryClient.invalidateQueries({ queryKey: keys.user(input.address) }),
    queryClient.invalidateQueries({ queryKey: keys.userStatus(input.marketId, input.address) }),
    queryClient.invalidateQueries({ queryKey: keys.claimable(input.marketId, input.address) }),
    queryClient.invalidateQueries({ queryKey: keys.refundable(input.marketId, input.address) }),
  ]);
}
