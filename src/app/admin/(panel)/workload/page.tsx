import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import WorkloadClient from "./WorkloadClient";

export default async function AdminWorkloadPage() {
  const admin = await requireAdmin();
  if (!admin) return null;
  const supabase = createAdminClient();

  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, role, status")
    .eq("status", "active")
    .order("name");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, assigned_to")
    .in("status", ["pending", "active"]);

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("member_id, contribution_percent");

  return (
    <WorkloadClient
      members={(members ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role }))}
      tasks={(tasks ?? []).map((t) => ({ id: t.id, status: t.status, assigned_to: t.assigned_to }))}
      projectMembers={(projectMembers ?? []).map((pm) => ({
        member_id: pm.member_id,
        contribution_percent: Number(pm.contribution_percent) || 0,
      }))}
    />
  );
}
