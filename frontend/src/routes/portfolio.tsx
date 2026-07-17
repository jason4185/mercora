import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/mercora/app-shell";
import { useWallet } from "@/lib/wallet-context";
import { getMarketById, type UserMarketStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { StatusBadge } from "@/components/mercora/status-badge";
import { Wallet, Trophy, Coins, Activity, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({
    meta: [
      { title: "Portfolio — Mercora" },
      { name: "description", content: "Your open, won, lost, refundable and claimed Mercora positions." },
    ],
  }),
});

type Tab = "ALL" | "ACTIVE" | "WON" | "LOST" | "REFUNDS" | "CLAIMED";
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
  { key: "REFUNDS", label: "Refunds" },
  { key: "CLAIMED", label: "Claimed" },
];

function matches(s: UserMarketStatus, tab: Tab) {
  if (tab === "ALL") return true;
  if (tab === "ACTIVE") return s === "PENDING";
  if (tab === "WON") return s === "WON";
  if (tab === "LOST") return s === "LOST";
  if (tab === "REFUNDS") return s === "REFUND_AVAILABLE";
  if (tab === "CLAIMED") return s === "CLAIMED" || s === "REFUNDED";
  return true;
}

function PortfolioPage() {
  const { wallet, positions, mode } = useWallet();
  const [tab, setTab] = useState<Tab>("ALL");

  const summary = useMemo(() => {
    const staked = positions.reduce((s, p) => s + parseFloat(p.stake), 0);
    const claimable = positions.reduce((s, p) => s + parseFloat(p.claimable), 0);
    const active = positions.filter((p) => p.status === "PENDING").length;
    const won = positions.filter((p) => p.status === "WON" || p.status === "CLAIMED").length;
    return { staked, claimable, active, won };
  }, [positions]);

  const filtered = positions.filter((p) => matches(p.status, tab));

  if (mode === "DISCONNECTED") {
    return (
      <AppShell>
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-14 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Connect a wallet to view your portfolio</h1>
          <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
            Positions, stakes and claimable amounts are read directly from the GenLayer contract per
            wallet address. Use the wallet menu above to preview different account states.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Portfolio</h1>
          <p className="text-[13px] text-muted-foreground text-mono">{wallet?.address}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCard label="Wallet balance" value={`${wallet?.balance} GEN`} Icon={Wallet} />
          <SummaryCard label="Total staked" value={`${summary.staked.toFixed(2)} GEN`} Icon={Activity} />
          <SummaryCard label="Active positions" value={String(summary.active)} Icon={Activity} />
          <SummaryCard
            label="Claimable"
            value={`${summary.claimable.toFixed(2)} GEN`}
            Icon={Coins}
            highlight={summary.claimable > 0}
          />
        </div>

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
        </div>

        {filtered.length === 0 ? (
          <div className="card-elevated grid place-items-center rounded-xl p-14 text-center">
            <Trophy className="h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No positions in this view</p>
            <p className="text-[12px] text-muted-foreground">Place a bet from the markets page.</p>
            <Link
              to="/"
              className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px]"
            >
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <div className="hidden grid-cols-[minmax(0,2fr)_100px_100px_140px_140px_160px] gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground md:grid">
              <span>Market</span>
              <span>Position</span>
              <span>Stake</span>
              <span>Market status</span>
              <span>Your result</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((p) => {
                const m = getMarketById(p.marketId);
                if (!m) return null;
                return (
                  <div
                    key={p.marketId}
                    className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,2fr)_100px_100px_140px_140px_160px] md:items-center"
                  >
                    <Link to="/market/$id" params={{ id: m.id }} className="flex items-center gap-3 min-w-0">
                      <AssetIcon asset={m.asset} size={22} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{m.pair}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {new Date(m.openTime).toISOString().substring(11, 16)}–
                          {new Date(m.closeTime).toISOString().substring(11, 16)} UTC
                        </div>
                      </div>
                    </Link>
                    <span
                      className={cn(
                        "inline-flex w-fit rounded px-1.5 py-0.5 text-[11px] font-medium",
                        p.side === "UP" && "bg-up-soft text-up",
                        p.side === "DOWN" && "bg-down-soft text-down",
                      )}
                    >
                      {p.side}
                    </span>
                    <span className="text-mono text-[13px]">{p.stake} GEN</span>
                    <div>
                      <StatusBadge status={m.status} outcome={m.outcome} />
                    </div>
                    <ResultBadge s={p.status} />
                    <div className="flex md:justify-end">
                      <ClaimButton position={p} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  Icon,
  highlight,
}: {
  label: string;
  value: string;
  Icon: typeof Wallet;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3",
        highlight && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function ResultBadge({ s }: { s: UserMarketStatus }) {
  const cfg: Record<UserMarketStatus, { text: string; cls: string }> = {
    NOT_PARTICIPATED: { text: "—", cls: "text-muted-foreground" },
    PENDING: { text: "Pending", cls: "text-muted-foreground" },
    WON: { text: "Won", cls: "text-up" },
    LOST: { text: "Lost", cls: "text-down" },
    REFUND_AVAILABLE: { text: "Refund available", cls: "text-warning" },
    CLAIMED: { text: "Claimed", cls: "text-consensus" },
    REFUNDED: { text: "Refunded", cls: "text-consensus" },
  };
  const c = cfg[s];
  return <span className={`text-[12px] font-medium ${c.cls}`}>{c.text}</span>;
}

function ClaimButton({ position }: { position: { status: UserMarketStatus; claimable: string; marketId: string } }) {
  const { status, claimable, marketId } = position;
  if (status === "WON") {
    return (
      <Button
        size="sm"
        className="bg-up text-up-foreground hover:bg-up/90"
        onClick={() => toast.success(`Claimed ${claimable} GEN`)}
      >
        Claim {claimable} GEN
      </Button>
    );
  }
  if (status === "REFUND_AVAILABLE") {
    return (
      <Button size="sm" variant="secondary" onClick={() => toast.success(`Refunded ${claimable} GEN`)}>
        Claim refund
      </Button>
    );
  }
  return (
    <Link
      to="/market/$id"
      params={{ id: marketId }}
      className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
    >
      View <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}
