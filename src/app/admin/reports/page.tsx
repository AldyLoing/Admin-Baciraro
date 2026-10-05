import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import ReportsClient, { type PLRow, type MemberDist, type Transaction, type Payout } from "./ReportsClient";

export const revalidate = 30;

type ProjectRow = { id: number; name: string; client_name: string | null; status: string };
type PayoutMemberRow = { name: string | null; amount: number | string | null };

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = createAdminClient();

  const [projectsRes, transactionsRes, payoutsRes, payoutMembersRes] = await Promise.all([
    supabase.from("projects").select("id, name, client_name, total_value, status, created_at, completed_at"),
    supabase.from("transactions").select("id, date, type, amount, source, description, project_id").eq("status", "active").order("date", { ascending: true }),
    supabase.from("payouts").select("id, project_id, project_name, date, total_amount, orders_fee, net_amount, status, finalized_at, kas_optional_amount").order("date", { ascending: true }),
    supabase.from("payout_members").select("id, payout_id, member_id, name, amount, contribution_percent"),
  ]);

  const projects = (projectsRes.data ?? []) as ProjectRow[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const payouts = (payoutsRes.data ?? []) as Payout[];
  const payoutMembers = (payoutMembersRes.data ?? []) as PayoutMemberRow[];

  // --- P&L per project ---
  const plByProject: PLRow[] = projects.map((p) => {
    const tx = transactions.filter((t) => t.project_id === p.id);
    const inc = tx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = tx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const kas = payouts.filter((po) => po.project_id === p.id && po.status !== "cancelled").reduce((s, po) => s + Number(po.orders_fee || 0), 0);
    const netIncome = inc - exp;
    return { id: p.id, name: p.name, client_name: p.client_name, status: p.status, income: inc, expense: exp, kas, net: netIncome, distribusi: netIncome - kas };
  }).filter((p) => p.income > 0 || p.expense > 0);

  // --- Member distribution ---
  const memberPayoutMap = new Map<string, { name: string; amount: number }>();
  for (const pm of payoutMembers) {
    const name = pm.name || "Unknown";
    const curr = memberPayoutMap.get(name) || { name, amount: 0 };
    curr.amount += Number(pm.amount) || 0;
    memberPayoutMap.set(name, curr);
  }
  const memberDistribution: MemberDist[] = Array.from(memberPayoutMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15);

  return (
    <ReportsClient
      plByProject={plByProject}
      memberDistribution={memberDistribution}
      allTransactions={transactions}
      allPayouts={payouts}
    />
  );
}
