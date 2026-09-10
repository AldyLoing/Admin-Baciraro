"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/admin/format";
import DashboardCharts from "@/components/admin/DashboardCharts";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  total_value: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type MemberStat = {
  id: number;
  name: string;
  role: string;
  photo_url: string | null;
  projectCount: number;
  totalIncome: number;
};

type MonthlyRow = { month: string; income: number; expense: number };
type StatusRow = { name: string; value: number; color: string };
type KategoriRow = { name: string; value: number };
type ClientRow = { name: string; value: number };
type MemberPayoutRow = { name: string; amount: number };
type TaskAssigneeRow = { name: string; pending: number; active: number; total: number };

type Props = {
  firstName: string;
  allProjects: Project[];
  monthly: MonthlyRow[];
  statusData: StatusRow[];
  totalRevenue: number;
  kasRiil: number;
  activeCount: number;
  completedCount: number;
  paidCount: number;
  memberStats: MemberStat[];
  journalCount: number;
  totalJournalDebit: number;
  totalJournalCredit: number;
  accountCount: number;
  expenseByKategori: KategoriRow[];
  expenseColors: string[];
  incomeByClient: ClientRow[];
  payoutByMember: MemberPayoutRow[];
  taskByAssignee: TaskAssigneeRow[];
};

const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
const statusBadge: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  paid: "bg-green-500/10 text-green-400 border border-green-500/20",
};

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek} minggu lalu`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} bulan lalu`;
  return `${Math.floor(diffMonth / 12)} tahun lalu`;
}

const rankBadge = [
  "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  "bg-gray-300/10 text-gray-300 border border-gray-400/20",
  "bg-orange-600/15 text-orange-400 border border-orange-500/20",
];

export default function DashboardClient({
  firstName,
  allProjects,
  monthly,
  statusData,
  totalRevenue,
  kasRiil,
  activeCount,
  completedCount,
  paidCount,
  memberStats,
  journalCount,
  totalJournalDebit,
  totalJournalCredit,
  accountCount,
  expenseByKategori,
  expenseColors,
  incomeByClient,
  payoutByMember,
  taskByAssignee,
}: Props) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const filteredMonthly = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const months: MonthlyRow[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      const monthTx = monthly.find((m) => {
        const mIdx = monthNames.indexOf(m.month);
        return mIdx === cursor.getMonth();
      }) || { month: monthNames[cursor.getMonth()], income: 0, expense: 0 };
      months.push(monthTx);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    if (months.length === 0) return monthly;
    return months;
  }, [dateFrom, dateTo, monthly]);

  const recentProjects = allProjects.slice(0, 5);
  const topIncome = memberStats.length > 0 ? memberStats[0].totalIncome : 1;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Halo, {firstName} 👋
          </h1>
          <p className="text-white/50 mt-1">
            Ringkasan project, pendapatan, dan kas Baciraro.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Project
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Pendapatan */}
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Pendapatan</p>
              <p className="text-2xl font-bold text-white mt-2">{formatRupiah(totalRevenue)}</p>
              <p className="text-xs text-white/40 mt-1">{allProjects.length} total project</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Kas Riil */}
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className={`absolute top-0 left-0 w-full h-1 ${kasRiil >= 0 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-red-600"}`} />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Kas Riil</p>
              <p className={`text-2xl font-bold mt-2 ${kasRiil >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatRupiah(kasRiil)}
              </p>
              <p className="text-xs text-white/40 mt-1">pemasukan − pengeluaran</p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${kasRiil >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <svg className={`w-5 h-5 ${kasRiil >= 0 ? "text-emerald-400" : "text-red-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Project Aktif */}
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Project Aktif</p>
              <p className="text-2xl font-bold text-white mt-2">{activeCount}</p>
              <p className="text-xs text-white/40 mt-1">sedang berjalan</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
        </div>

        {/* Selesai / Dibayar */}
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Selesai / Dibayar</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">{completedCount}</p>
              <p className="text-xs text-white/40 mt-1">{paidCount} sudah dibayar</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/admin/payouts" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-[#E9A64E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Buat Payout
        </Link>
        <Link href="/admin/schedule" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Lihat Jadwal
        </Link>
        <Link href="/admin/transactions" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Catat Transaksi
        </Link>
        <Link href="/admin/meetings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Tambah Meeting
        </Link>
        <Link href="/admin/activity" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Log Aktivitas
        </Link>
        <Link href="/admin/journal" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Jurnal Umum
        </Link>
        <Link href="/admin/bookkeeping" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white/70 hover:text-white hover:border-[#D97A2B]/40 hover:bg-[#D97A2B]/5 transition">
          <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Buku Besar
        </Link>
      </div>

      {/* Charts */}
      <div className="mb-8">
        <DashboardCharts
          monthly={filteredMonthly}
          statusData={statusData}
          expenseByKategori={expenseByKategori}
          expenseColors={expenseColors}
          incomeByClient={incomeByClient}
          payoutByMember={payoutByMember}
          taskByAssignee={taskByAssignee}
        />
      </div>

      {/* Accounting Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/journal" className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-purple-500/30 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Jurnal Umum</p>
          <p className="text-2xl font-bold text-white mt-2">{journalCount}</p>
          <p className="text-xs text-white/40 mt-1">total entri jurnal</p>
        </Link>
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Debit</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{formatRupiah(totalJournalDebit)}</p>
          <p className="text-xs text-white/40 mt-1">dari semua jurnal</p>
        </div>
        <div className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-white/20 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-violet-600" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Kredit</p>
          <p className="text-2xl font-bold text-violet-400 mt-2">{formatRupiah(totalJournalCredit)}</p>
          <p className="text-xs text-white/40 mt-1">dari semua jurnal</p>
        </div>
        <Link href="/admin/accounts" className="relative bg-[#151515] rounded-xl border border-white/10 p-5 overflow-hidden group hover:border-amber-500/30 transition">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Daftar Akun</p>
          <p className="text-2xl font-bold text-white mt-2">{accountCount}</p>
          <p className="text-xs text-white/40 mt-1">akun aktif</p>
        </Link>
      </div>

      {/* Balance Sheet Quick View */}
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Neraca Saldo (Ringkas)</h2>
          <Link href="/admin/bookkeeping" className="text-sm text-[#E9A64E] hover:underline">Buku Besar →</Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/10">
            <p className="text-sm text-blue-400 font-medium">Aset (Kas)</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{formatRupiah(kasRiil)}</p>
            <p className="text-xs text-white/40 mt-1">pemasukan − pengeluaran</p>
          </div>
          <div className="bg-emerald-500/5 rounded-lg p-4 border border-emerald-500/10">
            <p className="text-sm text-emerald-400 font-medium">Total Pendapatan</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupiah(totalJournalDebit)}</p>
            <p className="text-xs text-white/40 mt-1">dari jurnal</p>
          </div>
          <div className="bg-purple-500/5 rounded-lg p-4 border border-purple-500/10">
            <p className="text-sm text-purple-400 font-medium">Total Beban</p>
            <p className="text-xl font-bold text-purple-400 mt-1">{formatRupiah(totalJournalCredit)}</p>
            <p className="text-xs text-white/40 mt-1">dari jurnal</p>
          </div>
        </div>
      </div>

      {/* Date range filter (compact) */}
      <div className="bg-[#151515] rounded-xl border border-white/10 p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm font-medium text-white/70">Rentang Data:</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-sm focus:border-[#D97A2B] outline-none transition"
          />
          <span className="text-white/30">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-sm focus:border-[#D97A2B] outline-none transition"
          />
        </div>
      </div>

      {/* Bottom sections */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent projects */}
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Project Terbaru</h2>
            <Link href="/admin/projects" className="text-sm text-[#E9A64E] hover:underline">
              Lihat semua →
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <div className="text-center py-10 text-white/40">
              <svg className="w-12 h-12 mx-auto text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm">Belum ada project.</p>
              <Link href="/admin/projects/new" className="text-[#E9A64E] text-sm hover:underline mt-2 inline-block">
                + Tambah project pertama
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-white truncate group-hover:text-[#E9A64E] transition">{project.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40">{project.client_name || "Tanpa klien"}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-xs text-white/30">{relativeTime(project.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-semibold text-sm text-white">{formatRupiah(project.total_value)}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge[project.status]}`}>
                      {statusLabel[project.status] ?? project.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Member ranking */}
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Pendapatan Anggota</h2>
            <Link href="/admin/workload" className="text-sm text-[#E9A64E] hover:underline">
              Workload →
            </Link>
          </div>
          {memberStats.length === 0 ? (
            <div className="text-center py-10 text-white/40 text-sm">
              Belum ada data anggota.
            </div>
          ) : (
            <div className="space-y-3">
              {memberStats.slice(0, 6).map((m, i) => {
                const barWidth = topIncome > 0 ? Math.min(100, (m.totalIncome / topIncome) * 100) : 0;
                return (
                  <div key={m.id} className="group">
                    <div className="flex items-center gap-3">
                      {i < 3 ? (
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${rankBadge[i]}`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="w-6 text-center text-xs font-bold text-white/20 shrink-0">{i + 1}</span>
                      )}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C44A3A]/30 to-[#D97A2B]/30 text-[#E9A64E] flex items-center justify-center text-xs font-semibold shrink-0 border border-white/5">
                        {m.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photo_url} alt={m.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          m.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-white truncate">{m.name}</p>
                          <p className="text-sm font-semibold text-white shrink-0 ml-2">{formatRupiah(m.totalIncome)}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40 shrink-0">{m.projectCount} project</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
