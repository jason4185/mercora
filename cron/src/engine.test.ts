import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "./index";
import { SettlementCoordinator } from "./index";
import { transactionState } from "./genlayer";
import type { GenLayerTransaction } from "genlayer-js/types";
import {
  retryRead,
  runSettlementCycle,
  SubmissionUncertainError,
  type EngineOptions,
  type Logger,
  type MarketReader,
  type MarketRecord,
  type SettlementWriter,
  type TransactionReader,
} from "./engine";
import { MemoryJobStore } from "./store";

const OPERATOR = "0xb88be5f8ed476abc8fb5e6c47b12032f075162b3";
const CONTRACT = "0x0A3Fcc4671b6fF0BffBCDab3B744CFf6d5c7ED05";

function harness(ids: string[] = ["1"]) {
  const store = new MemoryJobStore();
  const markets = new Map<string, MarketRecord>(
    ids.map((id) => [
      id,
      { market_id: id, status: "OPEN", settle_after: "800", final_outcome: "" },
    ]),
  );
  const reader: MarketReader = {
    due: vi.fn(async () => ({
      market_ids: ids,
      next_cursor: String(ids.length),
      has_more: false,
    })),
    market: vi.fn(async (id) => {
      const market = markets.get(id);
      if (!market) throw new Error("invalid market ID");
      return structuredClone(market);
    }),
    ready: vi.fn(async () => true),
    displayStatus: vi.fn(async () => "READY_FOR_SETTLEMENT"),
    protocolStats: vi.fn(async () => ({
      owner: "0xowner",
      market_operator: OPERATOR,
    })),
  };
  const writer: SettlementWriter = {
    submit: vi.fn(async (id) => ({ transactionHash: `0xevm${id}` })),
  };
  const transactions: TransactionReader = {
    check: vi.fn(async () => ({ state: "PROCESSING" as const })),
  };
  const logger: Logger = { log: vi.fn(), error: vi.fn() };
  let now = 1_000;
  const options: EngineOptions = {
    expectedOperator: OPERATOR,
    extraGraceSeconds: 180,
    pageSize: 10,
    leaseSeconds: 90,
    maxAttempts: 4,
    now: () => now,
    sleep: vi.fn(async () => undefined),
  };
  return {
    store,
    markets,
    reader,
    writer,
    transactions,
    logger,
    options,
    setNow: (value: number) => {
      now = value;
    },
    run: (runId?: string) =>
      runSettlementCycle(
        store,
        reader,
        writer,
        transactions,
        logger,
        options,
        runId,
      ),
  };
}

async function makeActive(
  h: ReturnType<typeof harness>,
  marketId = "1",
): Promise<void> {
  await h.store.upsertWaiting(marketId, 900);
  const job = await h.store.getJob(marketId);
  if (!job) throw new Error("test job missing");
  await h.store.updateJob({
    ...job,
    state: "SUBMITTED",
    attemptCount: 1,
    submittedAt: 950,
    transactionHash: "0xevm",
    updatedAt: 950,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("settlement discovery and eligibility", () => {
  it("finishes an empty due-market run without a submission", async () => {
    const h = harness([]);
    const result = await h.run();
    expect(result.discovered).toBe(0);
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("discovers one due market and stores a unique job", async () => {
    const h = harness(["7"]);
    await h.run();
    expect(await h.store.getJob("7")).not.toBeNull();
    expect(h.store.jobs.size).toBe(1);
  });

  it("discovers multiple due markets but submits only the oldest", async () => {
    const h = harness(["7", "8", "9"]);
    const result = await h.run();
    expect(h.store.jobs.size).toBe(3);
    expect(result.submittedMarketId).toBe("7");
    expect(h.writer.submit).toHaveBeenCalledTimes(1);
  });

  it("uses only get_due_market_ids(0, 10)", async () => {
    const h = harness([]);
    await h.run();
    expect(h.reader.due).toHaveBeenCalledWith(0, 10);
  });

  it("enforces the extra 180-second grace period", async () => {
    const h = harness();
    h.markets.set("1", { status: "OPEN", settle_after: "900" });
    h.setNow(1_079);
    await h.run();
    expect(h.writer.submit).not.toHaveBeenCalled();
    h.setNow(1_080);
    await h.run();
    expect(h.writer.submit).toHaveBeenCalledOnce();
  });

  it("skips a market that the contract says is not ready", async () => {
    const h = harness();
    vi.mocked(h.reader.ready).mockResolvedValue(false);
    await h.run();
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("refuses to submit when the configured operator differs", async () => {
    const h = harness();
    vi.mocked(h.reader.protocolStats).mockResolvedValue({
      owner: "0xowner",
      market_operator: "0x0000000000000000000000000000000000000001",
    });
    const result = await h.run();
    expect(result.error).toContain("operator");
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("prevents duplicate jobs for a repeated due market", async () => {
    const h = harness();
    await h.run();
    h.transactions.check = vi.fn(async () => ({ state: "PROCESSING" as const }));
    h.setNow(1_060);
    await h.run();
    expect(h.store.jobs.size).toBe(1);
  });
});

describe("lease and one-at-a-time behavior", () => {
  it("does not acquire an overlapping global lease", async () => {
    const h = harness();
    await h.store.acquireLease("first", 1_000, 1_090);
    const result = await h.run("second");
    expect(result.acquired).toBe(false);
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("recovers an expired lease", async () => {
    const h = harness();
    await h.store.acquireLease("first", 900, 999);
    const result = await h.run("second");
    expect(result.acquired).toBe(true);
  });

  it("an active transaction blocks a second submission", async () => {
    const h = harness(["1", "2"]);
    await makeActive(h);
    await h.run();
    expect(h.transactions.check).toHaveBeenCalledWith("0xevm", "");
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("saves the submitted transaction hash immediately", async () => {
    const h = harness();
    await h.run();
    expect((await h.store.getJob("1"))?.transactionHash).toBe("0xevm1");
    expect((await h.store.getJob("1"))?.state).toBe("SUBMITTED");
  });

  it("supplies only market_id to settle_market", async () => {
    const h = harness(["42"]);
    await h.run();
    expect(h.writer.submit).toHaveBeenCalledWith("42");
    expect(vi.mocked(h.writer.submit).mock.calls[0]).toHaveLength(1);
  });
});

describe("transaction reconciliation", () => {
  it("checks a processing transaction without resubmitting", async () => {
    const h = harness();
    await makeActive(h);
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("PROCESSING");
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("moves an accepted transaction to VERIFYING while state is delayed", async () => {
    const h = harness();
    await makeActive(h);
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "SUCCESS",
      genlayerHash: "0xgenlayer",
    });
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("VERIFYING");
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  for (const [status, outcome] of [
    ["SETTLED", "UP"],
    ["SETTLED", "DOWN"],
    ["INCONCLUSIVE", ""],
    ["CANCELLED", ""],
  ]) {
    it(`completes an accepted ${status}${outcome ? ` ${outcome}` : ""} market`, async () => {
      const h = harness();
      await makeActive(h);
      vi.mocked(h.transactions.check).mockResolvedValue({
        state: "SUCCESS",
        genlayerHash: "0xgenlayer",
      });
      h.markets.set("1", {
        status,
        final_outcome: outcome,
        settle_after: "800",
      });
      await h.run();
      expect((await h.store.getJob("1"))?.state).toBe("COMPLETED");
    });
  }

  it("releases the active slot and submits the next job after acceptance", async () => {
    const h = harness(["1", "2"]);
    await makeActive(h);
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "SUCCESS",
      genlayerHash: "0xaccepted",
    });
    h.markets.set("1", {
      status: "SETTLED",
      final_outcome: "UP",
      settle_after: "800",
    });
    const result = await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("COMPLETED");
    expect(result.submittedMarketId).toBe("2");
    expect(h.writer.submit).toHaveBeenCalledOnce();
    expect(h.writer.submit).toHaveBeenCalledWith("2");
  });

  it("a VERIFYING job completes from market state without checking the transaction again", async () => {
    const h = harness();
    await makeActive(h);
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "SUCCESS",
      genlayerHash: "0xaccepted",
    });
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("VERIFYING");
    h.markets.set("1", {
      status: "SETTLED",
      final_outcome: "DOWN",
      settle_after: "800",
    });
    h.setNow(1_060);
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("COMPLETED");
    expect(h.transactions.check).toHaveBeenCalledTimes(1);
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("keeps accepted hashes while a temporary market read failure leaves VERIFYING", async () => {
    const h = harness();
    await makeActive(h);
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "SUCCESS",
      genlayerHash: "0xaccepted",
    });
    vi.mocked(h.reader.market).mockRejectedValue(new Error("RPC timeout"));
    await h.run();
    const job = await h.store.getJob("1");
    expect(job?.state).toBe("VERIFYING");
    expect(job?.transactionHash).toBe("0xevm");
    expect(job?.genlayerHash).toBe("0xaccepted");
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("recovers an existing stored PROCESSING job after acceptance", async () => {
    const h = harness();
    await makeActive(h);
    const existing = await h.store.getJob("1");
    if (!existing) throw new Error("test job missing");
    await h.store.updateJob({
      ...existing,
      state: "PROCESSING",
      genlayerHash:
        "0x6f1917751f01d8d5054495b5f630beef1ab4a463a4f3d547af8b814d56131b2f",
    });
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "SUCCESS",
      genlayerHash: existing.genlayerHash,
    });
    h.markets.set("1", {
      status: "INCONCLUSIVE",
      final_outcome: "",
      settle_after: "800",
    });
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("COMPLETED");
    expect((await h.store.getJob("1"))?.attemptCount).toBe(1);
    expect(h.writer.submit).not.toHaveBeenCalled();
  });

  it("does not falsely complete an accepted execution error", async () => {
    const h = harness();
    await makeActive(h);
    vi.mocked(h.transactions.check).mockResolvedValue({
      state: "FAILED",
      genlayerHash: "0xaccepted",
      reason: "ACCEPTED with FINISHED_WITH_ERROR",
    });
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("RETRY_WAIT");
    expect((await h.store.getJob("1"))?.lastError).toContain(
      "FINISHED_WITH_ERROR",
    );
    expect(h.writer.submit).not.toHaveBeenCalled();
  });
});

describe("GenLayer ACCEPTED status parsing", () => {
  const hash =
    "0x6f1917751f01d8d5054495b5f630beef1ab4a463a4f3d547af8b814d56131b2f";

  it.each([
    { statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" },
    { statusName: "accepted", txExecutionResultName: "finished_with_return" },
    { status: 5, txExecutionResult: 1 },
    {
      transaction: {
        status_name: "accepted",
        tx_execution_result_name: "finished_with_return",
      },
    },
  ])("treats accepted representation %# as success", (fields) => {
    expect(
      transactionState({ ...fields, txId: hash } as unknown as GenLayerTransaction),
    ).toEqual({ state: "SUCCESS", genlayerHash: hash });
  });

  it("does not wait for FINALIZED after ACCEPTED succeeds", () => {
    expect(
      transactionState({
        status: 5,
        statusName: "ACCEPTED",
        txExecutionResult: 1,
        txExecutionResultName: "FINISHED_WITH_RETURN",
        txId: hash,
      } as unknown as GenLayerTransaction),
    ).toEqual({ state: "SUCCESS", genlayerHash: hash });
  });

  it("keeps FINALIZED as a backward-compatible success", () => {
    expect(
      transactionState({
        statusName: "FINALIZED",
        txExecutionResultName: "FINISHED_WITH_RETURN",
        txId: hash,
      } as unknown as GenLayerTransaction),
    ).toEqual({ state: "SUCCESS", genlayerHash: hash });
  });

  it("rejects ACCEPTED with an explicit execution error", () => {
    expect(
      transactionState({
        statusName: "ACCEPTED",
        txExecutionResultName: "FINISHED_WITH_ERROR",
        txId: hash,
      } as unknown as GenLayerTransaction).state,
    ).toBe("FAILED");
  });

  it("contains no appeal or finalization polling state in the transaction result", () => {
    const result = transactionState({
      statusName: "ACCEPTED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
      txId: hash,
    } as unknown as GenLayerTransaction);
    expect(Object.keys(result)).not.toContain("appeal");
    expect(Object.keys(result)).not.toContain("finalization");
  });
});

describe("retry and cooldown policy", () => {
  it("retries temporary reads with 1, 2, and 4 second delays", async () => {
    const sleep = vi.fn(async () => undefined);
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("RPC timeout"))
      .mockRejectedValueOnce(new Error("503 temporarily unavailable"))
      .mockRejectedValueOnce(new Error("incomplete response"))
      .mockResolvedValue("ok");
    await expect(retryRead(read, sleep)).resolves.toBe("ok");
    expect(sleep.mock.calls).toEqual([[1_000], [2_000], [4_000]]);
  });

  it("does not retry a permanent read error", async () => {
    const sleep = vi.fn(async () => undefined);
    const read = vi.fn(async () => {
      throw new Error("invalid market ID");
    });
    await expect(retryRead(read, sleep)).rejects.toThrow("invalid market");
    expect(read).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("moves a failed submission into the two-minute retry cooldown", async () => {
    const h = harness();
    vi.mocked(h.writer.submit).mockRejectedValueOnce(new Error("gas estimate rejected"));
    await h.run();
    const job = await h.store.getJob("1");
    expect(job?.state).toBe("RETRY_WAIT");
    expect(job?.nextRetryAt).toBe(1_120);
  });

  it("does not retry a submission whose broadcast status is uncertain", async () => {
    const h = harness();
    vi.mocked(h.writer.submit).mockRejectedValueOnce(
      new SubmissionUncertainError(),
    );
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("FAILED_ATTENTION");
    h.setNow(2_000);
    await h.run();
    expect(h.writer.submit).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed write before its cooldown", async () => {
    const h = harness();
    vi.mocked(h.writer.submit).mockRejectedValueOnce(new Error("rejected"));
    await h.run();
    h.setNow(1_119);
    await h.run();
    expect(h.writer.submit).toHaveBeenCalledTimes(1);
  });

  it("uses 2, 5, and 15 minute cooldowns then requires attention", async () => {
    const h = harness();
    vi.mocked(h.writer.submit).mockRejectedValue(new Error("rejected"));
    await h.run();
    expect((await h.store.getJob("1"))?.nextRetryAt).toBe(1_120);
    h.setNow(1_120);
    await h.run();
    expect((await h.store.getJob("1"))?.nextRetryAt).toBe(1_420);
    h.setNow(1_420);
    await h.run();
    expect((await h.store.getJob("1"))?.nextRetryAt).toBe(2_320);
    h.setNow(2_320);
    await h.run();
    expect((await h.store.getJob("1"))?.state).toBe("FAILED_ATTENTION");
    expect(h.writer.submit).toHaveBeenCalledTimes(4);
  });
});

describe("public endpoints and secret safety", () => {
  function env(): Env {
    return {
      MERCORA_CONTRACT_ADDRESS: CONTRACT,
      MERCORA_OPERATOR_ADDRESS: OPERATOR,
      MERCORA_OPERATOR_PRIVATE_KEY: `0x${"1".repeat(64)}`,
      MERCORA_ADMIN_TOKEN: "admin-secret",
      GENLAYER_NETWORK: "testnet-bradbury",
      GENLAYER_RPC: "https://rpc-bradbury.genlayer.com",
      SETTLEMENT_COORDINATOR: {} as DurableObjectNamespace,
    };
  }

  it("/run requires the admin token", async () => {
    const response = await worker.fetch(new Request("https://worker.test/run", {
      method: "POST",
    }), env());
    expect(response.status).toBe(401);
  });

  it("/health exposes operational data but no secrets", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/health"),
      env(),
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain(CONTRACT);
    expect(body).not.toContain("admin-secret");
    expect(body).not.toContain("1".repeat(64));
  });

  it("/status exposes no private key or admin token", async () => {
    const values = new Map<string, unknown>();
    const storage = {
      get: async <T,>(key: string) => values.get(key) as T | undefined,
      put: async <T,>(key: string, value: T) => {
        values.set(key, value);
      },
      transaction: async <T,>(
        closure: (transaction: {
          get<V>(key: string): Promise<V | undefined>;
          put<V>(key: string, value: V): Promise<void>;
        }) => Promise<T>,
      ) => closure(storage),
    };
    const coordinator = new SettlementCoordinator(
      { storage } as unknown as DurableObjectState,
      env(),
    );
    const response = await coordinator.fetch(
      new Request("https://coordinator.test/status"),
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).not.toContain("admin-secret");
    expect(body).not.toContain("1".repeat(64));
  });

  it("structured logs never include signer material", async () => {
    const h = harness();
    await h.run();
    const output = JSON.stringify([
      ...vi.mocked(h.logger.log).mock.calls,
      ...vi.mocked(h.logger.error).mock.calls,
    ]);
    expect(output).not.toContain("private");
    expect(output).not.toContain("secret");
  });

  it("does not call exchange APIs or calculate a result", async () => {
    const h = harness();
    await h.run();
    expect(JSON.stringify(vi.mocked(h.writer.submit).mock.calls)).not.toMatch(
      /binance|bybit|gate|mexc|bitget|UP|DOWN/i,
    );
  });
});
