import {
  JOB_STATES,
  isActiveState,
  type JobState,
  type JobStore,
  type SettlementJob,
  type StoreStatus,
} from "./engine";

const LEASE_KEY = "lease:global";
const JOB_IDS_KEY = "jobs:ids";
const LAST_RUN_KEY = "runs:last";
const jobKey = (marketId: string) => `job:${marketId}`;
const stateKey = (state: JobState) => `index:state:${state}`;

interface LeaseRecord {
  runId: string;
  expiresAt: number;
}

interface DurableTransactionLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface DurableStorageLike extends DurableTransactionLike {
  transaction<T>(
    closure: (transaction: DurableTransactionLike) => Promise<T>,
  ): Promise<T>;
}

export function newWaitingJob(marketId: string, now: number): SettlementJob {
  return {
    marketId,
    transactionHash: "",
    genlayerHash: "",
    previousTransactionHashes: [],
    state: "WAITING",
    attemptCount: 0,
    discoveredAt: now,
    submittedAt: null,
    lastCheckedAt: null,
    nextRetryAt: null,
    completedAt: null,
    lastError: "",
    updatedAt: now,
  };
}

export class DurableJobStore implements JobStore {
  constructor(private readonly storage: DurableStorageLike) {}

  async acquireLease(runId: string, now: number, expiresAt: number): Promise<boolean> {
    return this.storage.transaction(async (transaction) => {
      const lease = await transaction.get<LeaseRecord>(LEASE_KEY);
      if (lease && lease.expiresAt > now && lease.runId !== runId) return false;
      await transaction.put(LEASE_KEY, { runId, expiresAt });
      await transaction.put(LAST_RUN_KEY, now);
      return true;
    });
  }

  async releaseLease(runId: string): Promise<void> {
    await this.storage.transaction(async (transaction) => {
      const lease = await transaction.get<LeaseRecord>(LEASE_KEY);
      if (lease?.runId === runId) {
        await transaction.put(LEASE_KEY, { runId: "", expiresAt: 0 });
      }
    });
  }

  async leaseStatus(now: number) {
    const lease = await this.storage.get<LeaseRecord>(LEASE_KEY);
    return {
      held: Boolean(lease?.runId && lease.expiresAt > now),
      runId: lease?.runId || "",
      expiresAt: lease?.expiresAt || 0,
    };
  }

  async upsertWaiting(marketId: string, now: number): Promise<SettlementJob> {
    return this.storage.transaction(async (transaction) => {
      const existing = await transaction.get<SettlementJob>(jobKey(marketId));
      if (existing) return existing;
      const job = newWaitingJob(marketId, now);
      const ids = (await transaction.get<string[]>(JOB_IDS_KEY)) || [];
      await transaction.put(jobKey(marketId), job);
      await transaction.put(JOB_IDS_KEY, [...ids, marketId]);
      const waitingIds = (await transaction.get<string[]>(stateKey("WAITING"))) || [];
      await transaction.put(stateKey("WAITING"), [...waitingIds, marketId]);
      return job;
    });
  }

  async getJob(marketId: string): Promise<SettlementJob | null> {
    return (await this.storage.get<SettlementJob>(jobKey(marketId))) || null;
  }

  async updateJob(job: SettlementJob): Promise<void> {
    await this.storage.transaction(async (transaction) => {
      const existing = await transaction.get<SettlementJob>(jobKey(job.marketId));
      if (existing?.state !== job.state) {
        if (existing) {
          const previousIds =
            (await transaction.get<string[]>(stateKey(existing.state))) || [];
          await transaction.put(
            stateKey(existing.state),
            previousIds.filter((id) => id !== job.marketId),
          );
        }
        const nextIds = (await transaction.get<string[]>(stateKey(job.state))) || [];
        if (!nextIds.includes(job.marketId)) {
          await transaction.put(stateKey(job.state), [...nextIds, job.marketId]);
        }
      }
      await transaction.put(jobKey(job.marketId), job);
    });
  }

  private async jobs(): Promise<SettlementJob[]> {
    const ids = (await this.storage.get<string[]>(JOB_IDS_KEY)) || [];
    const jobs = await Promise.all(ids.map((id) => this.getJob(id)));
    return jobs.filter((job): job is SettlementJob => job !== null);
  }

  async getActiveJob(): Promise<SettlementJob | null> {
    const ids = (
      await Promise.all(
        (["SUBMITTED", "PROCESSING", "VERIFYING"] as JobState[]).map(
          async (state) => (await this.storage.get<string[]>(stateKey(state))) || [],
        ),
      )
    ).flat();
    const jobs = await Promise.all(ids.map((id) => this.getJob(id)));
    return jobs
      .filter((job): job is SettlementJob => job !== null && isActiveState(job.state))
      .sort((left, right) => (left.submittedAt || 0) - (right.submittedAt || 0))[0] ?? null;
  }

  async getOldestEligible(now: number): Promise<SettlementJob | null> {
    const ids = (
      await Promise.all(
        (["WAITING", "RETRY_WAIT"] as JobState[]).map(
          async (state) => (await this.storage.get<string[]>(stateKey(state))) || [],
        ),
      )
    ).flat();
    const jobs = await Promise.all(ids.map((id) => this.getJob(id)));
    return jobs
      .filter((job): job is SettlementJob => job !== null)
      .filter(
        (job) =>
          job.state === "WAITING" ||
          (job.state === "RETRY_WAIT" && (job.nextRetryAt ?? Infinity) <= now),
      )
      .sort((left, right) => left.discoveredAt - right.discoveredAt)[0] ?? null;
  }

  async status(now: number): Promise<StoreStatus> {
    const jobs = await this.jobs();
    const counts = Object.fromEntries(JOB_STATES.map((state) => [state, 0])) as Record<
      JobState,
      number
    >;
    for (const job of jobs) counts[job.state] += 1;
    return {
      lease: await this.leaseStatus(now),
      lastCronRun: (await this.storage.get<number>(LAST_RUN_KEY)) ?? null,
      waitingJobs: counts.WAITING + counts.RETRY_WAIT,
      activeJob:
        jobs
          .filter((job) => isActiveState(job.state))
          .sort((left, right) => (left.submittedAt || 0) - (right.submittedAt || 0))[0] ??
        null,
      completedJobs: counts.COMPLETED,
      failedJobs: counts.FAILED_ATTENTION,
      recentJobs: jobs.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 10),
    };
  }
}

export class MemoryJobStore implements JobStore {
  private lease: LeaseRecord = { runId: "", expiresAt: 0 };
  private lastRun: number | null = null;
  readonly jobs = new Map<string, SettlementJob>();

  async acquireLease(runId: string, now: number, expiresAt: number): Promise<boolean> {
    if (this.lease.runId && this.lease.expiresAt > now && this.lease.runId !== runId)
      return false;
    this.lease = { runId, expiresAt };
    this.lastRun = now;
    return true;
  }

  async releaseLease(runId: string): Promise<void> {
    if (this.lease.runId === runId) this.lease = { runId: "", expiresAt: 0 };
  }

  async leaseStatus(now: number) {
    return {
      held: Boolean(this.lease.runId && this.lease.expiresAt > now),
      runId: this.lease.runId,
      expiresAt: this.lease.expiresAt,
    };
  }

  async upsertWaiting(marketId: string, now: number): Promise<SettlementJob> {
    const existing = this.jobs.get(marketId);
    if (existing) return structuredClone(existing);
    const job = newWaitingJob(marketId, now);
    this.jobs.set(marketId, structuredClone(job));
    return job;
  }

  async getJob(marketId: string): Promise<SettlementJob | null> {
    const job = this.jobs.get(marketId);
    return job ? structuredClone(job) : null;
  }

  async updateJob(job: SettlementJob): Promise<void> {
    this.jobs.set(job.marketId, structuredClone(job));
  }

  async getActiveJob(): Promise<SettlementJob | null> {
    return [...this.jobs.values()]
      .filter((job) => isActiveState(job.state))
      .sort((left, right) => (left.submittedAt || 0) - (right.submittedAt || 0))[0] ?? null;
  }

  async getOldestEligible(now: number): Promise<SettlementJob | null> {
    return [...this.jobs.values()]
      .filter(
        (job) =>
          job.state === "WAITING" ||
          (job.state === "RETRY_WAIT" && (job.nextRetryAt ?? Infinity) <= now),
      )
      .sort((left, right) => left.discoveredAt - right.discoveredAt)[0] ?? null;
  }

  async status(now: number): Promise<StoreStatus> {
    const jobs = [...this.jobs.values()];
    return {
      lease: await this.leaseStatus(now),
      lastCronRun: this.lastRun,
      waitingJobs: jobs.filter(
        (job) => job.state === "WAITING" || job.state === "RETRY_WAIT",
      ).length,
      activeJob: (await this.getActiveJob()) || null,
      completedJobs: jobs.filter((job) => job.state === "COMPLETED").length,
      failedJobs: jobs.filter((job) => job.state === "FAILED_ATTENTION").length,
      recentJobs: jobs.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 10),
    };
  }
}
