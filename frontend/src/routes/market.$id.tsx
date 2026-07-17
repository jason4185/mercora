import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { StatusBadge } from "@/components/mercora/status-badge";
import { ProbabilityBar } from "@/components/mercora/probability-bar";
import { PriceChart } from "@/components/mercora/price-chart";
import { BettingPanel } from "@/components/mercora/betting-panel";
import { EvidenceTable } from "@/components/mercora/evidence-table";
import { MarketCard } from "@/components/mercora/market-card";
import { Countdown } from "@/components/mercora/countdown";
import { getMarketById, impliedProbabilities, MARKETS, totalPool } from "@/lib/mock-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/market/$id")({
  component: MarketDetailPage,
  loader: ({ params }) => {
    const m = getMarketById(params.id);
    if (!m) throw notFound();
    return { market: m };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.market.pair} · 1H direction — Mercora` },
            { name: "description", content: loaderData.market.question },
          ],
        }
      : { meta: [{ title: "Market not found — Mercora" }] },
  notFoundComponent: () => (
    <AppShell>
      <div className="grid place-items-center py-20 text-center">
        <p className="text-lg font-semibold">Market not found</p>
        <p className="text-[13px] text-muted-foreground">
          It may have been settled and archived. Return to the market list.
        </p>
        <Link to="/" className="mt-4 rounded-md border border-border bg-surface px-4 py-2 text-sm">
          Back to markets
        </Link>
      </div>
    </AppShell>
  ),
});

function MarketDetailPage() {
  const { market: m } = Route.useLoaderData();
  const { up, down } = impliedProbabilities(m);
  const related = MARKETS.filter((x) => x.id !== m.id && x.asset === m.asset).slice(0, 3);

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to markets
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          {/* Header */}
          <div className="card-elevated rounded-2xl p-5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
              <AssetIcon asset={m.asset} size={32} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold">{m.pair}</h1>
                  <span className="text-mono text-[12px] text-muted-foreground">1H · UTC</span>
                  <StatusBadge status={m.status} outcome={m.outcome} />
                </div>
                <p className="mt-1 text-[14px] text-muted-foreground">{m.question}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Candle open">
                <span className="text-mono">{format(m.openTime, "HH:mm 'UTC'")}</span>
                <span className="text-[11px] text-muted-foreground text-mono">
                  {format(m.openTime, "MMM d, yyyy")}
                </span>
              </Stat>
              <Stat label="Candle close">
                <span className="text-mono">{format(m.closeTime, "HH:mm 'UTC'")}</span>
                <span className="text-[11px] text-muted-foreground text-mono">
                  {format(m.closeTime, "MMM d, yyyy")}
                </span>
              </Stat>
              <Stat label="Total pool">
                <span className="text-mono">{totalPool(m)} GEN</span>
                <span className="text-[11px] text-muted-foreground">{m.bettorCount} bettors</span>
              </Stat>
              <Stat label="Betting close">
                {m.status === "OPEN" ? (
                  <Countdown to={m.bettingCloseTime} />
                ) : (
                  <span className="text-mono">closed</span>
                )}
                <span className="text-[11px] text-muted-foreground text-mono">
                  {format(m.bettingCloseTime, "HH:mm:ss")}
                </span>
              </Stat>
              <Stat label="Settle after">
                <span className="text-mono">{format(m.settleAfterTime, "HH:mm 'UTC'")}</span>
                <span className="text-[11px] text-muted-foreground">Earliest allowed</span>
              </Stat>
            </div>

            <div className="mt-5">
              <ProbabilityBar up={up} down={down} />
            </div>
          </div>

          {/* Chart */}
          <div className="card-elevated rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Reference price</h2>
                <p className="text-[12px] text-muted-foreground">
                  Display only — settlement uses contract-fetched five-source evidence.
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    This chart shows a reference price series for display only. The on-chain
                    settlement pulls the opening and closing prices from Binance, Bybit, Gate.io,
                    MEXC, and Bitget, and requires 3-of-5 matching direction votes.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <PriceChart m={m} />
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Open marker: t+0m · Close marker: t+60m</span>
              <span className="text-mono">Open ref: {m.referencePrice.toLocaleString()}</span>
            </div>
          </div>

          {/* Rules & settlement */}
          <div className="card-elevated rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Rules &amp; settlement</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <RuleBlock
                title="UP resolution"
                dotClass="bg-up"
                text="Close > Open on the completed one-hour candle."
              />
              <RuleBlock
                title="DOWN resolution"
                dotClass="bg-down"
                text="Close ≤ Open on the completed one-hour candle. Equal open and close resolves DOWN."
              />
              <RuleBlock
                title="Inconclusive"
                dotClass="bg-warning"
                text="Fewer than 3-of-5 matching provider votes. Refunds become available."
              />
              <RuleBlock
                title="Cancelled"
                dotClass="bg-muted-foreground"
                text="One-sided pool or no bets. All stakes refundable."
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Binance", "Bybit", "Gate.io", "MEXC", "Bitget"].map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-consensus" />
                  {p}
                </span>
              ))}
              <span className="ml-auto text-[11px] text-muted-foreground">
                3-of-5 matching votes required · Operator can trigger settlement, cannot pick the outcome
              </span>
            </div>
          </div>

          {/* Evidence (after settlement) */}
          {m.evidence && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Settlement evidence</h2>
                <span className="text-[12px] text-muted-foreground">
                  Fetched by GenLayer validators after candle close
                </span>
              </div>
              <EvidenceTable evidence={m.evidence} />
            </div>
          )}

          {/* Related */}
          {related.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Related {m.asset} markets</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {related.map((r) => (
                  <MarketCard key={r.id} m={r} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — sticky panel on desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <BettingPanel m={m} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky panel */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
            <span className="font-medium">Place bet on {m.pair}</span>
            <span className="text-[11px] text-muted-foreground group-open:hidden">Tap to open</span>
            <span className="text-[11px] text-muted-foreground hidden group-open:inline">Tap to close</span>
          </summary>
          <div className="mt-3">
            <BettingPanel m={m} />
          </div>
        </details>
      </div>
    </AppShell>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="text-[13px] font-medium">{children}</div>
    </div>
  );
}

function RuleBlock({ title, text, dotClass }: { title: string; text: string; dotClass: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {title}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">{text}</p>
    </div>
  );
}
