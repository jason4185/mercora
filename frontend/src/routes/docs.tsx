import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/mercora/app-shell";
import {
  DOC_SECTIONS,
  HOW_IT_WORKS_STEPS,
  MARKET_DOCS,
  MARKET_TIMELINE,
  PRODUCTION_LINKS,
  READ_METHODS,
  SETTLEMENT_PROVIDERS,
  TRUST_SAFETY_ROWS,
  WRITE_METHODS,
} from "@/lib/product-docs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Documentation - Mercora" },
      {
        name: "description",
        content:
          "Learn how Mercora markets work, how prices are checked, and how payouts and refunds become available.",
      },
    ],
  }),
});

function DocsPage() {
  const [active, setActive] = useState<string>(DOC_SECTIONS[0].id);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-112px 0px -72% 0px", threshold: 0 },
    );

    DOC_SECTIONS.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <DocsNav active={active} />
        </aside>

        <div className="lg:hidden">
          <button
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="docs-mobile-nav"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px] font-medium"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Menu className="h-4 w-4" />
            Documentation Sections
          </button>
          {mobileNavOpen ? (
            <nav id="docs-mobile-nav" className="mt-2 rounded-lg border border-border bg-card p-2">
              {DOC_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={active === section.id ? "page" : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "block rounded-md border-l-2 border-transparent px-3 py-2 text-[13px] text-muted-foreground hover:bg-surface hover:text-foreground",
                    active === section.id && "border-primary bg-surface text-foreground",
                  )}
                >
                  {section.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>

        <article className="max-w-5xl space-y-10 text-[14px] leading-7 text-foreground/90">
          <header className="max-w-3xl">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              GenLayer Bradbury Testnet
            </span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Mercora Documentation
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              Mercora runs one-hour crypto prediction markets on a GenLayer Intelligent Contract.
              This guide explains the user-facing rules without requiring contract interface
              knowledge.
            </p>
          </header>

          <Section id="how-mercora-works" title="How Mercora Works">
            <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <li key={step} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-[12px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <p className="text-[13px] leading-6 text-muted-foreground">{step}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard
                title="What the frontend does"
                text="It displays contract data and submits user requests. The frontend does not choose the result."
              />
              <InfoCard
                title="What the Worker does"
                text="It calls settlement after the required delays. The Worker does not submit prices or choose UP/DOWN."
              />
              <InfoCard
                title="What the contract does"
                text="It stores stakes, checks permissions, applies the verified result, and makes claims or refunds available."
              />
              <InfoCard
                title="What validators do"
                text="They independently verify source evidence instead of blindly trusting the leader proposal."
              />
            </div>
          </Section>

          <Section id="supported-markets" title="Supported Markets">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MARKET_DOCS.supportedAssets.map((asset) => (
                <div
                  key={asset}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-center"
                >
                  <div className="text-sm font-semibold">{asset}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {asset}
                    {MARKET_DOCS.quoteAsset}
                  </div>
                </div>
              ))}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>All supported pairs are against {MARKET_DOCS.quoteAsset}.</li>
              <li>Every market represents one exact UTC hour.</li>
              <li>
                The Intelligent Contract generates the official pair, question, candle times, and
                settlement time.
              </li>
              <li>Arbitrary custom questions are not supported.</li>
            </ul>
          </Section>

          <Section id="market-timeline" title="Market Timeline">
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-4"
              aria-label="Market timeline from creation through result or refund"
            >
              {MARKET_TIMELINE.map((item, index) => (
                <div key={item} className="relative rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <h3 className="text-[13px] font-semibold">{item}</h3>
                  </div>
                  {index < MARKET_TIMELINE.length - 1 ? (
                    <ArrowRight className="absolute right-3 top-4 hidden h-4 w-4 text-muted-foreground md:block" />
                  ) : null}
                </div>
              ))}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Markets must be created at least 30 minutes before the candle starts.</li>
              <li>Betting closes exactly when the one-hour candle starts.</li>
              <li>
                The candle duration is {MARKET_DOCS.intervalSeconds.toLocaleString()} seconds.
              </li>
              <li>
                The contract settlement safety delay is {MARKET_DOCS.settlementSafetyDelaySeconds}{" "}
                seconds after the candle ends.
              </li>
              <li>
                The Worker adds {MARKET_DOCS.workerGraceSeconds} seconds before submission, so it
                normally submits approximately five minutes after the candle ends.
              </li>
              <li>
                Network and RPC timing can vary, so execution is not promised at the same second.
              </li>
            </ul>
          </Section>

          <Section id="prediction-limits" title="Prediction Limits">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <LimitCard label="Minimum stake" value={`${MARKET_DOCS.minimumStakeGen} GEN`} />
              <LimitCard
                label="Maximum cumulative stake"
                value={`${MARKET_DOCS.maximumStakeGen} GEN per wallet per market`}
              />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Additional predictions on the same side are allowed until the cumulative maximum.
              </li>
              <li>One wallet cannot predict both UP and DOWN in the same market.</li>
              <li>Predictions close when the candle begins.</li>
              <li>
                The 10 GEN limit is per wallet per market, not a limit on the whole market pool.
              </li>
            </ul>
          </Section>

          <Section id="pool-payouts" title="Pool Probabilities and Payouts">
            <p>
              Displayed UP/DOWN percentages come from the relative pool sizes. They are not a fixed
              return promise.
            </p>
            <div className="rounded-lg border border-border bg-surface p-4">
              <pre className="overflow-x-auto text-mono text-[12px] leading-6 text-foreground">
                {`UP pool: 6 GEN
DOWN pool: 4 GEN
Displayed split: UP 60%, DOWN 40%`}
              </pre>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Mercora uses a pari-mutuel shared pool.</li>
              <li>
                The winning side shares the full market pool in proportion to each winner's stake.
              </li>
              <li>There is no fixed promised return.</li>
              <li>A winning wallet claims manually.</li>
              <li>A losing wallet receives no payout.</li>
            </ul>
          </Section>

          <Section id="price-checks" title="How Prices Are Checked">
            <p>Each source is checked for the exact completed one-hour candle.</p>
            <div data-testid="docs-provider-list" className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {SETTLEMENT_PROVIDERS.map((provider) => (
                <div
                  key={provider}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-center text-[13px] font-medium"
                >
                  {provider}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <OutcomeCard
                icon={<ArrowUp className="h-4 w-4" />}
                title="UP"
                text="Close is strictly greater than open."
                tone="up"
              />
              <OutcomeCard
                icon={<ArrowDown className="h-4 w-4" />}
                title="DOWN"
                text="Close is equal to or lower than open."
                tone="down"
              />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Invalid, missing, malformed, or wrong-timestamp evidence becomes unavailable.</li>
              <li>One source alone cannot decide the result.</li>
            </ul>
          </Section>

          <Section id="genlayer-results" title="How GenLayer Confirms Results">
            <p className="rounded-lg border border-border bg-surface p-4 text-foreground">
              The leader fetches the five completed candles and proposes a result. Validators
              independently fetch the same sources and check whether the evidence supports that
              proposal.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <VoteRule count={`${MARKET_DOCS.requiredVotes} or more UP votes`} result="UP" />
              <VoteRule count={`${MARKET_DOCS.requiredVotes} or more DOWN votes`} result="DOWN" />
              <VoteRule count="No side reaches 3" result="INCONCLUSIVE" />
            </div>
            <p className="text-muted-foreground">
              GenLayer consensus verifies the leader's proposal. Validators do not blindly trust it.
            </p>
            <ArchitectureDiagram />
          </Section>

          <Section id="cancelled-inconclusive" title="Cancelled and Inconclusive Markets">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard
                title="CANCELLED"
                text="A market becomes cancelled during settlement when the market is empty or only one side has a pool. Participants can claim their original stakes back."
              />
              <InfoCard
                title="No clear result (Inconclusive)"
                text="A market becomes inconclusive when five-source evidence does not produce at least three matching UP or DOWN votes. Participants can claim their original stakes back."
              />
            </div>
          </Section>

          <Section id="winnings-refunds" title="Winnings and Refunds">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Claims are manual contract transactions.</li>
              <li>Winners use the winnings claim action.</li>
              <li>Cancelled or inconclusive participants use the refund claim action.</li>
              <li>Claims cannot be repeated.</li>
              <li>The frontend reads contract state to show the correct action.</li>
              <li>
                Losing users see <span className="text-foreground">Lost</span> and final payout{" "}
                <span className="text-mono text-foreground">0 GEN</span>.
              </li>
            </ul>
          </Section>

          <Section id="market-permissions" title="Who Can Create and Process Markets">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Owner or configured market operator can create markets.</li>
              <li>Owner or configured market operator can call settlement.</li>
              <li>Only the owner can change the market operator.</li>
              <li>Neither owner nor operator can submit source prices or choose the outcome.</li>
              <li>Users place predictions and claim only their own results.</li>
            </ul>
          </Section>

          <Section id="trust-safety" title="Trust and Safety">
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-[700px] text-left text-[13px]">
                <caption className="sr-only">
                  Mercora components, their roles, and what they cannot do
                </caption>
                <thead className="bg-surface text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Component
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cannot Do
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {TRUST_SAFETY_ROWS.map((row) => (
                    <tr key={row.component}>
                      <th scope="row" className="px-3 py-3 font-semibold text-foreground">
                        {row.component}
                      </th>
                      <td className="px-3 py-3 text-muted-foreground">{row.role}</td>
                      <td className="px-3 py-3 text-muted-foreground">{row.cannotDo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="production-links" title="Production Links">
            <ProductionLinks />
          </Section>

          <Section id="developer-reference" title="Developer Reference">
            <p>
              Contract method names are kept here for developer lookup. Normal users do not need
              these details to understand or use Mercora.
            </p>
            <div className="space-y-3">
              <MethodAccordion title="Read Methods" methods={READ_METHODS} />
              <MethodAccordion title="Write Methods" methods={WRITE_METHODS} />
            </div>
          </Section>
        </article>
      </div>
    </AppShell>
  );
}

function DocsNav({ active }: { active: string }) {
  return (
    <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
      <div className="mb-2 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
        Documentation
      </div>
      <ul className="space-y-0.5">
        {DOC_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? "page" : undefined}
              className={cn(
                "block rounded-r-md border-l-2 border-transparent px-3 py-1.5 text-[13px] text-muted-foreground transition hover:bg-surface hover:text-foreground",
                active === section.id && "border-primary bg-surface text-foreground",
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 text-[14px] text-muted-foreground [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-foreground">
        {children}
      </div>
    </section>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function LimitCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function OutcomeCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: "up" | "down";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "up" ? "border-up/35 bg-up-soft/35" : "border-down/35 bg-down-soft/35",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          tone === "up" ? "text-up" : "text-down",
        )}
      >
        {icon}
        {title}
      </div>
      <p className="mt-1 text-[13px] leading-6 text-foreground/90">{text}</p>
    </div>
  );
}

function VoteRule({ count, result }: { count: string; result: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[12px] text-muted-foreground">{count}</div>
      <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <ArrowRight className="h-4 w-4 text-primary" />
        {result}
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4 md:p-5"
      role="img"
      aria-labelledby="architecture-title"
      aria-describedby="architecture-description"
    >
      <h3 id="architecture-title" className="text-sm font-semibold text-foreground">
        Architecture Flow
      </h3>
      <p id="architecture-description" className="sr-only">
        User wallet sends requests through the Mercora frontend to the Intelligent Contract. The
        settlement Worker only triggers settlement on the contract. GenLayer verification checks a
        leader proposal, independent validators, and one grouped panel of five exchange sources.
        Verified results return to the contract so users can claim winnings or refunds.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <FlowNode title="User Wallet" detail="Signs user requests" />
        <FlowArrow label="Reads data and submits user transactions" />
        <FlowNode title="Mercora Frontend" detail="Displays contract state" />
        <FlowArrow label="Reads and writes through the configured network" />
        <FlowNode
          title="Mercora Intelligent Contract"
          detail="Controls stakes, permissions, and outcomes"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_1fr] md:items-center">
          <FlowNode title="Settlement Worker" detail="Triggers settlement only" />
          <div className="flex items-center justify-center text-[12px] text-muted-foreground">
            <span className="hidden h-px flex-1 bg-border md:block" />
            <span className="rounded border border-border bg-surface px-2 py-1">
              Triggers settlement only
            </span>
            <span className="hidden h-px flex-1 bg-border md:block" />
          </div>
          <FlowNode title="Mercora Intelligent Contract" detail="Receives the trigger" compact />
        </div>
        <FlowArrow label="Starts GenLayer verification" />
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            GenLayer Verification
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <FlowNode title="Leader" detail="Proposes evidence and result" compact />
            <FlowNode title="Validators" detail="Independently verify evidence" compact />
            <div
              data-testid="grouped-exchange-sources"
              className="rounded-md border border-border bg-background/70 p-3"
            >
              <div className="text-[13px] font-semibold text-foreground">Five Exchange Sources</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {SETTLEMENT_PROVIDERS.map((provider) => (
                  <span
                    key={provider}
                    className="rounded border border-border bg-surface px-2 py-1"
                  >
                    {provider}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <FlowArrow label="Verified UP / DOWN / INCONCLUSIVE returns to the contract" />
        <FlowNode title="Winnings or Refunds" detail="Users claim manually from contract state" />
      </div>
    </div>
  );
}

function FlowNode({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface", compact ? "p-3" : "p-4")}>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[12px] leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-[12px] text-muted-foreground">
      <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="text-center">{label}</span>
    </div>
  );
}

function ProductionLinks() {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(PRODUCTION_LINKS.contractAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <ExternalLinkCard title="Live App" href={PRODUCTION_LINKS.liveApp} />
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Intelligent Contract
        </div>
        <div className="mt-2 break-all text-mono text-[12px] text-foreground">
          {PRODUCTION_LINKS.contractAddress}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            aria-label="Copy intelligent contract address"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground"
            onClick={copyAddress}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          {PRODUCTION_LINKS.contractExplorerUrl ? (
            <ExternalButton
              href={PRODUCTION_LINKS.contractExplorerUrl}
              label="Open Contract Explorer"
            />
          ) : (
            <span className="inline-flex min-h-8 items-center rounded-md border border-border bg-background px-3 text-[12px] text-muted-foreground">
              Contract-specific explorer link unavailable
            </span>
          )}
        </div>
      </div>
      {PRODUCTION_LINKS.explorerBaseUrl ? (
        <ExternalLinkCard
          title={PRODUCTION_LINKS.explorerName}
          href={PRODUCTION_LINKS.explorerBaseUrl}
        />
      ) : null}
      <ExternalLinkCard title="Contract Source" href={PRODUCTION_LINKS.contractSource} />
      <ExternalLinkCard title="GitHub Repository" href={PRODUCTION_LINKS.githubRepository} />
      <ExternalLinkCard title="Settlement Worker" href={PRODUCTION_LINKS.settlementWorker} />
      <ExternalLinkCard title="Technical Documentation" href={PRODUCTION_LINKS.technicalDocs} />
    </div>
  );
}

function ExternalLinkCard({ title, href }: { title: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${title} - opens external site`}
      className="group rounded-lg border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-surface"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </div>
      <div className="mt-2 break-all text-mono text-[12px] text-foreground">{href}</div>
    </a>
  );
}

function ExternalButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} - opens external site`}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function MethodAccordion({
  title,
  methods,
}: {
  title: string;
  methods: readonly { name: string; description: string }[];
}) {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {methods.map((method) => (
            <div key={method.name} className="rounded-md border border-border bg-surface p-3">
              <dt className="break-all text-mono text-[12px] text-foreground">{method.name}</dt>
              <dd className="mt-1 text-[12px] leading-5 text-muted-foreground">
                {method.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
