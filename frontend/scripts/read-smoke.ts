import { mercoraContract } from "../src/lib/mercora-contract";
import { MERCORA_CONTRACT_ADDRESS, readClient } from "../src/config/mercora";

const schema = await readClient.getContractSchema(MERCORA_CONTRACT_ADDRESS);
const methods = Object.keys(schema.methods);
const expectedMethods = [
  "set_market_operator",
  "create_market",
  "place_bet",
  "settle_market",
  "claim_winnings",
  "claim_refund",
  "get_market",
  "market_exists",
  "get_market_count",
  "get_market_display_status",
  "is_market_ready_for_settlement",
  "get_due_market_ids",
  "get_active_market_ids",
  "get_market_ids",
  "get_completed_market_ids",
  "get_market_probabilities_bps",
  "get_user_position",
  "get_user_market_ids",
  "get_user_market_ids_page",
  "get_user_market_status",
  "get_claimable_amount",
  "get_refundable_amount",
  "get_market_id_by_key",
  "validate_market_creation",
  "get_market_configuration",
  "get_protocol_stats",
];
const missing = expectedMethods.filter((method) => !methods.includes(method));
if (missing.length > 0) throw new Error(`Deployed schema is missing: ${missing.join(", ")}`);
const configuration = await mercoraContract.getMarketConfiguration();
const stats = await mercoraContract.getProtocolStats();
const marketCount = await mercoraContract.getMarketCount();
const page = await mercoraContract.getMarketIds(0n, 5n);
const active = await mercoraContract.getActiveMarketIds(0n, 5n);
const due = await mercoraContract.getDueMarketIds(0n, 5n);
const completed = await mercoraContract.getCompletedMarketIds(0n, 5n);
const userIds = await mercoraContract.getUserMarketIds(stats.owner);
const userPage = await mercoraContract.getUserMarketIdsPage(stats.owner, 0n, 5n);
const previewStart = BigInt(Math.floor(Date.now() / 3_600_000) + 2) * 3_600n;
const validation = await mercoraContract.validateMarketCreation("BTC", previewStart);
const lookup = await mercoraContract.getMarketIdByKey("BTC", previewStart);

console.log(`schema: ok (${methods.length} methods)`);
console.log(`configuration: ok (${configuration.supported_assets.join(", ")})`);
console.log(`protocol_stats: ok (${stats.market_count} markets)`);
console.log(`market_count: ok (${marketCount})`);
console.log(`market_ids: ok (${page.market_ids.length} returned)`);
console.log(`active_market_ids: ok (${active.market_ids.length} returned)`);
console.log(`due_market_ids: ok (${due.market_ids.length} returned)`);
console.log(`completed_market_ids: ok (${completed.market_ids.length} returned)`);
console.log(`user_market_ids: ok (${userIds.market_ids.length} returned)`);
console.log(`user_market_ids_page: ok (${userPage.market_ids.length} returned)`);
console.log(`creation_validation: ok (${validation.reason})`);
console.log(`market_lookup: ok (${lookup.exists ? lookup.market_id : "not found"})`);

if (page.market_ids[0]) {
  const id = BigInt(page.market_ids[0]);
  const exists = await mercoraContract.marketExists(id);
  await mercoraContract.getMarket(id);
  const display = await mercoraContract.getMarketDisplayStatus(id);
  await mercoraContract.getMarketProbabilities(id);
  await mercoraContract.getUserPosition(id, stats.owner);
  await mercoraContract.getUserMarketStatus(id, stats.owner);
  await mercoraContract.getClaimableAmount(id, stats.owner);
  await mercoraContract.getRefundableAmount(id, stats.owner);
  await mercoraContract.isMarketReady(id);
  console.log(`market_exists: ok (${exists})`);
  console.log(`market: ok (${id})`);
  console.log(`display_status: ok (${display})`);
  console.log(`probabilities: ok (${id})`);
  console.log(`user_position: ok (${id})`);
  console.log(`user_market_status: ok (${id})`);
  console.log(`claimable_amount: ok (${id})`);
  console.log(`refundable_amount: ok (${id})`);
  console.log(`market_ready: ok (${id})`);
} else {
  console.log("market_exists: skipped (no deployed markets)");
  console.log("market: skipped (no deployed markets)");
  console.log("display_status: skipped (no deployed markets)");
  console.log("probabilities: skipped (no deployed markets)");
  console.log("user_position: skipped (no deployed markets)");
  console.log("user_market_status: skipped (no deployed markets)");
  console.log("claimable_amount: skipped (no deployed markets)");
  console.log("refundable_amount: skipped (no deployed markets)");
  console.log("market_ready: skipped (no deployed markets)");
}
