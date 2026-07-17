import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addHours, format, startOfHour } from "date-fns";
import { AppShell } from "@/components/mercora/app-shell";
import { AssetIcon } from "@/components/mercora/asset-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/lib/wallet-context";
import type { Asset } from "@/lib/mock-data";
import { MARKETS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Loader2, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin · Create market — Mercora" }, { name: "robots", content: "noindex" }],
  }),
});

type Validation =
  | "VALID"
  | "UNSUPPORTED_ASSET"
  | "NOT_HOUR_ALIGNED"
  | "NOT_IN_FUTURE"
  | "INSUFFICIENT_CREATION_LEAD_TIME"
  | "DUPLICATE_MARKET";

const ASSETS: Asset[] = ["BTC", "ETH", "BNB", "SOL"];
const MIN_LEAD_MIN = 15;

function AdminPage() {
  const { wallet, mode } = useWallet();
  const [asset, setAsset] = useState<Asset>("BTC");
  const [dateStr, setDateStr] = useState<string>(format(addHours(new Date(), 2), "yyyy-MM-dd"));
  const [hour, setHour] = useState<number>(new Date(startOfHour(addHours(new Date(), 2))).getUTCHours());
  const [tx, setTx] = useState<"idle" | "awaiting" | "pending" | "confirmed" | "failed">("idle");

  const openTime = useMemo(() => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    d.setUTCHours(hour, 0, 0, 0);
    return d.getTime();
  }, [dateStr, hour]);

  const closeTime = openTime + 60 * 60 * 1000;
  const bettingClose = closeTime - 60_000;
  const settleAfter = closeTime + 5 * 60_000;

  const pair = `${asset}USDT`;
  const question = `Will ${pair} close higher than open for the ${format(openTime, "HH:mm")} UTC hourly candle?`;

  const validation: Validation = useMemo(() => {
    if (!ASSETS.includes(asset)) return "UNSUPPORTED_ASSET";
    if (openTime % (60 * 60 * 1000) !== 0) return "NOT_HOUR_ALIGNED";
    if (openTime <= Date.now()) return "NOT_IN_FUTURE";
    if (openTime - Date.now() < MIN_LEAD_MIN * 60_000) return "INSUFFICIENT_CREATION_LEAD_TIME";
    if (MARKETS.some((m) => m.pair === pair && m.openTime === openTime)) return "DUPLICATE_MARKET";
    return "VALID";
  }, [asset, openTime, pair]);

  const canCreate = validation === "VALID" && mode === "OPERATOR";

  function submit() {
    if (!canCreate) return;
    setTx("awaiting");
    setTimeout(() => setTx("pending"), 800);
    setTimeout(() => {
      const ok = Math.random() > 0.05;
      setTx(ok ? "confirmed" : "failed");
      if (ok) toast.success(`Market created: ${pair} · ${format(openTime, "HH:mm 'UTC'")}`);
      else toast.error("Create transaction failed.");
    }, 2200);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Create market</h1>
          <p className="text-[13px] text-muted-foreground">
            Owner / operator-only. Operators may trigger settlement but cannot choose outcomes.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium",
            mode === "OPERATOR"
              ? "border-consensus/40 bg-consensus-soft text-consensus"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          {mode === "OPERATOR" ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
          {mode === "OPERATOR"
            ? `Operator · ${wallet?.address}`
            : "Not operator — switch wallet mode to preview"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Asset</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAsset(a)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition",
                    asset === a
                      ? "border-primary/60 bg-primary/10"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <AssetIcon asset={a} size={22} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{a}USDT</div>
                    <div className="text-[11px] text-muted-foreground">1H direction</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Candle window (UTC)</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  UTC Date
                </label>
                <Input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="h-11 text-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  UTC Hour
                </label>
                <select
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  className="h-11 w-full rounded-md border border-border bg-surface px-3 text-mono text-[13px]"
                >
                  {Array.from({ length: 24 }).map((_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Markets must be aligned to a whole UTC hour and created at least {MIN_LEAD_MIN} minutes
              before candle open.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Validation</h2>
            <div className="mt-3">
              <ValidationRow ok={validation !== "UNSUPPORTED_ASSET"} label="Supported asset" />
              <ValidationRow ok={validation !== "NOT_HOUR_ALIGNED"} label="Hour-aligned open time" />
              <ValidationRow ok={validation !== "NOT_IN_FUTURE"} label="Open time in the future" />
              <ValidationRow
                ok={validation !== "INSUFFICIENT_CREATION_LEAD_TIME"}
                label={`At least ${MIN_LEAD_MIN}m lead time`}
              />
              <ValidationRow ok={validation !== "DUPLICATE_MARKET"} label="No duplicate market for pair + hour" />
            </div>
            {validation !== "VALID" && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                <span>
                  <span className="text-mono">{validation}</span> — resolve before creating.
                </span>
              </div>
            )}
          </section>
        </div>

        {/* Preview */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground">Preview</div>
            <div className="flex items-center gap-2">
              <AssetIcon asset={asset} size={22} />
              <div>
                <div className="text-sm font-semibold">{pair}</div>
                <div className="text-[11px] text-muted-foreground text-mono">1H · UTC</div>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">{question}</p>

            <dl className="mt-4 divide-y divide-border rounded-lg border border-border bg-surface">
              <Row k="Candle open" v={format(openTime, "yyyy-MM-dd HH:mm 'UTC'")} />
              <Row k="Candle close" v={format(closeTime, "yyyy-MM-dd HH:mm 'UTC'")} />
              <Row k="Betting close" v={format(bettingClose, "HH:mm:ss 'UTC'")} />
              <Row k="Settle after" v={format(settleAfter, "HH:mm 'UTC'")} />
            </dl>

            <Button
              disabled={!canCreate || tx === "awaiting" || tx === "pending"}
              onClick={submit}
              className="mt-4 h-11 w-full"
            >
              {tx === "awaiting" && <Loader2 className="h-4 w-4 animate-spin" />}
              {tx === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
              {tx === "confirmed" && <CheckCircle2 className="h-4 w-4" />}
              {tx === "idle" && "Create market"}
              {tx === "awaiting" && "Awaiting wallet…"}
              {tx === "pending" && "Confirming on-chain…"}
              {tx === "confirmed" && "Market created"}
              {tx === "failed" && "Retry"}
            </Button>
            {tx === "failed" && (
              <p className="mt-2 text-[12px] text-down">Transaction failed. Try again.</p>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-[12px]">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-mono text-foreground">{v}</dd>
    </div>
  );
}

function ValidationRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 text-[13px] last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-1", ok ? "text-up" : "text-down")}>
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {ok ? "OK" : "Invalid"}
      </span>
    </div>
  );
}
