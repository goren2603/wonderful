"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";

export function CorrelationBarChart({
  data,
  color,
}: {
  data: { label: string; r: number }[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
        <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11, fill: "rgba(0,0,0,0.45)" }} />
        <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "rgba(0,0,0,0.65)" }} />
        <Tooltip
          formatter={(v: number) => v.toFixed(2)}
          contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
        />
        <Bar dataKey="r" radius={4}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.r >= 0 ? color : "#c7c7c7"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
  color,
}: {
  data: { week: string; count: number }[];
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} axisLine={false} tickLine={false} />
        <YAxis hide domain={[0, "dataMax + 1"]} />
        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
