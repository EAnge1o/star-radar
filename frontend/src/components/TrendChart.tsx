import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface Props {
  data: { t: string; v: number }[];
  height?: number;
  domainPad?: number;
}

/** 大号趋势图(项目 Star 曲线 / 赛道热度),y 轴自适应数据区间。 */
export default function TrendChart({ data, height = 190, domainPad = 400 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="tc-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id="tc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.32} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[`dataMin - ${domainPad}`, `dataMax + ${Math.max(20, Math.round(domainPad / 3))}`]} />
        <XAxis
          dataKey="t"
          tick={{ fill: "#5f6b85", fontSize: 10.5, fontFamily: "JetBrains Mono Variable" }}
          axisLine={{ stroke: "rgba(148,163,184,.15)" }}
          tickLine={false}
          minTickGap={36}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke="url(#tc-stroke)"
          strokeWidth={2.4}
          fill="url(#tc-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
