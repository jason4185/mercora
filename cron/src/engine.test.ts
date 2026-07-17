import { describe, expect, it, vi } from "vitest";
import { settleDueMarkets, type Lock, type Logger, type MarketReader, type SettlementWriter } from "./engine";

function harness(pages: string[][], statuses: Record<string, string> = {}) {
  const due = vi.fn(async (cursor: number) => { const index = cursor === 0 ? 0 : 1; const market_ids = pages[index] || []; return { market_ids, next_cursor: String(index === 0 ? 5 : 9), has_more: index === 0 && pages.length > 1 }; });
  const reader: MarketReader = { due, market: vi.fn(async id => ({ status: statuses[id] || "OPEN" })) };
  const writer: SettlementWriter = { settle: vi.fn(async id => ({ evmHash: `evm-${id}`, genlayerHash: `gl-${id}`, finalStatus: "FINALIZED" })) };
  const held = new Set<string>(); const lock: Lock = { acquire: vi.fn(async id => held.has(id) ? false : (held.add(id), true)), release: vi.fn(async id => { held.delete(id); }) };
  const logger: Logger = { log: vi.fn(), error: vi.fn() };
  return { reader, writer, lock, logger, due };
}

describe("settlement worker", () => {
  it("paginates with the contract scan cursor", async () => { const h = harness([["0", "1"], ["2"]]); await settleDueMarkets(h.reader, h.writer, h.lock, h.logger, { pageSize: 2, retries: 0 }); expect(h.writer.settle).toHaveBeenCalledTimes(3); expect(h.due).toHaveBeenLastCalledWith(5, 2); });
  it("skips markets no longer OPEN", async () => { const h = harness([["0"]], { "0": "SETTLED" }); await settleDueMarkets(h.reader, h.writer, h.lock, h.logger, { pageSize: 10, retries: 0 }); expect(h.writer.settle).not.toHaveBeenCalled(); });
  it("retries transient network failures", async () => { const h = harness([["0"]]); vi.mocked(h.writer.settle).mockRejectedValueOnce(new Error("503 temporary")); await settleDueMarkets(h.reader, h.writer, h.lock, h.logger, { pageSize: 10, retries: 1 }); expect(h.writer.settle).toHaveBeenCalledTimes(2); });
  it("avoids duplicate concurrent submission", async () => { const h = harness([["0"]]); vi.mocked(h.lock.acquire).mockResolvedValue(false); await settleDueMarkets(h.reader, h.writer, h.lock, h.logger, { pageSize: 10, retries: 0 }); expect(h.writer.settle).not.toHaveBeenCalled(); });
  it("never sends an outcome", async () => { const h = harness([["7"]]); await settleDueMarkets(h.reader, h.writer, h.lock, h.logger, { pageSize: 10, retries: 0 }); expect(h.writer.settle).toHaveBeenCalledWith("7"); expect(vi.mocked(h.writer.settle).mock.calls[0]).toHaveLength(1); });
});
