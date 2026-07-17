import { TokenBTC, TokenETH, TokenBNB, TokenSOL } from "@web3icons/react";
import type { Asset } from "@/lib/contract-parsers";
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
        "grid shrink-0 place-items-center rounded-full border border-border bg-surface-2 [&_svg]:drop-shadow-sm",
        asset === "SOL" && "bg-white/95",
        className,
      )}
      style={{ width: size + 8, height: size + 8 }}
    >
      <Icon variant="branded" size={size} />
    </span>
  );
}
