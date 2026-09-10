import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

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
  return NextResponse.json({ ok: true, attachments: data?.attachments ?? [] });
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

  const existing = (current?.attachments as Array<{ name: string; url: string; size: number; uploaded_at: string }>) ?? [];
  const newAttachment = {
    name,
    url: url ?? "",
    size: size ?? 0,
    uploaded_at: new Date().toISOString(),
  };
  const updated = [...existing, newAttachment];

  const { error } = await supabase
    .from("projects")
    .update({ attachments: updated })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, attachments: updated });
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

  const existing = (current?.attachments as Array<{ name: string; url: string; size: number; uploaded_at: string }>) ?? [];
  if (index < 0 || index >= existing.length) return NextResponse.json({ ok: false, error: "Index invalid." }, { status: 400 });

  const updated = existing.filter((_, i) => i !== index);
  const { error } = await supabase
    .from("projects")
    .update({ attachments: updated })
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, attachments: updated });
}
