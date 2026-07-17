import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/mercora/app-shell";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Documentation — Mercora" },
      {
        name: "description",
        content:
          "Mercora protocol documentation: lifecycle, settlement, contract reads, writes, and trust model.",
      },
    ],
  }),
});

const SECTIONS: { id: string; label: string }[] = [
  { id: "overview", label: "Protocol overview" },
  { id: "assets", label: "Supported assets & format" },
  { id: "lifecycle", label: "Lifecycle & statuses" },
  { id: "betting", label: "Betting rules & limits" },
  { id: "payout", label: "Payout formula & example" },
  { id: "settlement", label: "Five-source settlement" },
  { id: "consensus", label: "3-of-5 consensus" },
  { id: "inconclusive", label: "Inconclusive & cancelled" },
  { id: "claims", label: "Claims & refunds" },
  { id: "permissions", label: "Owner / operator permissions" },
  { id: "trust", label: "Frontend vs contract trust model" },
  { id: "reads", label: "Contract reads" },
  { id: "writes", label: "Contract writes" },
  { id: "validators", label: "Leader / validator flow" },
  { id: "limitations", label: "Limitations & risks" },
  { id: "network", label: "Contract, explorer, network" },
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
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
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
                      active === s.id && "bg-surface text-foreground border-l-2 border-primary rounded-l-none",
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
          <Section id="overview" title="Protocol overview">
            <p>
              Mercora is a pari-mutuel prediction market for one-hour crypto candle direction. Each
              market asks whether the next completed hourly candle for a supported pair will close
              higher than open. Markets are created by an operator, funded by end users, and
              resolved deterministically by GenLayer independent validators.
            </p>
          </Section>

          <Section id="assets" title="Supported assets & format">
            <ul>
              <li><b>Assets:</b> BTC, ETH, BNB, SOL against USDT.</li>
              <li><b>Format:</b> one-hour candle direction, aligned to whole UTC hours.</li>
              <li><b>Symbols used:</b> <code className="text-mono">BTCUSDT</code>, <code className="text-mono">ETHUSDT</code>, <code className="text-mono">BNBUSDT</code>, <code className="text-mono">SOLUSDT</code>.</li>
            </ul>
          </Section>

          <Section id="lifecycle" title="Lifecycle & statuses">
            <p>Each market moves through a strict set of on-chain statuses:</p>
            <ul>
              <li><StatusPill>OPEN</StatusPill> — accepting bets.</li>
              <li><StatusPill>CLOSED</StatusPill> — betting window ended, candle not yet complete.</li>
              <li><StatusPill>READY_FOR_SETTLEMENT</StatusPill> — settle window reached; anyone may trigger settlement.</li>
              <li><StatusPill>SETTLED</StatusPill> — outcome recorded (<span className="text-up">UP</span> or <span className="text-down">DOWN</span>).</li>
              <li><StatusPill>INCONCLUSIVE</StatusPill> — fewer than 3-of-5 matching votes; refunds available.</li>
              <li><StatusPill>CANCELLED</StatusPill> — one-sided or empty pool; refunds available.</li>
            </ul>
          </Section>

          <Section id="betting" title="Betting rules & limits">
            <ul>
              <li>Minimum stake: <span className="text-mono">1 GEN</span>.</li>
              <li>Maximum stake: <span className="text-mono">10 GEN</span> per wallet per market.</li>
              <li>Only one side per wallet per market.</li>
              <li>Bets accepted until <span className="text-mono">betting_close_time</span>.</li>
            </ul>
          </Section>

          <Section id="payout" title="Payout formula & example">
            <p>Pari-mutuel: winners share the losing pool proportionally to their stake.</p>
            <pre className="rounded-lg border border-border bg-surface p-3 text-mono text-[12px]">
{`payout = stake + (stake / winning_pool) * losing_pool`}
            </pre>
            <p>
              Example: pools UP=100, DOWN=60, your UP stake=10. If UP wins:
              <br />
              <span className="text-mono">10 + (10 / 100) * 60 = 16 GEN</span>.
            </p>
          </Section>

          <Section id="settlement" title="Five-source settlement">
            <p>
              GenLayer validators fetch open + close prices from all five providers: Binance, Bybit,
              Gate.io, MEXC, and Bitget. Each provider yields a single direction vote.
            </p>
          </Section>

          <Section id="consensus" title="3-of-5 consensus">
            <p>
              A market resolves when at least three providers vote for the same direction. Fewer
              than three matching votes marks the market <StatusPill>INCONCLUSIVE</StatusPill>.
            </p>
          </Section>

          <Section id="inconclusive" title="Inconclusive & cancelled">
            <ul>
              <li><StatusPill>INCONCLUSIVE</StatusPill>: consensus not reached. Refund every bettor.</li>
              <li><StatusPill>CANCELLED</StatusPill>: one-sided or empty pool. Refund every bettor.</li>
            </ul>
          </Section>

          <Section id="claims" title="Claims & refunds">
            <p>
              Nothing is auto-transferred. Winners call <code className="text-mono">claim_winnings</code>. Bettors on
              inconclusive or cancelled markets call <code className="text-mono">claim_refund</code>. Amounts are
              read from <code className="text-mono">get_claimable_amount</code> and{" "}
              <code className="text-mono">get_refundable_amount</code>.
            </p>
          </Section>

          <Section id="permissions" title="Owner / operator permissions">
            <ul>
              <li>Owner may set the operator via <code className="text-mono">set_market_operator</code>.</li>
              <li>Operator may create markets and trigger <code className="text-mono">settle_market</code>.</li>
              <li>Neither owner nor operator can choose outcomes.</li>
            </ul>
          </Section>

          <Section id="trust" title="Frontend vs contract trust model">
            <p>
              This UI is a convenience layer. All authoritative state lives on-chain. Reference
              charts and estimated payouts are display only — final outcomes and payouts are
              computed by the contract from validator-fetched evidence.
            </p>
          </Section>

          <Section id="reads" title="Contract reads">
            <MethodGrid methods={READ_METHODS} />
          </Section>

          <Section id="writes" title="Contract writes">
            <MethodGrid methods={WRITE_METHODS} kind="write" />
          </Section>

          <Section id="validators" title="Leader / validator flow">
            <ol>
              <li>Leader validator proposes settlement transaction.</li>
              <li>Independent validators fetch the same five providers in isolation.</li>
              <li>Consensus tally is compared; only matching results are accepted.</li>
              <li>Outcome and evidence are committed to state.</li>
            </ol>
          </Section>

          <Section id="limitations" title="Limitations & risks">
            <ul>
              <li>Provider outages can raise the inconclusive rate.</li>
              <li>Extreme volatility around the hour boundary may cause split votes.</li>
              <li>The GEN token, gas, and any bridging risks apply — read the network docs.</li>
            </ul>
          </Section>

          <Section id="network" title="Contract, explorer, network">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Placeholder k="Contract address" v="0x…placeholder" />
              <Placeholder k="Network" v="GenLayer Testnet" />
              <Placeholder k="Explorer" v="https://explorer.example/tx/…" />
              <Placeholder k="Repository" v="github.com/mercora/protocol" />
            </div>
          </Section>
        </article>
      </div>
    </AppShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
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
              kind === "read"
                ? "bg-consensus-soft text-consensus"
                : "bg-primary/15 text-primary",
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
