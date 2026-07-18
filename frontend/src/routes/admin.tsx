import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/mercora/page-header";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { EmptyState } from "@/components/mercora/empty-state";
import { InjectedConnectButton } from "@/components/mercora/wallet-button";
import { useWallet } from "@/lib/wallet-context";
import {
  mercoraContract,
  mercoraWrites,
  SubmittedTransactionError,
  walletErrorMessage,
} from "@/lib/mercora-contract";
import { mercoraKeys, useMarketConfiguration } from "@/hooks/contract/use-mercora";
import type { Asset } from "@/lib/contract-parsers";
import { cn } from "@/lib/utils";
import {
  friendlyCreationValidationReason,
  getMarketCreationAvailability,
  utcSelectionToUnix,
} from "@/lib/contract-ui";
import { toast } from "sonner";
import { reconcileCreatedMarket } from "@/lib/reconciliation";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";
import { contractPolling, invalidateAfterMarketCreation } from "@/lib/contract-refresh-policy";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type TransactionState =
  | "idle"
  | "awaiting"
  | "submitted"
  | "confirming"
  | "reconciling"
  | "syncing"
  | "processing"
  | "success"
  | "error";

const assetNames: Record<Asset, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  SOL: "Solana",
};

function formatUtc(seconds: bigint | null): string {
  if (seconds === null || seconds <= 0n) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
    .format(new Date(Number(seconds) * 1_000))
    .replace(",", " ·")
    .concat(" UTC");
}

function AdminPage() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const configQuery = useMarketConfiguration();
  const assets = useMemo(
    () => configQuery.data?.supported_assets ?? [],
    [configQuery.data?.supported_assets],
  );
  const [asset, setAsset] = useState<Asset>("BTC");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [transactionState, setTransactionState] = useState<TransactionState>("idle");
  const [transactionHash, setTransactionHash] = useState("");
  const [createdMarketId, setCreatedMarketId] = useState("");
  const [error, setError] = useState("");
  const [pendingCreation, setPendingCreation] = useState<{
    asset: Asset;
    candleStart: bigint;
  } | null>(null);
  const duplicateLookupStarted = useRef(Date.now());

  useEffect(() => {
    if (assets.length > 0 && !assets.includes(asset)) setAsset(assets[0]);
  }, [asset, assets]);

  const candleStart = useMemo(() => utcSelectionToUnix(date, hour), [date, hour]);
  const validationQuery = useQuery({
    queryKey: [
      ...mercoraKeys.validation(asset, candleStart ?? 0n),
      String(wallet.chainId),
    ] as const,
    queryFn: () => mercoraContract.validateMarketCreation(asset, candleStart!),
    enabled: Boolean(candleStart && configQuery.data),
    staleTime: 5_000,
    refetchInterval: contractPolling.validation,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: "always",
  });
  const validation = validationQuery.data;
  const duplicateLookupQuery = useQuery({
    queryKey: mercoraKeys.lookup(asset, candleStart ?? 0n),
    queryFn: async () => {
      const lookup = await mercoraContract.getMarketIdByKey(asset, candleStart!);
      if (!lookup.exists || !lookup.market_id) return null;
      const id = BigInt(lookup.market_id);
      if (!(await mercoraContract.marketExists(id))) return null;
      await mercoraContract.getMarket(id);
      return lookup.market_id;
    },
    enabled: Boolean(candleStart && validation?.reason === "DUPLICATE_MARKET"),
    refetchInterval: (query) =>
      query.state.data || Date.now() - duplicateLookupStarted.current >= 75_000 ? false : 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const existingMarketId =
    validation?.reason === "DUPLICATE_MARKET" ? duplicateLookupQuery.data || "" : "";
  const transactionPending = [
    "awaiting",
    "submitted",
    "confirming",
    "reconciling",
    "syncing",
    "processing",
  ].includes(transactionState);
  const availability = getMarketCreationAvailability({
    connected: wallet.isConnected,
    correctNetwork: wallet.isCorrectNetwork,
    authorizationLoading: wallet.authorizationLoading,
    authorized: wallet.isAdmin,
    assetSelected: Boolean(asset),
    dateSelected: Boolean(date),
    hourSelected: Boolean(hour),
    validationLoading: validationQuery.isFetching,
    validationError: validationQuery.isError,
    validationValid: validation?.valid === true,
    validationReason: validation?.reason,
    pending: transactionPending,
  });

  useEffect(() => {
    if (validation?.reason === "DUPLICATE_MARKET") {
      setError("");
      duplicateLookupStarted.current = Date.now();
    }
  }, [validation?.reason]);

  async function checkDuplicateAgain() {
    duplicateLookupStarted.current = Date.now();
    await duplicateLookupQuery.refetch();
  }

  async function reconcileCreation(targetAsset: Asset, targetStart: bigint) {
    setTransactionState("reconciling");
    setError("");
    const reconciled = await reconcileCreatedMarket(mercoraContract, targetAsset, targetStart);
    if (!reconciled.matched || !reconciled.value) {
      setTransactionState("syncing");
      return;
    }
    setCreatedMarketId(reconciled.value);
    setTransactionState("success");
    await invalidateAfterMarketCreation(queryClient, mercoraKeys, {
      marketId: reconciled.value,
      asset: targetAsset,
      candleStart: targetStart,
    });
    toast.success("Market created.");
    setDate("");
    setHour("");
    await navigate({ to: "/market/$id", params: { id: reconciled.value } });
    setPendingCreation(null);
  }

  async function handleCreate() {
    if (!availability.enabled || !wallet.address || !candleStart || !validation?.valid) {
      setError(availability.reason);
      return;
    }
    setError("");
    setCreatedMarketId("");
    setTransactionHash("");
    let confirmed = false;
    try {
      if (!wallet.isCorrectNetwork) {
        await wallet.switchToBradbury();
        return;
      }
      setTransactionState("awaiting");
      const result = await mercoraWrites.createMarket(
        { address: wallet.address, connector: wallet.connector, chainId: wallet.chainId },
        asset,
        candleStart,
        {
          onSubmitted: (submittedHash) => {
            setTransactionHash(submittedHash);
            setTransactionState("submitted");
            window.setTimeout(
              () =>
                setTransactionState((current) =>
                  current === "submitted" ? "confirming" : current,
                ),
              1_500,
            );
          },
        },
      );
      setTransactionHash(result.hash);
      confirmed = true;
      const creation = { asset, candleStart };
      setPendingCreation(creation);
      await reconcileCreation(creation.asset, creation.candleStart);
    } catch (caught) {
      console.error("Market creation failed", caught);
      if (confirmed) {
        setError("");
        setTransactionState("syncing");
      } else if (caught instanceof SubmittedTransactionError) {
        setTransactionHash(caught.hash);
        setError("Your transaction was submitted and is still processing.");
        setTransactionState("processing");
      } else {
        setError(walletErrorMessage(caught));
        setTransactionState("error");
      }
    }
  }

  async function checkCreationAgain() {
    if (!pendingCreation || transactionState === "reconciling") return;
    await reconcileCreation(pendingCreation.asset, pendingCreation.candleStart);
  }

  if (wallet.authorizationLoading || configQuery.isLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!wallet.isConnected || !wallet.isAdmin || wallet.authorizationError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Create a Market"
          description="Create an approved one-hour crypto market using contract-defined rules."
        />
        {!wallet.isConnected ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 font-display text-lg font-semibold">Authorized account required</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Connect the owner or authorized market-manager account to create markets.
            </p>
            <InjectedConnectButton className="mt-5" />
          </div>
        ) : wallet.authorizationError ? (
          <EmptyState
            icon={AlertCircle}
            title="Authorization could not be checked"
            description="The owner and market-manager addresses could not be loaded."
            actionLabel="Try Again"
            onAction={() => queryClient.invalidateQueries({ queryKey: mercoraKeys.stats })}
          />
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Authorized account required"
            description="Only the owner or authorized market manager can create markets."
            actionLabel="Return to Markets"
            to="/"
          />
        )}
      </div>
    );
  }

  if (configQuery.isError && !configQuery.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={AlertCircle}
          title="Market settings could not be loaded"
          description="Check your connection and try again."
          actionLabel="Try Again"
          onAction={() => configQuery.refetch()}
        />
      </div>
    );
  }

  const displayStart = validation ? BigInt(validation.candle_start) : candleStart;
  const displayEnd =
    (validation ? BigInt(validation.candle_end) : null) ??
    (candleStart && configQuery.data
      ? candleStart + BigInt(configQuery.data.interval_seconds)
      : null);
  const displayResult =
    (validation ? BigInt(validation.settle_after) : null) ??
    (displayEnd && configQuery.data
      ? displayEnd + BigInt(configQuery.data.settlement_safety_delay_seconds)
      : null);
  const pair = validation?.pair || `${asset}${configQuery.data?.quote_asset ?? ""}`;
  const question =
    displayStart && displayEnd
      ? `Will ${assetNames[asset]} finish higher than it started between ${formatUtc(displayStart)} and ${formatUtc(displayEnd)}?`
      : "Choose a date and UTC hour to generate the market question.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Create a Market"
        description="Choose an asset and a one-hour period. All market rules are set by Mercora."
      />
      {configQuery.isRefetchError && configQuery.data ? (
        <ContractRefreshWarning
          onRetry={() => configQuery.refetch()}
          retrying={configQuery.isFetching}
        />
      ) : null}
      {wallet.authorizationRefreshError && wallet.protocolStats ? (
        <div className="mt-3">
          <ContractRefreshWarning
            message="Authorization details could not be refreshed. Retrying…"
            onRetry={() => queryClient.invalidateQueries({ queryKey: mercoraKeys.stats })}
          />
        </div>
      ) : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Select Asset</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {assets.map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={transactionPending}
                    onClick={() => {
                      setAsset(item);
                      setTransactionState("idle");
                      setError("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                      item === asset
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-secondary/35 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <AssetIcon asset={item} size={22} />
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="market-date">Start Date</Label>
              <Input
                id="market-date"
                type="date"
                value={date}
                disabled={transactionPending}
                onChange={(event) => {
                  setDate(event.target.value);
                  setTransactionState("idle");
                  setError("");
                }}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="market-hour">Start Time (UTC)</Label>
              <select
                id="market-hour"
                value={hour}
                disabled={transactionPending}
                onChange={(event) => {
                  setHour(event.target.value);
                  setTransactionState("idle");
                  setError("");
                }}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a full UTC hour</option>
                {Array.from({ length: 24 }, (_, index) => (
                  <option key={index} value={String(index).padStart(2, "0")}>
                    {String(index).padStart(2, "0")}:00 UTC
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-secondary/25 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {validationQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : validation?.valid ? (
                <CheckCircle2 className="h-4 w-4 text-up" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              )}
              Validation Summary
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {validationQuery.isError
                ? "The selected market could not be checked. Try again."
                : !date
                  ? "Select a start date."
                  : !hour
                    ? "Select a full UTC start hour."
                    : friendlyCreationValidationReason(
                        validation?.reason,
                        configQuery.data?.minimum_creation_lead_time_seconds,
                      )}
            </p>
            {existingMarketId ? (
              <Link
                to="/market/$id"
                params={{ id: existingMarketId }}
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Open Existing Market
              </Link>
            ) : validation?.reason === "DUPLICATE_MARKET" ? (
              <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p>This market already exists. Retrieving it now…</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={duplicateLookupQuery.isFetching}
                  onClick={checkDuplicateAgain}
                >
                  {duplicateLookupQuery.isFetching ? "Checking…" : "Check Again"}
                </Button>
              </div>
            ) : null}
            {date && hour ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={validationQuery.isFetching || transactionPending}
                onClick={() => validationQuery.refetch()}
              >
                {validationQuery.isError ? "Retry Validation" : "Refresh Validation"}
              </Button>
            ) : null}
          </div>

          {!wallet.isCorrectNetwork ? (
            <Button className="mt-5 w-full" onClick={wallet.switchToBradbury}>
              Switch to GenLayer Bradbury
            </Button>
          ) : null}
          <Button
            className={cn("w-full", wallet.isCorrectNetwork ? "mt-5" : "mt-2")}
            disabled={!availability.enabled}
            onClick={handleCreate}
            aria-describedby="create-market-reason"
          >
            {transactionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {transactionState === "awaiting"
              ? "Waiting for wallet approval"
              : transactionState === "submitted"
                ? "Transaction submitted"
                : transactionState === "confirming"
                  ? "Creating market"
                  : transactionState === "reconciling"
                    ? "Updating market information…"
                    : transactionState === "syncing"
                      ? "Market created"
                      : transactionState === "processing"
                        ? "Transaction still processing"
                        : transactionState === "success"
                          ? "Market created"
                          : transactionState === "error"
                            ? "Create Market"
                            : "Create Market"}
          </Button>
          <p
            id="create-market-reason"
            className={cn(
              "mt-2 text-center text-xs",
              availability.enabled ? "text-up" : "text-muted-foreground",
            )}
          >
            {availability.reason}
          </p>

          {transactionState === "success" && createdMarketId ? (
            <div className="mt-4 rounded-lg border border-up/25 bg-up/10 p-4 text-sm">
              <p className="font-semibold text-up">Market created successfully.</p>
              <Link
                to="/market/$id"
                params={{ id: createdMarketId }}
                className="mt-2 inline-block font-medium text-foreground hover:text-primary"
              >
                View the new market
              </Link>
              {transactionHash ? (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Transaction: {transactionHash}
                </p>
              ) : null}
            </div>
          ) : null}
          {transactionState === "reconciling" ? (
            <div className="mt-4 rounded-lg border border-consensus/25 bg-consensus/10 p-4 text-sm">
              <p className="font-semibold text-consensus">
                Market created. Waiting for it to appear…
              </p>
              <p className="mt-1 text-muted-foreground">
                Transaction confirmed. Updating market information…
              </p>
            </div>
          ) : null}
          {transactionState === "syncing" ? (
            <div className="mt-4 rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
              <p className="font-semibold text-warning">
                Your transaction was confirmed, but the market is still syncing.
              </p>
              <p className="mt-1 text-muted-foreground">
                You can safely check again without creating another market.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={checkCreationAgain}>
                  Check Again
                </Button>
                <Button type="button" size="sm" variant="secondary" asChild>
                  <Link to="/">View Markets</Link>
                </Button>
              </div>
              {transactionHash ? (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Transaction: {transactionHash}
                </p>
              ) : null}
            </div>
          ) : null}
          {validationQuery.isRefetchError && validation ? (
            <div className="mt-3">
              <ContractRefreshWarning
                message="Market validation could not be refreshed. Retrying…"
                onRetry={() => validationQuery.refetch()}
                retrying={validationQuery.isFetching}
              />
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </section>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-base font-semibold">Review Market</h2>
          <div className="mt-4 space-y-4 text-sm">
            <ReviewRow label="Pair" value={pair || "—"} />
            <ReviewRow
              label="Price Period"
              value={
                displayStart && displayEnd
                  ? `${formatUtc(displayStart)} — ${formatUtc(displayEnd)}`
                  : "—"
              }
            />
            <ReviewRow label="Betting Closes" value={formatUtc(displayStart)} />
            <ReviewRow label="Result Available After" value={formatUtc(displayResult)} />
            <ReviewRow
              label="Earliest Allowed Start"
              value={
                validation?.minimum_allowed_candle_start
                  ? formatUtc(BigInt(validation.minimum_allowed_candle_start))
                  : "—"
              }
            />
          </div>
          <div className="mt-5 border-t border-border pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Generated Market Question
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{question}</p>
          </div>
          <div className="mt-5 flex gap-3 rounded-lg bg-info/8 p-3 text-xs leading-relaxed text-muted-foreground">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p>
              Select a one-hour period starting at a full UTC hour. The market must be created at
              least{" "}
              {String(BigInt(configQuery.data?.minimum_creation_lead_time_seconds ?? "0") / 60n)}{" "}
              minutes before betting closes.
            </p>
          </div>
          <div className="mt-3 flex gap-3 rounded-lg bg-secondary/35 p-3 text-xs leading-relaxed text-muted-foreground">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              The connected account is checked here for convenience. Mercora performs the final
              authorization check.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
