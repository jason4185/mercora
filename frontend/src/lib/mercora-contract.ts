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

function readKey(args: CalldataEncodable[]) {
  return JSON.stringify(args, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}

async function read(functionName: ReadMethod, args: CalldataEncodable[] = []) {
  const key = `${functionName}:${readKey(args)}`;
  const existing = inFlightReads.get(key);
  if (existing) return existing;
  const request = readClient.readContract({
    address: MERCORA_CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  });
  inFlightReads.set(key, request);
  try {
    return await request;
  } finally {
    inFlightReads.delete(key);
  }
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
