import { createClient, chains } from "genlayer-js";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Address, EIP1193Provider } from "viem";

export const MERCORA_CONTRACT_ADDRESS = (import.meta.env.VITE_MERCORA_CONTRACT_ADDRESS ??
  "0x0A3Fcc4671b6fF0BffBCDab3B744CFf6d5c7ED05") as Address;

export const MERCORA_NETWORK = chains.testnetBradbury;
export const MERCORA_NETWORK_KEY = "testnet-bradbury";
export const MERCORA_CHAIN_ID = MERCORA_NETWORK.id;

export const readClient = createClient({ chain: MERCORA_NETWORK });

export const wagmiConfig = createConfig({
  chains: [MERCORA_NETWORK],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [MERCORA_NETWORK.id]: http(MERCORA_NETWORK.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export function createWriteClient(address: Address, provider: EIP1193Provider) {
  return createClient({
    chain: MERCORA_NETWORK,
    account: address,
    provider,
  });
}
