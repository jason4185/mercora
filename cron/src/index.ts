import { runSettlementCycle, type Logger } from "./engine";
import { makeGasSafeWriter, makeReader, makeTransactionReader } from "./genlayer";
import { DurableJobStore } from "./store";

export interface Env {
  MERCORA_CONTRACT_ADDRESS: `0x${string}`;
  MERCORA_OPERATOR_ADDRESS: `0x${string}`;
  MERCORA_OPERATOR_PRIVATE_KEY: `0x${string}`;
  MERCORA_ADMIN_TOKEN: string;
  MERCORA_EXTRA_SETTLEMENT_GRACE_SECONDS?: string;
  GENLAYER_RPC: string;
  GENLAYER_NETWORK: string;
  GAS_MARGIN_PERCENT?: string;
  SETTLEMENT_COORDINATOR: DurableObjectNamespace;
}

const SERVICE_NAME = "mercora-settlement-worker";
const INTERNAL_RUN_URL = "https://coordinator.internal/run";
const INTERNAL_STATUS_URL = "https://coordinator.internal/status";
const PAGE_SIZE = 10;
const LEASE_SECONDS = 300;
const MAX_ATTEMPTS = 4;

const logger: Logger = {
  log(message, data) {
    console.log(JSON.stringify({ level: "info", message, ...data }));
  },
  error(message, data) {
    console.error(JSON.stringify({ level: "error", message, ...data }));
  },
};

function coordinator(env: Env) {
  const id = env.SETTLEMENT_COORDINATOR.idFromName("mercora-settlement-v3");
  return env.SETTLEMENT_COORDINATOR.get(id);
}

function configNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function verifyConfiguration(env: Env): void {
  if (env.GENLAYER_NETWORK !== "testnet-bradbury") {
    throw new Error("Only GenLayer Bradbury is configured");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(env.MERCORA_CONTRACT_ADDRESS)) {
    throw new Error("MERCORA_CONTRACT_ADDRESS is invalid");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(env.MERCORA_OPERATOR_ADDRESS)) {
    throw new Error("MERCORA_OPERATOR_ADDRESS is invalid");
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(env.MERCORA_OPERATOR_PRIVATE_KEY)) {
    throw new Error("MERCORA_OPERATOR_PRIVATE_KEY secret is not configured");
  }
}

async function executeCycle(
  env: Env,
  storage: DurableObjectStorage,
  runId: string,
) {
  verifyConfiguration(env);
  const store = new DurableJobStore(storage);
  return runSettlementCycle(
    store,
    makeReader(env.GENLAYER_RPC, env.MERCORA_CONTRACT_ADDRESS),
    makeGasSafeWriter(
      env.GENLAYER_RPC,
      env.MERCORA_CONTRACT_ADDRESS,
      env.MERCORA_OPERATOR_PRIVATE_KEY,
      BigInt(configNumber(env.GAS_MARGIN_PERCENT, 30)),
    ),
    makeTransactionReader(env.GENLAYER_RPC),
    logger,
    {
      expectedOperator: env.MERCORA_OPERATOR_ADDRESS,
      extraGraceSeconds: configNumber(
        env.MERCORA_EXTRA_SETTLEMENT_GRACE_SECONDS,
        180,
      ),
      pageSize: PAGE_SIZE,
      leaseSeconds: LEASE_SECONDS,
      maxAttempts: MAX_ATTEMPTS,
    },
    runId,
  );
}

function publicJob(job: Awaited<ReturnType<DurableJobStore["getJob"]>>) {
  if (!job) return null;
  return {
    market_id: job.marketId,
    transaction_hash: job.transactionHash,
    genlayer_transaction_hash: job.genlayerHash,
    state: job.state,
    attempt_count: job.attemptCount,
    discovered_at: job.discoveredAt,
    submitted_at: job.submittedAt,
    last_checked_at: job.lastCheckedAt,
    next_retry_at: job.nextRetryAt,
    completed_at: job.completedAt,
    last_error: job.lastError,
    updated_at: job.updatedAt,
  };
}

export class SettlementCoordinator implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/run" && request.method === "POST") {
      const runId = request.headers.get("x-mercora-run-id") || crypto.randomUUID();
      const result = await executeCycle(this.env, this.ctx.storage, runId);
      return Response.json(result);
    }
    if (path === "/status" && request.method === "GET") {
      const now = Math.floor(Date.now() / 1_000);
      const status = await new DurableJobStore(this.ctx.storage).status(now);
      return Response.json({
        last_cron_run: status.lastCronRun,
        lease: status.lease,
        waiting_jobs: status.waitingJobs,
        active_job: publicJob(status.activeJob),
        completed_jobs: status.completedJobs,
        failed_jobs: status.failedJobs,
        recent_jobs: status.recentJobs.map(publicJob),
      });
    }
    return new Response("not found", { status: 404 });
  }
}

async function invokeRun(env: Env): Promise<Response> {
  return coordinator(env).fetch(INTERNAL_RUN_URL, {
    method: "POST",
    headers: { "x-mercora-run-id": crypto.randomUUID() },
  });
}

function authorized(request: Request, env: Env): boolean {
  const authorization = request.headers.get("authorization");
  return Boolean(
    env.MERCORA_ADMIN_TOKEN &&
      authorization === `Bearer ${env.MERCORA_ADMIN_TOKEN}`,
  );
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      invokeRun(env).then(async (response) => {
        if (!response.ok) throw new Error(`scheduled run failed (${response.status})`);
        const result = (await response.json()) as { runId?: string; acquired?: boolean };
        logger.log("scheduled run finished", {
          runId: result.runId || "",
          acquired: Boolean(result.acquired),
        });
      }),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") {
      return Response.json({
        service: SERVICE_NAME,
        status: "ok",
        network: env.GENLAYER_NETWORK,
        contract_address: env.MERCORA_CONTRACT_ADDRESS,
        timestamp: new Date().toISOString(),
      });
    }
    if (path === "/status" && request.method === "GET") {
      return coordinator(env).fetch(INTERNAL_STATUS_URL);
    }
    if (path === "/run" && request.method === "POST") {
      if (!authorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return invokeRun(env);
    }
    return new Response("not found", { status: 404 });
  },
};
