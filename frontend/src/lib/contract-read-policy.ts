const PERMANENT_READ_ERRORS = [
  "invalid market id",
  "market does not exist",
  "unsupported asset",
  "invalid address",
  "malformed wallet",
  "not hour aligned",
  "must be aligned",
  "unauthorized",
  "duplicate market",
  "invalid calldata",
  "invalid argument",
];

let rateLimitCooldownUntil = 0;

export function contractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "string") return error.toLowerCase();
  return "";
}

export function isContractRateLimitError(error: unknown): boolean {
  return contractErrorMessage(error).includes("rate limit exceeded");
}

export function isPermanentContractReadError(error: unknown): boolean {
  const message = contractErrorMessage(error);
  return PERMANENT_READ_ERRORS.some((pattern) => message.includes(pattern));
}

export function shouldRetryContractRead(failureCount: number, error: unknown): boolean {
  const maxFailures = isContractRateLimitError(error) ? 4 : 3;
  return failureCount < maxFailures && !isPermanentContractReadError(error);
}

export function contractReadRetryDelay(attemptIndex: number): number {
  return Math.min(1_000 * 2 ** attemptIndex, 4_000);
}

export function contractRateLimitRetryDelay(attemptIndex: number): number {
  const jitter = Math.floor(Math.random() * 1_500);
  const delay = [15_000, 30_000, 60_000][Math.min(attemptIndex, 2)] + jitter;
  rateLimitCooldownUntil = Date.now() + delay;
  return delay;
}

export function contractReadRetryDelayForError(attemptIndex: number, error: unknown): number {
  if (isContractRateLimitError(error)) return contractRateLimitRetryDelay(attemptIndex);
  return Math.min(1_000 * 2 ** attemptIndex, 4_000);
}

export function contractReadCooldownRemaining(): number {
  return Math.max(0, rateLimitCooldownUntil - Date.now());
}

export const contractReadQueryPolicy = {
  retry: shouldRetryContractRead,
  retryDelay: contractReadRetryDelayForError,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
} as const;
