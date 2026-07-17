export const JOB_STATES = [
  "WAITING",
  "SUBMITTED",
  "PROCESSING",
  "VERIFYING",
  "COMPLETED",
  "RETRY_WAIT",
  "FAILED_ATTENTION",
] as const;

export type JobState = (typeof JOB_STATES)[number];

export interface SettlementJob {
  marketId: string;
  transactionHash: string;
  genlayerHash: string;
  previousTransactionHashes: string[];
  state: JobState;
  attemptCount: number;
  discoveredAt: number;
  submittedAt: number | null;
  lastCheckedAt: number | null;
  nextRetryAt: number | null;
  completedAt: number | null;
  lastError: string;
  updatedAt: number;
}

export interface DuePage {
  market_ids: string[];
  next_cursor: string;
  has_more: boolean;
}

export interface MarketRecord {
  market_id?: string;
  status: string;
  final_outcome?: string;
  settle_after: string;
}

export interface ProtocolStats {
  owner: string;
  market_operator: string;
}

export interface MarketReader {
  due(cursor: number, limit: number): Promise<DuePage>;
  market(id: string): Promise<MarketRecord>;
  ready(id: string): Promise<boolean>;
  displayStatus(id: string): Promise<string>;
  protocolStats(): Promise<ProtocolStats>;
}

export interface SettlementWriter {
  submit(id: string): Promise<{ transactionHash: string }>;
}

export type TransactionCheck =
  | { state: "PROCESSING"; genlayerHash?: string }
  | { state: "SUCCESS"; genlayerHash: string }
  | { state: "FAILED"; genlayerHash?: string; reason: string };

export interface TransactionReader {
  check(transactionHash: string, genlayerHash: string): Promise<TransactionCheck>;
}

export interface JobStore {
  acquireLease(runId: string, now: number, expiresAt: number): Promise<boolean>;
  releaseLease(runId: string): Promise<void>;
  leaseStatus(now: number): Promise<{ held: boolean; runId: string; expiresAt: number }>;
  upsertWaiting(marketId: string, now: number): Promise<SettlementJob>;
  getJob(marketId: string): Promise<SettlementJob | null>;
  updateJob(job: SettlementJob): Promise<void>;
  getActiveJob(): Promise<SettlementJob | null>;
  getOldestEligible(now: number): Promise<SettlementJob | null>;
  status(now: number): Promise<StoreStatus>;
}

export interface StoreStatus {
  lease: { held: boolean; runId: string; expiresAt: number };
  lastCronRun: number | null;
  waitingJobs: number;
  activeJob: SettlementJob | null;
  completedJobs: number;
  failedJobs: number;
  recentJobs: SettlementJob[];
}

export interface Logger {
  log(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface EngineOptions {
  expectedOperator: string;
  extraGraceSeconds: number;
  pageSize: number;
  leaseSeconds: number;
  maxAttempts: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface RunResult {
  runId: string;
  acquired: boolean;
  discovered: number;
  submittedMarketId: string | null;
  activeMarketId: string | null;
  error?: string;
}

export class SubmissionUncertainError extends Error {
  constructor(message = "settlement submission status is uncertain") {
    super(message);
    this.name = "SubmissionUncertainError";
  }
}

const ACTIVE_STATES = new Set<JobState>(["SUBMITTED", "PROCESSING", "VERIFYING"]);
const FINAL_MARKET_STATES = new Set(["SETTLED", "INCONCLUSIVE", "CANCELLED"]);
const RETRY_DELAYS_SECONDS = [120, 300, 900] as const;
const PERMANENT_READ_ERRORS = [
  "invalid market",
  "unsupported",
  "unauthorized",
  "malformed argument",
  "invalid argument",
  "method not found",
  "does not exist",
];
const TEMPORARY_READ_ERRORS = [
  "timeout",
  "timed out",
  "temporar",
  "unavailable",
  "network",
  "fetch",
  "429",
  "502",
  "503",
  "504",
  "incomplete",
  "decode",
  "connection",
];

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sanitizeError(error: unknown): string {
  const text = errorText(error)
    .replace(/0x[a-fA-F0-9]{64}/g, "[hash]")
    .replace(
      /((?:private[_ -]?key|admin[_ -]?token))\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 240) || "unknown error";
}

export function isTemporaryReadError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  if (PERMANENT_READ_ERRORS.some((token) => text.includes(token))) return false;
  return TEMPORARY_READ_ERRORS.some((token) => text.includes(token));
}

export async function retryRead<T>(
  work: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void> = defaultSleep,
): Promise<T> {
  const delays = [1_000, 2_000, 4_000];
  let attempt = 0;
  while (true) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= delays.length || !isTemporaryReadError(error)) throw error;
      await sleep(delays[attempt]);
      attempt += 1;
    }
  }
}

export function isFinalMarket(market: MarketRecord): boolean {
  if (!FINAL_MARKET_STATES.has(market.status)) return false;
  if (market.status !== "SETTLED") return true;
  return market.final_outcome === "UP" || market.final_outcome === "DOWN";
}

function cooldownForAttempt(attemptCount: number): number | null {
  return RETRY_DELAYS_SECONDS[attemptCount - 1] ?? null;
}

function withCheck(job: SettlementJob, now: number): SettlementJob {
  return { ...job, lastCheckedAt: now, updatedAt: now };
}

async function completeIfFinal(
  store: JobStore,
  reader: MarketReader,
  job: SettlementJob,
  now: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<boolean> {
  const market = await retryRead(() => reader.market(job.marketId), sleep);
  if (!isFinalMarket(market)) {
    await store.updateJob({ ...withCheck(job, now), state: "VERIFYING" });
    return false;
  }
  await store.updateJob({
    ...withCheck(job, now),
    state: "COMPLETED",
    completedAt: now,
    nextRetryAt: null,
    lastError: "",
  });
  return true;
}

async function scheduleFailedAttempt(
  store: JobStore,
  job: SettlementJob,
  now: number,
  reason: unknown,
  maxAttempts: number,
): Promise<void> {
  const delay = cooldownForAttempt(job.attemptCount);
  const exhausted = job.attemptCount >= maxAttempts || delay === null;
  await store.updateJob({
    ...withCheck(job, now),
    state: exhausted ? "FAILED_ATTENTION" : "RETRY_WAIT",
    nextRetryAt: exhausted ? null : now + delay,
    lastError: sanitizeError(reason),
  });
}

async function reconcileActive(
  store: JobStore,
  reader: MarketReader,
  transactions: TransactionReader,
  job: SettlementJob,
  now: number,
  options: EngineOptions,
): Promise<void> {
  const sleep = options.sleep ?? defaultSleep;
  if (job.state === "VERIFYING") {
    await completeIfFinal(store, reader, job, now, sleep);
    return;
  }

  const check = await retryRead(
    () => transactions.check(job.transactionHash, job.genlayerHash),
    sleep,
  );
  const checked = {
    ...withCheck(job, now),
    genlayerHash: check.genlayerHash || job.genlayerHash,
  };

  if (check.state === "PROCESSING") {
    await store.updateJob({ ...checked, state: "PROCESSING" });
    return;
  }
  if (check.state === "SUCCESS") {
    const verifying = { ...checked, state: "VERIFYING" as const };
    await store.updateJob(verifying);
    await completeIfFinal(store, reader, verifying, now, sleep);
    return;
  }

  const market = await retryRead(() => reader.market(job.marketId), sleep);
  if (isFinalMarket(market)) {
    await store.updateJob({
      ...checked,
      state: "COMPLETED",
      completedAt: now,
      nextRetryAt: null,
      lastError: "",
    });
    return;
  }
  await scheduleFailedAttempt(store, checked, now, check.reason, options.maxAttempts);
}

async function discover(
  store: JobStore,
  reader: MarketReader,
  now: number,
  pageSize: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<number> {
  const page = await retryRead(() => reader.due(0, pageSize), sleep);
  let discovered = 0;
  for (const marketId of page.market_ids) {
    const before = await store.getJob(marketId);
    await store.upsertWaiting(marketId, now);
    if (!before) discovered += 1;
  }
  return discovered;
}

export async function runSettlementCycle(
  store: JobStore,
  reader: MarketReader,
  writer: SettlementWriter,
  transactions: TransactionReader,
  logger: Logger,
  options: EngineOptions,
  requestedRunId?: string,
): Promise<RunResult> {
  const now = (options.now ?? (() => Math.floor(Date.now() / 1_000)))();
  const runId = requestedRunId || crypto.randomUUID();
  const result: RunResult = {
    runId,
    acquired: false,
    discovered: 0,
    submittedMarketId: null,
    activeMarketId: null,
  };
  if (!(await store.acquireLease(runId, now, now + options.leaseSeconds))) return result;
  result.acquired = true;
  const sleep = options.sleep ?? defaultSleep;

  try {
    let active = await store.getActiveJob();
    if (active) {
      result.activeMarketId = active.marketId;
      await reconcileActive(store, reader, transactions, active, now, options);
    }

    result.discovered = await discover(store, reader, now, options.pageSize, sleep);
    active = await store.getActiveJob();
    if (active) {
      result.activeMarketId = active.marketId;
      return result;
    }

    const job = await store.getOldestEligible(now);
    if (!job) return result;

    const stats = await retryRead(() => reader.protocolStats(), sleep);
    if (
      stats.market_operator.toLowerCase() !== options.expectedOperator.toLowerCase()
    ) {
      throw new Error("configured contract operator does not match expected operator");
    }

    const market = await retryRead(() => reader.market(job.marketId), sleep);
    if (isFinalMarket(market)) {
      await store.updateJob({
        ...job,
        state: "COMPLETED",
        completedAt: now,
        lastCheckedAt: now,
        updatedAt: now,
      });
      return result;
    }

    const ready = await retryRead(() => reader.ready(job.marketId), sleep);
    await retryRead(() => reader.displayStatus(job.marketId), sleep);
    const settleAfter = Number(market.settle_after);
    if (
      !ready ||
      !Number.isSafeInteger(settleAfter) ||
      now < settleAfter + options.extraGraceSeconds
    ) {
      await store.updateJob({
        ...job,
        state: "WAITING",
        lastCheckedAt: now,
        nextRetryAt: null,
        updatedAt: now,
      });
      return result;
    }

    try {
      const submission = await writer.submit(job.marketId);
      const nextJob: SettlementJob = {
        ...job,
        transactionHash: submission.transactionHash,
        genlayerHash: "",
        previousTransactionHashes: job.transactionHash
          ? [...job.previousTransactionHashes, job.transactionHash]
          : job.previousTransactionHashes,
        state: "SUBMITTED",
        attemptCount: job.attemptCount + 1,
        submittedAt: now,
        lastCheckedAt: now,
        nextRetryAt: null,
        lastError: "",
        updatedAt: now,
      };
      await store.updateJob(nextJob);
      result.submittedMarketId = job.marketId;
      result.activeMarketId = job.marketId;
      logger.log("settlement submitted", {
        runId,
        marketId: job.marketId,
        state: nextJob.state,
        transactionHash: submission.transactionHash,
        attemptCount: nextJob.attemptCount,
      });
    } catch (error) {
      const attempted = { ...job, attemptCount: job.attemptCount + 1 };
      if (error instanceof SubmissionUncertainError) {
        await store.updateJob({
          ...attempted,
          state: "FAILED_ATTENTION",
          lastCheckedAt: now,
          nextRetryAt: null,
          lastError: sanitizeError(error),
          updatedAt: now,
        });
      } else {
        await scheduleFailedAttempt(store, attempted, now, error, options.maxAttempts);
      }
      logger.error("settlement submission rejected", {
        runId,
        marketId: job.marketId,
        state:
          error instanceof SubmissionUncertainError
            ? "FAILED_ATTENTION"
            : "RETRY_WAIT",
        attemptCount: attempted.attemptCount,
        errorCategory: isTemporaryReadError(error) ? "temporary" : "submission",
      });
    }
    return result;
  } catch (error) {
    result.error = sanitizeError(error);
    logger.error("settlement run failed", {
      runId,
      errorCategory: isTemporaryReadError(error) ? "temporary-read" : "operational",
    });
    return result;
  } finally {
    await store.releaseLease(runId);
  }
}

export function isActiveState(state: JobState): boolean {
  return ACTIVE_STATES.has(state);
}
