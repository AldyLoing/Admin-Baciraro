import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import ProjectsClient from "./ProjectsClient";

export default async function AdminProjectsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const isAdmin = admin?.is_admin ?? false;

  const normalizedProjects = (projects ?? []).map((p: any) => ({
    id: String(p.id),
    name: p.name,
    client_name: p.client_name,
    total_value: Number(p.total_value),
    status: p.status,
    created_at: p.created_at,
  }));

  return <ProjectsClient projects={normalizedProjects} isAdmin={isAdmin} />;
}
