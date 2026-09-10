import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, default_members, default_tasks } = await req.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama template wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_templates")
    .insert({
      name: String(name).trim(),
      description: description?.trim() || null,
      default_members: Array.isArray(default_members) ? default_members : [],
      default_tasks: Array.isArray(default_tasks) ? default_tasks : [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, data });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, description, default_members, default_tasks } = await req.json();

  if (!id) return NextResponse.json({ error: "ID template wajib diisi." }, { status: 400 });
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama template wajib diisi." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("project_templates")
    .update({
      name: String(name).trim(),
      description: description?.trim() || null,
      default_members: Array.isArray(default_members) ? default_members : [],
      default_tasks: Array.isArray(default_tasks) ? default_tasks : [],
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID template wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("project_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
