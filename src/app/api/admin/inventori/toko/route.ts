import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

const TOKO_SELECT = "id, name, contact_name, phone, address, city, notes, is_active, created_at";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";

  let query = supabase.from("tokos").select(TOKO_SELECT).order("name", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat toko: " + error.message }, { status: 400 });
  return NextResponse.json({ tokos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const contactName = String(body.contact_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!name) return NextResponse.json({ error: "Nama toko wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: dup } = await supabase
    .from("tokos")
    .select("id, name")
    .ilike("name", name)
    .maybeSingle();
  if (dup) {
    return NextResponse.json({ error: `Toko "${dup.name}" sudah terdaftar.` }, { status: 400 });
  }

  const { data: toko, error } = await supabase
    .from("tokos")
    .insert({
      name,
      contact_name: contactName,
      phone,
      address,
      city,
      notes,
      is_active: true,
      created_by: admin.id,
    })
    .select("id, name")
    .single();

  if (error) return NextResponse.json({ error: "Gagal menambah toko: " + error.message }, { status: 400 });

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "toko",
    entityId: toko.id, entityName: name,
    after: { name, contact_name: contactName, phone, address, city, notes },
  });
  if (!okCreate) return NextResponse.json({ error: "Toko dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: toko.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before, error: fetchError } = await supabase.from("tokos").select("*").eq("id", id).single();
  if (fetchError || !before) return NextResponse.json({ error: "Toko tidak ditemukan." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nama toko wajib diisi." }, { status: 400 });
    if (name.toLowerCase() !== String(before.name).toLowerCase()) {
      const { data: dup } = await supabase.from("tokos").select("id, name").ilike("name", name).maybeSingle();
      if (dup) return NextResponse.json({ error: `Toko "${dup.name}" sudah terdaftar.` }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.contact_name !== undefined) patch.contact_name = String(body.contact_name).trim();
  if (body.phone !== undefined) patch.phone = String(body.phone).trim();
  if (body.address !== undefined) patch.address = String(body.address).trim();
  if (body.city !== undefined) patch.city = String(body.city).trim();
  if (body.notes !== undefined) patch.notes = String(body.notes).trim();
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;

  const { error } = await supabase.from("tokos").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal memperbarui toko: " + error.message }, { status: 400 });

  const okUpdate = await auditMutation({
    supabase, admin, action: "update", entityType: "toko",
    entityId: id, entityName: String(patch.name ?? before.name),
    before, after: patch,
  });
  if (!okUpdate) return NextResponse.json({ error: "Toko diperbarui, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("tokos").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "Toko tidak ditemukan." }, { status: 404 });
  if (before.is_active === false) return NextResponse.json({ error: "Toko sudah nonaktif." }, { status: 400 });

  // Soft-delete saja: toko bisa jadi masih punya nota titip aktif di masa lalu.
  const { error } = await supabase.from("tokos").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menonaktifkan toko: " + error.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "deactivate", entityType: "toko",
    entityId: id, entityName: before?.name ?? "", before, after: { is_active: false },
  });
  if (!okDelete) return NextResponse.json({ error: "Toko dinonaktifkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
