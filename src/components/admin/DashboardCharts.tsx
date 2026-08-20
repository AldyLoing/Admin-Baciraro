"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatRupiah } from "@/lib/admin/format";

type MonthlyRow = { month: string; income: number; expense: number };
type StatusRow = { name: string; value: number; color: string };

type Props = {
  monthly: MonthlyRow[];
  statusData: StatusRow[];
};

const statusName: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
const statusColor: Record<string, string> = {
  active: "#60A5FA",
  completed: "#34D399",
  paid: "#10B981",
};

const tooltipStyle = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fafafa",
};

export default function DashboardCharts({ monthly, statusData }: Props) {
  const hasMonthly = monthly.some((m) => m.income > 0 || m.expense > 0);
  const hasStatus = statusData.some((s) => s.value > 0);

  return (
    <div className="grid lg:grid-cols-2 gap-8 mb-8">
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Kas 6 Bulan Terakhir</h2>
        {hasMonthly ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000000)}jt`} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatRupiah(Number(value)), name === "income" ? "Pemasukan" : "Pengeluaran"]} />
              <Legend formatter={(value: string) => (value === "income" ? "Pemasukan" : "Pengeluaran")} />
              <Bar dataKey="income" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
            Belum ada transaksi. Catat di menu Kas &amp; Transaksi.
          </div>
        )}
      </div>

      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Status Project</h2>
        {hasStatus ? (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="55%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {statusData.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-white/60">{s.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
            Belum ada project.
          </div>
        )}
      </div>
    </div>
  );
}

export { statusName, statusColor };
