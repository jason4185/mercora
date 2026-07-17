import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { MERCORA_CONTRACT_ADDRESS, MERCORA_NETWORK_KEY } from "@/config/mercora";
import { mercoraContract } from "@/lib/mercora-contract";
import type { MarketPageKind } from "@/lib/mercora-contract";
import { toMarketView } from "@/lib/market-view";
import {
  amountRefetchInterval,
  contractPolling,
  marketListRefetchInterval,
  marketRefetchInterval,
  portfolioRefetchInterval,
  userStatusRefetchInterval,
} from "@/lib/contract-refresh-policy";
import type { MarketStatus } from "@/lib/contract-parsers";

const root = ["mercora", MERCORA_NETWORK_KEY, MERCORA_CONTRACT_ADDRESS] as const;
export const mercoraKeys = {
  all: root,
  config: [...root, "get_market_configuration"] as const,
  stats: [...root, "get_protocol_stats"] as const,
  market: (id: string) => [...root, "get_market", id] as const,
  markets: (kind: string, pageSize = 12) =>
    [...root, "market-page", kind, String(pageSize)] as const,
  user: (address: string) => [...root, "user", address.toLowerCase()] as const,
  userStatus: (id: string, address: string) =>
    [...root, "get_user_market_status", id, address.toLowerCase()] as const,
  claimable: (id: string, address: string) =>
    [...root, "get_claimable_amount", id, address.toLowerCase()] as const,
  refundable: (id: string, address: string) =>
    [...root, "get_refundable_amount", id, address.toLowerCase()] as const,
  read: (method: string, args: string[]) => [...root, method, ...args] as const,
  validation: (asset: string, start: bigint) =>
    [...root, "validate_market_creation", asset, start.toString()] as const,
  lookup: (asset: string, start: bigint) =>
    [...root, "get_market_id_by_key", asset, start.toString()] as const,
};

export function useMarketConfiguration() {
  return useQuery({
    queryKey: mercoraKeys.config,
    queryFn: mercoraContract.getMarketConfiguration,
    staleTime: 60_000,
    refetchInterval: contractPolling.protocolConfig,
    refetchOnMount: "always",
  });
}

export function useProtocolStats() {
  return useQuery({
    queryKey: mercoraKeys.stats,
    queryFn: mercoraContract.getProtocolStats,
    staleTime: 60_000,
    refetchInterval: contractPolling.protocolStats,
    refetchOnMount: "always",
  });
}

export function useMarketPages(kind: MarketPageKind, pageSize = 12) {
  return useInfiniteQuery({
    queryKey: mercoraKeys.markets(kind, pageSize),
    initialPageParam: "0",
    queryFn: async ({ pageParam }) => {
      const page = await mercoraContract.getMarketIdsPage(
        kind,
        BigInt(pageParam),
        BigInt(pageSize),
      );
      const markets = await Promise.all(
        page.market_ids.map(async (id) => {
          const [market, probabilities] = await Promise.all([
            mercoraContract.getMarket(BigInt(id)),
            mercoraContract.getMarketProbabilities(BigInt(id)),
          ]);
          return toMarketView(market, probabilities);
        }),
      );
      return { ...page, markets };
    },
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    refetchInterval: marketListRefetchInterval(kind),
    refetchIntervalInBackground: kind !== "completed",
    refetchOnMount: "always",
  });
}

export function useMarket(marketId: string) {
  return useQuery({
    queryKey: mercoraKeys.market(marketId),
    queryFn: async () => {
      if (!/^\d+$/.test(marketId)) return null;
      const id = BigInt(marketId);
      if (!(await mercoraContract.marketExists(id))) return null;
      const [market, probabilities] = await Promise.all([
        mercoraContract.getMarket(id),
        mercoraContract.getMarketProbabilities(id),
      ]);
      return toMarketView(market, probabilities);
    },
    refetchInterval: (query) => marketRefetchInterval(query.state.data?.status),
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}

export function useUserMarketStatus(
  marketId: string,
  address?: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: mercoraKeys.userStatus(marketId, address ?? ""),
    queryFn: () => mercoraContract.getUserMarketStatus(BigInt(marketId), address!),
    enabled: Boolean((options.enabled ?? true) && address && /^\d+$/.test(marketId)),
    refetchInterval: (query) => userStatusRefetchInterval(query.state.data),
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}

export function useClaimableAmount(
  marketId: string,
  address?: string,
  options: { fast?: boolean; marketStatus?: MarketStatus } = {},
) {
  return useQuery({
    queryKey: mercoraKeys.claimable(marketId, address ?? ""),
    queryFn: () => mercoraContract.getClaimableAmount(BigInt(marketId), address!),
    enabled: Boolean(address && /^\d+$/.test(marketId)),
    refetchInterval: (query) =>
      amountRefetchInterval({
        amount: query.state.data,
        fast: options.fast ?? false,
        marketStatus: options.marketStatus,
      }),
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}

export function useRefundableAmount(
  marketId: string,
  address?: string,
  options: { fast?: boolean; marketStatus?: MarketStatus } = {},
) {
  return useQuery({
    queryKey: mercoraKeys.refundable(marketId, address ?? ""),
    queryFn: () => mercoraContract.getRefundableAmount(BigInt(marketId), address!),
    enabled: Boolean(address && /^\d+$/.test(marketId)),
    refetchInterval: (query) =>
      amountRefetchInterval({
        amount: query.state.data,
        fast: options.fast ?? false,
        marketStatus: options.marketStatus,
      }),
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}

export async function loadUserPortfolio(address: string, safetyPages = 10) {
  let cursor = 0n;
  const entries = [];
  for (let pageNumber = 0; pageNumber < safetyPages; pageNumber += 1) {
    const page = await mercoraContract.getUserMarketIdsPage(address, cursor, 20n);
    const batch = await Promise.all(
      page.market_ids.map(async (id) => {
        const [market, probabilities, user] = await Promise.all([
          mercoraContract.getMarket(BigInt(id)),
          mercoraContract.getMarketProbabilities(BigInt(id)),
          mercoraContract.getUserMarketStatus(BigInt(id), address),
        ]);
        return { market: toMarketView(market, probabilities), user };
      }),
    );
    entries.push(...batch);
    if (!page.has_more) break;
    cursor = BigInt(page.next_cursor);
  }
  return entries;
}

export function useUserPortfolio(address?: string) {
  return useQuery({
    queryKey: mercoraKeys.user(address ?? ""),
    queryFn: () => loadUserPortfolio(address!),
    enabled: Boolean(address),
    refetchInterval: (query) => portfolioRefetchInterval(query.state.data),
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
  });
}
