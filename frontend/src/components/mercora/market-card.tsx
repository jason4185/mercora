import { Link } from "@tanstack/react-router";
import { Users, Timer, Coins } from "lucide-react";
import { format } from "date-fns";
import type { Market } from "@/lib/mock-data";
import { impliedProbabilities, totalPool } from "@/lib/mock-data";
import { AssetIcon } from "./asset-icon";
import { StatusBadge } from "./status-badge";
import { ProbabilityBar } from "./probability-bar";
import { Countdown } from "./countdown";
import { Button } from "@/components/ui/button";

export function MarketCard({ m }: { m: Market }) {
  const { up, down } = impliedProbabilities(m);
  const isOpen = m.status === "OPEN" && Date.now() < m.bettingCloseTime;

  return (
    <Link
      to="/market/$id"
      params={{ id: m.id }}
      className="group card-elevated relative flex flex-col rounded-xl p-4 transition hover:border-border-strong hover:shadow-lg hover:shadow-black/20"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <AssetIcon asset={m.asset} size={22} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{m.pair}</span>
            <span className="text-mono text-[11px] text-muted-foreground">1H</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
            {m.question}
          </p>
        </div>
        <StatusBadge status={m.status} outcome={m.outcome} />
      </div>

      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground text-mono">
        <span>
          {format(m.openTime, "HH:mm")}–{format(m.closeTime, "HH:mm")} UTC
        </span>
        <span className="text-border-strong">•</span>
        <span>{format(m.openTime, "MMM d")}</span>
      </div>

      <div className="mt-3">
        <ProbabilityBar up={up} down={down} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" />
          <span className="text-mono text-foreground">{totalPool(m)}</span> GEN
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span className="text-mono text-foreground">{m.bettorCount}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <Timer className="h-3.5 w-3.5" />
          {m.status === "OPEN" ? (
            <Countdown to={m.bettingCloseTime} />
          ) : m.status === "READY_FOR_SETTLEMENT" ? (
            <span className="text-consensus">now</span>
          ) : (
            <span className="text-mono">closed</span>
          )}
        </div>
      </div>

      {isOpen ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="border border-up/30 bg-up-soft text-up hover:bg-up/20"
            onClick={(e) => e.preventDefault()}
            asChild
          >
            <span>Bet UP</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border border-down/30 bg-down-soft text-down hover:bg-down/20"
            onClick={(e) => e.preventDefault()}
            asChild
          >
            <span>Bet DOWN</span>
          </Button>
        </div>
      ) : m.status === "SETTLED" ? (
        <div className="mt-3 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Final:{" "}
          <span className={m.outcome === "UP" ? "text-up font-medium" : "text-down font-medium"}>
            {m.outcome}
          </span>{" "}
          · 5/5 sources agreed · GenLayer verified
        </div>
      ) : m.status === "INCONCLUSIVE" ? (
        <div className="mt-3 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Inconclusive — fewer than 3/5 matching votes. Refunds available.
        </div>
      ) : m.status === "CANCELLED" ? (
        <div className="mt-3 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Cancelled — one-sided pool. Refunds available.
        </div>
      ) : null}
    </Link>
  );
}
