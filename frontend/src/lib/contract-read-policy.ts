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

export function contractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "string") return error.toLowerCase();
  return "";
}

export function isPermanentContractReadError(error: unknown): boolean {
  const message = contractErrorMessage(error);
  return PERMANENT_READ_ERRORS.some((pattern) => message.includes(pattern));
}

export function shouldRetryContractRead(failureCount: number, error: unknown): boolean {
  return failureCount < 3 && !isPermanentContractReadError(error);
}

export function contractReadRetryDelay(attemptIndex: number): number {
  return Math.min(1_000 * 2 ** attemptIndex, 4_000);
}

export const contractReadQueryPolicy = {
  retry: shouldRetryContractRead,
  retryDelay: contractReadRetryDelay,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: true,
} as const;
