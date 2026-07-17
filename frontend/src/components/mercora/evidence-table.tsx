import type { Evidence } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Check, AlertTriangle, X } from "lucide-react";

const PROVIDER_INITIALS: Record<string, string> = {
  Binance: "BN",
  Bybit: "BY",
  "Gate.io": "GA",
  MEXC: "MX",
  Bitget: "BG",
};

export function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  const okCount = evidence.filter((e) => e.status === "OK").length;
  const upVotes = evidence.filter((e) => e.vote === "UP").length;
  const downVotes = evidence.filter((e) => e.vote === "DOWN").length;
  const dominant = upVotes >= downVotes ? "UP" : "DOWN";
  const dominantVotes = Math.max(upVotes, downVotes);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded bg-consensus-soft px-1.5 py-0.5 text-[11px] font-medium text-consensus">
            GenLayer verified
          </span>
          <span className="text-muted-foreground text-[13px]">
            {okCount}/5 valid · {dominantVotes} {dominant} vote{dominantVotes === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Provider</th>
              <th className="px-4 py-2 text-left font-medium">Symbol</th>
              <th className="px-4 py-2 text-right font-medium">Open</th>
              <th className="px-4 py-2 text-right font-medium">Close</th>
              <th className="px-4 py-2 text-left font-medium">Vote</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {evidence.map((e) => (
              <tr key={e.provider} className="text-[13px]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 border border-border text-[10px] font-semibold text-foreground">
                      {PROVIDER_INITIALS[e.provider]}
                    </span>
                    <span className="font-medium">{e.provider}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-mono text-muted-foreground">{e.symbol}</td>
                <td className="px-4 py-2.5 text-right text-mono">{e.open}</td>
                <td className="px-4 py-2.5 text-right text-mono">{e.close}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                      e.vote === "UP" && "bg-up-soft text-up",
                      e.vote === "DOWN" && "bg-down-soft text-down",
                      e.vote === "NONE" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {e.vote === "NONE" ? "—" : e.vote}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[12px]",
                      e.status === "OK" && "text-up",
                      e.status === "MISSING" && "text-warning",
                      e.status === "INVALID" && "text-down",
                    )}
                  >
                    {e.status === "OK" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : e.status === "MISSING" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
