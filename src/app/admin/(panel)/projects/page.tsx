import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { formatRupiah, formatDate } from "@/lib/admin/format";
import ProjectStatusActions from "./ProjectStatusActions";

export default async function AdminProjectsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const isAdmin = admin?.is_admin ?? false;

  const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
  const statusColor: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    paid: "bg-green-600 text-white",
  };

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

      {(!projects || projects.length === 0) ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center">
          <p className="text-white/40">Belum ada project.</p>
          {isAdmin && (
            <Link href="/admin/projects/new" className="text-[#E9A64E] text-sm font-medium hover:underline mt-2 inline-block">
              + Tambah project pertama
            </Link>
          )}
        </div>
      ) : (
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
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-white/5 transition">
                    <td className="px-5 py-4">
                      <Link href={`/admin/projects/${project.id}`} className="font-medium text-white hover:text-[#E9A64E] transition">
                        {project.name}
                      </Link>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
