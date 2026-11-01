import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface Props {
  data: { t: string; v: number }[];
  height?: number;
  domainPad?: number;
}

/** 大号趋势图(项目 Star 曲线 / 赛道热度),y 轴自适应数据区间。 */
export default function TrendChart({ data, height = 190, domainPad = 400 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height} style={{ color: "var(--accent)" }}>
      <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} className="trend-chart">
        <YAxis hide domain={[`dataMin - ${domainPad}`, `dataMax + ${Math.max(20, Math.round(domainPad / 3))}`]} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10.5, fontFamily: "JetBrains Mono Variable", fill: "var(--faint)" }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
          minTickGap={36}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke="currentColor"
          strokeWidth={2}
          fill="var(--accent-soft)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
