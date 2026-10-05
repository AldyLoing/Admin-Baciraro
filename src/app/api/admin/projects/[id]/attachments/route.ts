import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projects")
    .select("attachments")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const all = (data?.attachments as { removed_at?: string | null }[]) ?? [];
  return NextResponse.json({ ok: true, attachments: all.filter((a) => !a.removed_at) });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, url, size } = body;
  if (!name) return NextResponse.json({ ok: false, error: "Nama file wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: current, error: fetchErr } = await supabase
    .from("projects")
    .select("attachments")
    .eq("id", id)
    .single();
  if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });

  const all = (current?.attachments as Array<{ name: string; url: string; size: number; uploaded_at: string; removed_at?: string | null }>) ?? [];
  const existing = all.filter((a) => !a.removed_at);
  const newAttachment: { name: string; url: string; size: number; uploaded_at: string; removed_at: null } = {
    name,
    url: url ?? "",
    size: size ?? 0,
    uploaded_at: new Date().toISOString(),
    removed_at: null,
  };
  const stored = [...all, newAttachment];

  const { error } = await supabase
    .from("projects")
    .update({ attachments: stored })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "attachment", entityId: Number(id),
    entityName: name, after: newAttachment, extra: { project_id: Number(id) },
  });
  if (!ok) return NextResponse.json({ ok: false, error: "File tersimpan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, attachments: stored.filter((a) => !a.removed_at) });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { index } = body;
  if (typeof index !== "number") return NextResponse.json({ ok: false, error: "Index wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: current, error: fetchErr } = await supabase
    .from("projects")
    .select("attachments")
    .eq("id", id)
    .single();
  if (fetchErr) return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });

  const all = (current?.attachments as Array<{ name: string; url: string; size: number; uploaded_at: string; removed_at?: string | null }>) ?? [];
  const active = all.filter((a) => !a.removed_at);
  if (index < 0 || index >= active.length) return NextResponse.json({ ok: false, error: "Index invalid." }, { status: 400 });

  const removed = active[index];
  const removedAt = new Date().toISOString();
  const updated: typeof all = all.map((a) =>
    !a.removed_at && a.name === removed.name && a.url === removed.url && a.uploaded_at === removed.uploaded_at
      ? { ...a, removed_at: removedAt }
      : a
  );
  const { error } = await supabase
    .from("projects")
    .update({ attachments: updated })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ok = await auditMutation({
    supabase, admin, action: "delete", entityType: "attachment", entityId: Number(id),
    entityName: removed?.name || `index ${index}`, before: removed ?? null,
    after: { removed_at: removedAt },
    extra: { project_id: Number(id) },
  });
  if (!ok) return NextResponse.json({ ok: false, error: "File dihapus, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, attachments: updated.filter((a) => !a.removed_at) });
}
