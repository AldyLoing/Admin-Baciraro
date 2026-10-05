import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateDistribution } from "@/lib/admin/format";
import ProjectDetailClient from "./ProjectDetailClient";

export const revalidate = 30;

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
    .select("id, name, client_name, description, total_value, status, created_at, completed_at")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  const [{ data: projectMembers }, { data: allMembers }, { data: transactions }, { data: payouts }, { data: activities }] = await Promise.all([
    supabase
      .from("project_members")
      .select("id, member_id, name, contribution_percent, amount, tugas, team_members(id, name, role, photo_url)")
      .eq("project_id", id)
      .order("contribution_percent", { ascending: false }),
    supabase
      .from("team_members")
      .select("id, name, role")
      .order("name"),
    supabase
      .from("transactions")
      .select("id, date, type, amount, source, description, reference, account_code")
      .eq("project_id", id)
      .order("date", { ascending: true }),
    supabase
      .from("payouts")
      .select("id, date, total_amount, orders_fee, net_amount, status, finalized_at, kas_optional_amount")
      .eq("project_id", id)
      .order("date", { ascending: false }),
    supabase
      .from("activity_log")
      .select("id, user_name, action, entity_type, entity_name, details, created_at")
      .eq("entity_type", "project")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

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
        transactions={allTx.map((t) => ({
          id: t.id, date: t.date, type: t.type, amount: Number(t.amount),
          source: t.source, description: t.description, reference: t.reference,
        }))}
        payouts={allPayouts.map((p) => ({
          id: p.id, date: p.date, total_amount: Number(p.total_amount),
          orders_fee: Number(p.orders_fee), net_amount: Number(p.net_amount),
          status: p.status, kas_optional_amount: Number(p.kas_optional_amount || 0),
        }))}
        activities={(activities ?? []).map((a) => ({
          id: a.id, user_name: a.user_name ?? "-", action: a.action,
          entity_name: a.entity_name ?? "-", details: a.details,
          created_at: a.created_at,
        }))}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        totalPaidPayout={totalPaidPayout}
        pendingPayout={pendingPayout}
        dist={dist}
      />
    </div>
  );
}
