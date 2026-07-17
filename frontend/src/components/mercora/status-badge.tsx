import { cn } from "@/lib/utils";
import type { MarketStatus, Outcome } from "@/lib/contract-parsers";

const LABELS: Record<MarketStatus, string> = {
  OPEN: "Betting Open",
  CLOSED: "Price Period Active",
  READY_FOR_SETTLEMENT: "Waiting for Result",
  SETTLED: "Result Confirmed",
  INCONCLUSIVE: "No Clear Result",
  CANCELLED: "Cancelled",
};

export function StatusBadge({
  status,
  outcome,
  className,
}: {
  status: MarketStatus;
  outcome?: Outcome;
  className?: string;
}) {
  const isSettledUp = status === "SETTLED" && outcome === "UP";
  const isSettledDown = status === "SETTLED" && outcome === "DOWN";

  const styles = cn(
    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums",
    status === "OPEN" && "bg-primary/12 text-primary border border-primary/30",
    status === "READY_FOR_SETTLEMENT" &&
      "bg-consensus-soft text-consensus border border-consensus/40",
    status === "CLOSED" && "bg-warning/10 text-warning border border-warning/30",
    isSettledUp && "bg-up-soft text-up border border-up/40",
    isSettledDown && "bg-down-soft text-down border border-down/40",
    status === "INCONCLUSIVE" && "bg-muted text-muted-foreground border border-border-strong",
    status === "CANCELLED" && "bg-muted text-muted-foreground border border-border-strong",
    className,
  );
  const dot = cn(
    "h-1.5 w-1.5 rounded-full",
    status === "OPEN" && "bg-primary animate-pulse",
    status === "READY_FOR_SETTLEMENT" && "bg-consensus",
    isSettledUp && "bg-up",
    isSettledDown && "bg-down",
    (status === "INCONCLUSIVE" || status === "CANCELLED" || status === "CLOSED") &&
      "bg-muted-foreground",
  );

  const label =
    status === "SETTLED"
      ? outcome === "UP"
        ? "Result Confirmed · UP"
        : "Result Confirmed · DOWN"
      : LABELS[status];

  return (
    <span className={styles}>
      <span className={dot} />
      {label}
    </span>
  );
}
