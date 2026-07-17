import type { SourceEvidence } from "@/lib/contract-parsers";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check } from "lucide-react";

const PROVIDER_INITIALS: Record<string, string> = {
  BINANCE: "BN",
  BYBIT: "BY",
  GATEIO: "GA",
  MEXC: "MX",
  BITGET: "BG",
};
const PROVIDER_NAMES: Record<string, string> = {
  BINANCE: "Binance",
  BYBIT: "Bybit",
  GATEIO: "Gate.io",
  MEXC: "MEXC",
  BITGET: "Bitget",
};

export function EvidenceTable({ evidence }: { evidence: SourceEvidence[] }) {
  const available = evidence.filter((item) => item.status === "VALID");
  const up = available.filter((item) => item.direction === "UP").length;
  const down = available.filter((item) => item.direction === "DOWN").length;
  const agreement = Math.max(up, down);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded bg-consensus-soft px-1.5 py-0.5 text-[11px] font-medium text-consensus">
            Checked by GenLayer
          </span>
          <span className="text-[13px] text-muted-foreground">
            {up} UP · {down} DOWN · {available.length} of 5 available
          </span>
        </div>
        <span className="text-[11px] font-medium text-consensus">
          {agreement >= 3
            ? `${agreement === 5 ? "All 5" : `${agreement} of 5`} exchanges agreed`
            : "Fewer than 3 exchanges agreed"}
        </span>
      </div>
      <div className="divide-y divide-border">
        {evidence.map((item) => (
          <div
            key={item.provider}
            className="grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(70px,auto))] items-center gap-3 px-4 py-3 text-[12px]"
          >
            <span className="flex items-center gap-2 font-medium">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface-2 text-[10px]">
                {PROVIDER_INITIALS[item.provider]}
              </span>
              {PROVIDER_NAMES[item.provider] ?? item.provider}
            </span>
            <span className="text-right text-mono">{item.open ?? "—"}</span>
            <span className="text-right text-mono">{item.close ?? "—"}</span>
            <span className="flex justify-end">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                  item.status !== "VALID" && "bg-warning/10 text-warning",
                  item.direction === "UP" && "bg-up-soft text-up",
                  item.direction === "DOWN" && "bg-down-soft text-down",
                )}
              >
                {item.status === "VALID" ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {item.status === "VALID" ? item.direction : "Unavailable"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
