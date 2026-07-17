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
import { useMarketConfiguration } from "@/hooks/contract/use-mercora";
import { weiToGen } from "@/lib/contract-parsers";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — Mercora" },
      {
        name: "description",
        content:
          "Learn how Mercora opens one-hour markets, checks prices across five exchanges, and makes payouts and refunds available.",
      },
    ],
  }),
});

const STEPS = [
  {
    Icon: CandlestickChart,
    title: "1 · Market Created",
    text: "An authorized market manager selects the asset and one-hour period.",
  },
  {
    Icon: Users,
    title: "2 · Predictions Open",
    text: "Users choose UP or DOWN and stake between 1 and 10 GEN.",
  },
  {
    Icon: Timer,
    title: "3 · Betting Closes",
    text: "Betting closes when the selected one-hour price period begins.",
  },
  {
    Icon: CandlestickChart,
    title: "4 · Price Period Runs",
    text: "The market tracks the asset for exactly one hour. No new bets are accepted during this time.",
  },
  {
    Icon: Database,
    title: "5 · Prices Are Collected",
    text: "Mercora collects the opening and closing prices from Binance, Bybit, Gate.io, MEXC, and Bitget.",
  },
  {
    Icon: Cpu,
    title: "6 · Results Are Checked",
    text: "GenLayer independently checks the exchange prices and directions.",
  },
  {
    Icon: ShieldCheck,
    title: "7 · Result Is Confirmed",
    text: "At least three exchanges must report the same direction.",
  },
  {
    Icon: Wallet,
    title: "8 · Claims Open",
    text: "Winners can claim their payout. Cancelled markets and markets without a clear result provide refunds.",
  },
];

function HowItWorksPage() {
  const configurationQuery = useMarketConfiguration();
  const configuration = configurationQuery.data;
  const providers = configuration?.providers ?? [];
  const providerLabels: Record<string, string> = {
    BINANCE: "Binance",
    BYBIT: "Bybit",
    GATEIO: "Gate.io",
    MEXC: "MEXC",
    BITGET: "Bitget",
  };
  const minimumStake = configuration ? weiToGen(configuration.minimum_stake) : "—";
  const maximumStake = configuration ? weiToGen(configuration.maximum_stake_per_wallet) : "—";
  const required = configuration?.required_matching_votes ?? "—";
  return (
    <AppShell>
      {configurationQuery.isRefetchError && configurationQuery.data ? (
        <div className="mb-5">
          <ContractRefreshWarning
            onRetry={() => configurationQuery.refetch()}
            retrying={configurationQuery.isFetching}
          />
        </div>
      ) : configurationQuery.isError && !configurationQuery.data ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <span>Current market settings could not be loaded.</span>
          <button
            type="button"
            className="font-semibold text-warning hover:underline"
            onClick={() => configurationQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            Transparent result verification
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            One hour. Two outcomes. Five exchanges.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] text-muted-foreground">
            Choose whether a cryptocurrency will finish higher or lower during a one-hour period.
            Mercora checks the final prices across five major exchanges before confirming the
            result. No single exchange or administrator decides the outcome.
          </p>
        </header>

        {/* Outcome rules */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-up/40 bg-up-soft/40 p-5">
            <div className="flex items-center gap-2 text-up">
              <ArrowUp className="h-4 w-4" />
              <span className="text-sm font-semibold">UP wins</span>
            </div>
            <p className="mt-2 text-[13px] text-foreground/90">
              The closing price is higher than the opening price.
            </p>
          </div>
          <div className="rounded-2xl border border-down/40 bg-down-soft/40 p-5">
            <div className="flex items-center gap-2 text-down">
              <ArrowDown className="h-4 w-4" />
              <span className="text-sm font-semibold">DOWN wins</span>
            </div>
            <p className="mt-2 text-[13px] text-foreground/90">
              The closing price is equal to or lower than the opening price.
            </p>
          </div>
        </section>

        {/* Lifecycle */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            How a market works
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
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {title.includes("Predictions Open")
                    ? `Users choose UP or DOWN and stake between ${minimumStake} and ${maximumStake} GEN.`
                    : title.includes("Result Is Confirmed")
                      ? `At least ${required} exchanges must report the same direction.`
                      : text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Consensus diagram */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Five exchange results</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Mercora compares prices from Binance, Bybit, Gate.io, MEXC, and Bitget. At least three
            exchanges must report the same direction before a result is confirmed.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {providers.map((provider, index) => {
              const label = providerLabels[provider] ?? provider;
              return (
                <div
                  key={provider}
                  className="rounded-lg border border-border bg-surface p-3 text-center"
                >
                  <div className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-consensus/40 bg-consensus-soft text-[10px] font-semibold text-consensus">
                    {["BN", "BY", "GA", "MX", "BG"][index] ?? label.slice(0, 2)}
                  </div>
                  <div className="mt-2 text-[12px] font-medium">{label}</div>
                  <div className="mt-0.5 text-[11px] text-up">Direction: UP</div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-consensus/40 bg-consensus-soft/50 p-4 text-center">
            <span className="text-[11px] uppercase tracking-wide text-consensus">Result</span>
            <p className="text-sm font-semibold">All 5 exchanges agreed · Result confirmed as UP</p>
            <p className="text-[12px] text-muted-foreground">
              If fewer than {required} exchanges agree, all participants can claim a refund.
            </p>
          </div>
        </section>

        {/* Why GenLayer */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">How the result stays fair</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Point title="Five exchange checks" text="No single exchange can decide the outcome." />
            <Point
              title="Manager cannot choose"
              text="The authorized market manager can start the result check but cannot choose the winner."
            />
            <Point
              title="Results can be reviewed"
              text="The opening and closing prices are shown for each available exchange."
            />
          </div>
        </section>

        {/* Shared-pool example */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold">Shared-pool example</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            All bets are placed into one shared pool. Winners share the losing side's pool based on
            how much they contributed.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric k="UP pool" v="100 GEN" />
            <Metric k="DOWN pool" v="60 GEN" />
            <Metric k="Your UP stake" v="10 GEN" />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-[13px]">
            If UP wins: winnings ={" "}
            <span className="text-mono">stake + (stake / UP pool) × DOWN pool</span>
            <br />= <span className="text-mono">10 + (10 / 100) × 60</span> ={" "}
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
            <li>Exchange prices can be unavailable. A market may finish without a clear result.</li>
            <li>The prices shown in the chart are for reference only.</li>
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
