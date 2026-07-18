import {
  AlertTriangle,
  Bell,
  Check,
  Coins,
  Loader2,
  Play,
  ShieldCheck,
  Timer,
  Trophy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUserPortfolio } from "@/hooks/contract/use-mercora";
import { useWallet } from "@/lib/wallet-context";
import { contractNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { ContractRefreshWarning } from "./contract-refresh-warning";

export function NotificationsBell() {
  const wallet = useWallet({ balance: false });
  const [open, setOpen] = useState(false);
  const [portfolioEnabled, setPortfolioEnabled] = useState(false);
  useEffect(() => {
    if (!wallet.isConnected) {
      setPortfolioEnabled(false);
      return;
    }
    const timeout = window.setTimeout(() => setPortfolioEnabled(true), 8_000);
    return () => window.clearTimeout(timeout);
  }, [wallet.isConnected, wallet.address]);
  const portfolio = useUserPortfolio(wallet.address, {
    enabled: wallet.isConnected && portfolioEnabled,
    source: open ? "NotificationsBell/open" : "NotificationsBell/deferred",
    blocksRendering: false,
    userSpecific: true,
  });
  const notifications = contractNotifications(portfolio.data ?? [], wallet.address);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setPortfolioEnabled(true);
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {notifications.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
        </div>
        <div className="max-h-[380px] divide-y divide-border overflow-y-auto scrollbar-thin">
          {portfolio.isRefetchError && portfolio.data ? (
            <div className="p-2">
              <ContractRefreshWarning
                message="Notifications could not be refreshed. Retrying…"
                onRetry={() => portfolio.refetch()}
                retrying={portfolio.isFetching}
              />
            </div>
          ) : null}
          {!wallet.isConnected ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Connect your browser wallet to see updates about your markets.
            </p>
          ) : portfolio.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : portfolio.isError && !portfolio.data ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              <p>Notifications could not be loaded.</p>
              <button
                type="button"
                className="mt-2 font-semibold text-primary hover:underline"
                onClick={() => portfolio.refetch()}
              >
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              You have no market updates yet.
            </p>
          ) : (
            notifications.map((notification) => {
              const Icon =
                notification.kind === "won"
                  ? Trophy
                  : notification.kind === "lost"
                    ? AlertTriangle
                    : notification.kind === "refund"
                      ? AlertTriangle
                      : notification.kind === "claimed"
                        ? Coins
                        : notification.kind === "closing"
                          ? Timer
                          : notification.kind === "started"
                            ? Play
                            : notification.kind === "ready"
                              ? ShieldCheck
                              : Check;
              const color =
                notification.kind === "won"
                  ? "text-up"
                  : notification.kind === "lost"
                    ? "text-foreground"
                    : notification.kind === "refund"
                      ? "text-warning"
                      : notification.kind === "claimed" || notification.kind === "ready"
                        ? "text-consensus"
                        : "text-muted-foreground";
              return (
                <Link
                  key={notification.id}
                  to="/market/$id"
                  params={{ id: notification.marketId }}
                  className="flex items-start gap-3 px-3 py-3 transition hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2",
                      color,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Market details provide the latest result and claim information.
        </div>
      </PopoverContent>
    </Popover>
  );
}
