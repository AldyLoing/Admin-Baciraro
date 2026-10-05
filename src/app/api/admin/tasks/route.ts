import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAuthorizedClient, createGcalEvent, updateGcalEvent } from "@/lib/admin/gcal";
import { auditMutation, createNotification } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, project_id, assigned_to, due_date, priority, recurrence_rule } = await req.json();

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: task, error: err } = await supabase
    .from("tasks")
    .insert({
      title: String(title).trim(),
      description: description?.trim() || null,
      project_id: project_id || null,
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
      status: "pending",
      recurrence_rule: recurrence_rule || null,
    })
    .select("id")
    .single();

  if (err || !task) {
    return NextResponse.json({ error: "Gagal membuat tugas: " + (err?.message ?? "unknown") }, { status: 400 });
  }

  let gcalEventId: string | null = null;
  try {
    const auth = await getAuthorizedClient(admin.id);
    if (auth) {
      gcalEventId = await createGcalEvent(auth, {
        title: String(title).trim(),
        description: description?.trim() || null,
        startAt: due_date || null,
      });
      await supabase.from("tasks").update({ gcal_event_id: gcalEventId }).eq("id", task.id);
    }
  } catch (e) {
    console.warn("Google Calendar: gagal membuat event.", e);
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "task",
    entityId: task.id, entityName: String(title).trim(),
    after: {
      title: String(title).trim(), description: description?.trim() || null,
      project_id: project_id || null, assigned_to: assigned_to || null,
      due_date: due_date || null, priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
      gcal_event_id: gcalEventId,
    },
  });
  if (!okCreate) return NextResponse.json({ error: "Tugas dibuat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  if (assigned_to) {
    await createNotification({
      supabase, userId: Number(assigned_to),
      type: "task_assigned",
      message: `Kamu ditugaskan: "${String(title).trim()}"`,
      link: `/admin/schedule`,
    });
  }

  return NextResponse.json({ ok: true, id: task.id, gcalEventId });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, title, description, project_id, assigned_to, due_date, priority, recurrence_rule } = body;
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  if (status !== undefined && !["pending", "active", "completed", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Parameter status tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (title !== undefined) updates.title = String(title).trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (project_id !== undefined) updates.project_id = project_id || null;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
  if (due_date !== undefined) updates.due_date = due_date || null;
  if (priority !== undefined) updates.priority = ["low", "medium", "high"].includes(priority) ? priority : "medium";
  if (recurrence_rule !== undefined) updates.recurrence_rule = recurrence_rule || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada field untuk diperbarui." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existingTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("tasks").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal update tugas: " + error.message }, { status: 400 });

  const okUpdate = await auditMutation({
    supabase, admin,
    action: status === "completed" ? "complete" : "update",
    entityType: "task",
    entityId: id, entityName: updates.title ?? existingTask?.title ?? "",
    before: existingTask,
    after: updates,
  });
  if (!okUpdate) return NextResponse.json({ error: "Tugas diperbarui, tetapi audit gagal. Periksa log server." }, { status: 500 });

  let gcalUpdated = false;
  if (existingTask?.gcal_event_id) {
    const relevantChanged =
      (updates.title !== undefined && updates.title !== existingTask.title) ||
      (updates.description !== undefined && updates.description !== existingTask.description) ||
      (updates.due_date !== undefined && updates.due_date !== existingTask.due_date);
    if (relevantChanged) {
      try {
        const auth = await getAuthorizedClient(admin.id);
        if (auth) {
          await updateGcalEvent(auth, existingTask.gcal_event_id, {
            title: updates.title !== undefined ? updates.title : existingTask.title,
            description: updates.description !== undefined ? updates.description : existingTask.description,
            startAt: updates.due_date !== undefined ? updates.due_date : existingTask.due_date,
          });
          gcalUpdated = true;
        }
      } catch (e) {
        console.warn("Google Calendar: gagal update event.", e);
      }
    }
  }

  return NextResponse.json({ ok: true, gcalUpdated });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: existingTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (!existingTask) return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  if (existingTask.status === "cancelled") return NextResponse.json({ error: "Tugas sudah dibatalkan." }, { status: 400 });

  const updates: Record<string, unknown> = { status: "cancelled" };
  if (existingTask.gcal_event_id) updates.gcal_event_id = null;
  const { error } = await supabase.from("tasks").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal membatalkan: " + error.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "cancel", entityType: "task",
    entityId: id, entityName: existingTask?.title ?? "", before: existingTask, after: updates,
  });
  if (!okDelete) return NextResponse.json({ error: "Tugas dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, gcal_unlinked: Boolean(existingTask.gcal_event_id) });
}
