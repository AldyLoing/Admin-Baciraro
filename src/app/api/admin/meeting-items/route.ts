import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

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
  const { error } = await supabase.from("action_items").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal update status: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("action_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
