"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/admin/format";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";

type Details = Record<string, unknown> | string | null;

type Activity = {
  id: string | number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_name: string;
  details: Details;
  created_at: string;
};

type Props = {
  activities: Activity[];
};

const actionColor: Record<string, string> = {
  create: "bg-emerald-500/10 text-emerald-400",
  update: "bg-blue-500/10 text-blue-400",
  delete: "bg-red-500/10 text-red-400",
  login: "bg-purple-500/10 text-purple-400",
  login_failed: "bg-red-500/10 text-red-400",
  logout: "bg-white/10 text-white/50",
  export: "bg-orange-500/10 text-orange-400",
  import: "bg-orange-500/10 text-orange-400",
  connect: "bg-teal-500/10 text-teal-400",
  disconnect: "bg-white/10 text-white/50",
  finalize: "bg-amber-500/10 text-amber-400",
  sync: "bg-sky-500/10 text-sky-400",
  complete: "bg-emerald-500/10 text-emerald-400",
  backfill: "bg-white/10 text-white/50",
};

const actionLabel: Record<string, string> = {
  create: "Membuat",
  update: "Memperbarui",
  delete: "Menghapus",
  login: "Masuk",
  login_failed: "Login gagal",
  logout: "Keluar",
  export: "Mengekspor",
  import: "Mengimpor",
  connect: "Menyambung",
  disconnect: "Memutus",
  finalize: "Finalisasi",
  sync: "Sinkronisasi",
  complete: "Menyelesaikan",
  backfill: "Backfill",
};

const entityLabel: Record<string, string> = {
  product: "Barang",
  stock_movement: "Mutasi Stok",
  sale: "Penjualan",
  transaction: "Transaksi",
  journal: "Jurnal",
  payout: "Bagi Hasil",
  project: "Proyek",
  project_member: "Anggota Proyek",
  project_template: "Template",
  meeting: "Rapat",
  meeting_item: "Butir Rapat",
  attachment: "Lampiran",
  task: "Tugas",
  account: "Akun",
  member: "Anggota",
  notification: "Notifikasi",
  calendar: "Kalender",
  event_qr: "QR Event",
  user: "Pengguna",
};

const PER_PAGE = 15;

function parseDetails(d: Details): Record<string, unknown> | null {
  if (!d) return null;
  if (typeof d === "string") {
    try {
      const p: unknown = JSON.parse(d);
      if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
      return { value: p };
    } catch {
      return { raw: d };
    }
  }
  return d;
}

function shortValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "object") return Array.isArray(v) ? `[${v.length} item]` : "{…}";
  return String(v);
}

function summaryOf(details: Record<string, unknown> | null): string {
  if (!details) return "";
  const entries = Object.entries(details).filter(([k]) => k !== "before" && k !== "after");
  return entries.map(([k, v]) => `${k}: ${shortValue(v)}`).join(" · ");
}

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2) ?? "null";
  } catch {
    return String(v);
  }
}

export default function ActivityLogClient({ activities }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const actionOptions = useMemo(
    () => Array.from(new Set(activities.map((a) => a.action))).sort(),
    [activities]
  );
  const userOptions = useMemo(
    () => Array.from(new Set(activities.map((a) => a.user_name))).sort(),
    [activities]
  );

  const filtered = useMemo(() => {
    let list = activities;
    if (actionFilter) list = list.filter((a) => a.action === actionFilter);
    if (userFilter) list = list.filter((a) => a.user_name === userFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.user_name.toLowerCase().includes(q) ||
          a.entity_name.toLowerCase().includes(q) ||
          a.action.toLowerCase().includes(q) ||
          a.entity_type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, search, actionFilter, userFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Log Aktivitas</h1>
        <p className="text-white/50 mt-1">
          Riwayat aktivitas admin dan perubahan data di sistem. Setiap aksi tercatat permanen
          beserta nilai sebelum &amp; sesudah perubahan (tidak bisa dihapus).
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Aktivitas</p>
          <p className="text-xl font-bold text-white mt-1">{activities.length}</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Hari Ini</p>
          <p className="text-xl font-bold text-blue-400 mt-1">
            {activities.filter((a) => a.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length}
          </p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Pembuatan</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {activities.filter((a) => a.action === "create").length}
          </p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Penghapusan</p>
          <p className="text-xl font-bold text-red-400 mt-1">
            {activities.filter((a) => a.action === "delete").length}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Cari aktivitas..."
          className="sm:flex-1 min-w-[200px]"
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-[#151515] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[#E9A64E]"
        >
          <option value="">Semua aksi</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>{actionLabel[a] ?? a}</option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
          className="bg-[#151515] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[#E9A64E]"
        >
          <option value="">Semua pengguna</option>
          {userOptions.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
          <p className="text-lg font-medium mb-1">Belum ada aktivitas</p>
          <p className="text-sm">Aktivitas akan tercatat saat ada perubahan data.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Waktu</th>
                  <th className="px-4 py-3 font-medium">Pengguna</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                  <th className="px-4 py-3 font-medium">Tipe</th>
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((a) => {
                  const parsed = parseDetails(a.details);
                  const hasSnapshot = !!(parsed && ("before" in parsed || "after" in parsed));
                  const summary = summaryOf(parsed);
                  const isExpanded = expandedId === a.id;
                  return [
                    <tr
                      key={a.id}
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${isExpanded ? "bg-white/5" : ""}`}
                    >
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {formatDateTime(a.created_at)}
                      </td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                        {a.user_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${actionColor[a.action] ?? "bg-white/10 text-white/50"}`}>
                          {actionLabel[a.action] ?? a.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                        {entityLabel[a.entity_type] ?? a.entity_type}
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap max-w-[220px] truncate">
                        {a.entity_name}
                      </td>
                      <td className="px-4 py-3 text-white/40 text-xs max-w-[260px]">
                        {hasSnapshot && (
                          <span className="mr-1.5 px-1.5 py-0.5 rounded bg-white/10 text-white/50 whitespace-nowrap">
                            {isExpanded ? "Tutup" : "Lihat sebelum/sesudah"}
                          </span>
                        )}
                        <span className="truncate inline-block align-middle max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {summary || (hasSnapshot ? "" : parsed ? pretty(parsed) : "-")}
                        </span>
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${a.id}-detail`} className="border-b border-white/5 bg-black/30">
                        <td colSpan={6} className="px-4 py-4">
                          {hasSnapshot ? (
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-red-400/80 font-semibold mb-1">
                                  Sebelum
                                </p>
                                <pre className="text-xs text-white/70 bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                                  {parsed && "before" in parsed ? pretty(parsed.before) : "—"}
                                </pre>
                              </div>
                              <div>
                                <p className="text-[11px] uppercase tracking-wide text-emerald-400/80 font-semibold mb-1">
                                  Sesudah
                                </p>
                                <pre className="text-xs text-white/70 bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                                  {parsed && "after" in parsed ? pretty(parsed.after) : "—"}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            <pre className="text-xs text-white/70 bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
                              {parsed ? pretty(parsed) : "—"}
                            </pre>
                          )}
                          {hasSnapshot && summary && (
                            <p className="text-xs text-white/40 mt-2">{summary}</p>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={filtered.length} perPage={PER_PAGE} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
