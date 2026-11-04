import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  payoutExpenseAmount,
  sumAllocatedExpense,
  sumOperationalExpense,
  type ExpenseTx,
  type PayoutFinance,
} from "@/lib/admin/finance";
import PayoutsClient from "./PayoutsClient";

type ProjectMemberRow = {
  id: string;
  project_id: string;
  member_id: number | null;
  name: string | null;
  contribution_percent: number | string;
  tugas: string | null;
};

type ProjectExpenseRow = ExpenseTx & { project_id: string | number | null };
type ProjectPayoutRow = PayoutFinance & { project_id: string | number | null };

export const revalidate = 15;

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [
    { data: payouts },
    { data: payoutMembers },
    { data: projects },
    { data: projectMembers },
    { data: allMembers },
    { data: transactions },
    { data: projectInstallments },
  ] = await Promise.all([
    supabase
      .from("payouts")
      .select("id, project_id, project_name, sale_id, source_type, date, total_amount, orders_fee, net_amount, status, finalized_at, created_at, kas_optional_amount")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("payout_members")
      .select("id, payout_id, member_id, name, contribution_percent, amount, tugas")
      .order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("id, name, status, total_value, client_name")
      .order("name"),
    supabase
      .from("project_members")
      .select("id, project_id, member_id, name, contribution_percent, amount, tugas")
      .is("removed_at", null),
    supabase
      .from("team_members")
      .select("id, name, role, status")
      .order("name"),
    supabase
      .from("transactions")
      .select("project_id, type, amount, source, description, status")
      .eq("type", "expense"),
    supabase
      .from("project_installments")
      .select("project_id")
      .eq("status", "active"),
  ]);

  const expenseByProject = new Map<string, ProjectExpenseRow[]>();
  for (const tx of (transactions ?? []) as ProjectExpenseRow[]) {
    if (!tx.project_id) continue;
    const rows = expenseByProject.get(String(tx.project_id)) ?? [];
    rows.push(tx);
    expenseByProject.set(String(tx.project_id), rows);
  }

  const payoutByProject = new Map<string, ProjectPayoutRow[]>();
  for (const payout of (payouts ?? []) as ProjectPayoutRow[]) {
    if (!payout.project_id) continue;
    const rows = payoutByProject.get(String(payout.project_id)) ?? [];
    rows.push(payout);
    payoutByProject.set(String(payout.project_id), rows);
  }

  const projectsWithInstallments = new Set(
    (projectInstallments ?? []).map((i) => String(i.project_id))
  );

  return (
    <PayoutsClient
      payouts={(payouts ?? []).map((p) => ({
        id: p.id,
        project_id: p.project_id,
        project_name: p.project_name,
        sale_id: p.sale_id ?? null,
        source_type: p.source_type ?? "project",
        date: p.date,
        total_amount: Number(p.total_amount),
        orders_fee: Number(p.orders_fee),
        net_amount: Number(p.net_amount),
        status: p.status,
        finalized_at: p.finalized_at ?? null,
        created_at: p.created_at,
        kas_optional_amount: Number(p.kas_optional_amount || 0),
        expense_deducted: payoutExpenseAmount(p),
      }))}
      payoutMembers={(payoutMembers ?? []).map((pm) => ({
        id: pm.id,
        payout_id: pm.payout_id,
        member_id: pm.member_id,
        name: pm.name,
        contribution_percent: Number(pm.contribution_percent),
        amount: Number(pm.amount),
        tugas: pm.tugas ?? null,
      }))}
      projects={(projects ?? []).map((p) => {
        const operationalExpense = sumOperationalExpense(
          expenseByProject.get(String(p.id)) ?? []
        );
        const allocatedExpense = sumAllocatedExpense(
          payoutByProject.get(String(p.id)) ?? []
        );
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          total_value: Number(p.total_value),
          client_name: p.client_name,
          has_installments: projectsWithInstallments.has(String(p.id)),
          unallocated_expense: Math.max(
            0,
            Math.round((operationalExpense - allocatedExpense) * 100) / 100
          ),
        };
      })}
      projectMembers={((projectMembers ?? []) as ProjectMemberRow[]).map((pm) => ({
        id: pm.id,
        project_id: pm.project_id,
        member_id: pm.member_id ?? null,
        contribution_percent: Number(pm.contribution_percent),
        member_name: pm.name ?? "Anggota",
        tugas: pm.tugas ?? null,
      }))}
      allMembers={(allMembers ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status || "active",
      }))}
      isAdmin={admin?.is_admin ?? false}
      preselectProjectId={project ?? null}
    />
  );
}
