import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  showWord?: boolean;
}

/** Original Mercora mark: two interlocked chevrons hinting at up/down candle outcomes. */
export function MercoraLogo({ className, showWord = true }: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="h-7 w-7 text-primary"
        fill="none"
      >
        <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary/12 stroke-primary/50" strokeWidth="1" />
        <path d="M8 20 L14 12 L18 17 L24 10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="10" r="1.8" fill="currentColor" />
      </svg>
      {showWord && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Mercora
        </span>
      )}
    </div>
  );
}
