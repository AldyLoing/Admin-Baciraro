import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { meeting_note_id, task, assigned_to, due_date } = await req.json();

  if (!meeting_note_id || !task || !String(task).trim()) {
    return NextResponse.json({ error: "Teks tindak lanjut wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: created, error: err } = await supabase
    .from("action_items")
    .insert({
      meeting_note_id,
      task: String(task).trim(),
      assigned_to: assigned_to || null,
      due_date: due_date || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (err || !created) {
    return NextResponse.json({ error: "Gagal menambah tindak lanjut: " + (err?.message ?? "unknown") }, { status: 400 });
  }

  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "action_item", entityId: created.id,
    entityName: String(task).trim(), after: created,
  });
  if (!ok) return NextResponse.json({ error: "Tindak lanjut dibuat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, item: created });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !["pending", "completed"].includes(status)) {
    return NextResponse.json({ error: "Parameter status tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("action_items").select("*").eq("id", id).single();
  const { error } = await supabase.from("action_items").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal update status: " + error.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "update", entityType: "action_item", entityId: Number(id),
    entityName: before?.task || String(id),
    before: before ? { status: before.status } : null, after: { status },
  });
  if (!ok) return NextResponse.json({ error: "Status tersimpan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("action_items").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "Tindak lanjut tidak ditemukan." }, { status: 404 });
  if (before.status === "removed") return NextResponse.json({ error: "Tindak lanjut sudah dihapus." }, { status: 400 });

  const updates = { status: "removed" };
  const { error } = await supabase.from("action_items").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "delete", entityType: "action_item", entityId: Number(id),
    entityName: before?.task || String(id), before, after: updates,
  });
  if (!ok) return NextResponse.json({ error: "Tindak lanjut dihapus, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
