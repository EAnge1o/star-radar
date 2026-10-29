import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  spark: [string, number][] | null | undefined;
  height?: number;
  showAxis?: boolean;
}

export default function Sparkline({ spark, height = 44, showAxis = false }: Props) {
  if (!spark || spark.length < 3) {
    return (
      <div className="spark-empty" style={{ height }}>
        <span className="dot" />
        观测中 · 曲线累积中
      </div>
    );
  }
  const data = spark.map(([, v], i) => ({ i, v }));
  const id = `sg-${spark.length}-${spark[0][0].slice(-8)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={`url(#${id})`}
          strokeWidth={1.8}
          fill={`url(#${id}-f)`}
          isAnimationActive={!showAxis}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
