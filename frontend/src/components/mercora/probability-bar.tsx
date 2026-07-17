interface Props {
  up: number; // 0..1
  down: number;
  compact?: boolean;
  hasPredictions?: boolean;
}

export function ProbabilityBar({ up, down, compact, hasPredictions = up > 0 || down > 0 }: Props) {
  const upPct = Math.round(up * 100);
  const downPct = Math.round(down * 100);
  return (
    <div className="space-y-1.5">
      {hasPredictions ? (
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="text-up">UP {upPct}%</span>
          <span className="text-down">DOWN {downPct}%</span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>No predictions yet</span>
          <span>UP 0% · DOWN 0%</span>
        </div>
      )}
      <div
        className={`${compact ? "h-1.5" : "h-2"} flex overflow-hidden rounded-full bg-muted`}
        aria-label={hasPredictions ? `UP ${upPct}%, DOWN ${downPct}%` : "No predictions yet"}
      >
        <div className="bg-up" style={{ width: `${hasPredictions ? upPct : 0}%` }} />
        <div className="bg-down" style={{ width: `${hasPredictions ? downPct : 0}%` }} />
      </div>
    </div>
  );
}
