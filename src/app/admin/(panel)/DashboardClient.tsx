"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatRupiah } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import DashboardCharts from "@/components/admin/DashboardCharts";
import Onboarding from "@/components/admin/Onboarding";
import MyTasksCard, { type MyTaskGroup } from "@/components/admin/MyTasksCard";
import Card from "@/components/ui/Card";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Icon, { type IconName } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/Button";

type Project = {
  id: string | number;
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
type AttentionItem = { id: number; title: string; due_date?: string; project_name?: string };

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
  overdueTasks: AttentionItem[];
  pendingPayouts: AttentionItem[];
  myTaskGroups: MyTaskGroup[];
};

const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
const statusTone: Record<string, BadgeTone> = { active: "blue", completed: "orange", paid: "green" };

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

const RANGES = [
  { key: "1m", label: "1 bln", months: 1 },
  { key: "3m", label: "3 bln", months: 3 },
  { key: "6m", label: "6 bln", months: 6 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"] | "custom";

const quickActions: { href: string; label: string; icon: IconName; color: string }[] = [
  { href: "/admin/projects/new", label: "Project", icon: "folder", color: "text-brand-ink" },
  { href: "/admin/transactions", label: "Pemasukan", icon: "plus", color: "text-ok" },
  { href: "/admin/transactions", label: "Pengeluaran", icon: "minus", color: "text-bad" },
  { href: "/admin/schedule", label: "Tugas", icon: "cal", color: "text-info" },
  { href: "/admin/meetings", label: "Rapat", icon: "chat", color: "text-[#c4b5fd]" },
  { href: "/admin/payouts", label: "Payout", icon: "coin", color: "text-warn" },
];

function Stat({
  label,
  value,
  sub,
  valueClass,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  icon: IconName;
}) {
  return (
    <Card className="flex flex-col gap-2.5 px-5 py-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-ink-2">
          <Icon name={icon} className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <span className={cn("text-[26px] font-bold leading-tight tracking-tight text-ink", valueClass)}>{value}</span>
      <span className="text-[13px] text-ink-3">{sub}</span>
    </Card>
  );
}

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
  overdueTasks,
  pendingPayouts,
  myTaskGroups,
}: Props) {
  const [range, setRange] = useState<RangeKey>("6m");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  function pickRange(key: (typeof RANGES)[number]["key"], months: number) {
    const d = new Date();
    d.setMonth(d.getMonth() - (months - 1));
    setDateFrom(d.toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
    setRange(key);
  }

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
  const attentionCount = overdueTasks.length + pendingPayouts.length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Onboarding />

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[28px]">Halo, {firstName}</h1>
          <p className="mt-1 text-sm text-ink-2">Ringkasan project, kas, dan tugas Baciraro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Rentang data grafik" className="flex rounded-[10px] border border-line bg-surface p-[3px]">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={range === r.key}
                onClick={() => pickRange(r.key, r.months)}
                className={cn(
                  "h-8 rounded-[7px] px-3 text-[13px] transition",
                  range === r.key ? "bg-[#26262b] font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"
                )}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={range === "custom"}
              onClick={() => setRange("custom")}
              className={cn(
                "h-8 rounded-[7px] px-3 text-[13px] transition",
                range === "custom" ? "bg-[#26262b] font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"
              )}
            >
              Kustom
            </button>
          </div>
          <Link href="/admin/transactions" className={buttonClass("secondary")}>
            Catat transaksi
          </Link>
          <Link href="/admin/projects/new" className={buttonClass("primary")}>
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
            Project baru
          </Link>
        </div>
      </div>

      {range === "custom" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            Dari
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-line-2 bg-field px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            Sampai
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-line-2 bg-field px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
          <span className="text-xs text-ink-3">Grafik menampilkan data maksimal 6 bulan terakhir.</span>
        </div>
      )}

      {/* Tugas saya: shortcut centang tugas selesai */}
      <MyTasksCard groups={myTaskGroups} />

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total pendapatan" value={formatRupiah(totalRevenue)} sub={`${allProjects.length} total project`} icon="trend" />
        <Stat
          label="Kas riil"
          value={formatRupiah(kasRiil)}
          sub="pemasukan − pengeluaran"
          valueClass={kasRiil >= 0 ? "text-ok" : "text-bad"}
          icon="wallet"
        />
        <Stat label="Project aktif" value={String(activeCount)} sub="sedang berjalan" icon="folder" />
        <Stat
          label="Selesai / dibayar"
          value={String(completedCount)}
          sub={`${paidCount} sudah dibayar`}
          valueClass="text-ok"
          icon="check"
        />
      </div>

      {/* Perlu perhatian + aksi cepat */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="text-base font-bold text-ink">Perlu perhatian</h2>
            {attentionCount > 0 && <Badge tone="red">{attentionCount}</Badge>}
          </div>
          {attentionCount === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">Tidak ada yang perlu diperhatikan saat ini.</p>
          ) : (
            <ul>
              {overdueTasks.map((t) => (
                <li key={`task-${t.id}`} className="flex items-center gap-3 border-t border-[#1f1f23] py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2e1414] text-bad">
                    <Icon name="alert" className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink">Tugas “{t.title}” terlambat</span>
                  <Link href="/admin/schedule" className={buttonClass("secondary", "sm")}>
                    Buka
                  </Link>
                </li>
              ))}
              {pendingPayouts.map((p) => (
                <li key={`payout-${p.id}`} className="flex items-center gap-3 border-t border-[#1f1f23] py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b220c] text-warn">
                    <Icon name="coin" className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-ink">Payout “{p.project_name}” belum difinalisasi</span>
                  <Link href="/admin/payouts" className={buttonClass("secondary", "sm")}>
                    Finalisasi
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold text-ink">Aksi cepat</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex h-11 items-center gap-2.5 rounded-[10px] border border-line bg-surface-2 px-3 text-sm font-medium text-ink transition hover:border-line-2 hover:bg-white/[0.08]"
              >
                <span className={cn("flex", a.color)}>
                  <Icon name={a.icon} className="h-4 w-4" strokeWidth={2} />
                </span>
                {a.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-ink-3">
            Tip: cari apa saja lewat kolom pencarian di bagian atas halaman.
          </p>
        </Card>
      </div>

      {/* Grafik */}
      <DashboardCharts
        monthly={filteredMonthly}
        statusData={statusData}
        expenseByKategori={expenseByKategori}
        expenseColors={expenseColors}
        incomeByClient={incomeByClient}
        payoutByMember={payoutByMember}
        taskByAssignee={taskByAssignee}
      />

      {/* Ringkasan pembukuan */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-ink">Ringkasan pembukuan</h2>
          <Link href="/admin/bookkeeping" className="text-[13px] font-semibold text-brand-ink hover:underline">
            Buku Besar
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-[13px] font-medium text-ink-2">Aset (kas)</p>
            <p className="mt-1.5 text-lg font-bold text-ink">{formatRupiah(kasRiil)}</p>
            <p className="mt-1 text-xs text-ink-3">pemasukan − pengeluaran</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-[13px] font-medium text-ink-2">Total debit</p>
            <p className="mt-1.5 text-lg font-bold text-info">{formatRupiah(totalJournalDebit)}</p>
            <p className="mt-1 text-xs text-ink-3">dari semua jurnal</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-[13px] font-medium text-ink-2">Total kredit</p>
            <p className="mt-1.5 text-lg font-bold text-[#c4b5fd]">{formatRupiah(totalJournalCredit)}</p>
            <p className="mt-1 text-xs text-ink-3">dari semua jurnal</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-[13px] font-medium text-ink-2">Jurnal &amp; akun</p>
            <p className="mt-1.5 text-lg font-bold text-ink">{journalCount} entri</p>
            <p className="mt-1 text-xs text-ink-3">
              <Link href="/admin/journal" className="font-semibold text-brand-ink hover:underline">
                Jurnal umum
              </Link>
              {" · "}
              <Link href="/admin/accounts" className="font-semibold text-brand-ink hover:underline">
                {accountCount} akun
              </Link>
            </p>
          </div>
        </div>
      </Card>

      {/* Bagian bawah */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Project terbaru</h2>
            <Link href="/admin/projects" className="text-[13px] font-semibold text-brand-ink hover:underline">
              Lihat semua
            </Link>
          </div>
          {recentProjects.length === 0 ? (
            <div className="py-10 text-center text-ink-3">
              <p className="text-sm">Belum ada project.</p>
              <Link href="/admin/projects/new" className="mt-2 inline-block text-sm font-semibold text-brand-ink hover:underline">
                + Tambah project pertama
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="group flex items-center justify-between rounded-lg border border-transparent p-3 transition hover:border-line hover:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-ink">{project.name}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {project.client_name || "Tanpa klien"} · {relativeTime(project.created_at)}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right">
                    <p className="text-sm font-semibold text-ink">{formatRupiah(project.total_value)}</p>
                    <Badge tone={statusTone[project.status] ?? "gray"} className="mt-1">
                      {statusLabel[project.status] ?? project.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">Pendapatan anggota</h2>
            <Link href="/admin/workload" className="text-[13px] font-semibold text-brand-ink hover:underline">
              Workload
            </Link>
          </div>
          {memberStats.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-3">Belum ada data anggota.</div>
          ) : (
            <div className="space-y-3">
              {memberStats
                .filter((m) => m.projectCount > 0)
                .slice(0, 6)
                .map((m, i) => {
                  const barWidth = topIncome > 0 ? Math.min(100, (m.totalIncome / topIncome) * 100) : 0;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      {i < 3 ? (
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            rankBadge[i]
                          )}
                        >
                          {i + 1}
                        </span>
                      ) : (
                        <span className="w-6 shrink-0 text-center text-xs font-bold text-ink-3">{i + 1}</span>
                      )}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-2 bg-surface-2 text-xs font-semibold text-brand-ink">
                        {m.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.photo_url} alt={m.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          m.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                          <p className="ml-2 shrink-0 text-sm font-semibold text-ink">{formatRupiah(m.totalIncome)}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", i === 0 ? "bg-brand" : "bg-zinc-600")}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-xs text-ink-3">{m.projectCount} project</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
