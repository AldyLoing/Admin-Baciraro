import { notFound } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateDistribution } from "@/lib/admin/format";
import { payoutExpenseAmount, sumAllocatedExpense, sumOperationalExpense } from "@/lib/admin/finance";
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

  const [{ data: projectMembers }, { data: allMembers }, { data: transactions }, { data: payouts }, { data: activities }, { data: installments }, { data: accounts }, { data: tasks }] = await Promise.all([
    supabase
      .from("project_members")
      .select("id, member_id, name, contribution_percent, amount, tugas, team_members(id, name, role, photo_url)")
      .eq("project_id", id)
      .is("removed_at", null)
      .order("contribution_percent", { ascending: false }),
    supabase
      .from("team_members")
      .select("id, name, role")
      .order("name"),
    supabase
      .from("transactions")
      .select("id, date, type, amount, source, description, reference, account_code, status")
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
    supabase
      .from("project_installments")
      .select("id, installment_no, amount, date, note, status, payout_id")
      .eq("project_id", id)
      .order("installment_no", { ascending: true }),
    supabase
      .from("accounts")
      .select("code, name, type")
      .eq("type", "expense")
      .order("code", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, description, status, due_date, priority, assigned_to")
      .eq("project_id", id)
      .neq("status", "cancelled")
      .order("due_date", { ascending: true })
      .order("title", { ascending: true }),
  ]);

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const contributions = (projectMembers ?? []).map((pm) => ({
    profileId: pm.member_id,
    percent: Number(pm.contribution_percent),
  }));

  const allTx = transactions ?? [];
  const activeTx = allTx.filter((t) => t.status !== "void");
  const totalIncome = round2(
    activeTx.filter((t) => t.type === "income").reduce((s: number, t) => s + Number(t.amount), 0)
  );
  const operationalExpense = sumOperationalExpense(allTx);
  const allPayouts = payouts ?? [];
  const totalPaidPayout = round2(
    allPayouts.filter((p) => p.status === "paid").reduce((s: number, p) => s + Number(p.net_amount), 0)
  );
  const pendingPayout = round2(
    allPayouts.filter((p) => p.status !== "paid" && p.status !== "cancelled").reduce((s: number, p) => s + Number(p.net_amount), 0)
  );
  const unallocatedExpense = Math.max(
    0,
    round2(operationalExpense - sumAllocatedExpense(allPayouts))
  );

  const totalValue = round2(Number(project.total_value) || 0);
  const dist = calculateDistribution(totalValue, contributions, 0, operationalExpense);
  const paidKlien = round2(
    activeTx
      .filter((t) => t.type === "income" && (t.source ?? "").startsWith("Pembayaran klien"))
      .reduce((s, t) => s + Number(t.amount), 0)
  );
  const sisaTagihan = Math.max(0, round2(totalValue - paidKlien));

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
        members={(projectMembers ?? []).map((pm) => {
          const teamMember = Array.isArray(pm.team_members)
            ? pm.team_members[0]
            : pm.team_members;
          return {
            pm_id: pm.id,
            member_id: pm.member_id ?? null,
            name: pm.name ?? teamMember?.name ?? "Kontributor",
            role: teamMember?.role ?? null,
            avatar_url: teamMember?.photo_url ?? null,
            contribution_percent: Number(pm.contribution_percent),
            amount: pm.amount == null ? null : Number(pm.amount),
            tugas: pm.tugas ?? null,
          };
        })}
        allMembers={(allMembers ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role }))}
        accounts={(accounts ?? []).map((a) => ({ code: Number(a.code), name: a.name, type: a.type }))}
        tasks={(tasks ?? []).map((t) => ({
          id: String(t.id),
          title: t.title,
          description: t.description ?? null,
          status: t.status,
          due_date: t.due_date ?? null,
          priority: t.priority,
          assigned_to: t.assigned_to == null ? null : Number(t.assigned_to),
        }))}
        isAdmin={admin?.is_admin ?? false}
        statusLabel={statusLabel}
        statusColor={statusColor}
        transactions={allTx.map((t) => ({
          id: t.id, date: t.date, type: t.type, amount: Number(t.amount),
          source: t.source, description: t.description, reference: t.reference,
          account_code: t.account_code == null ? null : Number(t.account_code),
          status: t.status ?? "active",
        }))}
        payouts={allPayouts.map((p) => ({
          id: p.id, date: p.date, total_amount: Number(p.total_amount),
          orders_fee: Number(p.orders_fee), net_amount: Number(p.net_amount),
          status: p.status, kas_optional_amount: Number(p.kas_optional_amount || 0),
          expense_amount: payoutExpenseAmount(p),
        }))}
        activities={(activities ?? []).map((a) => ({
          id: a.id, user_name: a.user_name ?? "-", action: a.action,
          entity_name: a.entity_name ?? "-", details: a.details,
          created_at: a.created_at,
        }))}
        installments={(installments ?? []).map((i) => ({
          id: Number(i.id), installment_no: Number(i.installment_no),
          amount: Number(i.amount), date: i.date, note: i.note ?? null,
          status: i.status ?? "active", payout_id: i.payout_id == null ? null : Number(i.payout_id),
        }))}
        sisaTagihan={sisaTagihan}
        paidKlien={paidKlien}
        totalIncome={totalIncome}
        totalExpense={operationalExpense}
        unallocatedExpense={unallocatedExpense}
        totalPaidPayout={totalPaidPayout}
        pendingPayout={pendingPayout}
        dist={dist}
      />
    </div>
  );
}
