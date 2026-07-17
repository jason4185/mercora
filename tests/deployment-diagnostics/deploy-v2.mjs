import { readFileSync } from "fs";
import keytar from "/opt/homebrew/lib/node_modules/genlayer/node_modules/keytar/lib/keytar.js";
import { encodeFunctionData, parseEventLogs, zeroAddress } from "/opt/homebrew/lib/node_modules/genlayer/node_modules/viem/_esm/index.js";
import * as genlayer from "/opt/homebrew/lib/node_modules/genlayer/node_modules/genlayer-js/dist/index.js";

const RPC = process.env.GENLAYER_RPC || "https://rpc-bradbury.genlayer.com";
const ACCOUNT_NAME = process.env.GENLAYER_ACCOUNT || "mercora-deployer";
const EXPECTED_SENDER = (process.env.GENLAYER_FROM || "0xbeed80cd1863fd3aea8a4d73e7fdcbc4eb9b9fa6").toLowerCase();
const CONTRACT_PATH = process.env.CONTRACT_PATH || "contract/MercoraMarket.py";
const MARGIN = BigInt(process.env.GAS_MARGIN_PERCENT || "30");
const SUBMIT = process.env.SUBMIT === "1";
const chain = genlayer.chains.testnetBradbury;
const consensus = chain.consensusMainContract;
if (!consensus || chain.id !== 4221) throw new Error("Installed GenLayer Bradbury metadata is invalid.");
if (MARGIN < 25n || MARGIN > 35n) throw new Error("GAS_MARGIN_PERCENT must be reviewed between 25 and 35.");

const addTransactionAbi = [{ type: "function", name: "addTransaction", stateMutability: "nonpayable", inputs: [
  { name: "_sender", type: "address" }, { name: "_recipient", type: "address" }, { name: "_numOfInitialValidators", type: "uint256" },
  { name: "_maxRotations", type: "uint256" }, { name: "_txData", type: "bytes" }, { name: "_validUntil", type: "uint256" },
], outputs: [] }];

const json = value => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
async function rpc(method, params) {
  const response = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || response.statusText);
  return payload.result;
}
async function receipt(hash) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const value = await rpc("eth_getTransactionReceipt", [hash]);
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for EVM receipt ${hash}.`);
}
function genlayerHash(evmReceipt) {
  const events = parseEventLogs({ abi: consensus.abi, logs: evmReceipt.logs, strict: false });
  return events.find(item => item.eventName === "NewTransaction" || item.eventName === "CreatedTransaction")?.args?.txId;
}

const source = readFileSync(CONTRACT_PATH, "utf8");
const latest = await rpc("eth_getBlockByNumber", ["latest", false]);
const validUntil = BigInt(latest.timestamp) + 3600n;
const constructor = genlayer.abi.calldata.encode(genlayer.abi.calldata.makeCalldataObject(undefined, [], undefined));
const transactionData = genlayer.abi.transactions.serialize([source, constructor, false]);
const data = encodeFunctionData({ abi: addTransactionAbi, functionName: "addTransaction", args: [EXPECTED_SENDER, zeroAddress, BigInt(chain.defaultNumberOfInitialValidators), BigInt(chain.defaultConsensusMaxRotations), transactionData, validUntil] });
const request = { from: EXPECTED_SENDER, to: consensus.address, data, value: "0x0" };
let estimate;
try { estimate = BigInt(await rpc("eth_estimateGas", [request])); }
catch (error) { console.log(json({ mode: SUBMIT ? "submit" : "estimate-only", estimateError: String(error) })); throw new Error("Deployment estimation failed; refusing submission."); }
const gas = (estimate * (100n + MARGIN) + 99n) / 100n;
const blockGasLimit = BigInt(latest.gasLimit);
if (gas >= blockGasLimit) throw new Error(`Padded gas ${gas} is not below block gas limit ${blockGasLimit}.`);
console.log(json({ mode: SUBMIT ? "submit" : "estimate-only", network: "testnet-bradbury", account: ACCOUNT_NAME, sender: EXPECTED_SENDER, sourceBytes: Buffer.byteLength(source), estimate, gasMarginPercent: MARGIN, chosenGasLimit: gas, blockGasLimit, validUntil, valueWei: 0n }));
if (!SUBMIT) { console.log("No transaction submitted. Set SUBMIT=1 only after every deployment gate passes."); process.exit(0); }

const privateKey = await keytar.getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`);
if (!privateKey) throw new Error(`Account ${ACCOUNT_NAME} is not unlocked in the OS keychain.`);
const account = genlayer.createAccount(privateKey);
if (account.address.toLowerCase() !== EXPECTED_SENDER) throw new Error("Unlocked account does not match the controlled deployer.");
const balance = BigInt(await rpc("eth_getBalance", [account.address, "latest"]));
const gasPrice = BigInt(await rpc("eth_gasPrice", []));
if (balance < gas * gasPrice) throw new Error("Controlled deployer balance is insufficient for padded deployment gas.");
const nonce = BigInt(await rpc("eth_getTransactionCount", [account.address, "pending"]));
const signed = await account.signTransaction({ account, to: consensus.address, data, value: 0n, gas, gasPrice, nonce: Number(nonce), chainId: chain.id, type: "legacy" });
const evmTransactionHash = await rpc("eth_sendRawTransaction", [signed]);
console.log(json({ evmTransactionHash }));
const evmReceipt = await receipt(evmTransactionHash);
console.log(json({ evmReceipt: { status: evmReceipt.status, gasUsed: BigInt(evmReceipt.gasUsed), gasLimit: gas, blockNumber: BigInt(evmReceipt.blockNumber) } }));
if (evmReceipt.status !== "0x1") throw new Error("Underlying deployment reverted; this script will not retry.");
const hash = genlayerHash(evmReceipt);
if (!hash) throw new Error("No GenLayer transaction ID was emitted.");
console.log(json({ genLayerTransactionHash: hash }));
const client = genlayer.createClient({ chain, endpoint: RPC, account });
const accepted = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 5000, retries: 240, fullTransaction: true });
console.log(json({ accepted }));
