import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { journalForMovement, round2 } from "@/lib/admin/inventori";
import { auditMutation } from "@/lib/admin/audit";
import { voidJournalEntry } from "@/lib/admin/void";

const MOVEMENT_SELECT = `
  id, product_id, type, reason, qty, recipient, note, reference, harga_modal,
  sale_id, transaction_id, journal_entry_id, created_by, created_at,
  products:product_id ( id, name, sku, unit, stok )
`;

const OUT_REASONS = ["penyesuaian", "gratis", "rusak", "hilang"];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const productId = sp.get("product_id");
  const type = sp.get("type");
  const reason = sp.get("reason");
  const from = sp.get("from");
  const to = sp.get("to");
  const limit = Math.min(Number(sp.get("limit")) || 200, 500);

  let query = supabase
    .from("stock_movements")
    .select(MOVEMENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productId) query = query.eq("product_id", productId);
  if (type === "in" || type === "out") query = query.eq("type", type);
  if (reason) query = query.eq("reason", reason);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat mutasi: " + error.message }, { status: 400 });
  return NextResponse.json({ movements: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const productId = body.product_id;
  const type = body.type;
  const reason = body.reason;
  const qty = Math.trunc(Number(body.qty));
  const recipient = String(body.recipient ?? "").trim();
  const note = String(body.note ?? "").trim();

  if (!productId) return NextResponse.json({ error: "Barang wajib dipilih." }, { status: 400 });
  if (type !== "in" && type !== "out") {
    return NextResponse.json({ error: "Jenis mutasi tidak valid." }, { status: 400 });
  }
  if (!qty || qty <= 0) return NextResponse.json({ error: "Jumlah harus lebih dari 0." }, { status: 400 });

  const allowedIn = ["penyesuaian", "stok_awal"];
  const validReason = type === "in" ? allowedIn.includes(reason) : OUT_REASONS.includes(reason);
  if (!validReason) {
    return NextResponse.json({ error: "Alasan mutasi tidak valid." }, { status: 400 });
  }
  if (type === "out" && reason !== "penyesuaian" && !recipient && !note) {
    return NextResponse.json({ error: "Isi penerima atau catatan untuk barang keluar." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: product, error: productError } = await supabase
    .from("inventory_items")
    .select("id, name, unit, stok, harga_modal, is_active")
    .eq("id", productId)
    .single();

  if (productError || !product) return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 404 });
  if (!product.is_active) return NextResponse.json({ error: "Barang nonaktif tidak bisa dimutasi." }, { status: 400 });

  const newStok = type === "in" ? product.stok + qty : product.stok - qty;
  if (newStok < 0) {
    return NextResponse.json(
      { error: `Stok ${product.name} tidak cukup (sisa ${product.stok} ${product.unit}).` },
      { status: 400 }
    );
  }

  const hargaModal = round2(product.harga_modal);
  const date = new Date().toISOString().slice(0, 10);

  const { data: movement, error: movementError } = await supabase
    .from("stock_movements")
    .insert({
      product_id: productId,
      type,
      reason,
      qty,
      recipient,
      note,
      harga_modal: hargaModal,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (movementError || !movement) {
    return NextResponse.json({ error: "Gagal mencatat mutasi: " + (movementError?.message ?? "") }, { status: 400 });
  }

  const { error: stokError } = await supabase
    .from("inventory_items")
    .update({ stok: newStok, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (stokError) {
    await supabase.from("stock_movements").delete().eq("id", movement.id);
    return NextResponse.json({ error: "Gagal memperbarui stok: " + stokError.message }, { status: 400 });
  }

  let journalId: number | null = null;
  try {
    journalId = await journalForMovement(supabase, {
      date,
      type,
      reason,
      qty,
      hargaModal,
      productName: product.name,
      note: note || (recipient ? `ke ${recipient}` : ""),
      reference: `MUT-${movement.id}`,
      createdBy: admin.id,
    });
    if (journalId) {
      await supabase.from("stock_movements").update({ journal_entry_id: journalId }).eq("id", movement.id);
    }
  } catch {
    // jurnal bersifat pelengkap, mutasi tetap tersimpan
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "stock_movement",
    entityId: movement.id,
    entityName: `${type === "in" ? "Masuk" : "Keluar"} ${qty} ${product.unit} ${product.name}`,
    after: { product_id: product.id, type, qty, reason, recipient, note, harga_modal: hargaModal, journal: journalId },
  });
  if (!okCreate) return NextResponse.json({ error: "Mutasi dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: movement.id, stok_baru: newStok, journal: !!journalId });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: movement, error } = await supabase
    .from("stock_movements")
    .select("id, product_id, type, reason, qty, harga_modal, sale_id, journal_entry_id, reference, products:product_id ( name, unit, stok )")
    .eq("id", id)
    .single();

  if (error || !movement) return NextResponse.json({ error: "Mutasi tidak ditemukan." }, { status: 404 });
  if (movement.sale_id) {
    return NextResponse.json(
      { error: "Mutasi ini bagian dari penjualan. Batalkan lewat daftar penjualan agar stok & kas ikut terbalik." },
      { status: 400 }
    );
  }
  const { data: already } = await supabase
    .from("stock_movements")
    .select("id")
    .eq("reference", `VOID-${id}`)
    .maybeSingle();
  if (already) return NextResponse.json({ error: "Mutasi ini sudah pernah dikoreksi." }, { status: 400 });

  const product = movement.products as unknown as { name: string; unit: string; stok: number };
  const newStok = movement.type === "in" ? product.stok - movement.qty : product.stok + movement.qty;
  if (newStok < 0) {
    return NextResponse.json({ error: "Koreksi ini membuat stok negatif. Stok mungkin sudah berubah." }, { status: 400 });
  }

  const { error: stokError } = await supabase
    .from("inventory_items")
    .update({ stok: newStok, updated_at: new Date().toISOString() })
    .eq("id", movement.product_id);
  if (stokError) return NextResponse.json({ error: "Gagal mengembalikan stok: " + stokError.message }, { status: 400 });

  if (movement.journal_entry_id) {
    const j = await voidJournalEntry(supabase, movement.journal_entry_id, admin.id);
    if (!j.ok) return NextResponse.json({ error: "Gagal membatalkan jurnal mutasi: " + j.error }, { status: 400 });
  }

  const koreksiType = movement.type === "in" ? "out" : "in";
  const { data: koreksi, error: koreksiError } = await supabase
    .from("stock_movements")
    .insert({
      product_id: movement.product_id,
      type: koreksiType,
      reason: "koreksi",
      qty: movement.qty,
      note: `Koreksi atas mutasi #${id} (${movement.type === "in" ? "masuk" : "keluar"})`,
      reference: `VOID-${id}`,
      harga_modal: Number(movement.harga_modal) || 0,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (koreksiError) return NextResponse.json({ error: "Gagal mencatat mutasi koreksi: " + koreksiError.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "void", entityType: "stock_movement",
    entityId: id,
    entityName: `${movement.type === "in" ? "Masuk" : "Keluar"} ${movement.qty} ${product.unit} ${product.name}`,
    before: movement as unknown as Record<string, unknown>,
    after: { koreksi_id: koreksi.id, type: koreksiType, reason: "koreksi", qty: movement.qty },
    extra: { stok_baru: newStok },
  });
  if (!okDelete) return NextResponse.json({ error: "Mutasi dikoreksi, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, stok_baru: newStok });
}
