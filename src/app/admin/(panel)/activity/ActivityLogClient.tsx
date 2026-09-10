"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/admin/format";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";

type Activity = {
  id: string | number;
  user_name: string;
  action: string;
  entity_type: string;
  entity_name: string;
  details: string | null;
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
  logout: "bg-white/10 text-white/50",
  export: "bg-orange-500/10 text-orange-400",
};

const actionLabel: Record<string, string> = {
  create: "Membuat",
  update: "Memperbarui",
  delete: "Menghapus",
  login: "Masuk",
  logout: "Keluar",
  export: "Mengekspor",
};

const PER_PAGE = 15;

export default function ActivityLogClient({ activities }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return activities;
    const q = search.toLowerCase();
    return activities.filter(
      (a) =>
        a.user_name.toLowerCase().includes(q) ||
        a.entity_name.toLowerCase().includes(q) ||
        a.action.toLowerCase().includes(q)
    );
  }, [activities, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Log Aktivitas</h1>
        <p className="text-white/50 mt-1">
          Riwayat aktivitas admin dan perubahan data di sistem.
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
                {paginated.map((a) => (
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
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
                      {a.entity_type}
                    </td>
                    <td className="px-4 py-3 text-white whitespace-nowrap">
                      {a.entity_name}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs max-w-[200px] truncate">
                      {a.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={filtered.length} perPage={PER_PAGE} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
