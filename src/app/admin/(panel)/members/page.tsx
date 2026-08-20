import Link from "next/link";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { formatRupiah, KAS_PERCENT } from "@/lib/admin/format";
import MembersManager from "./MembersManager";

export default async function AdminMembersPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, role, division, photo_url, email, username, is_admin, status")
    .order("name");

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select(
      "member_id, contribution_percent, project_id, projects!inner(name, status, total_value, created_at)"
    )
    .order("created_at", { ascending: false });

  const { data: payoutMembers } = await supabase
    .from("payout_members")
    .select("member_id, amount");

  const { data: payouts } = await supabase
    .from("payouts")
    .select("net_amount, status");

  const allProjects = new Map<string, { name: string; status: string; total_value: number }>();
  (projectMembers ?? []).forEach((pm: any) => {
    if (pm.projects) {
      allProjects.set(pm.project_id, {
        name: pm.projects.name,
        status: pm.projects.status,
        total_value: Number(pm.projects.total_value),
      });
    }
  });

  const statusLabel: Record<string, string> = { active: "Aktif", completed: "Selesai", paid: "Dibayar" };
  const statusColor: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    paid: "bg-green-600 text-white",
  };

  const stats = (members ?? []).map((member) => {
    const rows = (projectMembers ?? []).filter((pm: any) => pm.member_id === member.id);
    const projectCount = rows.length;
    const activeProjects = rows.filter((pm: any) => pm.projects?.status === "active").length;
    const paidProjects = rows.filter((pm: any) => pm.projects?.status === "paid").length;

    const totalIncome = (payoutMembers ?? [])
      .filter((pm: any) => pm.member_id === member.id)
      .reduce((sum: number, pm: any) => sum + Number(pm.amount), 0);

    const pendingIncome = rows.reduce((sum: number, pm: any) => {
      if (pm.projects?.status !== "completed") return sum;
      const value = Number(pm.projects?.total_value) || 0;
      const percent = Number(pm.contribution_percent) || 0;
      return sum + ((value * (100 - KAS_PERCENT)) / 100) * (percent / 100);
    }, 0);

    return { ...member, projectCount, activeProjects, paidProjects, totalIncome, pendingIncome, rows };
  });

  const totalIncomeAll = stats.reduce((s, m) => s + m.totalIncome, 0);
  const pendingPayout = (payouts ?? [])
    .filter((p: any) => p.status !== "paid")
    .reduce((s: number, p: any) => s + Number(p.net_amount), 0);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Statistik Anggota</h1>
        <p className="text-white/50 mt-1">
          Data anggota dari tim Baciraro (halaman /leadership). Jumlah project yang ditangani dan
          pendapatan setiap anggota (Kas Baciraro {KAS_PERCENT}% dipotong otomatis).
        </p>
      </div>

      <MembersManager
        members={(members ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          division: m.division,
          photo_url: m.photo_url,
          email: m.email,
          username: m.username ?? m.email ?? "",
          is_admin: m.is_admin,
          status: m.status || "active",
        }))}
        isAdmin={admin?.is_admin ?? false}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Anggota</p>
          <p className="text-xl font-bold text-white mt-1">{stats.length} orang</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Project Ditangani</p>
          <p className="text-xl font-bold text-white mt-1">{stats.reduce((s, m) => s + m.projectCount, 0)}</p>
          <p className="text-xs text-white/40 mt-1">total keterlibatan</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Dibayar ke Anggota</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupiah(totalIncomeAll)}</p>
          <p className="text-xs text-white/40 mt-1">dari payout</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Payout Belum Dibayar</p>
          <p className="text-xl font-bold text-[#E9A64E] mt-1">{formatRupiah(pendingPayout)}</p>
          <p className="text-xs text-white/40 mt-1">pending + diproses</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {stats.map((m) => (
          <div key={m.id} className="bg-[#151515] rounded-xl border border-white/10 p-6">
            <div className="flex items-center gap-4 mb-4">
              {m.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo_url} alt={m.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#D97A2B]/20 text-[#E9A64E] flex items-center justify-center text-sm font-semibold shrink-0">
                  {m.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white">{m.name}</p>
                  {m.is_admin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#D97A2B] text-white font-medium">ADMIN</span>
                  )}
                </div>
                <p className="text-sm text-white/50">{m.role}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-emerald-400">{formatRupiah(m.totalIncome)}</p>
                <p className="text-xs text-white/40">payout diterima</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">{m.projectCount}</p>
                <p className="text-xs text-white/50">Project</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{m.activeProjects}</p>
                <p className="text-xs text-white/50">Aktif</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-emerald-400">{m.paidProjects}</p>
                <p className="text-xs text-white/50">Dibayar</p>
              </div>
            </div>

            {m.pendingIncome > 0 && (
              <p className="text-xs text-orange-400 mb-3 bg-[#D97A2B]/10 rounded-lg px-3 py-2">
                Belum dibayar: {formatRupiah(m.pendingIncome)} (project selesai, menunggu pembayaran)
              </p>
            )}

            {m.rows.length > 0 ? (
              <div className="space-y-2">
                {m.rows.map((pm: any) => (
                  <div key={pm.project_id} className="flex items-center justify-between text-sm py-1.5 border-t border-white/5">
                    <div className="min-w-0 flex-1 pr-3">
                      <Link href={`/admin/projects/${pm.project_id}`} className="font-medium text-white hover:text-[#E9A64E] transition truncate block">
                        {pm.projects?.name}
                      </Link>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium mr-3 ${statusColor[pm.projects?.status]}`}>
                      {statusLabel[pm.projects?.status] ?? pm.projects?.status}
                    </span>
                    <span className="text-xs text-white/50 mr-3">{pm.contribution_percent}%</span>
                    {pm.projects?.status === "paid" && (
                      <span className="font-semibold text-emerald-400 w-24 text-right">
                        {formatRupiah(((Number(pm.projects?.total_value) * (100 - KAS_PERCENT)) / 100) * (Number(pm.contribution_percent) / 100))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40 text-center py-3">Belum terlibat di project mana pun.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
