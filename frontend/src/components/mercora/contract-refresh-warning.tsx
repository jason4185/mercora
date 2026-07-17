import { RefreshCw } from "lucide-react";

export function ContractRefreshWarning({
  message = "Could not refresh the latest information. Retrying…",
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/25 bg-warning/[0.07] px-3 py-2 text-xs text-warning">
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      <span>{message}</span>
      <span className="ml-auto hidden text-muted-foreground sm:inline">
        Last updated moments ago
      </span>
      {onRetry ? (
        <button
          type="button"
          disabled={retrying}
          className="font-semibold text-warning hover:underline disabled:cursor-wait disabled:opacity-60"
          onClick={onRetry}
        >
          {retrying ? "Checking…" : "Try Again"}
        </button>
      ) : null}
    </div>
  );
}
