import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Market } from "@/lib/mock-data";

export function PriceChart({ m }: { m: Market }) {
  const data = m.priceSeries ?? [];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 8, right: 8, top: 12, bottom: 4 }}>
          <defs>
            <linearGradient id="mercora-price" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.66 0.22 285)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="oklch(0.66 0.22 285)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{ fill: "oklch(0.68 0.02 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={9}
            tickFormatter={(v) => `${v}m`}
          />
          <YAxis
            tick={{ fill: "oklch(0.68 0.02 260)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={["auto", "auto"]}
            tickFormatter={(v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          />
          <ReferenceLine
            y={m.referencePrice}
            stroke="oklch(0.78 0.14 210)"
            strokeDasharray="4 4"
            label={{ value: "Open", fill: "oklch(0.78 0.14 210)", fontSize: 10, position: "insideTopRight" }}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.22 0.013 265)",
              border: "1px solid oklch(0.28 0.014 265)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `t+${v}m`}
            formatter={(v: number) => [Number(v).toFixed(2), "Price"]}
          />
          <Area
            type="monotone"
            dataKey="p"
            stroke="oklch(0.66 0.22 285)"
            strokeWidth={2}
            fill="url(#mercora-price)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
