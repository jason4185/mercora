import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/mercora/app-shell";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useMarketConfiguration } from "@/hooks/contract/use-mercora";
import { weiToGen } from "@/lib/contract-parsers";
import { ContractRefreshWarning } from "@/components/mercora/contract-refresh-warning";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Documentation — Mercora" },
      {
        name: "description",
        content:
          "Learn how Mercora markets work, how prices are checked, and how payouts and refunds become available.",
      },
    ],
  }),
});

const SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "How Mercora Works" },
  { id: "assets", label: "Supported Assets" },
  { id: "lifecycle", label: "Market Stages" },
  { id: "betting", label: "Betting Limits" },
  { id: "payout", label: "How Payouts Work" },
  { id: "settlement", label: "How Prices Are Checked" },
  { id: "consensus", label: "How a Result Is Confirmed" },
  { id: "inconclusive", label: "Markets Without a Clear Result" },
  { id: "claims", label: "Claims and Refunds" },
  { id: "permissions", label: "Who Can Process Markets" },
  { id: "trust", label: "How Results Are Protected" },
  { id: "reads", label: "Available Information" },
  { id: "writes", label: "Available Actions" },
  { id: "validators", label: "How GenLayer Checks Results" },
  { id: "limitations", label: "Important Information" },
  { id: "network", label: "Project Links" },
];

const READ_METHODS = [
  "get_market",
  "market_exists",
  "get_market_count",
  "get_market_display_status",
  "is_market_ready_for_settlement",
  "get_due_market_ids",
  "get_active_market_ids",
  "get_market_ids",
  "get_completed_market_ids",
  "get_market_probabilities_bps",
  "get_user_position",
  "get_user_market_ids",
  "get_user_market_ids_page",
  "get_user_market_status",
  "get_claimable_amount",
  "get_refundable_amount",
  "get_market_id_by_key",
  "validate_market_creation",
  "get_market_configuration",
  "get_protocol_stats",
];

const WRITE_METHODS = [
  "set_market_operator",
  "create_market",
  "place_bet",
  "settle_market",
  "claim_winnings",
  "claim_refund",
];

function DocsPage() {
  const configurationQuery = useMarketConfiguration();
  const configuration = configurationQuery.data;
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const assets = configuration?.supported_assets.join(", ") ?? "Unavailable";
  const quoteAsset = configuration?.quote_asset ?? "—";
  const minimumStake = configuration ? weiToGen(configuration.minimum_stake) : "—";
  const maximumStake = configuration ? weiToGen(configuration.maximum_stake_per_wallet) : "—";
  const exchangeCount = configuration?.configured_source_count ?? "—";
  const required = configuration?.required_matching_votes ?? "—";
  const providerNames =
    configuration?.providers
      .map((provider) => {
        if (provider === "GATEIO") return "Gate.io";
        if (provider === "BINANCE") return "Binance";
        if (provider === "BYBIT") return "Bybit";
        if (provider === "BITGET") return "Bitget";
        return provider;
      })
      .join(", ") ?? "the configured exchanges";

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

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
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
            <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Documentation
            </div>
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground",
                      active === s.id &&
                        "bg-surface text-foreground border-l-2 border-primary rounded-l-none",
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="lg:hidden">
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[13px]"
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <Menu className="h-4 w-4" /> Sections
          </button>
          {mobileNavOpen && (
            <nav className="mt-2 rounded-lg border border-border bg-card p-2">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setMobileNavOpen(false)}
                  className="block rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-surface hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        {/* Content */}
        <article className="prose-invert max-w-3xl space-y-10 text-[14px] leading-relaxed text-foreground/90">
          <Section id="overview" title="How Mercora Works">
            <p>
              Mercora lets users predict whether a cryptocurrency's price will finish higher or
              lower during a specific one-hour period. An authorized market manager creates each
              market. Users then choose UP or DOWN.
            </p>
          </Section>

          <Section id="assets" title="Supported Assets">
            <ul>
              <li>
                <b>Assets:</b> {assets} against {quoteAsset}.
              </li>
              <li>
                <b>Format:</b> one-hour price periods that start at a full UTC hour.
              </li>
              <li>
                <b>Symbols used:</b> <code className="text-mono">BTCUSDT</code>,{" "}
                <code className="text-mono">ETHUSDT</code>,{" "}
                <code className="text-mono">BNBUSDT</code>,{" "}
                <code className="text-mono">SOLUSDT</code>.
              </li>
            </ul>
          </Section>

          <Section id="lifecycle" title="Market Stages">
            <p>Each market moves through the following stages:</p>
            <ul>
              <li>
                <StatusPill>Betting Open</StatusPill> — users can choose UP or DOWN.
              </li>
              <li>
                <StatusPill>Price Period Active</StatusPill> — betting is closed while the one-hour
                period runs.
              </li>
              <li>
                <StatusPill>Ready for Result</StatusPill> — the final prices can be checked.
              </li>
              <li>
                <StatusPill>Result Confirmed</StatusPill> — UP or DOWN has won.
              </li>
              <li>
                <StatusPill>No Clear Result</StatusPill> — fewer than {required} exchanges agreed.
              </li>
              <li>
                <StatusPill>Cancelled</StatusPill> — the market could not continue.
              </li>
            </ul>
          </Section>

          <Section id="betting" title="Betting Limits">
            <ul>
              <li>
                Minimum stake: <span className="text-mono">{minimumStake} GEN</span>.
              </li>
              <li>
                Maximum stake: <span className="text-mono">{maximumStake} GEN</span> per account per
                market.
              </li>
              <li>Each account can choose only one direction per market.</li>
              <li>Betting closes when the one-hour price period begins.</li>
            </ul>
          </Section>

          <Section id="payout" title="How Payouts Work">
            <p>
              All bets are placed into one shared pool. Winners share the losing side's pool based
              on how much they contributed.
            </p>
            <pre className="rounded-lg border border-border bg-surface p-3 text-mono text-[12px]">
              {`payout = stake + (stake / winning_pool) * losing_pool`}
            </pre>
            <p>
              Example: pools UP=100, DOWN=60, your UP stake=10. If UP wins:
              <br />
              <span className="text-mono">10 + (10 / 100) * 60 = 16 GEN</span>.
            </p>
          </Section>

          <Section id="settlement" title="How Prices Are Checked">
            <p>
              Settlement is the process of confirming the final market result. Mercora compares
              opening and closing prices from {providerNames}. Each exchange reports whether the
              price finished UP or DOWN.
            </p>
          </Section>

          <Section id="consensus" title="How a Result Is Confirmed">
            <p>
              At least {required} of {exchangeCount} exchanges must report the same direction before
              a result is confirmed. If fewer than {required} agree, the market finishes without a
              clear result.
            </p>
          </Section>

          <Section id="inconclusive" title="Markets Without a Clear Result">
            <ul>
              <li>
                <StatusPill>No Clear Result</StatusPill>: fewer than {required} exchanges agreed.
                All participants can claim a refund.
              </li>
              <li>
                <StatusPill>Cancelled</StatusPill>: bets were placed on only one side, or no bets
                were placed. All participants can claim a refund.
              </li>
            </ul>
          </Section>

          <Section id="claims" title="Claims and Refunds">
            <p>
              After a result is confirmed, winners can claim their payout. If a market is cancelled
              or no clear result can be confirmed, participants can claim a refund. Claims are not
              sent automatically.
            </p>
          </Section>

          <Section id="permissions" title="Who Can Create and Process Markets">
            <ul>
              <li>The owner selects the authorized market manager.</li>
              <li>
                The owner or authorized market manager can create markets and start result checks.
              </li>
              <li>Neither can choose the winning direction.</li>
            </ul>
          </Section>

          <Section id="trust" title="How Mercora Protects Market Results">
            <p>
              Users cannot submit prices or choose a result. The reference chart and estimated
              payouts are for display only. The final result uses prices collected directly from the
              {exchangeCount} exchanges and checked by GenLayer.
            </p>
          </Section>

          <Section id="reads" title="Available Information">
            <p>These technical methods provide market, position, claim, and refund information.</p>
            <MethodGrid methods={READ_METHODS} />
          </Section>

          <Section id="writes" title="Available Actions">
            <p>These technical methods create markets, submit predictions, and process claims.</p>
            <MethodGrid methods={WRITE_METHODS} kind="write" />
          </Section>

          <Section id="validators" title="How GenLayer Checks Results">
            <ol>
              <li>GenLayer receives a proposed result.</li>
              <li>
                Other GenLayer participants collect prices from the same {exchangeCount} exchanges.
              </li>
              <li>They calculate the direction from the opening and closing prices.</li>
              <li>The result is confirmed only when the checks agree.</li>
            </ol>
          </Section>

          <Section id="limitations" title="Important Information">
            <ul>
              <li>Exchange outages may prevent a clear result.</li>
              <li>
                Fast price changes near the hour boundary may produce different exchange results.
              </li>
              <li>Only stake an amount you can afford to lose.</li>
            </ul>
          </Section>

          <Section id="network" title="Project Links">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Placeholder k="Contract address" v="Not configured" />
              <Placeholder k="Explorer" v="Not configured" />
              <Placeholder k="GitHub source" v="Not configured" />
              <Placeholder k="Technical documentation" v="This frontend guide" />
            </div>
          </Section>
        </article>
      </div>
    </AppShell>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[14px] text-muted-foreground [&_b]:text-foreground [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-foreground [&_a]:text-primary [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1">
        {children}
      </div>
    </section>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-mono rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-foreground">
      {children}
    </span>
  );
}

function MethodGrid({ methods, kind = "read" }: { methods: string[]; kind?: "read" | "write" }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {methods.map((m) => (
        <div
          key={m}
          className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
        >
          <code className="text-mono text-[12px] text-foreground">{m}</code>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              kind === "read" ? "bg-consensus-soft text-consensus" : "bg-primary/15 text-primary",
            )}
          >
            {kind === "read" ? "READ" : "WRITE"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-1 text-mono text-[12px] text-foreground break-all">{v}</div>
    </div>
  );
}
