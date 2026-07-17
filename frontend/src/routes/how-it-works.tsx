import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/mercora/app-shell";
import {
  ArrowRight,
  CandlestickChart,
  Cpu,
  Database,
  ShieldCheck,
  Timer,
  Wallet,
  Users,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — Mercora" },
      {
        name: "description",
        content:
          "The Mercora lifecycle: hourly markets, pari-mutuel betting, five-source settlement, GenLayer consensus, and manual claims.",
      },
    ],
  }),
});

const STEPS = [
  {
    Icon: CandlestickChart,
    title: "1 · Market created",
    text: "Operator schedules a whole-UTC-hour candle market for BTC, ETH, BNB, or SOL against USDT.",
  },
  {
    Icon: Users,
    title: "2 · Pari-mutuel betting",
    text: "Wallets stake between 1 and 10 GEN on UP or DOWN. Estimated payout is variable and depends on both pools at close.",
  },
  {
    Icon: Timer,
    title: "3 · Candle completes",
    text: "Betting closes just before the hour ends. The candle finishes at exactly the UTC boundary.",
  },
  {
    Icon: Database,
    title: "4 · Five sources fetched",
    text: "GenLayer independent validators fetch open + close from Binance, Bybit, Gate.io, MEXC, and Bitget.",
  },
  {
    Icon: Cpu,
    title: "5 · Consensus vote",
    text: "Each provider votes UP or DOWN. At least 3-of-5 matching votes are required to resolve the market.",
  },
  {
    Icon: ShieldCheck,
    title: "6 · Outcome recorded",
    text: "Contract stores the outcome. Operators can trigger settlement but cannot choose the result.",
  },
  {
    Icon: Wallet,
    title: "7 · Manual claims",
    text: "Winners claim payouts. Inconclusive or cancelled markets refund stakes. Nothing auto-transfers.",
  },
];

function HowItWorksPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            GenLayer-powered
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            One hour. Two outcomes. Five sources.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] text-muted-foreground">
            Mercora is a pari-mutuel prediction market for one-hour crypto candle direction. Every
            market is resolved by independent-validator consensus across five exchanges — no oracle,
            no operator discretion, no black-box settlement.
          </p>
        </header>

        {/* Outcome rules */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-up/40 bg-up-soft/40 p-5">
            <div className="flex items-center gap-2 text-up">
              <ArrowUp className="h-4 w-4" />
              <span className="text-sm font-semibold">Resolves UP</span>
            </div>
            <p className="mt-2 text-[13px] text-foreground/90">
              Completed hourly candle <span className="text-mono">close &gt; open</span>.
            </p>
          </div>
          <div className="rounded-2xl border border-down/40 bg-down-soft/40 p-5">
            <div className="flex items-center gap-2 text-down">
              <ArrowDown className="h-4 w-4" />
              <span className="text-sm font-semibold">Resolves DOWN</span>
            </div>
            <p className="mt-2 text-[13px] text-foreground/90">
              Completed hourly candle <span className="text-mono">close ≤ open</span>. Equal open
              and close resolves DOWN.
            </p>
          </div>
        </section>

        {/* Lifecycle */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </h2>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {STEPS.map(({ Icon, title, text }) => (
              <li key={title} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Consensus diagram */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Five-source consensus</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Each validator independently fetches the candle from all five providers. The contract
            counts matching direction votes.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {["Binance", "Bybit", "Gate.io", "MEXC", "Bitget"].map((p, i) => (
              <div
                key={p}
                className="rounded-lg border border-border bg-surface p-3 text-center"
              >
                <div className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-consensus/40 bg-consensus-soft text-[10px] font-semibold text-consensus">
                  {["BN", "BY", "GA", "MX", "BG"][i]}
                </div>
                <div className="mt-2 text-[12px] font-medium">{p}</div>
                <div className="mt-0.5 text-[11px] text-up">Vote: UP</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-consensus/40 bg-consensus-soft/50 p-4 text-center">
            <span className="text-[11px] uppercase tracking-wide text-consensus">Result</span>
            <p className="text-sm font-semibold">5/5 valid · 5 UP votes · GenLayer verified</p>
            <p className="text-[12px] text-muted-foreground">
              Fewer than 3 matching votes → market becomes <span className="text-warning">INCONCLUSIVE</span>.
            </p>
          </div>
        </section>

        {/* Why GenLayer */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Why GenLayer is essential</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Point
              title="No single oracle"
              text="Five providers vote independently. No single exchange can force an outcome."
            />
            <Point
              title="Operator cannot cheat"
              text="Anyone can trigger settlement. The contract computes the winner from provider evidence."
            />
            <Point
              title="Deterministic evidence"
              text="Open + close prices are stored on-chain for every market so anyone can verify the result."
            />
          </div>
        </section>

        {/* Pari-mutuel example */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Pari-mutuel example</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Payout is proportional to your share of the winning side.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric k="UP pool" v="100 GEN" />
            <Metric k="DOWN pool" v="60 GEN" />
            <Metric k="Your UP stake" v="10 GEN" />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-[13px]">
            If UP wins: winnings = <span className="text-mono">stake + (stake / UP pool) × DOWN pool</span>
            <br />
            = <span className="text-mono">10 + (10 / 100) × 60</span> ={" "}
            <span className="text-mono font-semibold text-up">16 GEN</span>
          </div>
        </section>

        {/* Risks */}
        <section className="rounded-2xl border border-warning/40 bg-warning/10 p-6">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Risks &amp; disclosures</h2>
          </div>
          <ul className="mt-3 list-disc pl-5 text-[13px] text-foreground/90 space-y-1.5">
            <li>Betting is speculative. Only stake what you can afford to lose.</li>
            <li>Estimated payouts are variable until betting closes.</li>
            <li>Providers can be unavailable — markets can resolve INCONCLUSIVE.</li>
            <li>All state is on-chain; the frontend is a display only.</li>
          </ul>
        </section>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Explore markets <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm"
          >
            Read documentation
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function Point({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[13px] font-medium">{title}</div>
      <p className="mt-1 text-[12px] text-muted-foreground">{text}</p>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-1 text-mono text-lg font-semibold">{v}</div>
    </div>
  );
}
