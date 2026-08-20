import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import PayoutsClient from "./PayoutsClient";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: payoutMembers } = await supabase
    .from("payout_members")
    .select("*")
    .order("created_at", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status, total_value, client_name")
    .order("name");

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("id, project_id, member_id, name, contribution_percent, amount, tugas");

  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, name, role, status")
    .order("name");

  return (
    <PayoutsClient
      payouts={(payouts ?? []).map((p) => ({
        id: p.id,
        project_id: p.project_id,
        project_name: p.project_name,
        date: p.date,
        total_amount: Number(p.total_amount),
        orders_fee: Number(p.orders_fee),
        net_amount: Number(p.net_amount),
        status: p.status,
        finalized_at: p.finalized_at ?? null,
        created_at: p.created_at,
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
      projects={(projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        total_value: Number(p.total_value),
        client_name: p.client_name,
      }))}
      projectMembers={(projectMembers ?? []).map((pm: any) => ({
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
