import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { StatusBadge } from "@/components/mercora/status-badge";
import { ProbabilityBar } from "@/components/mercora/probability-bar";
import { BettingPanel } from "@/components/mercora/betting-panel";
import { EvidenceTable } from "@/components/mercora/evidence-table";
import { Countdown } from "@/components/mercora/countdown";
import { EmptyState } from "@/components/mercora/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUtc } from "@/lib/format";
import {
  marketDetailQuestion,
  marketPercentages,
  participantLabel,
  totalPool,
} from "@/lib/market-view";
import { useMarket } from "@/hooks/contract/use-mercora";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";

export const Route = createFileRoute("/market/$id")({
  validateSearch: (search: Record<string, unknown>): { side?: "UP" | "DOWN" } =>
    search.side === "DOWN" || search.side === "UP" ? { side: search.side } : {},
  component: MarketDetailPage,
  head: () => ({ meta: [{ title: "Market — Mercora" }] }),
});

function MarketDetailPage() {
  const { id } = Route.useParams();
  const { side } = Route.useSearch();
  const query = useMarket(id);

  if (query.isLoading)
    return (
      <AppShell>
        <Skeleton className="h-[620px] rounded-2xl" />
      </AppShell>
    );
  if (query.isError && !query.data) {
    return (
      <AppShell>
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load this market"
          description="Market information could not be loaded. Try again."
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      </AppShell>
    );
  }
  if (!query.data) {
    return (
      <AppShell>
        <EmptyState
          icon={AlertTriangle}
          title="Market Not Found"
          description="This market does not exist."
          actionLabel="Return to Markets"
        />
      </AppShell>
    );
  }

  const m = query.data;
  const { up, down } = marketPercentages(m);
  return (
    <AppShell>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to markets
      </Link>
      {query.isRefetchError && query.data ? (
        <div className="mb-4">
          <ContractRefreshWarning onRetry={() => query.refetch()} retrying={query.isFetching} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <div className="card-elevated rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <AssetIcon asset={m.asset} size={32} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold">{m.pair}</h1>
                  <span className="text-mono text-[12px] text-muted-foreground">1H · UTC</span>
                  <StatusBadge status={m.status} outcome={m.outcome} />
                </div>
                <p className="mt-1 text-[14px] text-muted-foreground">{marketDetailQuestion(m)}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Price period starts" value={formatUtc(m.openTime)} />
              <Stat label="Price period ends" value={formatUtc(m.closeTime)} />
              <Stat
                label="Total pool"
                value={`${totalPool(m)} GEN · ${participantLabel(m.bettorCount)}`}
              />
              <Stat
                label="Betting closes"
                value={
                  m.status === "OPEN" ? (
                    <Countdown to={m.bettingCloseTime} />
                  ) : (
                    formatUtc(m.bettingCloseTime)
                  )
                }
              />
              <Stat label="Result available after" value={formatUtc(m.settleAfterTime)} />
            </div>
            <div className="mt-5">
              <ProbabilityBar up={up} down={down} hasPredictions={m.hasPredictions} />
            </div>
          </div>

          <div className="card-elevated rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Price Overview</h2>
                <p className="text-[12px] text-muted-foreground">
                  Price chart is not available yet.
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="Chart information"
                      className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    The official result is confirmed separately using prices from five exchanges.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="grid h-64 place-items-center rounded-xl border border-dashed border-border bg-surface text-center">
              <div>
                <p className="text-sm font-medium">Price chart is not available yet.</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  The official result is confirmed separately using prices from five exchanges.
                </p>
              </div>
            </div>
          </div>

          <div className="card-elevated rounded-2xl p-5">
            <h2 className="text-sm font-semibold">Market Rules</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <Rule
                title="UP wins"
                text="The closing price must be higher than the opening price."
                color="bg-up"
              />
              <Rule
                title="DOWN wins"
                text="The closing price must be equal to or lower than the opening price."
                color="bg-down"
              />
              <Rule
                title="No clear result"
                text="If fewer than three exchanges agree, all participants can claim a refund."
                color="bg-warning"
              />
              <Rule
                title="Cancelled"
                text="If bets are placed on only one side, all participants can claim a refund."
                color="bg-muted-foreground"
              />
            </div>
          </div>

          {m.evidence.length > 0 && (
            <div id="exchange-results" className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Exchange Results</h2>
                <span className="text-[12px] text-muted-foreground">Checked by GenLayer</span>
              </div>
              <EvidenceTable evidence={m.evidence} />
            </div>
          )}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <BettingPanel m={m} initialSide={side} />
          </div>
        </aside>
      </div>
      <div className="mt-6 lg:hidden">
        <BettingPanel m={m} initialSide={side} />
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-[12px] font-medium">{value}</span>
    </div>
  );
}

function Rule({ title, text, color }: { title: string; text: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        {title}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">{text}</p>
    </div>
  );
}
