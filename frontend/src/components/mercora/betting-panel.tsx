import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { MarketView } from "@/lib/market-view";
import { totalPool } from "@/lib/market-view";
import { genToWei, weiToGen } from "@/lib/contract-parsers";
import { mercoraContract, mercoraWrites, SubmittedTransactionError } from "@/lib/mercora-contract";
import { getInjectedProvider } from "@/config/mercora";
import {
  useClaimableAmount,
  mercoraKeys,
  useMarketConfiguration,
  useRefundableAmount,
  useUserMarketStatus,
} from "@/hooks/contract/use-mercora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { toast } from "sonner";
import type { Address } from "viem";
import { canClaimRefund, canClaimWinnings, userMarketResult } from "@/lib/contract-ui";
import { InjectedConnectButton } from "./wallet-button";
import {
  claimStateMatches,
  predictionStateMatches,
  reconcileContractState,
} from "@/lib/reconciliation";
import { ContractRefreshWarning } from "./contract-refresh-warning";
import { invalidateAfterUserWrite } from "@/lib/contract-refresh-policy";

type TxState =
  | "idle"
  | "awaiting"
  | "submitted"
  | "confirming"
  | "reconciling"
  | "syncing"
  | "confirmed"
  | "processing"
  | "failed";
const QUICK = ["1", "2", "5", "10"];
type ReconciliationContext =
  | {
      kind: "prediction";
      position: "UP" | "DOWN";
      minimumStake: bigint;
      minimumPool: bigint;
    }
  | { kind: "winnings" | "refund" };

export function BettingPanel({
  m,
  initialSide = "UP",
}: {
  m: MarketView;
  initialSide?: "UP" | "DOWN";
}) {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const userQuery = useUserMarketStatus(m.id, wallet.address);
  const fastUserAmountPolling =
    !userQuery.data || ["PENDING", "WON", "REFUND_AVAILABLE"].includes(userQuery.data.user_result);
  const claimableQuery = useClaimableAmount(m.id, wallet.address, {
    fast: fastUserAmountPolling,
    marketStatus: m.status,
  });
  const refundableQuery = useRefundableAmount(m.id, wallet.address, {
    fast: fastUserAmountPolling,
    marketStatus: m.status,
  });
  const configuration = useMarketConfiguration();
  const [side, setSide] = useState<"UP" | "DOWN">(initialSide);
  const [stake, setStake] = useState("1");
  const [tx, setTx] = useState<TxState>("idle");
  const [hash, setHash] = useState<string>();
  const reconciliation = useRef<ReconciliationContext | null>(null);
  const terminal = ["SETTLED", "INCONCLUSIVE", "CANCELLED"].includes(m.status);
  const bettingOpen = m.status === "OPEN" && Date.now() < m.bettingCloseTime;
  const currentStake = BigInt(userQuery.data?.total_stake ?? "0");
  const minimumStake = BigInt(configuration.data?.minimum_stake ?? "0");
  const maximumStake = BigInt(configuration.data?.maximum_stake_per_wallet ?? "0");
  let stakeWei = 0n;
  let amountError = "";
  try {
    stakeWei = genToWei(stake);
    if (!configuration.data) {
      amountError = "Market limits are loading.";
    } else if (stakeWei < minimumStake || stakeWei > maximumStake) {
      amountError = `Enter an amount between ${weiToGen(minimumStake)} and ${weiToGen(maximumStake)} GEN.`;
    }
    if (maximumStake > 0n && currentStake + stakeWei > maximumStake)
      amountError = `Your total stake cannot exceed ${weiToGen(maximumStake)} GEN.`;
  } catch (error) {
    amountError = error instanceof Error ? error.message : "Enter a valid GEN amount.";
  }
  const oppositeSelected =
    userQuery.data?.participated &&
    userQuery.data.position !== "NONE" &&
    userQuery.data.position !== side;

  async function refresh() {
    if (!wallet.address) {
      await queryClient.invalidateQueries({ queryKey: mercoraKeys.market(m.id) });
      return;
    }
    await invalidateAfterUserWrite(queryClient, mercoraKeys, {
      marketId: m.id,
      address: wallet.address,
    });
    void wallet.refreshBalance();
  }

  async function reconcileWrite(context: ReconciliationContext) {
    if (!wallet.address) return;
    reconciliation.current = context;
    setTx("reconciling");
    const result = await reconcileContractState({
      read: async () => {
        const user = await mercoraContract.getUserMarketStatus(BigInt(m.id), wallet.address!);
        if (context.kind === "prediction") {
          const [position, market] = await Promise.all([
            mercoraContract.getUserPosition(BigInt(m.id), wallet.address!),
            mercoraContract.getMarket(BigInt(m.id)),
            mercoraContract.getMarketProbabilities(BigInt(m.id)),
          ]);
          return {
            user: { ...user, position: position.position },
            market,
            amount: 0n,
          };
        }
        const amount =
          context.kind === "winnings"
            ? await mercoraContract.getClaimableAmount(BigInt(m.id), wallet.address!)
            : await mercoraContract.getRefundableAmount(BigInt(m.id), wallet.address!);
        return { user, market: null, amount };
      },
      matches: ({ user, market, amount }) =>
        context.kind === "prediction"
          ? Boolean(
              market &&
              predictionStateMatches(
                { user, market },
                {
                  position: context.position,
                  minimumStake: context.minimumStake,
                  minimumPool: context.minimumPool,
                },
              ),
            )
          : claimStateMatches({ user_result: user.user_result, amount }, context.kind),
    });
    await refresh();
    if (result.matched) {
      setTx("confirmed");
      toast.success(
        context.kind === "prediction"
          ? "Prediction confirmed."
          : context.kind === "winnings"
            ? "Winnings Claimed"
            : "Refund Claimed",
      );
    } else {
      setTx("syncing");
    }
  }

  async function checkAgain() {
    if (!reconciliation.current || tx === "reconciling") return;
    await reconcileWrite(reconciliation.current);
  }

  async function place() {
    if (!wallet.address) return toast.error("Connect a browser wallet to continue.");
    if (!wallet.isCorrectNetwork) return toast.error("Switch to GenLayer Bradbury to continue.");
    if (!bettingOpen) return toast.error("This market is no longer accepting predictions.");
    if (!userQuery.data || !configuration.data)
      return toast.error("Market information is still loading. Try again.");
    if (amountError) return toast.error(amountError);
    if (oppositeSelected)
      return toast.error("You already selected the other direction for this market.");
    const provider = getInjectedProvider();
    if (!provider) return toast.error("Install a browser wallet to continue.");
    setTx("awaiting");
    try {
      const result = await mercoraWrites.placeBet(
        wallet.address as Address,
        provider,
        BigInt(m.id),
        side,
        stakeWei,
        {
          onSubmitted: (submittedHash) => {
            setHash(submittedHash);
            setTx("submitted");
            window.setTimeout(
              () => setTx((current) => (current === "submitted" ? "confirming" : current)),
              1_500,
            );
          },
        },
      );
      setHash(result.hash);
      await reconcileWrite({
        kind: "prediction",
        position: side,
        minimumStake: currentStake + stakeWei,
        minimumPool: BigInt(m.contract.total_pool) + stakeWei,
      });
    } catch (error) {
      console.error(error);
      if (error instanceof SubmittedTransactionError) {
        setHash(error.hash);
        setTx("processing");
      } else {
        setTx("failed");
      }
      toast.error(
        error instanceof SubmittedTransactionError
          ? "Your transaction was submitted and is still processing."
          : "Transaction failed.",
      );
    }
  }

  async function claim(kind: "winnings" | "refund") {
    if (!wallet.address || !wallet.isCorrectNetwork)
      return toast.error("Connect on GenLayer Bradbury to continue.");
    const provider = getInjectedProvider();
    if (!provider) return toast.error("Install a browser wallet to continue.");
    let amount: bigint;
    try {
      const refreshed =
        kind === "winnings" ? await claimableQuery.refetch() : await refundableQuery.refetch();
      if (refreshed.error || refreshed.data === undefined)
        throw refreshed.error ?? new Error("Claim availability is unavailable.");
      amount = refreshed.data;
    } catch (error) {
      console.error("Claim availability check failed", error);
      return toast.error(
        kind === "winnings"
          ? "Winnings availability could not be checked. Try again."
          : "Refund availability could not be checked. Try again.",
      );
    }
    if (amount <= 0n)
      return toast.error(
        kind === "winnings"
          ? "No winnings are available to claim."
          : "No refund is available for this market.",
      );
    setTx("awaiting");
    try {
      const action = kind === "winnings" ? mercoraWrites.claimWinnings : mercoraWrites.claimRefund;
      const result = await action(wallet.address as Address, provider, BigInt(m.id), {
        onSubmitted: (submittedHash) => {
          setHash(submittedHash);
          setTx("submitted");
          window.setTimeout(
            () => setTx((current) => (current === "submitted" ? "confirming" : current)),
            1_500,
          );
        },
      });
      setHash(result.hash);
      await reconcileWrite({ kind });
    } catch (error) {
      console.error(error);
      if (error instanceof SubmittedTransactionError) {
        setHash(error.hash);
        setTx("processing");
        toast.error("Your transaction was submitted and is still processing.");
      } else {
        setTx("failed");
        toast.error("Transaction failed.");
      }
    }
  }

  const personalResult = userMarketResult({
    status: userQuery.data,
    market: { status: m.status, outcome: m.outcome },
    claimableAmount: claimableQuery.data,
    refundableAmount: refundableQuery.data,
  });
  const userResult = userQuery.data?.user_result;
  const winningsEligible = canClaimWinnings(userQuery.data);
  const refundEligible = canClaimRefund(userQuery.data);
  const winningsAvailable = winningsEligible && (claimableQuery.data ?? 0n) > 0n;
  const refundAvailable = refundEligible && (refundableQuery.data ?? 0n) > 0n;
  const transactionPending = [
    "awaiting",
    "submitted",
    "confirming",
    "reconciling",
    "syncing",
    "processing",
  ].includes(tx);

  if (wallet.isConnected && personalResult.kind === "LOST" && userQuery.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold">
              Lost
            </span>
            <h3 className="mt-3 text-sm font-semibold">Your prediction did not win</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {personalResult.supportingMessage}
            </p>
          </div>
        </div>
        {(userQuery.isRefetchError && userQuery.data) ||
        (claimableQuery.isRefetchError && claimableQuery.data !== undefined) ||
        (refundableQuery.isRefetchError && refundableQuery.data !== undefined) ? (
          <div className="mt-3">
            <ContractRefreshWarning
              onRetry={() => {
                void refresh();
              }}
              retrying={
                userQuery.isFetching || claimableQuery.isFetching || refundableQuery.isFetching
              }
            />
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ResultStat label="Your Prediction" value={userQuery.data.position} />
          <ResultStat label="Confirmed Result" value={m.outcome} />
          <ResultStat label="Your Stake" value={`${weiToGen(userQuery.data.total_stake)} GEN`} />
          <ResultStat label="Final Payout" value="0 GEN" />
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          No payout is available for this market.
        </p>
        <Button asChild className="mt-4 w-full" variant="secondary">
          <Link to="/market/$id" params={{ id: m.id }} hash="exchange-results">
            View Exchange Results
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Choose Your Prediction</h3>
        <span className="text-mono text-[11px] text-muted-foreground">Pool {totalPool(m)} GEN</span>
      </div>
      {(userQuery.isRefetchError && userQuery.data) ||
      (claimableQuery.isRefetchError && claimableQuery.data !== undefined) ||
      (refundableQuery.isRefetchError && refundableQuery.data !== undefined) ||
      (configuration.isRefetchError && configuration.data) ? (
        <div className="mt-3">
          <ContractRefreshWarning
            onRetry={() => {
              void refresh();
            }}
            retrying={
              userQuery.isFetching ||
              claimableQuery.isFetching ||
              refundableQuery.isFetching ||
              configuration.isFetching
            }
          />
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["UP", "DOWN"] as const).map((direction) => {
          const Icon = direction === "UP" ? ArrowUp : ArrowDown;
          const percent = direction === "UP" ? m.upPercent : m.downPercent;
          return (
            <button
              key={direction}
              type="button"
              disabled={!bettingOpen || transactionPending || tx === "confirmed"}
              onClick={() => {
                setSide(direction);
                setTx("idle");
              }}
              className={cn(
                "rounded-lg border p-3 text-left transition disabled:opacity-60",
                side === direction
                  ? direction === "UP"
                    ? "border-up bg-up-soft"
                    : "border-down bg-down-soft"
                  : "border-border bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  direction === "UP" ? "text-up" : "text-down",
                )}
              >
                <Icon className="h-4 w-4" /> {direction}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Pool split: {percent.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>

      {bettingOpen && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <label htmlFor="stake" className="text-muted-foreground">
              Stake (GEN)
            </label>
            <span className="text-muted-foreground">Current: {weiToGen(currentStake)} GEN</span>
          </div>
          <Input
            id="stake"
            inputMode="decimal"
            value={stake}
            disabled={transactionPending || tx === "confirmed"}
            onChange={(event) => {
              setStake(event.target.value);
              setTx("idle");
            }}
            className="h-11 text-mono"
          />
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={transactionPending || tx === "confirmed"}
                onClick={() => {
                  setStake(amount);
                  setTx("idle");
                }}
                className="rounded-md border border-border bg-surface py-1.5 text-[12px] text-mono"
              >
                {amount}
              </button>
            ))}
          </div>
          {amountError && <p className="text-[11px] text-down">{amountError}</p>}
        </div>
      )}

      <div className="mt-4">
        {!wallet.isConnected ? (
          <InjectedConnectButton className="w-full" />
        ) : winningsEligible && claimableQuery.isLoading ? (
          <Button className="w-full" variant="secondary" disabled>
            <Loader2 className="h-4 w-4 animate-spin" /> Checking winnings
          </Button>
        ) : refundEligible && refundableQuery.isLoading ? (
          <Button className="w-full" variant="secondary" disabled>
            <Loader2 className="h-4 w-4 animate-spin" /> Checking refund
          </Button>
        ) : winningsEligible && claimableQuery.isError ? (
          <Button className="w-full" variant="secondary" onClick={() => claimableQuery.refetch()}>
            Retry Winnings Check
          </Button>
        ) : refundEligible && refundableQuery.isError ? (
          <Button className="w-full" variant="secondary" onClick={() => refundableQuery.refetch()}>
            Retry Refund Check
          </Button>
        ) : winningsAvailable ? (
          <Button
            className="w-full bg-up text-up-foreground"
            disabled={transactionPending}
            onClick={() => claim("winnings")}
          >
            {transactionPending ? "Claim Processing" : "Claim Winnings"}
          </Button>
        ) : refundAvailable ? (
          <Button
            className="w-full"
            variant="secondary"
            disabled={transactionPending}
            onClick={() => claim("refund")}
          >
            {transactionPending ? "Claim Processing" : "Claim Refund"}
          </Button>
        ) : !terminal && !bettingOpen ? (
          <div className="space-y-2">
            <Button className="w-full" variant="secondary" disabled>
              Predictions Closed
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Betting closed when the one-hour price period began.
            </p>
          </div>
        ) : !terminal ? (
          <Button
            className={cn(
              "h-11 w-full font-semibold",
              side === "UP" ? "bg-up text-up-foreground" : "bg-down text-down-foreground",
            )}
            disabled={
              !bettingOpen ||
              !userQuery.data ||
              !configuration.data ||
              Boolean(amountError) ||
              oppositeSelected ||
              transactionPending ||
              tx === "confirmed"
            }
            onClick={place}
          >
            {["awaiting", "submitted", "confirming"].includes(tx) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {tx === "idle" && `Predict ${side} with ${stake || "0"} GEN`}
            {tx === "awaiting" && "Waiting for wallet approval"}
            {tx === "submitted" && "Transaction submitted"}
            {tx === "confirming" && "Confirming prediction"}
            {tx === "reconciling" && "Updating market information…"}
            {tx === "syncing" && "Transaction confirmed"}
            {tx === "confirmed" && (
              <>
                <CheckCircle2 className="h-4 w-4" /> Prediction confirmed
              </>
            )}
            {tx === "processing" && "Transaction still processing"}
            {tx === "failed" && "Try Again"}
          </Button>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-3 text-[12px] text-muted-foreground">
            {userResult === "CLAIMED"
              ? "Winnings claimed."
              : userResult === "REFUNDED"
                ? "Refund claimed."
                : "No claim is available for this account."}
          </div>
        )}
        {bettingOpen && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Betting closes in{" "}
              <Countdown to={m.bettingCloseTime} />
            </span>
          </div>
        )}
        {hash && (
          <p className="mt-2 break-all text-[10px] text-muted-foreground">Transaction: {hash}</p>
        )}
        {tx === "reconciling" ? (
          <p className="mt-2 text-[11px] text-consensus">
            {reconciliation.current?.kind === "prediction"
              ? "Prediction confirmed. Updating the market…"
              : reconciliation.current?.kind === "winnings"
                ? "Claim confirmed. Updating your claim status…"
                : "Refund confirmed. Updating your refund status…"}
          </p>
        ) : null}
        {tx === "syncing" ? (
          <div className="mt-3 rounded-md border border-warning/25 bg-warning/10 p-3 text-[11px]">
            <p className="text-warning">
              {reconciliation.current?.kind === "prediction"
                ? "Your prediction was confirmed, but the latest market totals are still syncing."
                : "The transaction is confirmed, but the latest information is still syncing."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={checkAgain}
            >
              Check Again
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-mono text-[13px] font-semibold">{value}</span>
    </div>
  );
}
