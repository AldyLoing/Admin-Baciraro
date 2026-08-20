import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { isGoogleConfigured, getStoredToken } from "@/lib/admin/gcal";
import ScheduleClient from "./ScheduleClient";

export default async function AdminSchedulePage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, description, due_date, priority, status, project_id, assigned_to, gcal_event_id, projects(name, status), team_members(name)"
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .order("name");

  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, role, status")
    .order("name");

  const icsConfigured = !!process.env.GOOGLE_CALENDAR_ICS_URL;
  const oauthConfigured = isGoogleConfigured();
  const storedToken = admin ? await getStoredToken(admin.id) : null;
  const googleConnected = Boolean(storedToken?.refresh_token);

  let googleEmail: string | null = null;
  if (googleConnected) {
    const { data: tokenRow } = await supabase
      .from("calendar_tokens")
      .select("google_email")
      .eq("user_id", admin!.id)
      .single();
    googleEmail = tokenRow?.google_email ?? null;
  }

  return (
    <ScheduleClient
      tasks={(tasks ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        priority: t.priority,
        status: t.status,
        project_id: t.project_id,
        assigned_to: t.assigned_to,
        project_name: t.projects?.name ?? null,
        project_status: t.projects?.status ?? null,
        assigned_name: t.team_members?.name ?? null,
        gcal_event_id: t.gcal_event_id ?? null,
      }))}
      projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      members={(members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status || "active",
      }))}
      isAdmin={admin?.is_admin ?? false}
      icsConfigured={icsConfigured}
      oauthConfigured={oauthConfigured}
      googleConnected={googleConnected}
      googleEmail={googleEmail}
      embedUrl={process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMBED_URL}
      calendarEmail={process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMAIL}
    />
  );
}
