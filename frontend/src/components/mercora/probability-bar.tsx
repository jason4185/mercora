interface Props {
  up: number; // 0..1
  down: number;
  compact?: boolean;
}

export function ProbabilityBar({ up, down, compact }: Props) {
  const upPct = Math.round(up * 100);
  const downPct = 100 - upPct;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-up">UP {upPct}%</span>
        <span className="text-down">DOWN {downPct}%</span>
      </div>
      <div className={`flex h-${compact ? "1.5" : "2"} overflow-hidden rounded-full bg-muted`}>
        <div className="bg-up" style={{ width: `${upPct}%` }} />
        <div className="bg-down" style={{ width: `${downPct}%` }} />
      </div>
    </div>
  );
}
