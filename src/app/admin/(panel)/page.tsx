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
      .select("date, type, amount"),
    supabase
      .from("payout_members")
      .select("member_id, amount"),
    supabase
      .from("journal_entries")
      .select("total_debit, total_credit"),
    supabase
      .from("accounts")
      .select("code, name, type"),
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
    />
  );
}
