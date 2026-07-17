import { chains, createClient } from "genlayer-js";

const CONTRACT =
  process.env.MERCORA_CONTRACT_ADDRESS ||
  "0x0A3Fcc4671b6fF0BffBCDab3B744CFf6d5c7ED05";
const ENDPOINT =
  process.env.GENLAYER_RPC || "https://rpc-bradbury.genlayer.com";
const GRACE_SECONDS = Number(
  process.env.MERCORA_EXTRA_SETTLEMENT_GRACE_SECONDS || "180",
);

const client = createClient({ chain: chains.testnetBradbury, endpoint: ENDPOINT });
const read = (functionName, args = []) =>
  client.readContract({ address: CONTRACT, functionName, args });
const json = (value) => JSON.parse(String(value));

const schema = await client.getContractSchema(CONTRACT);
const stats = json(await read("get_protocol_stats"));
const duePage = json(await read("get_due_market_ids", [0, 10]));
const now = Math.floor(Date.now() / 1_000);
const due = [];

for (const marketId of duePage.market_ids) {
  const market = json(await read("get_market", [BigInt(marketId)]));
  const ready = await read("is_market_ready_for_settlement", [BigInt(marketId)]);
  const displayStatus = await read("get_market_display_status", [BigInt(marketId)]);
  const settleAfter = Number(market.settle_after);
  due.push({
    market_id: marketId,
    status: market.status,
    display_status: String(displayStatus),
    contract_ready: ready === true,
    worker_grace_passed:
      Number.isSafeInteger(settleAfter) && now >= settleAfter + GRACE_SECONDS,
  });
}

console.log(
  JSON.stringify(
    {
      network: "testnet-bradbury",
      contract: CONTRACT,
      schema_method_count: Object.keys(schema?.methods || {}).length,
      operator: stats.market_operator,
      market_count: stats.market_count,
      open_market_count: stats.open_market_count,
      due_market_ids: duePage.market_ids,
      due,
      write_performed: false,
    },
    null,
    2,
  ),
);
