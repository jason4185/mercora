import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CandlestickChart,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import { HOW_IT_WORKS_STEPS, MARKET_DOCS, SETTLEMENT_PROVIDERS } from "@/lib/product-docs";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
  head: () => ({
    meta: [
      { title: "How It Works — Mercora" },
      {
        name: "description",
        content:
          "A simple overview of Mercora's one-hour crypto markets, five-source settlement, and manual claims.",
      },
    ],
  }),
});

const STEP_ICONS = [
  CandlestickChart,
  Wallet,
  Clock3,
  CandlestickChart,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
] as const;

function HowItWorksPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-9">
        <header className="max-w-3xl">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
            One-hour crypto predictions
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Predict UP or DOWN for one exact UTC hour.
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            Mercora markets are simple: choose whether BTC, ETH, BNB, or SOL finishes higher or
            lower against USDT during a specific one-hour candle. The frontend does not choose the
            result, and neither does the automated Worker.
          </p>
        </header>

        <section aria-labelledby="outcome-rules">
          <h2 id="outcome-rules" className="sr-only">
            Outcome Rules
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <OutcomeRule
              icon={ArrowUp}
              title="UP"
              text="UP wins only when the completed candle closes strictly higher than it opened."
              tone="up"
            />
            <OutcomeRule
              icon={ArrowDown}
              title="DOWN"
              text="DOWN wins when the completed candle closes equal to or lower than it opened."
              tone="down"
            />
          </div>
        </section>

        <section aria-labelledby="market-lifecycle">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="market-lifecycle" className="text-xl font-semibold tracking-tight">
                Seven-step lifecycle
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                From market creation to claim or refund.
              </p>
            </div>
          </div>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {HOW_IT_WORKS_STEPS.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <li key={step} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">Step {index + 1}</h3>
                      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{step}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="settlement-overview"
          className="rounded-lg border border-border bg-card p-5"
        >
          <h2 id="settlement-overview" className="text-lg font-semibold tracking-tight">
            Settlement is triggered, not chosen.
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Fact
              title="Worker"
              text="Calls settlement after the contract delay and Worker grace period. It does not send prices or choose UP/DOWN."
            />
            <Fact
              title="GenLayer"
              text={`Checks ${MARKET_DOCS.sourceCount} completed exchange candles and requires ${MARKET_DOCS.requiredVotes} matching directions.`}
            />
            <Fact
              title="Contract"
              text="Stores stakes, applies the verified outcome, and makes winnings or refunds claimable."
            />
          </div>
        </section>

        <section aria-labelledby="sources" className="rounded-lg border border-border bg-card p-5">
          <h2 id="sources" className="text-lg font-semibold tracking-tight">
            Five exchanges, one grouped check
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            GenLayer validators independently verify the same completed one-hour candle from the
            five configured sources. One exchange alone cannot decide the result.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SETTLEMENT_PROVIDERS.map((provider) => (
              <span
                key={provider}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium"
              >
                {provider}
              </span>
            ))}
          </div>
        </section>

        <section aria-labelledby="trust-message" className="rounded-lg border border-border p-5">
          <h2 id="trust-message" className="text-lg font-semibold tracking-tight">
            What keeps the result honest
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
            The owner or configured operator can create markets and trigger settlement, but they
            cannot submit source prices or override the source-vote outcome. The leader proposes
            evidence, validators independently verify it, and users claim winnings or refunds
            through contract transactions.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Browse Markets <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-foreground"
          >
            Open Documentation
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function OutcomeRule({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof ArrowUp;
  title: string;
  text: string;
  tone: "up" | "down";
}) {
  return (
    <div
      className={
        tone === "up"
          ? "rounded-lg border border-up/35 bg-up-soft/40 p-4"
          : "rounded-lg border border-down/35 bg-down-soft/40 p-4"
      }
    >
      <div
        className={
          tone === "up" ? "flex items-center gap-2 text-up" : "flex items-center gap-2 text-down"
        }
      >
        <Icon className="h-4 w-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-6 text-foreground/90">{text}</p>
    </div>
  );
}

function Fact({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
