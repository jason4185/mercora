import { TokenBTC, TokenETH, TokenBNB, TokenSOL } from "@web3icons/react";
import type { Asset } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface Props {
  asset: Asset;
  size?: number;
  className?: string;
}

export function AssetIcon({ asset, size = 24, className }: Props) {
  const Icon =
    asset === "BTC" ? TokenBTC : asset === "ETH" ? TokenETH : asset === "BNB" ? TokenBNB : TokenSOL;
  return (
    <span
      className={cn(
        "grid place-items-center rounded-full bg-surface-2 border border-border shrink-0",
        className,
      )}
      style={{ width: size + 8, height: size + 8 }}
    >
      <Icon variant="branded" size={size} />
    </span>
  );
}
