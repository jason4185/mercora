import type { CalldataEncodable, TransactionHash } from "genlayer-js/types";
import type { Address, EIP1193Provider } from "viem";
import type { Connector } from "wagmi";
import {
  createWriteClient,
  MERCORA_CHAIN_ID,
  MERCORA_CONTRACT_ADDRESS,
  MERCORA_NETWORK,
} from "@/config/mercora";

type ProviderRequest = {
  method: string;
  params?: unknown[];
};

type WalletWriteMethod =
  | "create_market"
  | "place_bet"
  | "claim_winnings"
  | "claim_refund"
  | "settle_market";

export type WalletWriteOperation =
  | "createMarket"
  | "placeBet"
  | "claimWinnings"
  | "claimRefund"
  | "settleMarket";

export type WalletWriteCallbacks = {
  onSubmitted?: (hash: TransactionHash) => void;
};

export type WalletWriteInput = {
  connector?: Connector;
  address?: Address;
  chainId?: number;
  functionName: WalletWriteMethod;
  args: CalldataEncodable[];
  value?: bigint;
  operation: WalletWriteOperation;
  callbacks?: WalletWriteCallbacks;
};

export type WalletErrorCategory =
  | "USER_REJECTED"
  | "WRONG_NETWORK"
  | "NETWORK_SWITCH_REJECTED"
  | "UNSUPPORTED_WALLET"
  | "SELECTED_PROVIDER_MISMATCH"
  | "DISCONNECTED_WALLET"
  | "INSUFFICIENT_GEN"
  | "STAKE_BELOW_MINIMUM"
  | "STAKE_ABOVE_MAXIMUM"
  | "BETTING_CLOSED"
  | "DUPLICATE_OR_CONFLICTING_POSITION"
  | "RPC_RATE_LIMITED"
  | "RPC_TRANSPORT_INCOMPATIBILITY"
  | "SUBMITTED_CONFIRMATION_DELAYED"
  | "CONTRACT_EXECUTION_ERROR"
  | "UNKNOWN";

export class WalletWriteError extends Error {
  constructor(
    public readonly category: WalletErrorCategory,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
  }
}

export class SubmittedTransactionError extends Error {
  constructor(public readonly hash: TransactionHash) {
    super("Your transaction was submitted and is still processing.");
  }
}

export type WalletWriteState = {
  hash: TransactionHash;
  receipt: import("genlayer-js/types").GenLayerTransaction;
};

function normalizeAddress(address: string | undefined): string {
  return (address ?? "").toLowerCase();
}

function requestProvider(provider: EIP1193Provider, request: ProviderRequest): Promise<unknown> {
  return provider.request(request as Parameters<EIP1193Provider["request"]>[0]);
}

function providerName(provider: EIP1193Provider): string {
  const flags = provider as EIP1193Provider & Record<string, unknown>;
  if (flags.isRabby) return "Rabby";
  if (flags.isMetaMask) return "MetaMask";
  if (flags.isCoinbaseWallet) return "Coinbase Wallet";
  if (flags.isBraveWallet) return "Brave Wallet";
  return "Injected wallet";
}

function accountSuffix(address: string | undefined): string {
  return address ? address.slice(-6) : "none";
}

function devWalletDiagnostic(input: {
  connector?: Connector;
  provider?: EIP1193Provider;
  address?: string;
  chainId?: number;
  operation: WalletWriteOperation;
  stage: string;
  category?: WalletErrorCategory;
  hash?: string;
}) {
  if (!import.meta.env.DEV) return;
  console.info("[mercora:wallet-write]", {
    connector: input.connector?.name ?? "none",
    connectorId: input.connector?.id ?? "none",
    provider: input.provider ? providerName(input.provider) : "none",
    accountSuffix: accountSuffix(input.address),
    chainId: input.chainId,
    operation: input.operation,
    stage: input.stage,
    rpcCategory: input.stage.includes("submit") ? "submission" : "wallet",
    transaction: input.hash,
    errorCategory: input.category,
  });
}

function mapChainId(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  return null;
}

function addChainParameter() {
  return {
    chainId: `0x${MERCORA_CHAIN_ID.toString(16)}`,
    chainName: MERCORA_NETWORK.name,
    nativeCurrency: MERCORA_NETWORK.nativeCurrency,
    rpcUrls: [...MERCORA_NETWORK.rpcUrls.default.http],
    blockExplorerUrls: MERCORA_NETWORK.blockExplorers?.default.url
      ? [MERCORA_NETWORK.blockExplorers.default.url]
      : undefined,
  };
}

function transactionHash(value: unknown): TransactionHash {
  if (typeof value === "string" && value.startsWith("0x")) return value as TransactionHash;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const hash = obj.hash ?? obj.txId ?? obj.transaction_hash;
    if (typeof hash === "string" && hash.startsWith("0x")) return hash as TransactionHash;
  }
  throw new WalletWriteError("UNKNOWN", "The network did not return a transaction hash.");
}

function isUserRejected(error: unknown): boolean {
  const obj = error as { code?: unknown; message?: unknown };
  const message = typeof obj?.message === "string" ? obj.message.toLowerCase() : "";
  return obj?.code === 4001 || message.includes("user rejected") || message.includes("user denied");
}

function isUnknownChain(error: unknown): boolean {
  const obj = error as { code?: unknown; message?: unknown };
  const message = typeof obj?.message === "string" ? obj.message.toLowerCase() : "";
  return (
    obj?.code === 4902 ||
    message.includes("unrecognized chain") ||
    message.includes("unknown chain")
  );
}

function mapWriteError(error: unknown): WalletWriteError {
  if (error instanceof WalletWriteError) return error;
  if (error instanceof SubmittedTransactionError)
    return new WalletWriteError("SUBMITTED_CONFIRMATION_DELAYED", error.message, error);
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (isUserRejected(error))
    return new WalletWriteError("USER_REJECTED", "Request rejected.", error);
  if (lower.includes("insufficient"))
    return new WalletWriteError("INSUFFICIENT_GEN", message, error);
  if (lower.includes("rate limit exceeded"))
    return new WalletWriteError(
      "RPC_RATE_LIMITED",
      "Updates are temporarily delayed. Mercora will retry automatically.",
      error,
    );
  if (
    lower.includes("cannot unmarshal string into go struct field request.id") ||
    lower.includes("parse error as single request")
  )
    return new WalletWriteError(
      "RPC_TRANSPORT_INCOMPATIBILITY",
      "This wallet could not submit the transaction through the current GenLayer network connection. Please retry after reconnecting the wallet.",
      error,
    );
  if (
    lower.includes("rejected") ||
    lower.includes("reverted") ||
    lower.includes("finished_with_error")
  )
    return new WalletWriteError(
      "CONTRACT_EXECUTION_ERROR",
      "The network rejected this transaction.",
      error,
    );
  return new WalletWriteError("UNKNOWN", message || "Transaction failed.", error);
}

export function walletErrorMessage(error: unknown): string {
  const mapped = mapWriteError(error);
  switch (mapped.category) {
    case "USER_REJECTED":
      return "Wallet request rejected.";
    case "WRONG_NETWORK":
      return "Switch to GenLayer Bradbury to continue.";
    case "NETWORK_SWITCH_REJECTED":
      return "Network switch was rejected.";
    case "UNSUPPORTED_WALLET":
      return "This browser wallet is not available. Reconnect and try again.";
    case "SELECTED_PROVIDER_MISMATCH":
      return "The selected wallet does not match the connected account. Reconnect and try again.";
    case "DISCONNECTED_WALLET":
      return "Connect a browser wallet to continue.";
    case "INSUFFICIENT_GEN":
      return "Your wallet does not have enough GEN for this transaction.";
    case "STAKE_BELOW_MINIMUM":
      return "Stake is below the market minimum.";
    case "STAKE_ABOVE_MAXIMUM":
      return "Stake is above the market maximum.";
    case "BETTING_CLOSED":
      return "This market is no longer accepting predictions.";
    case "DUPLICATE_OR_CONFLICTING_POSITION":
      return "You already selected the other direction for this market.";
    case "RPC_RATE_LIMITED":
      return "Updates are temporarily delayed. Mercora will retry automatically.";
    case "RPC_TRANSPORT_INCOMPATIBILITY":
      return mapped.message;
    case "SUBMITTED_CONFIRMATION_DELAYED":
      return "Your transaction was submitted and is still processing.";
    case "CONTRACT_EXECUTION_ERROR":
      return "The network rejected this transaction.";
    default:
      return "Transaction failed. Please try again.";
  }
}

export async function resolveSelectedWalletProviderForWrite(
  input: WalletWriteInput,
): Promise<EIP1193Provider> {
  if (!input.connector || !input.address) {
    throw new WalletWriteError("DISCONNECTED_WALLET", "Connect a browser wallet to continue.");
  }
  const provider = (await input.connector.getProvider({
    chainId: MERCORA_CHAIN_ID,
  })) as EIP1193Provider | undefined;
  if (!provider?.request) {
    throw new WalletWriteError("UNSUPPORTED_WALLET", "The selected wallet is not available.");
  }

  devWalletDiagnostic({
    connector: input.connector,
    provider,
    address: input.address,
    chainId: input.chainId,
    operation: input.operation,
    stage: "provider-selected",
  });

  const accounts = (await requestProvider(provider, { method: "eth_accounts" })) as string[];
  if (!accounts.some((account) => normalizeAddress(account) === normalizeAddress(input.address))) {
    throw new WalletWriteError(
      "SELECTED_PROVIDER_MISMATCH",
      "The selected wallet does not match the connected account.",
    );
  }

  const providerChainId = mapChainId(await requestProvider(provider, { method: "eth_chainId" }));
  if (providerChainId !== MERCORA_CHAIN_ID) {
    try {
      if (input.connector.switchChain) {
        await input.connector.switchChain({
          chainId: MERCORA_CHAIN_ID,
          addEthereumChainParameter: addChainParameter(),
        });
      } else {
        await requestProvider(provider, {
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${MERCORA_CHAIN_ID.toString(16)}` }],
        });
      }
    } catch (switchError) {
      if (isUnknownChain(switchError)) {
        try {
          await requestProvider(provider, {
            method: "wallet_addEthereumChain",
            params: [addChainParameter()],
          });
        } catch (addError) {
          if (isUserRejected(addError))
            throw new WalletWriteError(
              "NETWORK_SWITCH_REJECTED",
              "Network switch was rejected.",
              addError,
            );
          throw mapWriteError(addError);
        }
      } else if (isUserRejected(switchError)) {
        throw new WalletWriteError(
          "NETWORK_SWITCH_REJECTED",
          "Network switch was rejected.",
          switchError,
        );
      } else {
        throw mapWriteError(switchError);
      }
    }
    const verifiedChainId = mapChainId(await requestProvider(provider, { method: "eth_chainId" }));
    if (verifiedChainId !== MERCORA_CHAIN_ID) {
      throw new WalletWriteError("WRONG_NETWORK", "Switch to GenLayer Bradbury to continue.");
    }
  }

  const verifiedAccounts = (await requestProvider(provider, {
    method: "eth_accounts",
  })) as string[];
  if (
    !verifiedAccounts.some(
      (account) => normalizeAddress(account) === normalizeAddress(input.address),
    )
  ) {
    throw new WalletWriteError(
      "SELECTED_PROVIDER_MISMATCH",
      "The selected wallet does not match the connected account.",
    );
  }
  return provider;
}

export async function writeWithSelectedWallet(input: WalletWriteInput): Promise<WalletWriteState> {
  try {
    const provider = await resolveSelectedWalletProviderForWrite(input);
    const client = createWriteClient(input.address!, provider);
    devWalletDiagnostic({
      connector: input.connector,
      provider,
      address: input.address,
      chainId: MERCORA_CHAIN_ID,
      operation: input.operation,
      stage: "submit-once",
    });
    const submitted = await client.writeContract({
      address: MERCORA_CONTRACT_ADDRESS,
      functionName: input.functionName,
      args: input.args,
      value: input.value ?? 0n,
    });
    const hash = transactionHash(submitted);
    input.callbacks?.onSubmitted?.(hash);
    devWalletDiagnostic({
      connector: input.connector,
      provider,
      address: input.address,
      chainId: MERCORA_CHAIN_ID,
      operation: input.operation,
      stage: "submitted",
      hash,
    });
    try {
      const receipt = await client.waitForTransactionReceipt({
        hash,
        retries: 90,
        interval: 4_000,
      });
      if (
        receipt.txExecutionResultName === "FINISHED_WITH_ERROR" ||
        receipt.resultName === "FAILURE"
      ) {
        throw new WalletWriteError(
          "CONTRACT_EXECUTION_ERROR",
          "The network rejected this transaction.",
          receipt,
        );
      }
      return { hash, receipt };
    } catch (error) {
      if (error instanceof WalletWriteError) throw error;
      console.error("GenLayer confirmation wait did not finish", error);
      throw new SubmittedTransactionError(hash);
    }
  } catch (error) {
    const mapped = mapWriteError(error);
    devWalletDiagnostic({
      connector: input.connector,
      address: input.address,
      chainId: input.chainId,
      operation: input.operation,
      stage: "failed",
      category: mapped.category,
    });
    throw mapped.category === "SUBMITTED_CONFIRMATION_DELAYED" &&
      error instanceof SubmittedTransactionError
      ? error
      : mapped;
  }
}
