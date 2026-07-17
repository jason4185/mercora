import {
  abi,
  chains,
  createAccount,
  createClient,
} from "genlayer-js";
import {
  executionResultNumberToName,
  transactionsStatusNumberToName,
  type CalldataEncodable,
  type GenLayerTransaction,
} from "genlayer-js/types";
import { encodeFunctionData, parseEventLogs, type Hex } from "viem";
import type {
  MarketReader,
  MarketRecord,
  ProtocolStats,
  SettlementWriter,
  TransactionCheck,
  TransactionReader,
} from "./engine";
import { SubmissionUncertainError } from "./engine";

const addTransactionAbi = [
  {
    type: "function",
    name: "addTransaction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_recipient", type: "address" },
      { name: "_numOfInitialValidators", type: "uint256" },
      { name: "_maxRotations", type: "uint256" },
      { name: "_txData", type: "bytes" },
      { name: "_validUntil", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

interface RpcReceipt {
  status: Hex;
  logs: Array<{ address: Hex; data: Hex; topics: Hex[] }>;
}

interface RpcBlock {
  timestamp: Hex;
  gasLimit: Hex;
}

async function rpc<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response.json()) as {
    result?: T;
    error?: { message?: string };
  };
  if (!response.ok || payload.error || payload.result === undefined) {
    throw new Error(payload.error?.message || `RPC request failed (${response.status})`);
  }
  return payload.result;
}

function parseJson<T>(value: CalldataEncodable, label: string): T {
  if (typeof value !== "string") throw new Error(`incomplete ${label} response`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`temporary decode failure for ${label}`);
  }
}

type TransactionFields = Record<string, unknown>;

function object(value: unknown): TransactionFields | null {
  return value !== null && typeof value === "object"
    ? (value as TransactionFields)
    : null;
}

function transactionFields(transaction: GenLayerTransaction): TransactionFields[] {
  const root = transaction as unknown as TransactionFields;
  return [
    root,
    object(root.transaction),
    object(root.data),
    object(object(root.data)?.transaction),
  ].filter((value): value is TransactionFields => value !== null);
}

function field(fields: TransactionFields[], names: string[]): unknown {
  for (const source of fields) {
    for (const name of names) {
      if (source[name] !== undefined && source[name] !== null) return source[name];
    }
  }
  return undefined;
}

function normalizedStatus(fields: TransactionFields[]): string {
  const value = field(fields, ["statusName", "status_name", "status"]);
  if (typeof value === "number" || /^\d+$/.test(String(value ?? ""))) {
    return String(
      transactionsStatusNumberToName[
        String(value) as keyof typeof transactionsStatusNumberToName
      ] || value,
    ).toUpperCase();
  }
  return String(value || "").toUpperCase();
}

function normalizedExecution(fields: TransactionFields[]): string {
  const value = field(fields, [
    "txExecutionResultName",
    "tx_execution_result_name",
    "executionResultName",
    "execution_result_name",
    "txExecutionResult",
    "tx_execution_result",
    "executionResult",
    "execution_result",
  ]);
  if (typeof value === "number" || /^\d+$/.test(String(value ?? ""))) {
    return String(
      executionResultNumberToName[
        String(value) as keyof typeof executionResultNumberToName
      ] || value,
    ).toUpperCase();
  }
  return String(value || "").toUpperCase();
}

export function transactionState(
  transaction: GenLayerTransaction,
): TransactionCheck {
  const fields = transactionFields(transaction);
  const status = normalizedStatus(fields);
  const execution = normalizedExecution(fields);
  const hash = String(transaction.hash || transaction.txId || "");
  const accepted = status === "ACCEPTED" || status === "FINALIZED";
  if (accepted && execution === "FINISHED_WITH_RETURN") {
    return { state: "SUCCESS", genlayerHash: hash };
  }
  if (
    status === "CANCELED" ||
    status === "UNDETERMINED" ||
    (accepted && execution === "FINISHED_WITH_ERROR")
  ) {
    return {
      state: "FAILED",
      genlayerHash: hash,
      reason: `GenLayer execution ended with ${status || "unknown status"} and ${
        execution || "unknown execution result"
      }`,
    };
  }
  return { state: "PROCESSING", genlayerHash: hash || undefined };
}

export function makeReader(endpoint: string, contract: Hex): MarketReader {
  const client = createClient({ chain: chains.testnetBradbury, endpoint });
  const read = (functionName: string, args: CalldataEncodable[] = []) =>
    client.readContract({ address: contract, functionName, args });

  return {
    async due(cursor, limit) {
      return parseJson(
        await read("get_due_market_ids", [cursor, limit]),
        "due-market page",
      );
    },
    async market(id) {
      return parseJson<MarketRecord>(
        await read("get_market", [BigInt(id)]),
        "market",
      );
    },
    async ready(id) {
      const value = await read("is_market_ready_for_settlement", [BigInt(id)]);
      if (typeof value !== "boolean") throw new Error("incomplete readiness response");
      return value;
    },
    async displayStatus(id) {
      const value = await read("get_market_display_status", [BigInt(id)]);
      if (typeof value !== "string") throw new Error("incomplete display-status response");
      return value;
    },
    async protocolStats() {
      return parseJson<ProtocolStats>(await read("get_protocol_stats"), "protocol stats");
    },
  };
}

export function makeGasSafeWriter(
  endpoint: string,
  contract: Hex,
  privateKey: Hex,
  marginPercent = 30n,
): SettlementWriter {
  if (marginPercent < 20n || marginPercent > 50n) {
    throw new Error("GAS_MARGIN_PERCENT must be between 20 and 50");
  }
  const chain = chains.testnetBradbury;
  const consensus = chain.consensusMainContract;
  if (!consensus) throw new Error("Bradbury consensus metadata is unavailable");
  const account = createAccount(privateKey);

  return {
    async submit(id) {
      const call = abi.calldata.encode(
        abi.calldata.makeCalldataObject("settle_market", [BigInt(id)], undefined),
      );
      const transactionData = abi.transactions.serialize([call, false]);
      const latest = await rpc<RpcBlock>(endpoint, "eth_getBlockByNumber", [
        "latest",
        false,
      ]);
      const validUntil = BigInt(latest.timestamp) + 3_600n;
      const data = encodeFunctionData({
        abi: addTransactionAbi,
        functionName: "addTransaction",
        args: [
          account.address,
          contract,
          BigInt(chain.defaultNumberOfInitialValidators),
          BigInt(chain.defaultConsensusMaxRotations),
          transactionData,
          validUntil,
        ],
      });
      const request = {
        from: account.address,
        to: consensus.address,
        data,
        value: "0x0",
      };
      const estimate = BigInt(await rpc<Hex>(endpoint, "eth_estimateGas", [request]));
      const gas = (estimate * (100n + marginPercent) + 99n) / 100n;
      if (gas >= BigInt(latest.gasLimit)) {
        throw new Error("padded settlement gas exceeds the current block limit");
      }
      const nonce = BigInt(
        await rpc<Hex>(endpoint, "eth_getTransactionCount", [
          account.address,
          "pending",
        ]),
      );
      const gasPrice = BigInt(await rpc<Hex>(endpoint, "eth_gasPrice", []));
      const signed = await account.signTransaction({
        account,
        to: consensus.address,
        data,
        value: 0n,
        gas,
        gasPrice,
        nonce: Number(nonce),
        chainId: chain.id,
        type: "legacy",
      });
      let transactionHash: Hex;
      try {
        transactionHash = await rpc<Hex>(endpoint, "eth_sendRawTransaction", [
          signed,
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (
          message.includes("timeout") ||
          message.includes("fetch") ||
          message.includes("network") ||
          message.includes("connection")
        ) {
          throw new SubmissionUncertainError();
        }
        throw error;
      }
      return { transactionHash };
    },
  };
}

export function makeTransactionReader(endpoint: string): TransactionReader {
  const chain = chains.testnetBradbury;
  const consensus = chain.consensusMainContract;
  if (!consensus) throw new Error("Bradbury consensus metadata is unavailable");
  const client = createClient({ chain, endpoint });

  return {
    async check(transactionHash, savedGenlayerHash) {
      let genlayerHash = savedGenlayerHash;
      if (!genlayerHash) {
        const receipt = await rpc<RpcReceipt | null>(
          endpoint,
          "eth_getTransactionReceipt",
          [transactionHash],
        );
        if (!receipt) return { state: "PROCESSING" };
        if (receipt.status !== "0x1") {
          return { state: "FAILED", reason: "underlying transaction reverted" };
        }
        const events = parseEventLogs({
          abi: consensus.abi,
          logs: receipt.logs as never,
          strict: false,
        }) as Array<{ eventName?: string; args?: Record<string, unknown> }>;
        const event = events.find(
          (item) =>
            item.eventName === "NewTransaction" ||
            item.eventName === "CreatedTransaction",
        );
        genlayerHash = String(event?.args?.txId || "");
        if (!genlayerHash.startsWith("0x")) {
          throw new Error("temporarily unavailable GenLayer transaction identifier");
        }
      }
      const transaction = await client.getTransaction({
        hash: genlayerHash as `0x${string}` & { length: 66 },
      });
      return transactionState(transaction);
    },
  };
}
