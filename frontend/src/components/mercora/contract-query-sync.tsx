import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";
import { mercoraKeys } from "@/hooks/contract/use-mercora";
import { isMercoraUserQueryKey } from "@/lib/contract-refresh-policy";

export function ContractQuerySync() {
  const queryClient = useQueryClient();
  const account = useAccount();
  const chainId = useChainId();
  const previousAddress = useRef<string | undefined>(undefined);
  const previousChainId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const currentAddress = account.address?.toLowerCase();
    const oldAddress = previousAddress.current;
    const chainChanged =
      previousChainId.current !== undefined && previousChainId.current !== chainId;
    const addressChanged = oldAddress !== currentAddress;

    if (oldAddress && addressChanged) {
      queryClient.removeQueries({
        predicate: (query) => isMercoraUserQueryKey(query.queryKey, oldAddress),
      });
    }

    if (currentAddress && (addressChanged || chainChanged)) {
      void queryClient.invalidateQueries({ queryKey: mercoraKeys.user(currentAddress) });
      void queryClient.invalidateQueries({ queryKey: mercoraKeys.stats });
    }

    if (chainChanged) {
      void queryClient.invalidateQueries({ queryKey: mercoraKeys.all });
    }

    previousAddress.current = currentAddress;
    previousChainId.current = chainId;
  }, [account.address, chainId, queryClient]);

  return null;
}
