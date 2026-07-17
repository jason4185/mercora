import { readFileSync } from "fs";
import keytar from "/opt/homebrew/lib/node_modules/genlayer/node_modules/keytar/lib/keytar.js";
import {
  encodeFunctionData,
  parseEventLogs,
} from "/opt/homebrew/lib/node_modules/genlayer/node_modules/viem/_esm/index.js";
import * as genlayer from "/opt/homebrew/lib/node_modules/genlayer/node_modules/genlayer-js/dist/index.js";

const config = JSON.parse(readFileSync("config/mercora.v2.json", "utf8"));
const RPC = config.rpc_url;
const NETWORK = "testnet-bradbury";
const ACCOUNT_NAME = "mercora-deployer";
const EXPECTED_SENDER = "0xbeed80cd1863fd3aea8a4d73e7fdcbc4eb9b9fa6";
const CONTRACT = config.contracts.focused_crypto_v2_current;
const CONSENSUS = "0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D";
const GAS_MARGIN_PERCENT = 30n;
const SUBMIT = process.env.SUBMIT === "1";
const MARKET_FILE = process.env.MARKET_FILE;
const explicitGasLimit = process.env.GAS_LIMIT
  ? parsePositiveInteger(process.env.GAS_LIMIT, "GAS_LIMIT")
  : undefined;

const chain = genlayer.chains.testnetBradbury;

if (chain.id !== 4221 || chain.consensusMainContract.address.toLowerCase() !== CONSENSUS.toLowerCase()) {
  throw new Error("Installed GenLayer chain metadata does not match testnet-bradbury.");
}
if (config.network !== NETWORK || !/^0x[0-9a-fA-F]{40}$/.test(CONTRACT || "")) {
  throw new Error("Centralized Mercora v2 configuration is missing the Bradbury contract address.");
}
if (!MARKET_FILE) {
  throw new Error("MARKET_FILE is required. No default market will be submitted.");
}

const addTransactionAbiV6 = [{
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
}];

function parsePositiveInteger(value, name) {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${name} must be a positive base-10 integer.`);
  }
  return BigInt(value);
}

function toJson(value) {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item, 2);
}

async function rpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    const error = new Error(payload.error?.message || response.statusText);
    error.rpcError = payload.error;
    throw error;
  }
  return payload.result;
}

function intrinsicGas(data) {
  const bytes = data.slice(2).match(/.{2}/g) || [];
  const zeroBytes = bytes.filter((byte) => byte === "00").length;
  const nonzeroBytes = bytes.length - zeroBytes;
  return {
    inputBytes: bytes.length,
    zeroBytes,
    nonzeroBytes,
    intrinsicGas: 21_000 + zeroBytes * 4 + nonzeroBytes * 16,
  };
}

async function waitForEvmReceipt(hash, retries = 120, interval = 2_000) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (receipt) return receipt;
    if (attempt === retries) break;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Timed out waiting for underlying EVM receipt ${hash}.`);
}

function extractGenLayerHash(receipt) {
  const events = parseEventLogs({
    abi: chain.consensusMainContract.abi,
    logs: receipt.logs,
    strict: false,
  });
  const event = events.find((item) =>
    item.eventName === "NewTransaction" || item.eventName === "CreatedTransaction");
  return event?.args?.txId;
}

const latestBlock = await rpc("eth_getBlockByNumber", ["latest", false]);
const networkNow = BigInt(latestBlock.timestamp);
const input = JSON.parse(readFileSync(MARKET_FILE, "utf8"));
if (input === null || typeof input !== "object" || Array.isArray(input)) {
  throw new Error("MARKET_FILE must contain one JSON object.");
}
const asset = String(input.asset || "").trim().toUpperCase();
if (!["BTC", "ETH", "BNB", "SOL"].includes(asset)) {
  throw new Error("asset must be BTC, ETH, BNB, or SOL.");
}
const candleStart = parsePositiveInteger(String(input.candle_start), "candle_start");
if (candleStart <= networkNow) throw new Error("candle_start is not in the future at the latest Bradbury block.");
if (candleStart % 3600n !== 0n) throw new Error("candle_start must align to a UTC hour.");
if (candleStart < networkNow + 1800n) throw new Error("candle_start must provide at least 30 minutes of creation lead time.");
const args = [asset, candleStart];

const call = genlayer.abi.calldata.encode(
  genlayer.abi.calldata.makeCalldataObject("create_market", args, undefined),
);
const transactionData = genlayer.abi.transactions.serialize([call, false]);
const validUntil = networkNow + 60n * 60n;
const data = encodeFunctionData({
  abi: addTransactionAbiV6,
  functionName: "addTransaction",
  args: [
    EXPECTED_SENDER,
    CONTRACT,
    chain.defaultNumberOfInitialValidators,
    chain.defaultConsensusMaxRotations,
    transactionData,
    validUntil,
  ],
});
const transaction = {
  from: EXPECTED_SENDER,
  to: CONSENSUS,
  data,
  value: "0x0",
};

let estimate;
let estimateError;
try {
  estimate = BigInt(await rpc("eth_estimateGas", [transaction]));
} catch (error) {
  estimateError = error.rpcError || { message: error.message };
}

if (estimate === undefined && explicitGasLimit === undefined) {
  console.log(toJson({
    mode: SUBMIT ? "submit" : "estimate-only",
    network: NETWORK,
    account: ACCOUNT_NAME,
    sender: EXPECTED_SENDER,
    contract: CONTRACT,
    market: { asset, candleStart },
    estimateError,
  }));
  throw new Error("Gas estimation failed; refusing to submit without GAS_LIMIT.");
}
if (estimate === undefined && process.env.REVIEWED_GAS_LIMIT !== "1") {
  throw new Error("Gas estimation failed; set REVIEWED_GAS_LIMIT=1 with the reviewed GAS_LIMIT to permit submission.");
}

const paddedEstimate = estimate === undefined
  ? undefined
  : (estimate * (100n + GAS_MARGIN_PERCENT) + 99n) / 100n;
const gasLimit = explicitGasLimit ?? paddedEstimate;
const blockGasLimit = BigInt(latestBlock.gasLimit);
if (gasLimit >= blockGasLimit) {
  throw new Error(`Chosen gas limit ${gasLimit} is not below block gas limit ${blockGasLimit}.`);
}

const diagnostics = {
  mode: SUBMIT ? "submit" : "estimate-only",
  network: NETWORK,
  chainId: chain.id,
  rpc: RPC,
  account: ACCOUNT_NAME,
  sender: EXPECTED_SENDER,
  accountBalanceWei: BigInt(await rpc("eth_getBalance", [EXPECTED_SENDER, "latest"])),
  contract: CONTRACT,
  consensusContract: CONSENSUS,
  networkBlock: {
    number: BigInt(latestBlock.number),
    timestamp: networkNow,
    gasLimit: blockGasLimit,
  },
  market: {
    asset,
    candleStart,
  },
  validUntil,
  valueWei: 0n,
  calldata: intrinsicGas(data),
  estimate: estimate ?? null,
  estimateError: estimateError ?? null,
  gasMarginPercent: estimate === undefined ? null : GAS_MARGIN_PERCENT,
  paddedEstimate: paddedEstimate ?? null,
  explicitGasLimit: explicitGasLimit ?? null,
  chosenGasLimit: gasLimit,
};
console.log(toJson(diagnostics));

if (!SUBMIT) {
  console.log("Estimation complete. No transaction submitted; set SUBMIT=1 only after reviewing the displayed gas limit and candle time.");
  process.exit(0);
}

const privateKey = await keytar.getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`);
if (!privateKey) {
  throw new Error(`Account ${ACCOUNT_NAME} is not unlocked in the OS keychain.`);
}
const account = genlayer.createAccount(privateKey);
if (account.address.toLowerCase() !== EXPECTED_SENDER.toLowerCase()) {
  throw new Error("Unlocked account address does not match mercora-deployer.");
}

const nonce = BigInt(await rpc("eth_getTransactionCount", [EXPECTED_SENDER, "pending"]));
const gasPrice = BigInt(await rpc("eth_gasPrice", []));
const balance = BigInt(await rpc("eth_getBalance", [EXPECTED_SENDER, "latest"]));
if (balance < gasLimit * gasPrice) {
  throw new Error("mercora-deployer balance is insufficient for the reviewed gas limit.");
}
const signed = await account.signTransaction({
  account,
  to: CONSENSUS,
  data,
  value: 0n,
  gas: gasLimit,
  gasPrice,
  nonce: Number(nonce),
  chainId: chain.id,
  type: "legacy",
});
const evmTransactionHash = await rpc("eth_sendRawTransaction", [signed]);
console.log(toJson({ evmTransactionHash }));

const evmReceipt = await waitForEvmReceipt(evmTransactionHash);
console.log(toJson({
  evmReceipt: {
    transactionHash: evmReceipt.transactionHash,
    blockNumber: BigInt(evmReceipt.blockNumber),
    status: BigInt(evmReceipt.status),
    gasLimit,
    gasUsed: BigInt(evmReceipt.gasUsed),
    effectiveGasPrice: BigInt(evmReceipt.effectiveGasPrice),
    logs: evmReceipt.logs,
  },
}));
if (evmReceipt.status !== "0x1") {
  let replay;
  try {
    replay = await rpc("eth_call", [transaction, evmReceipt.blockNumber]);
  } catch (error) {
    replay = error.rpcError || { message: error.message };
  }
  console.log(toJson({ evmReplayAtReceiptBlock: replay }));
  throw new Error("Underlying EVM transaction reverted; no additional retry will be attempted by this script.");
}

const genLayerTransactionHash = extractGenLayerHash(evmReceipt);
if (!genLayerTransactionHash) {
  throw new Error("EVM submission succeeded but no GenLayer transaction hash was emitted.");
}
console.log(toJson({ genLayerTransactionHash }));

const client = genlayer.createClient({ chain, account, endpoint: RPC });
const acceptedReceipt = await client.waitForTransactionReceipt({
  hash: genLayerTransactionHash,
  status: "ACCEPTED",
  interval: 5_000,
  retries: 240,
  fullTransaction: true,
});
console.log(toJson({ acceptedReceipt }));
if (acceptedReceipt.statusName !== "ACCEPTED" || acceptedReceipt.resultName !== "AGREE" || acceptedReceipt.txExecutionResultName !== "FINISHED_WITH_RETURN") {
  throw new Error("GenLayer create_market did not finish with ACCEPTED / AGREE / FINISHED_WITH_RETURN; no retry will be attempted by this script.");
}
