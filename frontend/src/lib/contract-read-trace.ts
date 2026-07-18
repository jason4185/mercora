export interface ContractReadTraceMeta {
  queryKey?: readonly unknown[];
  source?: string;
  route?: string;
  cacheStatus?: "miss" | "refetch-with-cache" | "unknown";
  blocksRendering?: boolean;
  userSpecific?: boolean;
  essentialAboveFold?: boolean;
}

type ContractReadTraceEvent = ContractReadTraceMeta & {
  method: string;
  runtime: "server" | "browser";
  duplicateInFlight: boolean;
  status: "ok" | "error" | "deduped";
  startTime: string;
  completionTime: string;
  durationMs: number;
  queuedMs?: number;
  error?: string;
};

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function runtime(): ContractReadTraceEvent["runtime"] {
  return typeof window === "undefined" ? "server" : "browser";
}

function redact(value: unknown): unknown {
  if (typeof value === "string") return ADDRESS_PATTERN.test(value) ? "<address>" : value;
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry)]));
  }
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown contract read error";
}

export function traceNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function traceContractRead(event: Omit<ContractReadTraceEvent, "runtime">): void {
  if (!import.meta.env.DEV) return;
  const payload: ContractReadTraceEvent = {
    ...event,
    runtime: runtime(),
    queryKey: event.queryKey ? (redact(event.queryKey) as readonly unknown[]) : undefined,
    error: event.error ? errorMessage(event.error) : undefined,
  };
  console.debug("[mercora:contract-read]", payload);
}
