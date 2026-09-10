"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { formatRupiah, formatDate } from "@/lib/admin/format";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import ProjectStatusActions from "./ProjectStatusActions";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  total_value: number;
  status: string;
  created_at: string;
  attachments?: Array<{ name: string; url: string; size: number; uploaded_at: string }>;
};

type Props = {
  projects: Project[];
  isAdmin: boolean;
};

const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
const statusColor: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-400",
  paid: "bg-green-600 text-white",
};

const PER_PAGE = 15;

export default function ProjectsClient({ projects, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, Array<{ name: string; url: string; size: number; uploaded_at: string }>>>({});
  const [attachName, setAttachName] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachLoading, setAttachLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.client_name ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, search, statusFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  async function toggleAttachments(projectId: string) {
    if (expandedId === projectId) { setExpandedId(null); return; }
    setExpandedId(projectId);
    if (!attachments[projectId]) {
      try {
        const res = await fetch(`/api/admin/projects/${projectId}/attachments`);
        const data = await res.json();
        if (data.ok) setAttachments((prev) => ({ ...prev, [projectId]: data.attachments }));
      } catch { /* silent */ }
    }
  }

  async function addAttachment(projectId: string) {
    if (!attachName.trim()) return;
    setAttachLoading(projectId);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: attachName.trim(), url: attachUrl.trim() || null, size: 0 }),
      });
      const data = await res.json();
      if (data.ok) {
        setAttachments((prev) => ({ ...prev, [projectId]: data.attachments }));
        setAttachName(""); setAttachUrl("");
      }
    } catch { /* silent */ }
    setAttachLoading(null);
  }

  async function removeAttachment(projectId: string, index: number) {
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/attachments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      const data = await res.json();
      if (data.ok) setAttachments((prev) => ({ ...prev, [projectId]: data.attachments }));
    } catch { /* silent */ }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Project & Bagi Hasil</h1>
          <p className="text-white/50 mt-1">Kelola project, kontribusi anggota, dan pembagian hasil.</p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/projects/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Project
          </Link>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        {(["all", "active", "completed", "paid"] as const).map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${statusFilter === s ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white" : "bg-[#151515] border border-white/10 text-white/60 hover:bg-white/5"}`}>
            {s === "all" ? "Semua" : statusLabel[s]}
          </button>
        ))}
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Cari project..." className="sm:flex-1 min-w-[200px]" />
      </div>

      {paginated.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center">
          <p className="text-white/40">Belum ada project.</p>
          {isAdmin && (
            <Link href="/admin/projects/new" className="text-[#E9A64E] text-sm font-medium hover:underline mt-2 inline-block">
              + Tambah project pertama
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Klien</th>
                    <th className="px-5 py-3 font-medium">Nilai</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Dibuat</th>
                    <th className="px-5 py-3 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginated.map((project) => {
                    const attCount = project.attachments?.length ?? attachments[project.id]?.length ?? 0;
                    return (
                    <Fragment key={project.id}>
                    <tr className="hover:bg-white/5 transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/admin/projects/${project.id}`} className="font-medium text-white hover:text-[#E9A64E] transition">
                            {project.name}
                          </Link>
                          {isAdmin && attCount > 0 && (
                            <button onClick={() => toggleAttachments(project.id)}
                              className="text-[10px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-full hover:bg-white/10 transition">
                              📎 {attCount}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-white/50">{project.client_name || "-"}</td>
                      <td className="px-5 py-4 font-semibold text-white">{formatRupiah(project.total_value)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusColor[project.status]}`}>
                          {statusLabel[project.status] ?? project.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-white/50">{formatDate(project.created_at)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex flex-col items-end gap-2">
                          <ProjectStatusActions
                            projectId={project.id}
                            currentStatus={project.status}
                            isAdmin={isAdmin}
                          />
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button onClick={() => toggleAttachments(project.id)}
                                className="text-white/30 hover:text-[#E9A64E] transition p-1" title="Lampiran">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                              </button>
                            )}
                            <Link
                              href={`/admin/projects/${project.id}`}
                              className="inline-flex items-center gap-1 text-[#E9A64E] hover:underline font-medium"
                            >
                              Detail
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                    {expandedId === project.id && isAdmin && (
                      <tr key={`${project.id}-att`}>
                        <td colSpan={6} className="px-5 py-3 bg-[#0d0d0d]">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-white/50 uppercase">Lampiran</p>
                            <div className="space-y-1">
                              {(attachments[project.id] ?? []).map((att, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm bg-[#151515] rounded-lg px-3 py-2 border border-white/10">
                                  <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  <span className="text-white">{att.name}</span>
                                  {att.url && <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-[#E9A64E] text-xs hover:underline">Buka</a>}
                                  <button onClick={() => removeAttachment(project.id, i)} className="ml-auto text-white/30 hover:text-red-400 transition text-xs">Hapus</button>
                                </div>
                              ))}
                              {(attachments[project.id] ?? []).length === 0 && (
                                <p className="text-xs text-white/30">Belum ada lampiran.</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input value={attachName} onChange={(e) => setAttachName(e.target.value)} placeholder="Nama file" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-sm placeholder:text-white/25 focus:border-[#D97A2B] outline-none" />
                              <input value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} placeholder="URL (opsional)" className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-sm placeholder:text-white/25 focus:border-[#D97A2B] outline-none" />
                              <button onClick={() => addAttachment(project.id)} disabled={attachLoading === project.id}
                                className="px-4 py-2 rounded-lg bg-[#D97A2B] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                                {attachLoading === project.id ? "..." : "+ Tambah"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} totalItems={filtered.length} perPage={PER_PAGE} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
