import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, CheckCircle2, Clock3, Coins, RotateCcw, Users } from "lucide-react";
import type { MarketView } from "@/lib/market-view";
import {
  marketPercentages,
  participantLabel,
  shortMarketQuestion,
  totalPool,
} from "@/lib/market-view";
import { AssetIcon } from "./asset-icon";
import { StatusBadge } from "./status-badge";
import { ProbabilityBar } from "./probability-bar";
import { Countdown } from "./countdown";
import { cn } from "@/lib/utils";
import { formatCompactUtcWindow } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { useUserMarketStatus } from "@/hooks/contract/use-mercora";
import { userMarketResult } from "@/lib/contract-ui";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketCard({ m }: { m: MarketView }) {
  const navigate = useNavigate();
  const wallet = useWallet({ balance: false });
  const { up, down } = marketPercentages(m);
  const bettingOpen = m.status === "OPEN" && Date.now() < m.bettingCloseTime;
  const candleRunning = m.status === "CLOSED";
  const terminal =
    m.status === "SETTLED" || m.status === "INCONCLUSIVE" || m.status === "CANCELLED";
  const userStatus = useUserMarketStatus(m.id, wallet.address, {
    enabled: wallet.isConnected && terminal,
    source: "MarketCard/useUserMarketStatus",
    blocksRendering: false,
    essentialAboveFold: false,
  });
  const valid = m.evidence.filter((source) => source.status === "VALID");
  const upVotes = valid.filter((source) => source.direction === "UP").length;
  const downVotes = valid.filter((source) => source.direction === "DOWN").length;
  const matching = Math.max(upVotes, downVotes);
  const first = valid[0];
  const movement = first ? Number(first.close) - Number(first.open) : 0;
  const personalResult =
    userStatus.isSuccess && userStatus.data?.participated
      ? userMarketResult({
          status: userStatus.data,
          market: { status: m.status, outcome: m.outcome },
        })
      : null;

  const open = (side?: "UP" | "DOWN") =>
    navigate({
      to: "/market/$id",
      params: { id: m.id },
      search: side ? { side } : undefined,
    });

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`Open ${m.pair} market`}
      onClick={() => open()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="group card-elevated relative flex cursor-pointer flex-col rounded-xl p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl hover:shadow-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
        <AssetIcon asset={m.asset} size={20} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold">{m.pair}</span>
            <span className="text-mono text-[10px] text-muted-foreground">1H</span>
          </div>
          <p className="mt-0.5 min-h-8 text-[12px] leading-4 text-muted-foreground">
            {shortMarketQuestion(m.asset)}
          </p>
        </div>
        <StatusBadge status={m.status} outcome={m.outcome} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
        <span className="text-mono">{formatCompactUtcWindow(m.openTime, m.closeTime)}</span>
        {bettingOpen ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Clock3 className="h-3 w-3" /> closes <Countdown to={m.bettingCloseTime} />
          </span>
        ) : candleRunning ? (
          <span className="inline-flex items-center gap-1 text-warning">
            <Clock3 className="h-3 w-3" /> price period ends <Countdown to={m.closeTime} />
          </span>
        ) : null}
      </div>
      {personalResult && terminal ? (
        <div className="mt-2">
          <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
            {personalResult.label}
          </span>
        </div>
      ) : null}

      <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-background/25 p-2 text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Coins className="h-3 w-3" />{" "}
          <b className="text-mono font-medium text-foreground">{totalPool(m)} GEN</b>
        </span>
        <span className="flex items-center justify-end gap-1.5">
          <Users className="h-3 w-3" />{" "}
          <b className="text-mono font-medium text-foreground">{participantLabel(m.bettorCount)}</b>
        </span>
      </div>

      {terminal ? (
        <div className="mt-2.5 flex flex-1 flex-col">
          {m.status === "SETTLED" && (
            <div
              className={cn(
                "rounded-lg border p-2.5",
                m.outcome === "UP"
                  ? "border-up/25 bg-up-soft/40"
                  : "border-down/25 bg-down-soft/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[12px] font-semibold",
                    m.outcome === "UP" ? "text-up" : "text-down",
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Result Confirmed · {m.outcome}
                </span>
                <span className="text-[10.5px] text-consensus">
                  {matching} of 5 exchange directions matched
                </span>
              </div>
              {first && (
                <p className="mt-1.5 text-mono text-[10.5px] text-muted-foreground">
                  {Number(first.open).toLocaleString()} → {Number(first.close).toLocaleString()}{" "}
                  <span className={movement > 0 ? "text-up" : "text-down"}>
                    ({movement > 0 ? "+" : ""}
                    {movement.toFixed(2)})
                  </span>
                </p>
              )}
            </div>
          )}
          {m.status === "INCONCLUSIVE" && (
            <div className="rounded-lg border border-warning/25 bg-warning/[0.06] p-2.5">
              <p className="text-[12px] font-semibold text-warning">No Clear Result</p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                Fewer than three exchanges reported the same direction. All participants can claim a
                refund.
              </p>
            </div>
          )}
          {m.status === "CANCELLED" && (
            <div className="rounded-lg border border-border bg-surface p-2.5">
              <p className="text-[12px] font-semibold">Market Cancelled</p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">
                {m.settlementReason ??
                  "This market was cancelled before the final prices were checked."}
              </p>
            </div>
          )}
          <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            {m.status === "CANCELLED" ? "Pool split before cancellation" : "Final pool split"}
          </p>
          <div className="mt-1 opacity-60">
            <ProbabilityBar up={up} down={down} hasPredictions={m.hasPredictions} />
          </div>
          {(m.status === "INCONCLUSIVE" || m.status === "CANCELLED") && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                open();
              }}
              className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 text-[11px] font-semibold text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3.5 w-3.5" /> View Refund
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-2.5">
            <ProbabilityBar up={up} down={down} hasPredictions={m.hasPredictions} />
          </div>
          {bettingOpen ? (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <DirectionAction side="UP" value={up} onClick={() => open("UP")} />
              <DirectionAction side="DOWN" value={down} onClick={() => open("DOWN")} />
            </div>
          ) : (
            <div className="mt-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
              {candleRunning
                ? "The one-hour price period is active. Betting is closed."
                : "Betting has closed. The final prices are being checked."}
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function MarketCardSkeleton() {
  return (
    <article className="card-elevated flex min-h-[236px] flex-col rounded-xl p-3.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-border/80 bg-background/25 p-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-4 w-24" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>
    </article>
  );
}

function DirectionAction({
  side,
  value,
  onClick,
}: {
  side: "UP" | "DOWN";
  value: number;
  onClick: () => void;
}) {
  const Icon = side === "UP" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        side === "UP"
          ? "border-up/35 bg-up-soft text-up hover:border-up/70 hover:bg-up/20"
          : "border-down/35 bg-down-soft text-down hover:border-down/70 hover:bg-down/20",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {side} {Math.round(value * 100)}%
    </button>
  );
}
