"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/admin/format";
import ReportsCharts from "@/components/admin/ReportsCharts";

export type Summary = { totalIncome: number; totalExpense: number; netProfit: number; totalKas: number };
export type PLRow = { id: number; name: string; client_name: string | null; status: string; income: number; expense: number; kas: number; net: number; distribusi: number };
export type MonthlyRow = { month: string; income: number; expense: number };
export type MemberDist = { name: string; amount: number };
export type Transaction = { id: number; date: string; type: string; amount: number | string; source: string | null; description: string | null; project_id: number | null };
export type Payout = { id: number; project_id: number | null; project_name: string | null; date: string; net_amount: number | string; status: string; orders_fee: number | string };

type Props = {
  plByProject: PLRow[];
  memberDistribution: MemberDist[];
  allTransactions: Transaction[];
  allPayouts: Payout[];
};

export default function ReportsClient({ plByProject, memberDistribution, allTransactions, allPayouts }: Props) {
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<"ringkasan" | "pl" | "trend" | "distribusi">("ringkasan");

  const filtered = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    const tx = allTransactions.filter((t) => { const d = new Date(t.date); return d >= from && d <= to; });
    const inc = tx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = tx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

    const filteredPayouts = allPayouts.filter((p) => { const d = new Date(p.date); return d >= from && d <= to; });
    const kas = filteredPayouts.reduce((s, p) => s + Number(p.orders_fee || 0), 0);

    const isAllPaid = (projectId: number | null) => {
      if (!projectId) return false;
      const pp = allPayouts.filter((po) => po.project_id === projectId);
      return pp.length > 0 && pp.every((po) => po.status === "paid");
    };

    const projectIds = new Set(tx.map((t) => t.project_id).filter(Boolean));
    const pl = Array.from(projectIds).map((pid) => {
      const ptx = tx.filter((t) => t.project_id === pid);
      const p = plByProject.find((p) => p.id === pid);
      const pi = ptx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const pe = ptx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      const pk = filteredPayouts.filter((p) => p.project_id === pid).reduce((s, t) => s + Number(t.orders_fee || 0), 0);
      const netIncome = pi - pe;
      return { id: pid, name: p?.name || "Unknown", client_name: p?.client_name, status: p?.status || "", income: pi, expense: pe, kas: pk, net: netIncome, distribusi: netIncome - pk };
    }).filter((p) => p.income > 0 || p.expense > 0).sort((a, b) => b.distribusi - a.distribusi);

    const confirmedNet = pl.filter((p) => isAllPaid(p.id)).reduce((s, p) => s + p.distribusi, 0);

    const monthMap = new Map<string, { income: number; expense: number }>();
    const start = new Date(from);
    const end = new Date(to);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, { income: 0, expense: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    for (const t of tx) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthMap.get(key);
      if (bucket) {
        if (t.type === "income") bucket.income += Number(t.amount);
        else bucket.expense += Number(t.amount);
      }
    }

    return { totalIncome: inc, totalExpense: exp, netProfit: inc - exp, confirmedNet, totalKas: kas, pl, monthly: Array.from(monthMap.entries()).map(([month, data]) => ({ month, ...data })) };
  }, [dateFrom, dateTo, allTransactions, allPayouts, plByProject]);

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Laporan Keuangan Baciraro"],
      [`${dateFrom} s/d ${dateTo}`],
      [],
      ["Ringkasan"],
      ["Total Pendapatan", filtered.totalIncome],
      ["Total Pengeluaran", filtered.totalExpense],
      ["Laba Bersih", filtered.netProfit],
      ["Total Kas Baciraro", filtered.totalKas],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Ringkasan");

    // P&L per project
    const plData = [["Project", "Client", "Status", "Payout", "Pendapatan", "Pengeluaran", "Bersih", "Distribusi"]];
    for (const p of filtered.pl) {
      const projectPayouts = allPayouts.filter((po) => po.project_id === p.id);
      const allPaid = projectPayouts.length > 0 && projectPayouts.every((po) => po.status === "paid");
      plData.push([p.name, p.client_name || "", p.status, allPaid ? "Dibayar" : "Proses", String(p.income), String(p.expense), allPaid ? String(p.net) : "Proses", allPaid ? String(p.distribusi) : "Proses"]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plData), "P&L Project");

    // Transactions
    const txData = [["Tanggal", "Jenis", "Sumber", "Keterangan", "Jumlah", "Project ID"]];
    for (const t of allTransactions) {
      txData.push([t.date, t.type, t.source ?? "", t.description ?? "", String(t.amount), String(t.project_id ?? "")]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(txData), "Transaksi");

    XLSX.writeFile(wb, `Laporan_Baciraro_${dateFrom}_${dateTo}.xlsx`);
  };

  const tabs = [
    { key: "ringkasan" as const, label: "Ringkasan" },
    { key: "pl" as const, label: "P&L Project" },
    { key: "trend" as const, label: "Trend Bulanan" },
    { key: "distribusi" as const, label: "Distribusi Member" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/admin")}
        className="text-sm text-white/50 hover:text-[#E9A64E] transition flex items-center gap-1 mb-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Dashboard
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Laporan</h1>
          <p className="text-white/50 mt-1">Ringkasan keuangan dan analitik Baciraro.</p>
        </div>
        <button onClick={exportXlsx} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Export XLSX
        </button>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <label className="text-sm text-white/50">Dari</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white outline-none focus:border-white/20" />
        <label className="text-sm text-white/50">Sampai</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg bg-[#151515] border border-white/10 text-sm text-white outline-none focus:border-white/20" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === t.key ? "border-[#D97A2B] text-white" : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Ringkasan */}
      {activeTab === "ringkasan" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Pendapatan</p>
            <p className="text-2xl font-bold text-blue-400 mt-2">{formatRupiah(filtered.totalIncome)}</p>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Total Pengeluaran</p>
            <p className="text-2xl font-bold text-red-400 mt-2">{formatRupiah(filtered.totalExpense)}</p>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Bersih (Income - Expense)</p>
            <p className={`text-2xl font-bold mt-2 ${filtered.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(filtered.netProfit)}</p>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Siap Distribusi</p>
            <p className={`text-2xl font-bold mt-2 ${filtered.confirmedNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(filtered.confirmedNet)}</p>
            <p className="text-[11px] text-white/40 mt-1">Payout sudah selesai</p>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
            <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Kas Baciraro</p>
            <p className="text-2xl font-bold text-[#E9A64E] mt-2">{formatRupiah(filtered.totalKas)}</p>
          </div>
        </div>
      )}

      {/* Tab: P&L */}
      {activeTab === "pl" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payout</th>
                  <th className="px-4 py-3 font-medium text-right">Pendapatan</th>
                  <th className="px-4 py-3 font-medium text-right">Pengeluaran</th>
                  <th className="px-4 py-3 font-medium text-right">Bersih</th>
                  <th className="px-4 py-3 font-medium text-right">Distribusi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.pl.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">Tidak ada data</td></tr>
                ) : (
                  filtered.pl.map((p) => {
                    const projectPayouts = allPayouts.filter((po) => po.project_id === p.id);
                    const hasPaidPayout = projectPayouts.some((po) => po.status === "paid");
                    const allPaid = projectPayouts.length > 0 && projectPayouts.every((po) => po.status === "paid");
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-white/60">{p.client_name || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${p.status === "paid" ? "bg-green-600 text-white" : p.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                            {p.status === "paid" ? "Lunas" : p.status === "completed" ? "Selesai" : "Aktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {allPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400">Dibayar</span>
                          ) : hasPaidPayout || projectPayouts.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400">Proses</span>
                          ) : (
                            <span className="text-white/30">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400">{formatRupiah(p.income)}</td>
                        <td className="px-4 py-3 text-right text-red-400">{formatRupiah(p.expense)}</td>
                        <td className="px-4 py-3 text-right">
                          {allPaid ? (
                            <span className={`font-semibold ${p.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(p.net)}</span>
                          ) : (
                            <span className="text-amber-400 text-xs font-medium">Proses</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {allPaid ? (
                            <span className={`font-semibold ${p.distribusi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(p.distribusi)}</span>
                          ) : (
                            <span className="text-amber-400 text-xs font-medium">Proses</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Trend */}
      {activeTab === "trend" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6">
          <h3 className="text-sm font-semibold text-white/70 mb-4">Trend Pendapatan vs Pengeluaran</h3>
          <ReportsCharts type="trend" data={filtered.monthly} />
        </div>
      )}

      {/* Tab: Distribusi */}
      {activeTab === "distribusi" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6">
          <h3 className="text-sm font-semibold text-white/70 mb-4">Total Payout per Member</h3>
          <ReportsCharts type="distribution" data={memberDistribution} />
        </div>
      )}
    </div>
  );
}
