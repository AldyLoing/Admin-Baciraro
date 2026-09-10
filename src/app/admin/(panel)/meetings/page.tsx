import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import MeetingsClient from "./MeetingsClient";

export const revalidate = 30;

export default async function AdminMeetingsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: notes }, { data: attendees }, { data: actionItems }, { data: members }, { data: projects }] = await Promise.all([
    supabase
      .from("meeting_notes")
      .select("id, title, date, agenda, notes, project_id, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("meeting_note_attendees")
      .select("id, meeting_note_id, member_id"),
    supabase
      .from("action_items")
      .select("id, meeting_note_id, task, assigned_to, due_date, status")
      .order("created_at", { ascending: true }),
    supabase
      .from("team_members")
      .select("id, name, role, status")
      .order("name"),
    supabase
      .from("projects")
      .select("id, name, status")
      .order("name"),
  ]);

  return (
    <MeetingsClient
      notes={(notes ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        date: n.date,
        agenda: n.agenda,
        notes: n.notes,
        project_id: n.project_id,
        created_at: n.created_at,
      }))}
      attendees={(attendees ?? []).map((a) => ({
        id: a.id,
        meeting_note_id: a.meeting_note_id,
        member_id: a.member_id,
      }))}
      actionItems={(actionItems ?? []).map((a) => ({
        id: a.id,
        meeting_note_id: a.meeting_note_id,
        task: a.task,
        assigned_to: a.assigned_to,
        due_date: a.due_date,
        status: a.status,
      }))}
      members={(members ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        status: m.status || "active",
      }))}
      projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
