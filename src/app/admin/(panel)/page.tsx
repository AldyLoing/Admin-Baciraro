import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import DashboardClient from "./DashboardClient";

export const revalidate = 30;

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const supabase = createAdminClient();

  const [
    { data: projects },
    { data: members },
    { data: projectMembers },
    { data: transactions },
    { data: payoutMembers },
    { data: journalData },
    { data: accounts },
    { data: journalLines },
    { data: tasks },
    { data: payouts },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_name, total_value, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("team_members")
      .select("id, name, role, photo_url")
      .order("name"),
    supabase
      .from("project_members")
      .select("project_id, member_id, contribution_percent, projects!inner(status, total_value)"),
    supabase
      .from("transactions")
      .select("date, type, amount, project_id, description, source"),
    supabase
      .from("payout_members")
      .select("member_id, name, amount"),
    supabase
      .from("journal_entries")
      .select("total_debit, total_credit"),
    supabase
      .from("accounts")
      .select("code, name, type"),
    supabase
      .from("journal_entry_lines")
      .select("account_code, debit, credit"),
    supabase
      .from("tasks")
      .select("id, title, status, assigned_to, priority, due_date"),
    supabase
      .from("payouts")
      .select("id, project_name, net_amount, status, kas_optional_amount, finalized_at"),
  ]);

  const allProjects = (projects ?? []) as any[];
  const totalRevenue = allProjects.reduce((s: number, p: any) => s + (Number(p.total_value) || 0), 0);
  const allTx = transactions ?? [];
  const totalIncome = allTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalExpense = allTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const kasRiil = totalIncome - totalExpense;
  const activeCount = allProjects.filter((p: any) => p.status === "active").length;
  const completedCount = allProjects.filter((p: any) => p.status === "completed" || p.status === "paid").length;
  const paidCount = allProjects.filter((p: any) => p.status === "paid").length;

  const journalEntries = (journalData ?? []) as any[];
  const totalJournalDebit = journalEntries.reduce((s: number, e: any) => s + Number(e.total_debit || 0), 0);
  const totalJournalCredit = journalEntries.reduce((s: number, e: any) => s + Number(e.total_credit || 0), 0);
  const accountList = (accounts ?? []) as any[];

  const memberStats = (members ?? []).map((m: any) => {
    const rows = (projectMembers ?? []).filter((pm: any) => pm.member_id === m.id);
    const projectCount = rows.length;
    const totalIncomeFromPayouts = (payoutMembers ?? [])
      .filter((pm: any) => pm.member_id === m.id)
      .reduce((sum: number, pm: any) => sum + Number(pm.amount), 0);
    return { ...m, projectCount, totalIncome: totalIncomeFromPayouts };
  });
  memberStats.sort((a: any, b: any) => b.totalIncome - a.totalIncome);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const now = new Date();
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthIdx = d.getMonth();
    const monthTx = allTx.filter((t: any) => {
      const td = new Date(t.date);
      return td.getMonth() === monthIdx && td.getFullYear() === d.getFullYear();
    });
    const income = monthTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const expense = monthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
    return { month: monthNames[monthIdx], income, expense };
  });

  const statusData = ["active", "completed", "paid"]
    .map((s) => ({
      name: s === "active" ? "Aktif" : s === "completed" ? "Selesai" : "Dibayar",
      value: allProjects.filter((p: any) => p.status === s).length,
      color: s === "active" ? "#60A5FA" : s === "completed" ? "#34D399" : "#10B981",
    }))
    .filter((s) => s.value > 0);

  const firstName = admin.name?.split(" ")[0] || "Admin";

  // --- Chart 1: Expense by Kategori (dynamic dari DB) ---
  const allLines = (journalLines ?? []) as any[];
  const lineByAccount = new Map<number, number>();
  for (const line of allLines) {
    if (line.debit > 0) {
      lineByAccount.set(line.account_code, (lineByAccount.get(line.account_code) || 0) + Number(line.debit));
    }
  }
  const expenseAccounts = accountList.filter((a: any) => a.type === "expense");
  const expenseByKategori = expenseAccounts
    .filter((a: any) => a.code !== 5119)
    .map((a: any) => ({ name: a.name, value: lineByAccount.get(a.code) || 0 }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const EXPENSE_COLORS = ["#F59E0B", "#3B82F6", "#8B5CF6", "#10B981", "#EC4899", "#6366F1"];

  // --- Chart 2: Income by Client ---
  const incomeTxByProject = allTx.filter((t: any) => t.type === "income");
  const clientIncomeMap = new Map<string, number>();
  for (const tx of incomeTxByProject) {
    const project = allProjects.find((p: any) => p.id === tx.project_id);
    const client = project?.client_name || "Tanpa Klien";
    clientIncomeMap.set(client, (clientIncomeMap.get(client) || 0) + Number(tx.amount));
  }
  const incomeByClient = Array.from(clientIncomeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // --- Chart 3: Payout by Member (hanya amount > 0) ---
  const allPayoutMembers = (payoutMembers ?? []) as any[];
  const memberPayoutMap = new Map<string, { name: string; amount: number }>();
  for (const pm of allPayoutMembers) {
    if (!pm.amount || Number(pm.amount) <= 0) continue;
    const name = pm.name || "Unknown";
    const curr = memberPayoutMap.get(name) || { name, amount: 0 };
    curr.amount += Number(pm.amount) || 0;
    memberPayoutMap.set(name, curr);
  }
  const payoutByMember = Array.from(memberPayoutMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // --- Chart 4: Task by Assignee ---
  const allTasks = (tasks ?? []) as any[];
  const activeTasks = allTasks.filter((t: any) => t.status === "pending" || t.status === "active");
  const taskByAssigneeMap = new Map<number, { name: string; pending: number; active: number }>();
  for (const t of activeTasks) {
    if (!t.assigned_to) continue;
    const member = (members ?? []).find((m: any) => m.id === t.assigned_to);
    const name = member?.name || "Unknown";
    const curr = taskByAssigneeMap.get(t.assigned_to) || { name, pending: 0, active: 0 };
    if (t.status === "pending") curr.pending++;
    else curr.active++;
    taskByAssigneeMap.set(t.assigned_to, curr);
  }
  const taskByAssignee = Array.from(taskByAssigneeMap.values())
    .map((m) => ({ ...m, total: m.pending + m.active }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // --- Hari Ini: Attention items ---
  const todayStr = new Date().toISOString().split("T")[0];

  const overdueTasks = allTasks
    .filter((t: any) => t.due_date && t.due_date < todayStr && t.status !== "completed")
    .map((t: any) => ({ id: Number(t.id), title: t.title || "Untitled", due_date: t.due_date }));

  const allPayouts = (payouts ?? []) as any[];
  const pendingPayouts = allPayouts
    .filter((p: any) => p.status !== "paid" && !p.finalized_at)
    .map((p: any) => ({ id: Number(p.id), title: p.project_name || "Untitled", project_name: p.project_name }));

  return (
    <DashboardClient
      firstName={firstName}
      allProjects={allProjects}
      monthly={monthly}
      statusData={statusData}
      totalRevenue={totalRevenue}
      kasRiil={kasRiil}
      activeCount={activeCount}
      completedCount={completedCount}
      paidCount={paidCount}
      memberStats={memberStats}
      journalCount={journalEntries.length}
      totalJournalDebit={totalJournalDebit}
      totalJournalCredit={totalJournalCredit}
      accountCount={accountList.length}
      expenseByKategori={expenseByKategori}
      expenseColors={EXPENSE_COLORS}
      incomeByClient={incomeByClient}
      payoutByMember={payoutByMember}
      taskByAssignee={taskByAssignee}
      overdueTasks={overdueTasks}
      pendingPayouts={pendingPayouts}
    />
  );
}
