import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

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
  const { error } = await supabase.from("accounts").insert({
    code: Number(code),
    name: String(name).trim(),
    type,
    parent_code: parent_code ? Number(parent_code) : null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Kode akun sudah digunakan." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

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
  const { error } = await supabase.from("accounts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: lines } = await supabase
    .from("journal_entry_lines")
    .select("id")
    .eq("account_code", (await supabase.from("accounts").select("code").eq("id", id).single()).data?.code ?? -1)
    .limit(1);

  if (lines && lines.length > 0) {
    return NextResponse.json({ error: "Akun tidak bisa dihapus karena masih digunakan di jurnal." }, { status: 400 });
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
