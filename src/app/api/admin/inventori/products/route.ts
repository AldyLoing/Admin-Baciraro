import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { journalForMovement } from "@/lib/admin/inventori";
import { auditMutation } from "@/lib/admin/audit";

const PRODUCT_SELECT =
  "id, sku, name, category, unit, harga_modal, harga_jual, stok, stok_min, is_active, notes, created_at, updated_at";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select(PRODUCT_SELECT)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: "Gagal memuat barang: " + error.message }, { status: 400 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const sku = String(body.sku ?? "").trim() || null;
  const category = String(body.category ?? "").trim();
  const unit = String(body.unit ?? "").trim() || "pcs";
  const hargaModal = Number(body.harga_modal) || 0;
  const hargaJual = Number(body.harga_jual) || 0;
  const stokAwal = Math.trunc(Number(body.stok) || 0);
  const stokMin = Math.trunc(Number(body.stok_min) || 0);
  const notes = String(body.notes ?? "").trim();

  if (!name) return NextResponse.json({ error: "Nama barang wajib diisi." }, { status: 400 });
  if (hargaModal < 0 || hargaJual < 0) {
    return NextResponse.json({ error: "Harga tidak boleh negatif." }, { status: 400 });
  }
  if (stokAwal < 0 || stokMin < 0) {
    return NextResponse.json({ error: "Stok tidak boleh negatif." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: product, error } = await supabase
    .from("inventory_items")
    .insert({
      sku,
      name,
      category,
      unit,
      harga_modal: hargaModal,
      harga_jual: hargaJual,
      stok: stokAwal,
      stok_min: stokMin,
      notes,
      is_active: true,
    })
    .select("id, name")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "SKU sudah dipakai barang lain." : error.message;
    return NextResponse.json({ error: "Gagal menambah barang: " + msg }, { status: 400 });
  }

  if (stokAwal > 0) {
    const date = new Date().toISOString().slice(0, 10);
    const { data: movement } = await supabase
      .from("stock_movements")
      .insert({
        product_id: product.id,
        type: "in",
        reason: "stok_awal",
        qty: stokAwal,
        note: "Stok awal saat barang dibuat",
        harga_modal: hargaModal,
        created_by: admin.id,
      })
      .select("id")
      .single();

    if (movement) {
      const journalId = await journalForMovement(supabase, {
        date,
        type: "in",
        reason: "stok_awal",
        qty: stokAwal,
        hargaModal,
        productName: name,
        note: "Stok awal",
        reference: `SKU-${product.id}-AWAL`,
        createdBy: admin.id,
      });
      if (journalId) {
        await supabase.from("stock_movements").update({ journal_entry_id: journalId }).eq("id", movement.id);
      }
    }
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "product",
    entityId: product.id, entityName: name,
    after: { sku, name, category, unit, harga_modal: hargaModal, harga_jual: hargaJual, stok: stokAwal, stok_min: stokMin, notes },
    extra: { stok_awal: stokAwal },
  });
  if (!okCreate) return NextResponse.json({ error: "Barang dibuat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: product.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = body.id;
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Nama barang wajib diisi." }, { status: 400 });
    patch.name = name;
  }
  if (body.sku !== undefined) patch.sku = String(body.sku).trim() || null;
  if (body.category !== undefined) patch.category = String(body.category).trim();
  if (body.unit !== undefined) patch.unit = String(body.unit).trim() || "pcs";
  if (body.notes !== undefined) patch.notes = String(body.notes).trim();
  if (body.harga_modal !== undefined) {
    const v = Number(body.harga_modal);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Harga modal tidak valid." }, { status: 400 });
    patch.harga_modal = v;
  }
  if (body.harga_jual !== undefined) {
    const v = Number(body.harga_jual);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Harga jual tidak valid." }, { status: 400 });
    patch.harga_jual = v;
  }
  if (body.stok_min !== undefined) {
    const v = Math.trunc(Number(body.stok_min));
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Stok minimum tidak valid." }, { status: 400 });
    patch.stok_min = v;
  }
  if (body.is_active !== undefined) patch.is_active = !!body.is_active;

  const supabase = createAdminClient();
  const { data: before, error: fetchError } = await supabase.from("inventory_items").select("*").eq("id", id).single();
  if (fetchError || !before) return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });

  const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
  if (error) {
    const msg = error.code === "23505" ? "SKU sudah dipakai barang lain." : error.message;
    return NextResponse.json({ error: "Gagal memperbarui barang: " + msg }, { status: 400 });
  }

  const okUpdate = await auditMutation({
    supabase, admin, action: "update", entityType: "product",
    entityId: id, entityName: String(patch.name ?? before.name),
    before, after: patch,
  });
  if (!okUpdate) return NextResponse.json({ error: "Barang diperbarui, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const [{ count: movementCount }, { count: saleItemCount }] = await Promise.all([
    supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);

  if ((movementCount ?? 0) > 0 || (saleItemCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Barang memiliki riwayat mutasi/penjualan dan tidak bisa dihapus. Nonaktifkan saja (Ubah → Status)." },
      { status: 400 }
    );
  }

  const { data: before } = await supabase.from("inventory_items").select("*").eq("id", id).single();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "delete", entityType: "product",
    entityId: id, entityName: before?.name ?? "", before,
  });
  if (!okDelete) return NextResponse.json({ error: "Barang dihapus, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
