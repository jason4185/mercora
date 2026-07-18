import {
  useInfiniteQuery,
  useQueries,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
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
  rateLimitAwareInterval,
  userStatusRefetchInterval,
} from "@/lib/contract-refresh-policy";
import { isPermanentContractReadError } from "@/lib/contract-read-policy";
import type { MarketStatus } from "@/lib/contract-parsers";
import type { ContractReadTraceMeta } from "@/lib/contract-read-trace";

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

type ContractQueryOptions = {
  enabled?: boolean;
  source?: string;
  blocksRendering?: boolean;
  essentialAboveFold?: boolean;
  userSpecific?: boolean;
};
type MarketRecordQueryData = ReturnType<typeof toMarketView> | null;

function browserEnabled(enabled = true): boolean {
  return Boolean(enabled && typeof window !== "undefined");
}

function cacheStatus(
  queryClient: QueryClient,
  queryKey: QueryKey,
): ContractReadTraceMeta["cacheStatus"] {
  return queryClient.getQueryState(queryKey)?.dataUpdatedAt ? "refetch-with-cache" : "miss";
}

function traceMeta(
  queryClient: QueryClient,
  queryKey: QueryKey,
  input: ContractQueryOptions,
): ContractReadTraceMeta {
  return {
    queryKey,
    source: input.source,
    route: input.source,
    cacheStatus: cacheStatus(queryClient, queryKey),
    blocksRendering: input.blocksRendering ?? false,
    userSpecific: input.userSpecific ?? false,
    essentialAboveFold: input.essentialAboveFold ?? false,
  };
}

export function useMarketConfiguration(options: ContractQueryOptions = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: mercoraKeys.config,
    queryFn: () =>
      mercoraContract.getMarketConfiguration(
        traceMeta(queryClient, mercoraKeys.config, {
          source: options.source ?? "useMarketConfiguration",
          blocksRendering: options.blocksRendering,
          essentialAboveFold: options.essentialAboveFold,
        }),
      ),
    enabled: browserEnabled(options.enabled ?? true),
    staleTime: 60_000,
    refetchInterval: rateLimitAwareInterval(contractPolling.protocolConfig),
    refetchOnMount: false,
  });
}

export function useProtocolStats(options: ContractQueryOptions = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: mercoraKeys.stats,
    queryFn: () =>
      mercoraContract.getProtocolStats(
        traceMeta(queryClient, mercoraKeys.stats, {
          source: options.source ?? "useProtocolStats",
          blocksRendering: options.blocksRendering,
          essentialAboveFold: options.essentialAboveFold,
        }),
      ),
    enabled: browserEnabled(options.enabled ?? true),
    staleTime: 60_000,
    refetchInterval: rateLimitAwareInterval(contractPolling.protocolStats),
    refetchOnMount: false,
  });
}

export function useMarketPages(kind: MarketPageKind, pageSize = 12) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.markets(kind, pageSize);
  const pageQuery = useInfiniteQuery({
    queryKey,
    initialPageParam: "0",
    queryFn: async ({ pageParam }) => {
      return mercoraContract.getMarketIdsPage(
        kind,
        BigInt(pageParam),
        BigInt(pageSize),
        traceMeta(queryClient, queryKey, {
          source: `MarketsPage/${kind}/market-id-page`,
          blocksRendering: String(pageParam) === "0",
          essentialAboveFold: String(pageParam) === "0",
        }),
      );
    },
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    staleTime: 15_000,
    refetchInterval: rateLimitAwareInterval(marketListRefetchInterval(kind)),
    refetchIntervalInBackground: kind !== "completed",
    refetchOnMount: false,
    enabled: browserEnabled(),
  });

  const marketIds = pageQuery.data?.pages.flatMap((page) => page.market_ids) ?? [];
  const marketQueries = useQueries({
    queries: marketIds.map((id, index) => {
      const marketKey = mercoraKeys.market(id);
      const firstPage = index < pageSize;
      return {
        queryKey: marketKey,
        queryFn: async () => {
          if (!/^\d+$/.test(id)) return null;
          const market = await mercoraContract.getMarket(
            BigInt(id),
            traceMeta(queryClient, marketKey, {
              source: `MarketsPage/${kind}/market-card`,
              blocksRendering: firstPage,
              essentialAboveFold: firstPage,
            }),
          );
          return toMarketView(market);
        },
        enabled: browserEnabled(pageQuery.isSuccess),
        staleTime: 10_000,
        refetchInterval: (query: Query<MarketRecordQueryData>) =>
          rateLimitAwareInterval(marketRefetchInterval(query.state.data?.status)),
        refetchIntervalInBackground: kind !== "completed",
        refetchOnMount: false,
        placeholderData: (previous: MarketRecordQueryData | undefined) => previous,
      };
    }),
  });

  const marketById = new Map(
    marketQueries
      .map((query, index) => [marketIds[index], query.data] as const)
      .filter((entry) => entry[1]),
  );
  const data = pageQuery.data
    ? {
        ...pageQuery.data,
        pages: pageQuery.data.pages.map((page) => ({
          ...page,
          markets: page.market_ids
            .map((id) => marketById.get(id))
            .filter((market): market is NonNullable<typeof market> => Boolean(market)),
        })),
      }
    : undefined;
  const loadedMarketCount =
    data?.pages.reduce((count, page) => count + page.markets.length, 0) ?? 0;
  const allMarketRecordsFailed =
    marketIds.length > 0 &&
    marketQueries.length === marketIds.length &&
    marketQueries.every((query) => query.isError && !query.data);
  const marketRecordRefetchError = marketQueries.some((query) => query.isRefetchError);
  const marketRecordFetching = marketQueries.some((query) => query.isFetching);

  return {
    ...pageQuery,
    data,
    refetch: async () => {
      const pageResult = await pageQuery.refetch();
      await Promise.all(marketQueries.map((query) => query.refetch()));
      return pageResult;
    },
    marketIds,
    marketQueries,
    loadedMarketCount,
    isLoadingMarkets:
      marketIds.length > 0 &&
      loadedMarketCount === 0 &&
      marketQueries.some((query) => query.isLoading),
    isFetchingMarkets: marketRecordFetching,
    hasMarketRecordErrors: marketQueries.some((query) => query.isError && !query.data),
    isError: pageQuery.isError || allMarketRecordsFailed,
    isRefetchError: pageQuery.isRefetchError || marketRecordRefetchError,
    isFetching: pageQuery.isFetching || marketRecordFetching,
  };
}

export function useMarket(marketId: string) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.market(marketId);
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!/^\d+$/.test(marketId)) return null;
      const id = BigInt(marketId);
      try {
        const market = await mercoraContract.getMarket(
          id,
          traceMeta(queryClient, queryKey, {
            source: "MarketDetail/useMarket",
            blocksRendering: true,
            essentialAboveFold: true,
          }),
        );
        return toMarketView(market);
      } catch (error) {
        if (isPermanentContractReadError(error)) return null;
        throw error;
      }
    },
    enabled: browserEnabled(),
    staleTime: 10_000,
    refetchInterval: (query) =>
      rateLimitAwareInterval(marketRefetchInterval(query.state.data?.status)),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
  });
}

export function useUserMarketStatus(
  marketId: string,
  address?: string,
  options: ContractQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.userStatus(marketId, address ?? "");
  return useQuery({
    queryKey,
    queryFn: () =>
      mercoraContract.getUserMarketStatus(
        BigInt(marketId),
        address!,
        traceMeta(queryClient, queryKey, {
          source: options.source ?? "useUserMarketStatus",
          blocksRendering: options.blocksRendering,
          essentialAboveFold: options.essentialAboveFold,
          userSpecific: true,
        }),
      ),
    enabled: browserEnabled(
      Boolean((options.enabled ?? true) && address && /^\d+$/.test(marketId)),
    ),
    refetchInterval: (query) => rateLimitAwareInterval(userStatusRefetchInterval(query.state.data)),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
  });
}

export function useClaimableAmount(
  marketId: string,
  address?: string,
  options: { fast?: boolean; marketStatus?: MarketStatus } & ContractQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.claimable(marketId, address ?? "");
  return useQuery({
    queryKey,
    queryFn: () =>
      mercoraContract.getClaimableAmount(
        BigInt(marketId),
        address!,
        traceMeta(queryClient, queryKey, {
          source: options.source ?? "useClaimableAmount",
          blocksRendering: options.blocksRendering,
          essentialAboveFold: options.essentialAboveFold,
          userSpecific: true,
        }),
      ),
    enabled: browserEnabled(Boolean(address && /^\d+$/.test(marketId))),
    refetchInterval: (query) =>
      rateLimitAwareInterval(
        amountRefetchInterval({
          amount: query.state.data,
          fast: options.fast ?? false,
          marketStatus: options.marketStatus,
        }),
      ),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
  });
}

export function useRefundableAmount(
  marketId: string,
  address?: string,
  options: { fast?: boolean; marketStatus?: MarketStatus } & ContractQueryOptions = {},
) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.refundable(marketId, address ?? "");
  return useQuery({
    queryKey,
    queryFn: () =>
      mercoraContract.getRefundableAmount(
        BigInt(marketId),
        address!,
        traceMeta(queryClient, queryKey, {
          source: options.source ?? "useRefundableAmount",
          blocksRendering: options.blocksRendering,
          essentialAboveFold: options.essentialAboveFold,
          userSpecific: true,
        }),
      ),
    enabled: browserEnabled(Boolean(address && /^\d+$/.test(marketId))),
    refetchInterval: (query) =>
      rateLimitAwareInterval(
        amountRefetchInterval({
          amount: query.state.data,
          fast: options.fast ?? false,
          marketStatus: options.marketStatus,
        }),
      ),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
  });
}

export async function loadUserPortfolio(
  address: string,
  safetyPages = 10,
  trace?: ContractReadTraceMeta,
) {
  let cursor = 0n;
  const entries = [];
  for (let pageNumber = 0; pageNumber < safetyPages; pageNumber += 1) {
    const page = await mercoraContract.getUserMarketIdsPage(address, cursor, 20n, trace);
    const batch = await Promise.all(
      page.market_ids.map(async (id) => {
        const [market, user] = await Promise.all([
          mercoraContract.getMarket(BigInt(id), trace),
          mercoraContract.getUserMarketStatus(BigInt(id), address, trace),
        ]);
        return { market: toMarketView(market), user };
      }),
    );
    entries.push(...batch);
    if (!page.has_more) break;
    cursor = BigInt(page.next_cursor);
  }
  return entries;
}

export function useUserPortfolio(address?: string, options: ContractQueryOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = mercoraKeys.user(address ?? "");
  return useQuery({
    queryKey,
    queryFn: () =>
      loadUserPortfolio(
        address!,
        10,
        traceMeta(queryClient, queryKey, {
          source: options.source ?? "useUserPortfolio",
          blocksRendering: options.blocksRendering ?? true,
          essentialAboveFold: options.essentialAboveFold ?? false,
          userSpecific: true,
        }),
      ),
    enabled: browserEnabled(Boolean((options.enabled ?? true) && address)),
    refetchInterval: (query) => rateLimitAwareInterval(portfolioRefetchInterval(query.state.data)),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
  });
}
