import { settleDueMarkets, type Lock, type Logger } from "./engine";
import { makeGasSafeWriter, makeReader } from "./genlayer";

interface Env {
  MERCORA_CONTRACT_ADDRESS: `0x${string}`;
  SIGNER_PRIVATE_KEY: `0x${string}`;
  GENLAYER_RPC: string;
  GENLAYER_NETWORK: string;
  PAGE_SIZE: string;
  GAS_MARGIN_PERCENT: string;
  SETTLEMENT_COORDINATOR: DurableObjectNamespace;
}

const logger: Logger = { log: (message, data) => console.log(JSON.stringify({ level: "info", message, data })), error: (message, data) => console.error(JSON.stringify({ level: "error", message, data })) };

function coordinatorLock(env: Env): Lock {
  const stub = env.SETTLEMENT_COORDINATOR.get(env.SETTLEMENT_COORDINATOR.idFromName("mercora-v2"));
  return {
    async acquire(id) { const response = await stub.fetch(`https://lock.internal/${encodeURIComponent(id)}`, { method: "PUT" }); return response.status === 201; },
    async release(id) { await stub.fetch(`https://lock.internal/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  };
}

async function run(env: Env) {
  if (env.GENLAYER_NETWORK !== "testnet-bradbury") throw new Error("Only testnet-bradbury is configured");
  await settleDueMarkets(makeReader(env.GENLAYER_RPC, env.MERCORA_CONTRACT_ADDRESS), makeGasSafeWriter(env.GENLAYER_RPC, env.MERCORA_CONTRACT_ADDRESS, env.SIGNER_PRIVATE_KEY, BigInt(env.GAS_MARGIN_PERCENT || "30")), coordinatorLock(env), logger, { pageSize: Number(env.PAGE_SIZE || "25"), retries: 2 });
}

export class SettlementCoordinator implements DurableObject {
  private readonly ctx: DurableObjectState;
  constructor(ctx: DurableObjectState, _env: Env) { this.ctx = ctx; }
  async fetch(request: Request): Promise<Response> {
    const id = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (request.method === "PUT") {
      const existing = await this.ctx.storage.get<number>(id);
      if (existing && existing > Date.now()) return new Response("locked", { status: 409 });
      await this.ctx.storage.put(id, Date.now() + 15 * 60_000);
      return new Response("locked", { status: 201 });
    }
    if (request.method === "DELETE") { await this.ctx.storage.delete(id); return new Response(null, { status: 204 }); }
    return new Response("method not allowed", { status: 405 });
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) { ctx.waitUntil(run(env)); },
  async fetch(request: Request, env: Env) { if (new URL(request.url).pathname !== "/health") return new Response("not found", { status: 404 }); return Response.json({ ok: true, network: env.GENLAYER_NETWORK }); },
};
