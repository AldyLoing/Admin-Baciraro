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

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, date, type, amount, source, description, reference, account_code")
    .eq("project_id", id)
    .order("date", { ascending: true });

  const { data: payouts } = await supabase
    .from("payouts")
    .select("id, date, total_amount, orders_fee, net_amount, status, finalized_at")
    .eq("project_id", id)
    .order("date", { ascending: false });

  const contributions = (projectMembers ?? []).map((pm: any) => ({
    profileId: pm.member_id,
    percent: Number(pm.contribution_percent),
  }));

  const dist = calculateDistribution(Number(project.total_value) || 0, contributions);

  const allTx = (transactions ?? []) as any[];
  const totalIncome = allTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpense = allTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const allPayouts = (payouts ?? []) as any[];
  const totalPaidPayout = allPayouts.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.net_amount), 0);
  const pendingPayout = allPayouts.filter((p: any) => p.status !== "paid").reduce((s: number, p: any) => s + Number(p.net_amount), 0);

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

      {/* Financial Summary */}
      <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Ringkasan Keuangan Project</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-500/10 rounded-lg p-4">
            <p className="text-sm text-blue-400">Total Income</p>
            <p className="text-xl font-bold text-blue-400 mt-1">{formatRupiah(totalIncome)}</p>
            <p className="text-xs text-white/40 mt-1">{allTx.filter((t: any) => t.type === "income").length} transaksi</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-4">
            <p className="text-sm text-red-400">Total Expense</p>
            <p className="text-xl font-bold text-red-400 mt-1">{formatRupiah(totalExpense)}</p>
            <p className="text-xs text-white/40 mt-1">{allTx.filter((t: any) => t.type === "expense").length} transaksi</p>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-4">
            <p className="text-sm text-amber-400">Sudah Dibayar</p>
            <p className="text-xl font-bold text-amber-400 mt-1">{formatRupiah(totalPaidPayout)}</p>
            <p className="text-xs text-white/40 mt-1">{allPayouts.filter((p: any) => p.status === "paid").length} payout</p>
          </div>
          <div className={`rounded-lg p-4 ${(totalIncome - totalExpense - totalPaidPayout) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
            <p className={`text-sm ${(totalIncome - totalExpense - totalPaidPayout) >= 0 ? "text-emerald-400" : "text-red-400"}`}>Sisa Dana</p>
            <p className={`text-xl font-bold mt-1 ${(totalIncome - totalExpense - totalPaidPayout) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatRupiah(totalIncome - totalExpense - totalPaidPayout)}
            </p>
            <p className="text-xs text-white/40 mt-1">income − expense − payout</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {allTx.length > 0 && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Transaksi Project</h2>
            <a href="/admin/transactions" className="text-sm text-[#E9A64E] hover:underline">Lihat semua →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">REF</th>
                  <th className="px-3 py-2 font-medium">Jenis</th>
                  <th className="px-3 py-2 font-medium">Keterangan</th>
                  <th className="px-3 py-2 font-medium text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {allTx.slice(-5).reverse().map((t: any) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 text-white/60 whitespace-nowrap">
                      {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(t.date))}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-white/50">{t.reference || "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${t.type === "income" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
                        {t.type === "income" ? "Masuk" : "Keluar"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white">{t.source}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${t.type === "income" ? "text-blue-400" : "text-red-400"}`}>
                      {t.type === "income" ? "+" : "-"}{formatRupiah(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payout History */}
      {allPayouts.length > 0 && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Riwayat Payout</h2>
            <a href="/admin/payouts" className="text-sm text-[#E9A64E] hover:underline">Lihat semua →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-3 py-2 font-medium">Tanggal</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Kas</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {allPayouts.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 text-white/60 whitespace-nowrap">
                      {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(p.date))}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : p.status === "processing" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {p.status === "paid" ? "Dibayar" : p.status === "processing" ? "Diproses" : "Menunggu"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-amber-400">{formatRupiah(p.orders_fee)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{formatRupiah(p.net_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Distribution Summary */}
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
