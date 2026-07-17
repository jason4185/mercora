import type { CalldataEncodable, GenLayerTransaction, TransactionHash } from "genlayer-js/types";
import type { Address, EIP1193Provider } from "viem";
import { createWriteClient, MERCORA_CONTRACT_ADDRESS, readClient } from "@/config/mercora";
import {
  parseConfiguration,
  parseCreationValidation,
  parseIdPage,
  parseMarket,
  parseMarketLookup,
  parseProbabilities,
  parseProtocolStats,
  parseUserMarketIds,
  parseUserPosition,
  parseUserMarketStatus,
} from "./contract-parsers";

type ReadMethod =
  | "get_market"
  | "market_exists"
  | "get_market_count"
  | "get_market_display_status"
  | "is_market_ready_for_settlement"
  | "get_due_market_ids"
  | "get_active_market_ids"
  | "get_market_ids"
  | "get_completed_market_ids"
  | "get_market_probabilities_bps"
  | "get_user_position"
  | "get_user_market_ids"
  | "get_user_market_ids_page"
  | "get_user_market_status"
  | "get_claimable_amount"
  | "get_refundable_amount"
  | "get_market_id_by_key"
  | "validate_market_creation"
  | "get_market_configuration"
  | "get_protocol_stats";

type WriteMethod =
  | "create_market"
  | "place_bet"
  | "claim_winnings"
  | "claim_refund"
  | "settle_market";

export type MarketPageKind = "all" | "active" | "due" | "completed";
export const marketPageReadMethod: Record<MarketPageKind, ReadMethod> = {
  all: "get_market_ids",
  active: "get_active_market_ids",
  due: "get_due_market_ids",
  completed: "get_completed_market_ids",
};

async function read(functionName: ReadMethod, args: CalldataEncodable[] = []) {
  return readClient.readContract({
    address: MERCORA_CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  });
}

export const mercoraContract = {
  getSchema: () => readClient.getContractSchema(MERCORA_CONTRACT_ADDRESS),
  marketExists: async (marketId: bigint) => Boolean(await read("market_exists", [marketId])),
  getMarketCount: async () => BigInt((await read("get_market_count")) as string | number | bigint),
  getMarketDisplayStatus: async (marketId: bigint) =>
    String(await read("get_market_display_status", [marketId])),
  getMarket: async (marketId: bigint) => {
    const [market, display] = await Promise.all([
      read("get_market", [marketId]),
      read("get_market_display_status", [marketId]),
    ]);
    return parseMarket(market, String(display));
  },
  getMarketIds: async (cursor: bigint, limit: bigint) =>
    parseIdPage(await read("get_market_ids", [cursor, limit])),
  getActiveMarketIds: async (cursor: bigint, limit: bigint) =>
    parseIdPage(await read("get_active_market_ids", [cursor, limit])),
  getDueMarketIds: async (cursor: bigint, limit: bigint) =>
    parseIdPage(await read("get_due_market_ids", [cursor, limit])),
  getCompletedMarketIds: async (cursor: bigint, limit: bigint) =>
    parseIdPage(await read("get_completed_market_ids", [cursor, limit])),
  getMarketIdsPage: async (kind: MarketPageKind, cursor: bigint, limit: bigint) =>
    parseIdPage(await read(marketPageReadMethod[kind], [cursor, limit])),
  getMarketProbabilities: async (marketId: bigint) =>
    parseProbabilities(await read("get_market_probabilities_bps", [marketId])),
  getUserMarketStatus: async (marketId: bigint, wallet: string) =>
    parseUserMarketStatus(await read("get_user_market_status", [marketId, wallet])),
  getUserPosition: async (marketId: bigint, wallet: string) =>
    parseUserPosition(await read("get_user_position", [marketId, wallet])),
  getUserMarketIds: async (wallet: string) =>
    parseUserMarketIds(await read("get_user_market_ids", [wallet])),
  getUserMarketIdsPage: async (wallet: string, cursor: bigint, limit: bigint) =>
    parseIdPage(await read("get_user_market_ids_page", [wallet, cursor, limit])),
  getClaimableAmount: async (marketId: bigint, wallet: string) =>
    BigInt((await read("get_claimable_amount", [marketId, wallet])) as string | number | bigint),
  getRefundableAmount: async (marketId: bigint, wallet: string) =>
    BigInt((await read("get_refundable_amount", [marketId, wallet])) as string | number | bigint),
  getMarketConfiguration: async () => parseConfiguration(await read("get_market_configuration")),
  getProtocolStats: async () => parseProtocolStats(await read("get_protocol_stats")),
  validateMarketCreation: async (asset: string, candleStart: bigint) =>
    parseCreationValidation(await read("validate_market_creation", [asset, candleStart])),
  getMarketIdByKey: async (asset: string, candleStart: bigint) =>
    parseMarketLookup(await read("get_market_id_by_key", [asset, candleStart])),
  isMarketReady: async (marketId: bigint) =>
    Boolean(await read("is_market_ready_for_settlement", [marketId])),
};

export type WriteState = { hash: TransactionHash; receipt: GenLayerTransaction };
export type WriteCallbacks = {
  onSubmitted?: (hash: TransactionHash) => void;
};

export class SubmittedTransactionError extends Error {
  constructor(public readonly hash: TransactionHash) {
    super("Your transaction was submitted and is still processing.");
  }
}

function transactionHash(value: unknown): TransactionHash {
  if (typeof value === "string" && value.startsWith("0x")) return value as TransactionHash;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const hash = obj.hash ?? obj.txId ?? obj.transaction_hash;
    if (typeof hash === "string" && hash.startsWith("0x")) return hash as TransactionHash;
  }
  throw new Error("The network did not return a transaction hash.");
}

async function write(
  address: Address,
  provider: EIP1193Provider,
  functionName: WriteMethod,
  args: CalldataEncodable[],
  value = 0n,
  callbacks?: WriteCallbacks,
): Promise<WriteState> {
  const client = createWriteClient(address, provider);
  const submitted = await client.writeContract({
    address: MERCORA_CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  const hash = transactionHash(submitted);
  callbacks?.onSubmitted?.(hash);
  let receipt: GenLayerTransaction;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash,
      retries: 90,
      interval: 4_000,
    });
  } catch (error) {
    console.error("GenLayer confirmation wait did not finish", error);
    throw new SubmittedTransactionError(hash);
  }
  if (receipt.txExecutionResultName === "FINISHED_WITH_ERROR" || receipt.resultName === "FAILURE") {
    console.error("GenLayer transaction failed", receipt);
    throw new Error("The network rejected this transaction.");
  }
  return { hash, receipt };
}

export const mercoraCalls = {
  createMarket: (asset: string, candleStart: bigint) =>
    ({ functionName: "create_market", args: [asset, candleStart], value: 0n }) as const,
  placeBet: (marketId: bigint, position: "UP" | "DOWN", value: bigint) =>
    ({ functionName: "place_bet", args: [marketId, position], value }) as const,
  claimWinnings: (marketId: bigint) =>
    ({ functionName: "claim_winnings", args: [marketId], value: 0n }) as const,
  claimRefund: (marketId: bigint) =>
    ({ functionName: "claim_refund", args: [marketId], value: 0n }) as const,
  settleMarket: (marketId: bigint) =>
    ({ functionName: "settle_market", args: [marketId], value: 0n }) as const,
};

export const mercoraWrites = {
  placeBet: (
    address: Address,
    provider: EIP1193Provider,
    marketId: bigint,
    position: "UP" | "DOWN",
    value: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.placeBet(marketId, position, value);
    return write(address, provider, call.functionName, [...call.args], call.value, callbacks);
  },
  createMarket: (
    address: Address,
    provider: EIP1193Provider,
    asset: string,
    candleStart: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.createMarket(asset, candleStart);
    return write(address, provider, call.functionName, [...call.args], call.value, callbacks);
  },
  claimWinnings: (
    address: Address,
    provider: EIP1193Provider,
    marketId: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.claimWinnings(marketId);
    return write(address, provider, call.functionName, [...call.args], call.value, callbacks);
  },
  claimRefund: (
    address: Address,
    provider: EIP1193Provider,
    marketId: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.claimRefund(marketId);
    return write(address, provider, call.functionName, [...call.args], call.value, callbacks);
  },
  settleMarket: (
    address: Address,
    provider: EIP1193Provider,
    marketId: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.settleMarket(marketId);
    return write(address, provider, call.functionName, [...call.args], call.value, callbacks);
  },
};
