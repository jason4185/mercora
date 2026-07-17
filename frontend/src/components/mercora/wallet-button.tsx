import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AlertTriangle, ChevronDown, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";

export function WalletButton() {
  const wallet = useWallet();
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  useEffect(() => {
    setHasInjectedWallet(Boolean(window.ethereum));
  }, []);

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openConnectModal }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button
              type="button"
              disabled={!hasInjectedWallet}
              onClick={hasInjectedWallet ? openConnectModal : undefined}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-muted-foreground transition hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-65"
            >
              <Wallet className="h-4 w-4" />
              {hasInjectedWallet ? "Connect Wallet" : "Install a browser wallet"}
            </button>
          );
        }

        if (chain.unsupported || !wallet.isCorrectNetwork) {
          return (
            <button
              type="button"
              onClick={wallet.switchToBradbury}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 text-[13px] font-medium text-warning"
            >
              <AlertTriangle className="h-4 w-4" />
              Switch to Bradbury
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium text-foreground transition hover:border-border-strong"
          >
            <span className="h-2 w-2 rounded-full bg-up" />
            <span className="text-mono">{account.displayName}</span>
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <span className="hidden text-mono sm:inline">
              {wallet.balanceLoading
                ? "…"
                : wallet.balance !== undefined
                  ? `${wallet.balance} GEN`
                  : "GEN balance unavailable"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

export function InjectedConnectButton({ className = "" }: { className?: string }) {
  const [hasInjectedWallet, setHasInjectedWallet] = useState(false);
  useEffect(() => setHasInjectedWallet(Boolean(window.ethereum)), []);
  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <button
          type="button"
          disabled={!hasInjectedWallet}
          onClick={hasInjectedWallet ? openConnectModal : undefined}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-65 ${className}`}
        >
          <Wallet className="h-4 w-4" />
          {hasInjectedWallet ? "Connect Wallet" : "Install a browser wallet"}
        </button>
      )}
    </ConnectButton.Custom>
  );
}
