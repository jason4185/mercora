import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, AlertTriangle, ChevronRight, Coins, Trophy, Wallet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { AppShell } from "@/components/mercora/app-shell";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { EmptyState } from "@/components/mercora/empty-state";
import { PageHeader } from "@/components/mercora/page-header";
import { StatusBadge } from "@/components/mercora/status-badge";
import { Button } from "@/components/ui/button";
import { InjectedConnectButton } from "@/components/mercora/wallet-button";
import { useWallet } from "@/lib/wallet-context";
import {
  mercoraContract,
  mercoraWrites,
  SubmittedTransactionError,
  walletErrorMessage,
} from "@/lib/mercora-contract";
import { weiToGen } from "@/lib/contract-parsers";
import { mercoraKeys, useUserPortfolio } from "@/hooks/contract/use-mercora";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { canClaimRefund, canClaimWinnings, userMarketResult } from "@/lib/contract-ui";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";
import { claimStateMatches, reconcileContractState } from "@/lib/reconciliation";
import { invalidateAfterUserWrite } from "@/lib/contract-refresh-policy";

export const Route = createFileRoute("/portfolio")({
  component: PortfolioPage,
  head: () => ({ meta: [{ title: "Portfolio — Mercora" }] }),
});

type Tab = "ALL" | "ACTIVE" | "CLAIMABLE" | "REFUNDABLE" | "COMPLETED" | "LOST";
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "CLAIMABLE", label: "Claimable" },
  { key: "REFUNDABLE", label: "Refundable" },
  { key: "COMPLETED", label: "Completed" },
  { key: "LOST", label: "Lost" },
];

function PortfolioPage() {
  const wallet = useWallet();
  const query = useUserPortfolio(wallet.address, {
    source: "PortfolioPage/useUserPortfolio",
    blocksRendering: true,
    userSpecific: true,
  });
  const [tab, setTab] = useState<Tab>("ALL");

  if (!wallet.isConnected) {
    return (
      <AppShell>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Wallet className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 font-display text-xl font-semibold">
            Connect a wallet to view your portfolio
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Connect your browser wallet to view your predictions, winnings, and refunds.
          </p>
          <InjectedConnectButton className="mt-5" />
        </div>
      </AppShell>
    );
  }
  if (query.isLoading)
    return (
      <AppShell>
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      </AppShell>
    );
  if (query.isError && !query.data) {
    return (
      <AppShell>
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load your positions"
          description="Your positions could not be loaded. Try again."
          actionLabel="Retry"
          onAction={() => query.refetch()}
        />
      </AppShell>
    );
  }

  const entries = query.data ?? [];
  const filtered = entries.filter(({ market, user }) => {
    const result = userMarketResult({
      status: user,
      market: { status: market.status, outcome: market.outcome },
    });
    if (tab === "ALL") return true;
    if (tab === "ACTIVE") return result.kind === "ACTIVE";
    if (tab === "CLAIMABLE") return result.kind === "WON_CLAIMABLE";
    if (tab === "REFUNDABLE") return result.kind === "REFUND_AVAILABLE";
    if (tab === "LOST") return result.kind === "LOST";
    return ["WON_CLAIMABLE", "WON_CLAIMED", "LOST", "REFUNDED"].includes(result.kind);
  });
  const totalStaked = entries.reduce((sum, item) => sum + BigInt(item.user.total_stake), 0n);
  const winnings = entries.reduce((sum, item) => sum + BigInt(item.user.claimable_amount), 0n);
  const refunds = entries.reduce((sum, item) => sum + BigInt(item.user.refundable_amount), 0n);
  const active = entries.filter(
    (item) =>
      userMarketResult({
        status: item.user,
        market: { status: item.market.status, outcome: item.market.outcome },
      }).kind === "ACTIVE",
  ).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Portfolio"
          description="View your predictions and claim available payouts or refunds."
        />
        {query.isRefetchError && query.data ? (
          <ContractRefreshWarning onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : null}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Summary label="Open Positions" value={String(active)} Icon={Activity} />
          <Summary label="Available Winnings" value={`${weiToGen(winnings)} GEN`} Icon={Coins} />
          <Summary label="Available Refunds" value={`${weiToGen(refunds)} GEN`} Icon={Coins} />
          <Summary label="Total Staked" value={`${weiToGen(totalStaked)} GEN`} Icon={Activity} />
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium",
                tab === item.key ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No positions in this view"
            description="Try another filter or browse available markets."
            actionLabel="Browse Markets"
          />
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <div className="hidden grid-cols-[minmax(0,2fr)_90px_100px_100px_140px_140px_150px] gap-3 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Market</span>
              <span>Your Prediction</span>
              <span>Your Stake</span>
              <span>Your Share</span>
              <span>Market Status</span>
              <span>Payout</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(({ market, user }) => {
                const sidePool =
                  user.position === "UP"
                    ? market.contract.total_up_pool
                    : market.contract.total_down_pool;
                const shareBps =
                  BigInt(sidePool) > 0n
                    ? (BigInt(user.total_stake) * 10_000n) / BigInt(sidePool)
                    : 0n;
                const result = userMarketResult({
                  status: user,
                  market: { status: market.status, outcome: market.outcome },
                });
                return (
                  <div
                    key={market.id}
                    className="grid grid-cols-2 gap-3 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_90px_100px_100px_140px_140px_150px] lg:items-center"
                  >
                    <Link
                      to="/market/$id"
                      params={{ id: market.id }}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <AssetIcon asset={market.asset} size={22} />
                      <span className="text-[13px] font-medium">{market.pair}</span>
                    </Link>
                    <span className={user.position === "UP" ? "text-up" : "text-down"}>
                      {user.position}
                    </span>
                    <span className="text-mono text-[13px]">{weiToGen(user.total_stake)} GEN</span>
                    <span className="text-mono text-[12px]">{Number(shareBps) / 100}%</span>
                    <div className="space-y-1">
                      <span
                        className={cn(
                          "inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold",
                          result.kind === "LOST" ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {result.label}
                      </span>
                      <StatusBadge status={market.status} outcome={market.outcome} />
                    </div>
                    <span className="text-mono text-[12px]">
                      {result.kind === "LOST" ? "0" : weiToGen(result.payoutAmount)} GEN
                    </span>
                    <PositionAction
                      marketId={market.id}
                      userStatus={user}
                      address={wallet.address!}
                    />
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

function Summary({ label, value, Icon }: { label: string; value: string; Icon: typeof Wallet }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

function PositionAction({
  marketId,
  userStatus,
  address,
}: {
  marketId: string;
  userStatus: import("@/lib/contract-parsers").UserMarketStatus;
  address: Address;
}) {
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirmedKind, setConfirmedKind] = useState<"winnings" | "refund" | null>(null);
  const [transactionHash, setTransactionHash] = useState("");
  const [reconciled, setReconciled] = useState(false);

  async function reconcileClaim(kind: "winnings" | "refund") {
    setPending(true);
    setSyncing(false);
    const result = await reconcileContractState({
      read: async () => {
        const [status, amount] = await Promise.all([
          mercoraContract.getUserMarketStatus(BigInt(marketId), address),
          kind === "winnings"
            ? mercoraContract.getClaimableAmount(BigInt(marketId), address)
            : mercoraContract.getRefundableAmount(BigInt(marketId), address),
        ]);
        return { user_result: status.user_result, amount };
      },
      matches: (value) => claimStateMatches(value, kind),
    });
    await invalidateAfterUserWrite(queryClient, mercoraKeys, { marketId, address });
    void wallet.refreshBalance();
    setPending(false);
    setSyncing(!result.matched);
    if (result.matched) {
      setReconciled(true);
      setConfirmedKind(null);
      toast.success(kind === "winnings" ? "Winnings Claimed" : "Refund Claimed");
    }
  }

  async function claim(kind: "winnings" | "refund") {
    if (!wallet.isCorrectNetwork) return toast.error("Switch to GenLayer Bradbury to continue.");
    if (pending) return;
    try {
      const amount =
        kind === "winnings"
          ? await mercoraContract.getClaimableAmount(BigInt(marketId), address)
          : await mercoraContract.getRefundableAmount(BigInt(marketId), address);
      if (amount <= 0n)
        return toast.error(
          kind === "winnings"
            ? "No winnings are available to claim."
            : "No refund is available for this market.",
        );
      setPending(true);
      setReconciled(false);
      const action = kind === "winnings" ? mercoraWrites.claimWinnings : mercoraWrites.claimRefund;
      const result = await action(
        { address, connector: wallet.connector, chainId: wallet.chainId },
        BigInt(marketId),
      );
      setTransactionHash(result.hash);
      setConfirmedKind(kind);
      await reconcileClaim(kind);
    } catch (error) {
      console.error(error);
      if (error instanceof SubmittedTransactionError) setTransactionHash(error.hash);
      toast.error(
        error instanceof SubmittedTransactionError
          ? `Your transaction was submitted and is still processing. ${error.hash}`
          : walletErrorMessage(error),
      );
      if (!(error instanceof SubmittedTransactionError)) setPending(false);
    }
  }
  if (pending && confirmedKind)
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled
        title={transactionHash ? `Transaction: ${transactionHash}` : undefined}
      >
        Updating claim status…
      </Button>
    );
  if (syncing && confirmedKind)
    return (
      <Button
        size="sm"
        variant="secondary"
        title={transactionHash ? `Transaction: ${transactionHash}` : undefined}
        onClick={() => reconcileClaim(confirmedKind)}
      >
        Check Again
      </Button>
    );
  const winningsEligible = canClaimWinnings(userStatus);
  const refundEligible = canClaimRefund(userStatus);
  if (!reconciled && winningsEligible && BigInt(userStatus.claimable_amount) > 0n)
    return (
      <Button
        size="sm"
        className="bg-up text-up-foreground"
        disabled={pending}
        onClick={() => claim("winnings")}
      >
        {pending ? "Claim Processing" : "Claim Winnings"}
      </Button>
    );
  if (!reconciled && refundEligible && BigInt(userStatus.refundable_amount) > 0n)
    return (
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => claim("refund")}>
        {pending ? "Claim Processing" : "Claim Refund"}
      </Button>
    );
  return (
    <Link
      to="/market/$id"
      params={{ id: marketId }}
      className="flex items-center justify-end gap-1 text-[12px] text-muted-foreground"
    >
      View Market <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}
