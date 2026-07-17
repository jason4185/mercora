import { useEffect, useState } from "react";

function fmt(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function Countdown({ to, prefix, className }: { to: number; prefix?: string; className?: string }) {
  const [ms, setMs] = useState(() => to - Date.now());
  useEffect(() => {
    const i = setInterval(() => setMs(to - Date.now()), 1000);
    return () => clearInterval(i);
  }, [to]);
  return (
    <span className={className}>
      {prefix ? <span className="text-muted-foreground mr-1">{prefix}</span> : null}
      <span className="text-mono">{fmt(ms)}</span>
    </span>
  );
}
