import type { CalldataEncodable } from "genlayer-js/types";
import type { Address } from "viem";
import type { Connector } from "wagmi";
import { MERCORA_CONTRACT_ADDRESS, readClient } from "@/config/mercora";
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
import {
  SubmittedTransactionError,
  walletErrorMessage,
  writeWithSelectedWallet,
  type WalletWriteCallbacks,
  type WalletWriteState,
} from "./wallet-write";
import { traceContractRead, traceNow, type ContractReadTraceMeta } from "./contract-read-trace";

export { SubmittedTransactionError, walletErrorMessage };

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

const inFlightReads = new Map<string, Promise<unknown>>();
const MAX_CONCURRENT_CONTRACT_READS = 4;
let activeContractReads = 0;
const contractReadQueue: Array<() => void> = [];

function readKey(args: CalldataEncodable[]) {
  return JSON.stringify(args, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}

function scheduleContractRead<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeContractReads += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeContractReads -= 1;
          contractReadQueue.shift()?.();
        });
    };

    if (activeContractReads < MAX_CONCURRENT_CONTRACT_READS) run();
    else contractReadQueue.push(run);
  });
}

async function read(
  functionName: ReadMethod,
  args: CalldataEncodable[] = [],
  trace?: ContractReadTraceMeta,
) {
  const key = `${functionName}:${readKey(args)}`;
  const existing = inFlightReads.get(key);
  if (existing) {
    const timestamp = new Date().toISOString();
    traceContractRead({
      ...trace,
      method: functionName,
      duplicateInFlight: true,
      status: "deduped",
      startTime: timestamp,
      completionTime: timestamp,
      durationMs: 0,
    });
    return existing;
  }

  const startTime = new Date();
  const start = traceNow();
  let rpcStart = start;
  const request = scheduleContractRead(() => {
    rpcStart = traceNow();
    return readClient.readContract({
      address: MERCORA_CONTRACT_ADDRESS,
      functionName,
      args,
      jsonSafeReturn: true,
    });
  });
  inFlightReads.set(key, request);
  try {
    const result = await request;
    const endTime = new Date();
    const end = traceNow();
    traceContractRead({
      ...trace,
      method: functionName,
      duplicateInFlight: false,
      status: "ok",
      startTime: startTime.toISOString(),
      completionTime: endTime.toISOString(),
      durationMs: Math.round(end - start),
      queuedMs: Math.max(0, Math.round(rpcStart - start)),
    });
    return result;
  } catch (error) {
    const endTime = new Date();
    const end = traceNow();
    traceContractRead({
      ...trace,
      method: functionName,
      duplicateInFlight: false,
      status: "error",
      startTime: startTime.toISOString(),
      completionTime: endTime.toISOString(),
      durationMs: Math.round(end - start),
      queuedMs: Math.max(0, Math.round(rpcStart - start)),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    inFlightReads.delete(key);
  }
}

export const mercoraContract = {
  getSchema: () => readClient.getContractSchema(MERCORA_CONTRACT_ADDRESS),
  marketExists: async (marketId: bigint, trace?: ContractReadTraceMeta) =>
    Boolean(await read("market_exists", [marketId], trace)),
  getMarketCount: async () => BigInt((await read("get_market_count")) as string | number | bigint),
  getMarketDisplayStatus: async (marketId: bigint, trace?: ContractReadTraceMeta) =>
    String(await read("get_market_display_status", [marketId], trace)),
  getMarket: async (marketId: bigint, trace?: ContractReadTraceMeta) => {
    const [market, display] = await Promise.all([
      read("get_market", [marketId], trace),
      read("get_market_display_status", [marketId], trace),
    ]);
    return parseMarket(market, String(display));
  },
  getMarketIds: async (cursor: bigint, limit: bigint, trace?: ContractReadTraceMeta) =>
    parseIdPage(await read("get_market_ids", [cursor, limit], trace)),
  getActiveMarketIds: async (cursor: bigint, limit: bigint, trace?: ContractReadTraceMeta) =>
    parseIdPage(await read("get_active_market_ids", [cursor, limit], trace)),
  getDueMarketIds: async (cursor: bigint, limit: bigint, trace?: ContractReadTraceMeta) =>
    parseIdPage(await read("get_due_market_ids", [cursor, limit], trace)),
  getCompletedMarketIds: async (cursor: bigint, limit: bigint, trace?: ContractReadTraceMeta) =>
    parseIdPage(await read("get_completed_market_ids", [cursor, limit], trace)),
  getMarketIdsPage: async (
    kind: MarketPageKind,
    cursor: bigint,
    limit: bigint,
    trace?: ContractReadTraceMeta,
  ) => parseIdPage(await read(marketPageReadMethod[kind], [cursor, limit], trace)),
  getMarketProbabilities: async (marketId: bigint, trace?: ContractReadTraceMeta) =>
    parseProbabilities(await read("get_market_probabilities_bps", [marketId], trace)),
  getUserMarketStatus: async (marketId: bigint, wallet: string, trace?: ContractReadTraceMeta) =>
    parseUserMarketStatus(await read("get_user_market_status", [marketId, wallet], trace)),
  getUserPosition: async (marketId: bigint, wallet: string, trace?: ContractReadTraceMeta) =>
    parseUserPosition(await read("get_user_position", [marketId, wallet], trace)),
  getUserMarketIds: async (wallet: string, trace?: ContractReadTraceMeta) =>
    parseUserMarketIds(await read("get_user_market_ids", [wallet], trace)),
  getUserMarketIdsPage: async (
    wallet: string,
    cursor: bigint,
    limit: bigint,
    trace?: ContractReadTraceMeta,
  ) => parseIdPage(await read("get_user_market_ids_page", [wallet, cursor, limit], trace)),
  getClaimableAmount: async (marketId: bigint, wallet: string, trace?: ContractReadTraceMeta) =>
    BigInt(
      (await read("get_claimable_amount", [marketId, wallet], trace)) as string | number | bigint,
    ),
  getRefundableAmount: async (marketId: bigint, wallet: string, trace?: ContractReadTraceMeta) =>
    BigInt(
      (await read("get_refundable_amount", [marketId, wallet], trace)) as string | number | bigint,
    ),
  getMarketConfiguration: async (trace?: ContractReadTraceMeta) =>
    parseConfiguration(await read("get_market_configuration", [], trace)),
  getProtocolStats: async (trace?: ContractReadTraceMeta) =>
    parseProtocolStats(await read("get_protocol_stats", [], trace)),
  validateMarketCreation: async (
    asset: string,
    candleStart: bigint,
    trace?: ContractReadTraceMeta,
  ) => parseCreationValidation(await read("validate_market_creation", [asset, candleStart], trace)),
  getMarketIdByKey: async (asset: string, candleStart: bigint, trace?: ContractReadTraceMeta) =>
    parseMarketLookup(await read("get_market_id_by_key", [asset, candleStart], trace)),
  isMarketReady: async (marketId: bigint, trace?: ContractReadTraceMeta) =>
    Boolean(await read("is_market_ready_for_settlement", [marketId], trace)),
};

export type WriteCallbacks = WalletWriteCallbacks;
export type WriteState = WalletWriteState;

type WalletWriteContext = {
  address: Address;
  connector?: Connector;
  chainId?: number;
};

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
    wallet: WalletWriteContext,
    marketId: bigint,
    position: "UP" | "DOWN",
    value: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.placeBet(marketId, position, value);
    return writeWithSelectedWallet({
      ...wallet,
      operation: "placeBet",
      functionName: call.functionName,
      args: [...call.args],
      value: call.value,
      callbacks,
    });
  },
  createMarket: (
    wallet: WalletWriteContext,
    asset: string,
    candleStart: bigint,
    callbacks?: WriteCallbacks,
  ) => {
    const call = mercoraCalls.createMarket(asset, candleStart);
    return writeWithSelectedWallet({
      ...wallet,
      operation: "createMarket",
      functionName: call.functionName,
      args: [...call.args],
      value: call.value,
      callbacks,
    });
  },
  claimWinnings: (wallet: WalletWriteContext, marketId: bigint, callbacks?: WriteCallbacks) => {
    const call = mercoraCalls.claimWinnings(marketId);
    return writeWithSelectedWallet({
      ...wallet,
      operation: "claimWinnings",
      functionName: call.functionName,
      args: [...call.args],
      value: call.value,
      callbacks,
    });
  },
  claimRefund: (wallet: WalletWriteContext, marketId: bigint, callbacks?: WriteCallbacks) => {
    const call = mercoraCalls.claimRefund(marketId);
    return writeWithSelectedWallet({
      ...wallet,
      operation: "claimRefund",
      functionName: call.functionName,
      args: [...call.args],
      value: call.value,
      callbacks,
    });
  },
  settleMarket: (wallet: WalletWriteContext, marketId: bigint, callbacks?: WriteCallbacks) => {
    const call = mercoraCalls.settleMarket(marketId);
    return writeWithSelectedWallet({
      ...wallet,
      operation: "settleMarket",
      functionName: call.functionName,
      args: [...call.args],
      value: call.value,
      callbacks,
    });
  },
};
