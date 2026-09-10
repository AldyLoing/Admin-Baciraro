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
type KategoriRow = { name: string; value: number };
type ClientRow = { name: string; value: number };
type MemberPayoutRow = { name: string; amount: number };
type TaskAssigneeRow = { name: string; pending: number; active: number; total: number };

type Props = {
  monthly: MonthlyRow[];
  statusData: StatusRow[];
  expenseByKategori: KategoriRow[];
  expenseColors: string[];
  incomeByClient: ClientRow[];
  payoutByMember: MemberPayoutRow[];
  taskByAssignee: TaskAssigneeRow[];
};

const tooltipStyle = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
  color: "#fafafa",
};

function ExpensePieChart({ data, colors }: { data: KategoriRow[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Expense by Kategori</h2>
        <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
          Belum ada data expense.
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Expense by Kategori</h2>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width="50%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatRupiah(Number(value)), ""]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-white/60 truncate">{d.name}</span>
              </div>
              <span className="font-semibold text-white shrink-0 ml-2">{formatRupiah(d.value)}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm font-semibold">
            <span className="text-white/70">Total</span>
            <span className="text-white">{formatRupiah(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IncomeByClientChart({ data }: { data: ClientRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Income by Client</h2>
        <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
          Belum ada data income.
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Income by Client</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000000)}jt`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={110} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatRupiah(Number(value)), "Income"]} />
          <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PayoutByMemberChart({ data }: { data: MemberPayoutRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Payout by Member</h2>
        <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
          Belum ada data payout.
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Payout by Member</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000000)}jt`} width={44} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatRupiah(Number(value)), "Payout"]} />
          <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TaskByAssigneeChart({ data }: { data: TaskAssigneeRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Task by Assignee</h2>
        <div className="h-[260px] flex items-center justify-center text-white/40 text-sm">
          Belum ada tugas aktif.
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Task by Assignee</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={110} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, name === "pending" ? "Pending" : "Active"]} />
          <Legend formatter={(value: string) => (value === "pending" ? "Pending" : "Active")} />
          <Bar dataKey="pending" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
          <Bar dataKey="active" stackId="a" fill="#3B82F6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardCharts({
  monthly,
  statusData,
  expenseByKategori,
  expenseColors,
  incomeByClient,
  payoutByMember,
  taskByAssignee,
}: Props) {
  const hasMonthly = monthly.some((m) => m.income > 0 || m.expense > 0);
  const hasStatus = statusData.some((s) => s.value > 0);

  return (
    <>
      {/* Row 1: Cash Flow + Project Status */}
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

      {/* Row 2: Expense by Kategori + Income by Client */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <ExpensePieChart data={expenseByKategori} colors={expenseColors} />
        <IncomeByClientChart data={incomeByClient} />
      </div>

      {/* Row 3: Payout by Member + Task by Assignee */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <PayoutByMemberChart data={payoutByMember} />
        <TaskByAssigneeChart data={taskByAssignee} />
      </div>
    </>
  );
}


