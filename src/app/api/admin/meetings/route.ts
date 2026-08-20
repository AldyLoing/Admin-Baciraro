import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, date, agenda, notes, project_id, attendees } = await req.json();

  if (!title || !String(title).trim() || !date) {
    return NextResponse.json({ error: "Judul dan tanggal rapat wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let noteId = id ?? null;

  if (id) {
    const { error: err } = await supabase
      .from("meeting_notes")
      .update({
        title: String(title).trim(),
        date,
        agenda: agenda?.trim() || null,
        notes: notes?.trim() || null,
        project_id: project_id || null,
      })
      .eq("id", id);
    if (err) return NextResponse.json({ error: "Gagal memperbarui catatan: " + err.message }, { status: 400 });
  } else {
    const { data: created, error: err } = await supabase
      .from("meeting_notes")
      .insert({
        title: String(title).trim(),
        date,
        agenda: agenda?.trim() || null,
        notes: notes?.trim() || null,
        project_id: project_id || null,
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (err || !created) {
      return NextResponse.json({ error: "Gagal membuat catatan: " + (err?.message ?? "unknown") }, { status: 400 });
    }
    noteId = created.id;
  }

  const attendeeIds = Array.isArray(attendees) ? attendees.filter((a: any) => a) : [];

  await supabase.from("meeting_note_attendees").delete().eq("meeting_note_id", noteId);
  if (attendeeIds.length > 0) {
    const { error: aerr } = await supabase.from("meeting_note_attendees").insert(
      attendeeIds.map((memberId: number) => ({ meeting_note_id: noteId, member_id: memberId }))
    );
    if (aerr) {
      return NextResponse.json({ error: "Gagal menyimpan peserta: " + aerr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("meeting_notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
