export interface Logger { log(message: string, data?: unknown): void; error(message: string, data?: unknown): void }
export interface DuePage { market_ids: string[]; next_cursor: string; has_more: boolean }
export interface MarketReader { due(cursor: number, limit: number): Promise<DuePage>; market(id: string): Promise<{ status: string; display_status?: string }> }
export interface SettlementWriter { settle(id: string): Promise<{ evmHash: string; genlayerHash: string; finalStatus: string }> }
export interface Lock { acquire(id: string): Promise<boolean>; release(id: string): Promise<void> }

export interface EngineOptions { pageSize: number; retries: number }

function transient(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return ["timeout", "temporar", "429", "502", "503", "504", "network", "fetch"].some(token => text.includes(token));
}

async function retry<T>(work: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0;
  while (true) {
    try { return await work(); }
    catch (error) {
      if (attempt >= retries || !transient(error)) throw error;
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

export async function settleDueMarkets(reader: MarketReader, writer: SettlementWriter, lock: Lock, logger: Logger, options: EngineOptions): Promise<void> {
  let cursor = 0;
  while (true) {
    const page = await retry(() => reader.due(cursor, options.pageSize), options.retries);
    for (const id of page.market_ids) {
      if (!await lock.acquire(id)) { logger.log("settlement already in progress", { marketId: id }); continue; }
      try {
        const market = await retry(() => reader.market(id), options.retries);
        if (market.status !== "OPEN") { logger.log("skipping non-open market", { marketId: id, status: market.status }); continue; }
        const result = await retry(() => writer.settle(id), options.retries);
        logger.log("settlement finalized", { marketId: id, ...result });
      } catch (error) { logger.error("settlement failed", { marketId: id, error: String(error) }); }
      finally { await lock.release(id); }
    }
    if (!page.has_more) return;
    const next = Number(page.next_cursor);
    if (!Number.isSafeInteger(next) || next <= cursor) throw new Error("invalid due-market next_cursor");
    cursor = next;
  }
}
