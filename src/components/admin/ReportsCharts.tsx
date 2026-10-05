"use client";

import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatRupiah } from "@/lib/admin/format";

type TrendData = { month: string; income: number; expense: number };
type DistData = { name: string; amount: number };

type Props =
  | { type: "trend"; data: TrendData[] }
  | { type: "distribution"; data: DistData[] };

const tooltipStyle = {
  contentStyle: { backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#ccc" },
};

function TrendChart({ data }: { data: TrendData[] }) {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const formatted = data.map((d) => {
    const [y, m] = d.month.split("-");
    return { ...d, label: `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}` };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatRupiah(v)} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
        <Tooltip formatter={(v) => formatRupiah(Array.isArray(v) ? v[0] : v)} {...tooltipStyle} />
        <Legend wrapperStyle={{ color: "rgba(255,255,255,0.6)", fontSize: "12px" }} />
        <Area type="monotone" dataKey="income" name="Pendapatan" stroke="#3b82f6" fill="url(#gradIncome)" strokeWidth={2} />
        <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#ef4444" fill="url(#gradExpense)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DistributionChart({ data }: { data: DistData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis type="number" tickFormatter={(v) => formatRupiah(v)} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
        <Tooltip formatter={(v) => formatRupiah(Array.isArray(v) ? v[0] : v)} {...tooltipStyle} />
        <Bar dataKey="amount" name="Total Payout" fill="#D97A2B" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ReportsCharts(props: Props) {
  if (props.type === "trend") return <TrendChart data={props.data} />;
  return <DistributionChart data={props.data} />;
}
