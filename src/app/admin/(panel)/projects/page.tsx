import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import ProjectsClient from "./ProjectsClient";

export const revalidate = 30;

export default async function AdminProjectsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, client_name, total_value, status, created_at")
    .order("created_at", { ascending: false });

  // Sisa tagihan per project = total_value − Σ income "Pembayaran klien%"
  const ids = (projects ?? []).map((p) => p.id);
  const paidMap = new Map<number, number>();
  if (ids.length > 0) {
    const { data: incomeRows } = await supabase
      .from("transactions")
      .select("project_id, amount, status")
      .eq("type", "income")
      .neq("status", "void")
      .like("source", "Pembayaran klien%")
      .in("project_id", ids);
    for (const r of incomeRows ?? []) {
      const pid = Number(r.project_id);
      paidMap.set(pid, (paidMap.get(pid) ?? 0) + (Number(r.amount) || 0));
    }
  }

  const isAdmin = admin?.is_admin ?? false;

  const normalizedProjects = (projects ?? []).map((p: any) => ({
    id: String(p.id),
    name: p.name,
    client_name: p.client_name,
    total_value: Number(p.total_value),
    status: p.status,
    created_at: p.created_at,
    sisa_tagihan: Math.max(0, Math.round(((Number(p.total_value) || 0) - (paidMap.get(Number(p.id)) ?? 0)) * 100) / 100),
  }));

  return <ProjectsClient projects={normalizedProjects} isAdmin={isAdmin} />;
}
