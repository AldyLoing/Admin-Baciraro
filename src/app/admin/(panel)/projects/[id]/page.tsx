import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { formatRupiah, calculateDistribution, KAS_PERCENT } from "@/lib/admin/format";
import ProjectDetailClient from "./ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();

  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("id, member_id, name, contribution_percent, amount, tugas, team_members(id, name, role, photo_url)")
    .eq("project_id", id)
    .order("contribution_percent", { ascending: false });

  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, name, role")
    .order("name");

  const contributions = (projectMembers ?? []).map((pm: any) => ({
    profileId: pm.member_id,
    percent: Number(pm.contribution_percent),
  }));

  const dist = calculateDistribution(Number(project.total_value) || 0, contributions);

  const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
  const statusColor: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    paid: "bg-green-600 text-white",
  };

  return (
    <div className="max-w-5xl mx-auto">
      <ProjectDetailClient
        project={project}
        members={(projectMembers ?? []).map((pm: any) => ({
          pm_id: pm.id,
          member_id: pm.member_id ?? null,
          name: pm.name ?? pm.team_members?.name ?? "Kontributor",
          role: pm.team_members?.role ?? null,
          avatar_url: pm.team_members?.photo_url ?? null,
          contribution_percent: Number(pm.contribution_percent),
          amount: pm.amount == null ? null : Number(pm.amount),
          tugas: pm.tugas ?? null,
        }))}
        allMembers={(allMembers ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        isAdmin={admin?.is_admin ?? false}
        statusLabel={statusLabel}
        statusColor={statusColor}
      />

      <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Ringkasan Bagi Hasil</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-sm text-white/50">Nilai Total</p>
            <p className="text-xl font-bold text-white mt-1">{formatRupiah(dist.total)}</p>
          </div>
          <div className="bg-[#D97A2B]/10 rounded-lg p-4">
            <p className="text-sm text-[#E9A64E]">Kas Baciraro ({KAS_PERCENT}%)</p>
            <p className="text-xl font-bold text-[#E9A64E] mt-1">{formatRupiah(dist.kasAmount)}</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-4">
            <p className="text-sm text-emerald-400">Dibagikan ke Anggota</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupiah(dist.distributable)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
