import { useAccount, useBalance, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { useEffect } from "react";
import { MERCORA_CHAIN_ID } from "@/config/mercora";
import { useProtocolStats } from "@/hooks/contract/use-mercora";
import { isAuthorizedAccount } from "./contract-ui";

export function useWallet(options: { authorization?: boolean; balance?: boolean } = {}) {
  const account = useAccount();
  const chainId = useChainId();
  const balanceEnabled = options.balance ?? true;
  const balance = useBalance({
    address: account.address,
    chainId: MERCORA_CHAIN_ID,
    query: {
      enabled: account.isConnected && balanceEnabled,
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: "always",
    },
  });
  const { disconnect } = useDisconnect();
  const switchChain = useSwitchChain();
  const authorizationEnabled = options.authorization ?? false;
  const stats = useProtocolStats({
    enabled: authorizationEnabled && account.isConnected,
    source: "useWallet/authorization",
    userSpecific: true,
  });
  const isAdmin = isAuthorizedAccount(account.address, stats.data);
  const refreshBalance = balance.refetch;

  useEffect(() => {
    if (account.isConnected) void refreshBalance();
  }, [account.address, account.isConnected, chainId, refreshBalance]);

  return {
    address: account.address,
    connector: account.connector,
    isConnected: account.isConnected,
    isConnecting: account.isConnecting,
    chainId,
    isCorrectNetwork: chainId === MERCORA_CHAIN_ID,
    balance: balance.data?.formatted,
    balanceLoading: balanceEnabled && balance.isLoading,
    balanceError: balanceEnabled && balance.isError && !balance.data,
    balanceRefreshError: balanceEnabled && balance.isRefetchError,
    refreshBalance,
    disconnect,
    switchToBradbury: () => switchChain.switchChain({ chainId: MERCORA_CHAIN_ID }),
    isAdmin,
    authorizationLoading: authorizationEnabled && account.isConnected && stats.isLoading,
    authorizationError: authorizationEnabled && account.isConnected && stats.isError && !stats.data,
    authorizationRefreshError: authorizationEnabled && account.isConnected && stats.isRefetchError,
    protocolStats: stats.data,
  };
}
