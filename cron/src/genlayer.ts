import { abi, chains, createAccount, createClient } from "genlayer-js";
import { encodeFunctionData, parseEventLogs, type Hex } from "viem";
import type { MarketReader, SettlementWriter } from "./engine";

const addTransactionAbi = [{
  type: "function", name: "addTransaction", stateMutability: "nonpayable",
  inputs: [{ name: "_sender", type: "address" }, { name: "_recipient", type: "address" }, { name: "_numOfInitialValidators", type: "uint256" }, { name: "_maxRotations", type: "uint256" }, { name: "_txData", type: "bytes" }, { name: "_validUntil", type: "uint256" }], outputs: [],
}] as const;

interface RpcReceipt { status: Hex; logs: Array<{ address: Hex; data: Hex; topics: Hex[] }>; gasUsed: Hex; transactionHash: Hex }

async function rpc<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const payload = await response.json() as { result?: T; error?: { message: string } };
  if (!response.ok || payload.error || payload.result === undefined) throw new Error(payload.error?.message || `RPC ${response.status}`);
  return payload.result;
}

async function waitReceipt(endpoint: string, hash: Hex): Promise<RpcReceipt> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const receipt = await rpc<RpcReceipt | null>(endpoint, "eth_getTransactionReceipt", [hash]);
    if (receipt) return receipt;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`timeout waiting for EVM receipt ${hash}`);
}

export function makeReader(endpoint: string, contract: Hex): MarketReader {
  const client = createClient({ chain: chains.testnetBradbury, endpoint });
  return {
    async due(cursor, limit) { return JSON.parse(String(await client.readContract({ address: contract, functionName: "get_due_market_ids", args: [cursor, limit] }))) as { market_ids: string[]; next_cursor: string; has_more: boolean }; },
    async market(id) { return JSON.parse(String(await client.readContract({ address: contract, functionName: "get_market", args: [BigInt(id)] }))) as { status: string; display_status?: string }; },
  };
}

export function makeGasSafeWriter(endpoint: string, contract: Hex, privateKey: Hex, marginPercent = 30n): SettlementWriter {
  if (marginPercent < 20n || marginPercent > 50n) throw new Error("GAS_MARGIN_PERCENT must be between 20 and 50");
  const chain = chains.testnetBradbury;
  const consensus = chain.consensusMainContract;
  if (!consensus) throw new Error("Bradbury consensus contract metadata is unavailable");
  const account = createAccount(privateKey);
  const client = createClient({ chain, endpoint, account });
  return { async settle(id) {
    const call = abi.calldata.encode(abi.calldata.makeCalldataObject("settle_market", [BigInt(id)], undefined));
    const transactionData = abi.transactions.serialize([call, false]);
    const latest = await rpc<{ timestamp: Hex; gasLimit: Hex }>(endpoint, "eth_getBlockByNumber", ["latest", false]);
    const validUntil = BigInt(latest.timestamp) + 3600n;
    const data = encodeFunctionData({ abi: addTransactionAbi, functionName: "addTransaction", args: [account.address, contract, BigInt(chain.defaultNumberOfInitialValidators), BigInt(chain.defaultConsensusMaxRotations), transactionData, validUntil] });
    const request = { from: account.address, to: consensus.address, data, value: "0x0" };
    const estimate = BigInt(await rpc<Hex>(endpoint, "eth_estimateGas", [request]));
    const gas = (estimate * (100n + marginPercent) + 99n) / 100n;
    if (gas >= BigInt(latest.gasLimit)) throw new Error(`padded gas ${gas} exceeds block limit`);
    const nonce = BigInt(await rpc<Hex>(endpoint, "eth_getTransactionCount", [account.address, "pending"]));
    const gasPrice = BigInt(await rpc<Hex>(endpoint, "eth_gasPrice", []));
    const signed = await account.signTransaction({ account, to: consensus.address, data, value: 0n, gas, gasPrice, nonce: Number(nonce), chainId: chain.id, type: "legacy" });
    const evmHash = await rpc<Hex>(endpoint, "eth_sendRawTransaction", [signed]);
    const receipt = await waitReceipt(endpoint, evmHash);
    if (receipt.status !== "0x1") throw new Error(`underlying EVM revert ${evmHash}; no automatic resubmission`);
    const events = parseEventLogs({ abi: consensus.abi, logs: receipt.logs as never, strict: false }) as Array<{ eventName?: string; args?: Record<string, unknown> }>;
    const event = events.find(item => item.eventName === "NewTransaction" || item.eventName === "CreatedTransaction");
    const genlayerHash = String(event?.args?.txId || "");
    if (!genlayerHash.startsWith("0x")) throw new Error(`GenLayer transaction hash missing from ${evmHash}`);
    const final = await client.waitForTransactionReceipt({ hash: genlayerHash as never, status: "FINALIZED" as never, retries: 120, interval: 3000 });
    return { evmHash, genlayerHash, finalStatus: String(final.status) };
  } };
}
