import { Wallet, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWallet } from "@/lib/wallet-context";
import type { WalletMode } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const MODES: { key: WalletMode; label: string; sub: string }[] = [
  { key: "DISCONNECTED", label: "Disconnected", sub: "No wallet connected" },
  { key: "REGULAR", label: "Regular user", sub: "Player · 42.50 GEN" },
  { key: "OPERATOR", label: "Owner / operator", sub: "Admin access · 128.00 GEN" },
  { key: "WINNER", label: "Winner with claim", sub: "Has claimable payouts" },
  { key: "LOSER", label: "Losing position", sub: "No claims" },
  { key: "REFUND", label: "Refund available", sub: "Inconclusive & cancelled" },
];

export function WalletButton() {
  const { mode, setMode, wallet } = useWallet();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium transition hover:border-border-strong",
            wallet ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", wallet ? "bg-up" : "bg-muted-foreground")} />
          <Wallet className="h-4 w-4" />
          {wallet ? (
            <>
              <span className="text-mono">{wallet.address}</span>
              <span className="hidden text-muted-foreground sm:inline">·</span>
              <span className="hidden text-mono sm:inline">{wallet.balance} GEN</span>
            </>
          ) : (
            <span>Connect wallet</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Preview wallet modes
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODES.map((opt) => (
          <DropdownMenuItem
            key={opt.key}
            onSelect={() => setMode(opt.key)}
            className={cn("flex flex-col items-start gap-0.5", opt.key === mode && "bg-accent")}
          >
            <span className="text-[13px] font-medium">{opt.label}</span>
            <span className="text-[11px] text-muted-foreground">{opt.sub}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 pb-2 pt-1 text-[11px] text-muted-foreground">
          Mocked for preview — no real wallet is connected.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
