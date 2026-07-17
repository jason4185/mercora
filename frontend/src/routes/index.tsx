import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Filter, Clock, TrendingUp, CheckCircle2, XCircle, Search, ArrowUpDown } from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import { MarketCard } from "@/components/mercora/market-card";
import { MARKETS, type Asset, type MarketStatus } from "@/lib/mock-data";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
  { key: "READY", label: "Ready" },
  { key: "COMPLETED", label: "Completed" },
];

const ASSETS: Asset[] = ["BTC", "ETH", "BNB", "SOL"];

function matchesTab(status: MarketStatus, tab: Tab, startsInFuture: boolean) {
  if (tab === "ALL") return true;
  if (tab === "LIVE") return status === "OPEN" && !startsInFuture;
  if (tab === "UPCOMING") return status === "OPEN" && startsInFuture;
  if (tab === "READY") return status === "READY_FOR_SETTLEMENT" || status === "CLOSED";
  if (tab === "COMPLETED")
    return status === "SETTLED" || status === "INCONCLUSIVE" || status === "CANCELLED";
  return true;
}

function MarketsPage() {
  const [tab, setTab] = useState<Tab>("ALL");
  const [asset, setAsset] = useState<Asset | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"pool" | "time">("time");
  const [loading] = useState(false);

  const filtered = useMemo(() => {
    let list = MARKETS.filter((m) => {
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
        return parseFloat(b.upPool) + parseFloat(b.downPool) - (parseFloat(a.upPool) + parseFloat(a.downPool));
      return a.openTime - b.openTime;
    });
    return list;
  }, [tab, asset, q, sort]);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <SidebarPanel tab={tab} setTab={setTab} asset={asset} setAsset={setAsset} />
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">1-Hour direction markets</h1>
                <p className="text-[13px] text-muted-foreground">
                  Pari-mutuel · settled by 5-source consensus on GenLayer
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative md:hidden">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search"
                    className="h-9 w-40 rounded-md border border-border bg-surface pl-8 pr-2 text-[13px] focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setSort(sort === "pool" ? "time" : "pool")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Sort: {sort === "pool" ? "Pool size" : "Time"}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition",
                    tab === t.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 lg:hidden">
                {ASSETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAsset(asset === a ? null : a)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium",
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
            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-elevated grid place-items-center rounded-xl p-12 text-center">
                <Filter className="h-6 w-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No markets match your filters</p>
                <p className="text-[12px] text-muted-foreground">Try clearing filters or picking another asset.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((m) => (
                  <MarketCard key={m.id} m={m} />
                ))}
              </div>
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
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  asset: Asset | null;
  setAsset: (a: Asset | null) => void;
}) {
  const groupItems: { key: Tab; label: string; Icon: typeof Clock }[] = [
    { key: "LIVE", label: "Live", Icon: TrendingUp },
    { key: "UPCOMING", label: "Upcoming", Icon: Clock },
    { key: "READY", label: "Ready to settle", Icon: CheckCircle2 },
    { key: "COMPLETED", label: "Completed", Icon: XCircle },
  ];
  return (
    <div className="sticky top-20 space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Timeframe</span>
        </div>
        <button className="flex w-full items-center justify-between rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-[13px] font-medium text-primary">
          1 Hour
          <span className="text-[11px] text-muted-foreground">Only</span>
        </button>
      </div>
      <div>
        <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">Status</div>
        <nav className="space-y-0.5">
          {groupItems.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground",
                tab === key && "bg-surface text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div>
        <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">Assets</div>
        <nav className="space-y-0.5">
          {(["BTC", "ETH", "BNB", "SOL"] as Asset[]).map((a) => (
            <button
              key={a}
              onClick={() => setAsset(asset === a ? null : a)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground",
                asset === a && "bg-surface text-foreground",
              )}
            >
              <AssetIcon asset={a} size={18} />
              <span>
                {a === "BTC" ? "Bitcoin" : a === "ETH" ? "Ethereum" : a === "BNB" ? "BNB" : "Solana"}
              </span>
              <span className="ml-auto text-mono text-[11px] text-muted-foreground">/USDT</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
