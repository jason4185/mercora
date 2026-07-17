import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  showWord?: boolean;
}

/** Original Mercora mark: an M built from candle bodies and converging consensus paths. */
export function MercoraLogo({ className, showWord = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 text-primary" fill="none">
        <path
          d="M4 25V8l7 9 5-7 5 7 7-9v17"
          stroke="currentColor"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 6v5M16 4v5M24 6v5"
          className="stroke-consensus"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <rect x="6.5" y="11" width="3" height="7" rx="1" className="fill-up" />
        <rect x="14.5" y="9" width="3" height="8" rx="1" fill="currentColor" />
        <rect x="22.5" y="11" width="3" height="7" rx="1" className="fill-down" />
      </svg>
      {showWord && (
        <span className="text-[15px] font-bold tracking-[-0.035em] text-foreground">MERCORA</span>
      )}
    </div>
  );
}
