import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", admin.id)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const unreadCount = (data ?? []).filter((n: { is_read: boolean }) => !n.is_read).length;

  return NextResponse.json({ ok: true, notifications: data ?? [], unread_count: unreadCount });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, markAll } = await req.json();
  const supabase = createAdminClient();

  if (markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", admin.id)
      .eq("is_read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", admin.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("notifications")
    .select("*")
    .eq("id", id)
    .eq("user_id", admin.id)
    .single();
  if (!before) return NextResponse.json({ error: "Notifikasi tidak ditemukan." }, { status: 404 });
  if (before.archived) return NextResponse.json({ error: "Notifikasi sudah diarsipkan." }, { status: 400 });

  const updates = { archived: true };
  const { error } = await supabase
    .from("notifications")
    .update(updates)
    .eq("id", id)
    .eq("user_id", admin.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "archive", entityType: "notification", entityId: Number(id),
    entityName: before?.type || String(id), before, after: updates,
  });
  if (!ok) return NextResponse.json({ error: "Notifikasi diarsipkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
