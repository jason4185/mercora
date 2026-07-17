import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Filter,
  Clock,
  TrendingUp,
  CheckCircle2,
  History,
  Search,
  ArrowUpDown,
  LayoutGrid,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import { MarketCard } from "@/components/mercora/market-card";
import type { Asset, MarketStatus } from "@/lib/contract-parsers";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/mercora/page-header";
import { EmptyState } from "@/components/mercora/empty-state";
import { useMarketPages } from "@/hooks/contract/use-mercora";
import { Button } from "@/components/ui/button";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";
import { collectionReadState } from "@/lib/contract-ui";

export const Route = createFileRoute("/")({
  component: MarketsPage,
  head: () => ({
    meta: [
      { title: "Markets — Mercora" },
      {
        name: "description",
        content:
          "Browse live and upcoming one-hour BTC, ETH, BNB, and SOL direction markets on Mercora.",
      },
    ],
  }),
});

type Tab = "ALL" | "LIVE" | "UPCOMING" | "READY" | "COMPLETED";
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "LIVE", label: "Live" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "READY", label: "Ready for Result" },
  { key: "COMPLETED", label: "Completed" },
];

const ASSETS: Asset[] = ["BTC", "ETH", "BNB", "SOL"];

function matchesTab(status: MarketStatus, tab: Tab, startsInFuture: boolean) {
  if (tab === "ALL") return true;
  if (tab === "LIVE") return status === "CLOSED";
  if (tab === "UPCOMING") return status === "OPEN" && startsInFuture;
  if (tab === "READY") return status === "READY_FOR_SETTLEMENT";
  if (tab === "COMPLETED")
    return status === "SETTLED" || status === "INCONCLUSIVE" || status === "CANCELLED";
  return true;
}

function MarketsPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"pool" | "time">("time");
  const marketQuery = useMarketPages(
    tab === "READY" ? "due" : tab === "COMPLETED" ? "completed" : tab === "ALL" ? "all" : "active",
  );
  const filtered = useMemo(() => {
    const loadedMarkets = marketQuery.data?.pages.flatMap((page) => page.markets) ?? [];
    let list = loadedMarkets.filter((m) => {
      const startsInFuture = m.openTime > Date.now();
      return matchesTab(m.status, tab, startsInFuture);
    });
    if (asset) list = list.filter((m) => m.asset === asset);
    if (q.trim()) {
      const term = q.toLowerCase();
      list = list.filter(
        (m) => m.pair.toLowerCase().includes(term) || m.question.toLowerCase().includes(term),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === "pool")
        return (
          parseFloat(b.upPool) +
          parseFloat(b.downPool) -
          (parseFloat(a.upPool) + parseFloat(a.downPool))
        );
      return a.openTime - b.openTime;
    });
    return list;
  }, [tab, asset, q, sort, marketQuery.data?.pages]);
  const loadedMarketCount =
    marketQuery.data?.pages.reduce((count, page) => count + page.markets.length, 0) ?? 0;
  const noFilters = tab === "ALL" && asset === null && q.trim() === "";
  const readState = collectionReadState({
    isLoading: marketQuery.isLoading,
    isError: marketQuery.isError,
    hasData: Boolean(marketQuery.data),
    itemCount: loadedMarketCount,
  });

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[208px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <SidebarPanel tab={tab} setTab={setTab} asset={asset} setAsset={setAsset} />
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col gap-4">
            <PageHeader
              title="1-Hour Crypto Markets"
              description="Predict whether a cryptocurrency will finish higher or lower during a one-hour period."
              badge="5 exchanges · 3 must agree"
            />
            {marketQuery.isRefetchError && marketQuery.data ? (
              <ContractRefreshWarning
                message="Markets could not be refreshed. Retrying…"
                onRetry={() => marketQuery.refetch()}
                retrying={marketQuery.isFetching}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search markets"
                  aria-label="Search markets"
                  className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] focus:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                onClick={() => setSort(sort === "pool" ? "time" : "pool")}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Sort: {sort === "pool" ? "Pool size" : "Time"}
              </button>
              <details className="relative lg:hidden">
                <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-2xl">
                  <SidebarPanel
                    tab={tab}
                    setTab={setTab}
                    asset={asset}
                    setAsset={setAsset}
                    mobile
                  />
                </div>
              </details>
            </div>

            {/* Tabs */}
            <div className="hidden flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1 sm:flex lg:hidden">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tab === t.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1">
                {ASSETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAsset(asset === a ? null : a)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      asset === a
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            {readState === "loading" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : readState === "failed" ? (
              <EmptyState
                icon={Filter}
                title="Markets could not be loaded."
                description="Market information is temporarily unavailable."
                actionLabel="Try Again"
                onAction={() => marketQuery.refetch()}
              />
            ) : readState === "empty" && noFilters ? (
              <EmptyState
                icon={LayoutGrid}
                title="No markets have been created yet."
                description="New markets will appear here after an authorized market manager creates them."
                actionLabel="Refresh"
                onAction={() => marketQuery.refetch()}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Filter}
                title="No markets match your filters"
                description="Try another asset or clear the current search and status filters."
                actionLabel="Clear filters"
                onAction={() => {
                  setTab("ALL");
                  setAsset(null);
                  setQ("");
                }}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((m) => (
                    <MarketCard key={m.id} m={m} />
                  ))}
                </div>
                {marketQuery.hasNextPage && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="secondary"
                      disabled={marketQuery.isFetchingNextPage}
                      onClick={() => marketQuery.fetchNextPage()}
                    >
                      {marketQuery.isFetchingNextPage ? "Loading…" : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SidebarPanel({
  tab,
  setTab,
  asset,
  setAsset,
  mobile = false,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  asset: Asset | null;
  setAsset: (a: Asset | null) => void;
  mobile?: boolean;
}) {
  const groupItems: { key: Tab; label: string; Icon: typeof Clock }[] = [
    { key: "ALL", label: "All markets", Icon: LayoutGrid },
    { key: "LIVE", label: "Live", Icon: TrendingUp },
    { key: "UPCOMING", label: "Upcoming", Icon: Clock },
    { key: "READY", label: "Ready for Result", Icon: CheckCircle2 },
    { key: "COMPLETED", label: "Completed", Icon: History },
  ];
  return (
    <div className={cn("space-y-5", !mobile && "sticky top-20")}>
      <div>
        <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Markets
        </div>
        <nav className="space-y-0.5">
          {groupItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === key && "bg-primary/12 text-primary ring-1 ring-primary/30",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div>
        <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Assets
        </div>
        <nav className="space-y-0.5">
          {(["BTC", "ETH", "BNB", "SOL"] as Asset[]).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(asset === a ? null : a)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                asset === a && "bg-surface text-foreground",
              )}
            >
              <AssetIcon asset={a} size={18} />
              <span>
                {a === "BTC"
                  ? "Bitcoin"
                  : a === "ETH"
                    ? "Ethereum"
                    : a === "BNB"
                      ? "BNB"
                      : "Solana"}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
