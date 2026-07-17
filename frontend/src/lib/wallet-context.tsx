import { useAccount, useBalance, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { useEffect } from "react";
import { MERCORA_CHAIN_ID } from "@/config/mercora";
import { useProtocolStats } from "@/hooks/contract/use-mercora";
import { isAuthorizedAccount } from "./contract-ui";

export function useWallet() {
  const account = useAccount();
  const chainId = useChainId();
  const balance = useBalance({
    address: account.address,
    chainId: MERCORA_CHAIN_ID,
    query: {
      enabled: account.isConnected,
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: "always",
    },
  });
  const { disconnect } = useDisconnect();
  const switchChain = useSwitchChain();
  const stats = useProtocolStats();
  const isAdmin = isAuthorizedAccount(account.address, stats.data);
  const refreshBalance = balance.refetch;

  useEffect(() => {
    if (account.isConnected) void refreshBalance();
  }, [account.address, account.isConnected, chainId, refreshBalance]);

  return {
    address: account.address,
    isConnected: account.isConnected,
    isConnecting: account.isConnecting,
    chainId,
    isCorrectNetwork: chainId === MERCORA_CHAIN_ID,
    balance: balance.data?.formatted,
    balanceLoading: balance.isLoading,
    balanceError: balance.isError && !balance.data,
    balanceRefreshError: balance.isRefetchError,
    refreshBalance,
    disconnect,
    switchToBradbury: () => switchChain.switchChain({ chainId: MERCORA_CHAIN_ID }),
    isAdmin,
    authorizationLoading: account.isConnected && stats.isLoading,
    authorizationError: account.isConnected && stats.isError && !stats.data,
    authorizationRefreshError: account.isConnected && stats.isRefetchError,
    protocolStats: stats.data,
  };
}
