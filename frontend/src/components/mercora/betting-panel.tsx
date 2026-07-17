import { useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Loader2, Wallet, CheckCircle2 } from "lucide-react";
import type { Market } from "@/lib/mock-data";
import { estimatePayout, impliedProbabilities, totalPool } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { toast } from "sonner";

type TxState = "idle" | "review" | "awaiting" | "pending" | "confirmed" | "failed";

const MIN = 1;
const MAX = 10;
const QUICK = [1, 2, 5, 10];

export function BettingPanel({ m }: { m: Market }) {
  const { wallet, mode } = useWallet();
  const [side, setSide] = useState<"UP" | "DOWN">("UP");
  const [stake, setStake] = useState<string>("1");
  const [tx, setTx] = useState<TxState>("idle");

  const stakeNum = Math.max(0, Math.min(MAX, parseFloat(stake) || 0));
  const { up, down } = impliedProbabilities(m);
  const bettingOpen = m.status === "OPEN" && Date.now() < m.bettingCloseTime;
  const payout = bettingOpen ? estimatePayout(m, side, stakeNum) : 0;
  const disabled = !bettingOpen || stakeNum < MIN || !wallet;

  function place() {
    if (!wallet) {
      toast.info("Connect a wallet to place a bet");
      return;
    }
    setTx("review");
    setTimeout(() => setTx("awaiting"), 250);
    setTimeout(() => setTx("pending"), 1200);
    setTimeout(() => {
      const ok = Math.random() > 0.08;
      setTx(ok ? "confirmed" : "failed");
      if (ok) toast.success(`Bet placed: ${stakeNum} GEN on ${side}`);
      else toast.error("Transaction failed. Please retry.");
    }, 2400);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Place pari-mutuel bet</h3>
        <span className="text-[11px] text-muted-foreground text-mono">
          Pool {totalPool(m)} GEN
        </span>
      </div>

      {/* Side */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSide("UP")}
          className={cn(
            "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
            side === "UP"
              ? "border-up bg-up-soft"
              : "border-border bg-surface hover:border-border-strong",
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-up">
            <ArrowUp className="h-4 w-4" /> UP
          </span>
          <span className="text-[11px] text-muted-foreground">
            Implied <span className="text-mono text-foreground">{Math.round(up * 100)}%</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSide("DOWN")}
          className={cn(
            "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
            side === "DOWN"
              ? "border-down bg-down-soft"
              : "border-border bg-surface hover:border-border-strong",
          )}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium text-down">
            <ArrowDown className="h-4 w-4" /> DOWN
          </span>
          <span className="text-[11px] text-muted-foreground">
            Implied <span className="text-mono text-foreground">{Math.round(down * 100)}%</span>
          </span>
        </button>
      </div>

      {/* Stake */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <label htmlFor="stake" className="text-muted-foreground">
            Stake (GEN)
          </label>
          <span className="text-muted-foreground">
            Min {MIN} · Max {MAX} per wallet
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="stake"
            inputMode="decimal"
            value={stake}
            onChange={(e) => setStake(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-11 text-mono text-base"
          />
          <span className="text-mono text-sm text-muted-foreground">GEN</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setStake(String(q))}
              className={cn(
                "rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-mono transition hover:border-border-strong",
                parseFloat(stake) === q && "border-primary/60 bg-primary/10 text-primary",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated payout */}
      <div className="mt-4 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Estimated payout if {side}</span>
          <span className="text-mono text-foreground">{payout.toFixed(4)} GEN</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Variable — final payout depends on both pools at betting close.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-4 space-y-2">
        {mode === "DISCONNECTED" ? (
          <Button className="w-full" variant="secondary">
            <Wallet className="h-4 w-4" /> Connect wallet
          </Button>
        ) : (
          <Button
            className={cn(
              "w-full h-11 text-sm font-semibold",
              side === "UP"
                ? "bg-up text-up-foreground hover:bg-up/90"
                : "bg-down text-down-foreground hover:bg-down/90",
            )}
            disabled={disabled || tx === "pending" || tx === "awaiting"}
            onClick={place}
          >
            {tx === "awaiting" && <Loader2 className="h-4 w-4 animate-spin" />}
            {tx === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
            {tx === "confirmed" && <CheckCircle2 className="h-4 w-4" />}
            {tx === "idle" && `Bet ${stakeNum || 0} GEN on ${side}`}
            {tx === "review" && "Reviewing…"}
            {tx === "awaiting" && "Awaiting wallet…"}
            {tx === "pending" && "Confirming…"}
            {tx === "confirmed" && "Bet placed"}
            {tx === "failed" && "Retry"}
          </Button>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Bets close in{" "}
            <Countdown to={m.bettingCloseTime} />
          </span>
          <span>Settle after candle close</span>
        </div>

        {tx === "failed" && (
          <p className="text-[12px] text-down">Transaction failed. No stake was moved.</p>
        )}
      </div>
    </div>
  );
}
