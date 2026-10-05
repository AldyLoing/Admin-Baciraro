import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("code", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, accounts: data });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code, name, type, parent_code } = await req.json();

  if (!code || !name || !type) {
    return NextResponse.json({ error: "Kode, nama, dan tipe wajib diisi." }, { status: 400 });
  }
  if (!["asset", "liability", "equity", "revenue", "expense"].includes(type)) {
    return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const after = {
    code: Number(code),
    name: String(name).trim(),
    type,
    parent_code: parent_code ? Number(parent_code) : null,
  };
  const { data: created, error } = await supabase.from("accounts").insert(after).select("id").single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const ok = await auditMutation({ supabase, admin, action: "create", entityType: "account", entityId: created.id, entityName: `${after.code} — ${after.name}`, after });
  if (!ok) return NextResponse.json({ error: "Akun dibuat, tetapi pencatatan audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, type, parent_code, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name) updates.name = String(name).trim();
  if (type) updates.type = type;
  if (parent_code !== undefined) updates.parent_code = parent_code ? Number(parent_code) : null;
  if (is_active !== undefined) updates.is_active = is_active;

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("accounts").select("*").eq("id", id).single();
  const { error } = await supabase.from("accounts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "update", entityType: "account", entityId: Number(id),
    entityName: before ? `${before.code} — ${before.name}` : String(id),
    before, after: updates,
  });
  if (!ok) return NextResponse.json({ error: "Perubahan disimpan, tetapi pencatatan audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("accounts").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  if (before.is_active === false) {
    return NextResponse.json({ error: "Akun sudah nonaktif." }, { status: 400 });
  }

  const updates = { is_active: false };
  const { error } = await supabase.from("accounts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ok = await auditMutation({ supabase, admin, action: "deactivate", entityType: "account", entityId: Number(id), entityName: `${before.code} — ${before.name}`, before, after: updates });
  if (!ok) return NextResponse.json({ error: "Akun dinonaktifkan, tetapi pencatatan audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
