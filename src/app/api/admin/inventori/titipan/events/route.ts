import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

type EventRow = { type: string; qty: number | string };

function sumByType(events: EventRow[]) {
  let terjual = 0;
  let retur = 0;
  let susut = 0;
  for (const e of events) {
    const qty = Number(e.qty) || 0;
    if (e.type === "terjual") terjual += qty;
    else if (e.type === "retur") retur += qty;
    else if (e.type === "susut") susut += qty;
  }
  return { terjual, retur, susut };
}

const TYPE_LABEL: Record<string, string> = { terjual: "Terjual", retur: "Retur", susut: "Hilang/rusak" };

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const itemId = Number(body.consignment_item_id);
  const type = String(body.type ?? "");
  const qty = Math.round(Number(body.qty) * 1000) / 1000;
  const date: string = String(body.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const note = String(body.note ?? "").trim();

  if (!itemId) return NextResponse.json({ error: "Barang titip wajib dipilih." }, { status: 400 });
  if (!["terjual", "retur", "susut"].includes(type)) {
    return NextResponse.json({ error: "Jenis peristiwa tidak valid." }, { status: 400 });
  }
  if (!qty || qty <= 0) return NextResponse.json({ error: "Jumlah harus lebih dari 0." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: item, error: itemError } = await supabase
    .from("consignment_items")
    .select(
      "id, consignment_id, product_id, qty, harga_modal, products:product_id ( id, name, unit, stok ), consignments:consignment_id ( id, reference, status, toko:toko_id ( name ) )"
    )
    .eq("id", itemId)
    .single();
  if (itemError || !item) return NextResponse.json({ error: "Barang titip tidak ditemukan." }, { status: 404 });
  const product = item.products as unknown as { id: number; name: string; unit: string; stok: number };

  const consignment = item.consignments as unknown as {
    id: number;
    reference: string;
    status: string;
    toko: { name: string } | null;
  };
  if (consignment.status !== "active") {
    return NextResponse.json({ error: "Nota titip sudah dibatalkan." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("consignment_events")
    .select("type, qty")
    .eq("consignment_item_id", itemId);
  const sums = sumByType((existing ?? []) as EventRow[]);
  const terpakai = sums.terjual + sums.retur + sums.susut;
  const sisa = item.qty - terpakai;
  if (qty > sisa + 1e-9) {
    return NextResponse.json(
      { error: `Sisa titip ${item.qty - terpakai} ${product.unit}, melebihi jumlah yang masih dititip.` },
      { status: 400 }
    );
  }

  const tokoName = consignment.toko?.name ?? "";
  let stockMovementId: number | null = null;

  // Retur = barang fisik kembali ke gudang → stok naik + mutasi 'retur_titip'.
  // Terjual & susut = tanpa mutasi stok (barang sudah keluar sejak titip).
  if (type === "retur") {
    const { data: mv, error: mvError } = await supabase
      .from("stock_movements")
      .insert({
        product_id: product.id,
        type: "in",
        reason: "retur_titip",
        qty,
        recipient: tokoName,
        note: note || `Retur dari ${tokoName} — nota ${consignment.reference}`,
        reference: consignment.reference,
        harga_modal: Number(item.harga_modal) || 0,
        consignment_id: consignment.id,
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (mvError || !mv) {
      return NextResponse.json({ error: "Gagal mencatat mutasi retur: " + (mvError?.message ?? "") }, { status: 400 });
    }

    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: product.stok + qty, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (stokError) {
      // Kompensasi: mutasi yang baru dibuat ikut dibuang agar tidak menggantung.
      await supabase.from("stock_movements").delete().eq("id", mv.id);
      return NextResponse.json({ error: "Gagal memperbarui stok: " + stokError.message }, { status: 400 });
    }
    stockMovementId = mv.id;
  }

  const { data: ev, error: evError } = await supabase
    .from("consignment_events")
    .insert({
      consignment_item_id: itemId,
      type,
      qty,
      date,
      note,
      stock_movement_id: stockMovementId,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (evError || !ev) {
    // Jika retur sudah mengubah stok, batalkan dulu supaya tidak menggantung.
    if (type === "retur" && stockMovementId) {
      const { data: prodNow } = await supabase
        .from("inventory_items")
        .select("stok")
        .eq("id", (item.products as unknown as { id: number }).id)
        .single();
      if (prodNow) {
        await supabase
          .from("inventory_items")
          .update({ stok: prodNow.stok - qty, updated_at: new Date().toISOString() })
          .eq("id", (item.products as unknown as { id: number }).id);
      }
      await supabase.from("stock_movements").delete().eq("id", stockMovementId);
    }
    return NextResponse.json({ error: "Gagal mencatat peristiwa: " + (evError?.message ?? "") }, { status: 400 });
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "consignment_event",
    entityId: ev.id,
    entityName: `${TYPE_LABEL[type]} ${qty} — ${consignment.reference}${tokoName ? ` (${tokoName})` : ""}`,
    after: { consignment_item_id: itemId, type, qty, date, note, sisa_sebelumnya: sisa },
  });
  if (!okCreate) return NextResponse.json({ error: "Peristiwa dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: ev.id, sisa: sisa - qty });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: ev, error } = await supabase
    .from("consignment_events")
    .select(
      "id, consignment_item_id, type, qty, stock_movement_id, consignment_items:consignment_item_id ( product_id, harga_modal, consignments:consignment_id ( id, reference, status ) )"
    )
    .eq("id", id)
    .single();
  if (error || !ev) return NextResponse.json({ error: "Peristiwa tidak ditemukan." }, { status: 404 });

  const item = ev.consignment_items as unknown as {
    product_id: number;
    harga_modal: number;
    consignments: { id: number; reference: string; status: string };
  };
  if (item.consignments.status !== "active") {
    return NextResponse.json({ error: "Nota titip sudah dibatalkan, hapus lewat pembatalan nota." }, { status: 400 });
  }

  if (ev.type === "retur") {
    // Retur mengembalikan stok; menghapus event harus mengembalikan stok itu lagi.
    const { data: product } = await supabase
      .from("inventory_items")
      .select("id, name, unit, stok")
      .eq("id", item.product_id)
      .single();
    if (!product) return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
    const newStok = product.stok - ev.qty;
    if (newStok < 0) {
      return NextResponse.json(
        { error: `Stok ${product.name} tidak cukup untuk membatalkan retur (sisa ${product.stok} ${product.unit}).` },
        { status: 400 }
      );
    }
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: newStok, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (stokError) return NextResponse.json({ error: "Gagal mengoreksi stok: " + stokError.message }, { status: 400 });

    await supabase.from("stock_movements").insert({
      product_id: product.id,
      type: "out",
      reason: "koreksi",
      qty: ev.qty,
      note: `Pembatalan retur — nota ${item.consignments.reference}`,
      reference: `VOID-EVT-${id}`,
      harga_modal: Number(item.harga_modal) || 0,
      consignment_id: item.consignments.id,
      created_by: admin.id,
    });
  }

  const { error: delError } = await supabase.from("consignment_events").delete().eq("id", id);
  if (delError) return NextResponse.json({ error: "Gagal menghapus peristiwa: " + delError.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "delete", entityType: "consignment_event",
    entityId: id,
    entityName: `${TYPE_LABEL[ev.type] ?? ev.type} ${ev.qty} — ${item.consignments.reference}`,
    before: ev as unknown as Record<string, unknown>,
    extra: { stock_corrected: ev.type === "retur" },
  });
  if (!okDelete) return NextResponse.json({ error: "Peristiwa dihapus, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
