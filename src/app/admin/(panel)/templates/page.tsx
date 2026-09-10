import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import TemplatesClient from "./TemplatesClient";

export default async function AdminTemplatesPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: templates } = await supabase
    .from("project_templates")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, role, status")
    .order("name");

  const isAdmin = admin?.is_admin ?? false;

  const normalizedTemplates = (templates ?? []).map((t: any) => ({
    id: String(t.id),
    name: t.name,
    description: t.description,
    default_members: Array.isArray(t.default_members) ? t.default_members : [],
    default_tasks: Array.isArray(t.default_tasks) ? t.default_tasks : [],
    created_at: t.created_at,
  }));

  const normalizedMembers = (members ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    status: m.status,
  }));

  return (
    <TemplatesClient
      templates={normalizedTemplates}
      members={normalizedMembers}
      isAdmin={isAdmin}
    />
  );
}
