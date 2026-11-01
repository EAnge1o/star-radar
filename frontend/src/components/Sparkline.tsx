import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

interface Props {
  spark: [string, number][] | null | undefined;
  height?: number;
  showAxis?: boolean;
  /** C5 raise:同屏所有行共用一个比例尺,曲线才可比 */
  domainMax?: number;
}

export default function Sparkline({ spark, height = 44, showAxis = false, domainMax }: Props) {
  if (!spark || spark.length < 3) {
    return (
      <div className="spark-empty" style={{ height }}>
        <span className="dot" />
        观测中 · 曲线累积中
      </div>
    );
  }
  const data = spark.map(([, v], i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height} style={{ color: "var(--accent)" }}>
      <AreaChart
        data={data}
        margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        className="spark-area"
      >
        {domainMax ? <YAxis hide domain={[0, domainMax]} /> : null}
        <Area
          type="monotone"
          dataKey="v"
          stroke="currentColor"
          strokeWidth={1.5}
          fill="var(--accent-soft)"
          isAnimationActive={!showAxis}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
