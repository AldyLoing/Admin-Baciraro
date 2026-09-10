import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id } = await req.json();
  if (!task_id) return NextResponse.json({ error: "task_id wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: task, error: fetchErr } = await supabase
    .from("tasks")
    .select("id, title, description, priority, status, project_id, assigned_to, due_date, recurrence_rule")
    .eq("id", task_id)
    .single();

  if (fetchErr || !task) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (!task.recurrence_rule) {
    return NextResponse.json({ error: "Tugas ini tidak memiliki aturan pengulangan." }, { status: 400 });
  }

  let nextDueDate: string | null = null;
  if (task.due_date) {
    const base = new Date(task.due_date);
    switch (task.recurrence_rule) {
      case "daily":
        nextDueDate = addDays(base, 1).toISOString().slice(0, 10);
        break;
      case "weekly":
        nextDueDate = addDays(base, 7).toISOString().slice(0, 10);
        break;
      case "biweekly":
        nextDueDate = addDays(base, 14).toISOString().slice(0, 10);
        break;
      case "monthly":
        nextDueDate = addMonths(base, 1).toISOString().slice(0, 10);
        break;
      default:
        nextDueDate = addDays(base, 7).toISOString().slice(0, 10);
    }
  }

  const { data: newTask, error: insertErr } = await supabase
    .from("tasks")
    .insert({
      title: task.title,
      description: task.description,
      priority: task.priority,
      project_id: task.project_id,
      assigned_to: task.assigned_to,
      due_date: nextDueDate,
      status: "pending",
      recurrence_rule: task.recurrence_rule,
      recurrence_parent_id: task.id,
    })
    .select("id")
    .single();

  if (insertErr || !newTask) {
    return NextResponse.json({ error: "Gagal membuat tugas berulang: " + (insertErr?.message ?? "unknown") }, { status: 400 });
  }

  return NextResponse.json({ ok: true, new_task_id: newTask.id });
}
