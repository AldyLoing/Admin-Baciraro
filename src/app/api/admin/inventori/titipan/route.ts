import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateTitipanReference, round2 } from "@/lib/admin/inventori";
import { auditMutation } from "@/lib/admin/audit";

const CONSIGNMENT_SELECT = `
  id, reference, toko_id, date, note, status, void_reason, created_by, created_at,
  toko:toko_id ( id, name, phone, city ),
  consignment_items (
    id, product_id, qty, harga_jual, harga_modal,
    products:product_id ( id, name, sku, unit ),
    consignment_events ( id, type, qty, date, note, created_at )
  )
`;

type ClientItem = { product_id: number; qty: number; harga_jual?: number };

type ProductRow = {
  id: number;
  name: string;
  sku: string | null;
  unit: string;
  stok: number;
  harga_modal: number;
  harga_jual: number;
  is_active: boolean;
  is_raw_material: boolean;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const tokoId = sp.get("toko_id");
  const from = sp.get("from");
  const to = sp.get("to");
  const q = sp.get("q");
  const limit = Math.min(Number(sp.get("limit")) || 200, 500);

  let query = supabase
    .from("consignments")
    .select(CONSIGNMENT_SELECT)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (tokoId) query = query.eq("toko_id", tokoId);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat titipan: " + error.message }, { status: 400 });

  let rows = data ?? [];
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((c: Record<string, unknown>) => {
      const toko = c.toko as { name?: string } | null;
      const items = (c.consignment_items ?? []) as { products?: { name?: string } | null }[];
      return (
        String(c.reference ?? "").toLowerCase().includes(needle) ||
        String(toko?.name ?? "").toLowerCase().includes(needle) ||
        items.some((i) => String(i.products?.name ?? "").toLowerCase().includes(needle))
      );
    });
  }

  return NextResponse.json({ consignments: rows ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const tokoId = Number(body.toko_id);
  const date: string = String(body.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const note = String(body.note ?? "").trim();
  const items: ClientItem[] = Array.isArray(body.items) ? body.items : [];

  if (!tokoId) return NextResponse.json({ error: "Toko wajib dipilih." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: "Tambahkan minimal satu barang." }, { status: 400 });

  const normalized: { product_id: number; qty: number; harga_jual: number }[] = [];
  for (const it of items) {
    const pid = Number(it?.product_id);
    const qty = Math.round(Number(it?.qty) * 1000) / 1000;
    if (!pid || !qty || qty <= 0) {
      return NextResponse.json({ error: "Setiap barang wajib punya jumlah lebih dari 0." }, { status: 400 });
    }
    normalized.push({ product_id: pid, qty, harga_jual: Number(it?.harga_jual) || 0 });
  }

  const supabase = createAdminClient();

  const { data: toko, error: tokoError } = await supabase
    .from("tokos")
    .select("id, name, is_active")
    .eq("id", tokoId)
    .single();
  if (tokoError || !toko) return NextResponse.json({ error: "Toko tidak ditemukan." }, { status: 404 });
  if (!toko.is_active) return NextResponse.json({ error: "Toko nonaktif tidak bisa menerima titipan." }, { status: 400 });

  const productIds = [...new Set(normalized.map((i) => i.product_id))];
  const { data: products, error: productError } = await supabase
    .from("inventory_items")
    .select("id, name, sku, unit, stok, harga_modal, harga_jual, is_active, is_raw_material")
    .in("id", productIds);
  if (productError) return NextResponse.json({ error: "Gagal memuat barang: " + productError.message }, { status: 400 });

  const productMap = new Map<number, ProductRow>();
  for (const p of products ?? []) productMap.set(p.id, p);

  const needed = new Map<number, number>();
  for (const it of normalized) {
    const p = productMap.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Ada barang yang tidak ditemukan." }, { status: 400 });
    if (!p.is_active) return NextResponse.json({ error: `Barang "${p.name}" nonaktif.` }, { status: 400 });
    if (p.is_raw_material) return NextResponse.json({ error: `Bahan baku "${p.name}" tidak bisa dititipkan.` }, { status: 400 });
    needed.set(it.product_id, (needed.get(it.product_id) ?? 0) + it.qty);
  }
  for (const [pid, qty] of needed) {
    const p = productMap.get(pid);
    if (!p || p.stok < qty) {
      return NextResponse.json(
        { error: p ? `Stok ${p.name} tidak cukup (sisa ${p.stok} ${p.unit}, diminta ${qty}).` : "Barang tidak ditemukan." },
        { status: 400 }
      );
    }
  }

  const year = Number(date.slice(0, 4));
  const reference = await generateTitipanReference(supabase, year);

  // 1. Header nota titip
  const { data: consignment, error: cError } = await supabase
    .from("consignments")
    .insert({
      reference,
      toko_id: tokoId,
      date,
      note,
      status: "active",
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (cError || !consignment) {
    return NextResponse.json({ error: "Gagal menyimpan nota titip: " + (cError?.message ?? "") }, { status: 400 });
  }

  // 2. Item + snapshot harga
  const itemRows: {
    product_id: number;
    qty: number;
    harga_jual: number;
    harga_modal: number;
    product_name: string;
    unit: string;
  }[] = [];
  for (const it of normalized) {
    const p = productMap.get(it.product_id)!;
    itemRows.push({
      product_id: it.product_id,
      qty: it.qty,
      harga_jual: it.harga_jual > 0 ? round2(it.harga_jual) : round2(p.harga_jual),
      harga_modal: round2(p.harga_modal),
      product_name: p.name,
      unit: p.unit,
    });
  }

  const { error: itemsError } = await supabase.from("consignment_items").insert(
    itemRows.map((i) => ({
      consignment_id: consignment.id,
      product_id: i.product_id,
      qty: i.qty,
      harga_jual: i.harga_jual,
      harga_modal: i.harga_modal,
    }))
  );
  if (itemsError) {
    await supabase.from("consignments").delete().eq("id", consignment.id);
    return NextResponse.json({ error: "Gagal menyimpan barang titip: " + itemsError.message }, { status: 400 });
  }

  // 3. Mutasi keluar per barang (reason 'titip')
  const itemSummary = itemRows.map((i) => `${i.qty} ${i.unit} ${i.product_name}`).join(", ");
  for (const i of itemRows) {
    const { error: mvError } = await supabase.from("stock_movements").insert({
      product_id: i.product_id,
      type: "out",
      reason: "titip",
      qty: i.qty,
      recipient: toko.name,
      note: itemSummary,
      reference,
      harga_modal: i.harga_modal,
      consignment_id: consignment.id,
      created_by: admin.id,
    });
    if (mvError) {
      await rollbackConsignment(supabase, consignment.id, []);
      return NextResponse.json({ error: "Gagal mencatat mutasi stok: " + mvError.message }, { status: 400 });
    }
  }

  // 4. Pengurangan stok per barang
  const applied: { pid: number; qty: number }[] = [];
  for (const [pid, qty] of needed) {
    const p = productMap.get(pid)!;
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: p.stok - qty, updated_at: new Date().toISOString() })
      .eq("id", pid);
    if (stokError) {
      await rollbackConsignment(supabase, consignment.id, applied);
      return NextResponse.json({ error: "Gagal memperbarui stok: " + stokError.message }, { status: 400 });
    }
    applied.push({ pid, qty });
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "consignment",
    entityId: consignment.id, entityName: `${reference} — ${toko.name}`,
    after: { reference, toko_id: tokoId, toko: toko.name, date, note, items: itemRows.length, total_qty: [...needed.values()].reduce((s, n) => s + n, 0) },
  });
  if (!okCreate) return NextResponse.json({ error: "Titipan dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: consignment.id, reference });
}

/** Hapus header + item nota yang gagal tersimpan; kembalikan stok yang sudah terlanjur dikurangi. */
async function rollbackConsignment(
  supabase: ReturnType<typeof createAdminClient>,
  consignmentId: number,
  applied: { pid: number; qty: number }[]
) {
  for (const a of applied) {
    const { data: p } = await supabase.from("inventory_items").select("stok").eq("id", a.pid).single();
    if (p) await supabase.from("inventory_items").update({ stok: p.stok + a.qty }).eq("id", a.pid);
  }
  await supabase.from("stock_movements").delete().eq("consignment_id", consignmentId);
  await supabase.from("consignments").delete().eq("id", consignmentId);
}

/**
 * Batalkan nota titip (reversal, bukan hapus):
 * - tiap item: stok dikembalikan (+qty) dengan mutasi 'koreksi'
 * - event 'retur' pada nota itu dibalik (stok −qty) agar tidak dobel
 * - status nota menjadi 'void'
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = body.id;
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  if (action !== "void") return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: consignment, error } = await supabase
    .from("consignments")
    .select("id, reference, status, toko:toko_id ( name )")
    .eq("id", id)
    .single();
  if (error || !consignment) return NextResponse.json({ error: "Nota titip tidak ditemukan." }, { status: 404 });
  if (consignment.status === "void") return NextResponse.json({ error: "Nota titip sudah dibatalkan." }, { status: 400 });

  const { data: items } = await supabase
    .from("consignment_items")
    .select("id, product_id, qty, harga_modal, products:product_id ( stok, unit, name )")
    .eq("consignment_id", id);
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Nota titip tidak punya barang." }, { status: 400 });
  }

  const { data: events } = await supabase
    .from("consignment_events")
    .select("id, consignment_item_id, type, qty")
    .in("consignment_item_id", items.map((i) => i.id));

  // Pantau stok per produk di memori agar beberapa mutasi pada produk yang
  // sama dalam satu pembatalan tidak memakai nilai yang sudah basi.
  const stokNow = new Map<number, number>();
  for (const it of items) {
    const p = it.products as unknown as { stok: number };
    stokNow.set(it.product_id, p.stok);
  }
  const unitOf = new Map<number, { unit: string; name: string }>();
  for (const it of items) {
    const p = it.products as unknown as { unit: string; name: string };
    unitOf.set(it.product_id, p);
  }

  // 1. Balikkan event 'retur' dulu (stok berkurang) — aman karena stok
  //    memang sudah pernah naik saat retur dicatat.
  for (const ev of (events ?? []).filter((e) => e.type === "retur")) {
    const item = items.find((i) => i.id === ev.consignment_item_id);
    if (!item) continue;
    const meta = unitOf.get(item.product_id);
    const current = stokNow.get(item.product_id) ?? 0;
    const newStok = current - ev.qty;
    if (newStok < 0) {
      return NextResponse.json(
        { error: `Stok ${meta?.name ?? "barang"} tidak cukup untuk membalik retur (sisa ${current} ${meta?.unit ?? ""}).` },
        { status: 400 }
      );
    }
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: newStok, updated_at: new Date().toISOString() })
      .eq("id", item.product_id);
    if (stokError) return NextResponse.json({ error: "Gagal membalik retur: " + stokError.message }, { status: 400 });
    stokNow.set(item.product_id, newStok);
    await supabase.from("stock_movements").insert({
      product_id: item.product_id,
      type: "out",
      reason: "koreksi",
      qty: ev.qty,
      note: `Pembatalan retur — nota ${consignment.reference}`,
      reference: `VOID-TP-${id}-EVT-${ev.id}`,
      harga_modal: Number(item.harga_modal) || 0,
      consignment_id: id,
      created_by: admin.id,
    });
  }

  // 2. Kembalikan stok tiap item (stok naik)
  for (const it of items) {
    const current = stokNow.get(it.product_id) ?? 0;
    const newStok = current + it.qty;
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: newStok, updated_at: new Date().toISOString() })
      .eq("id", it.product_id);
    if (stokError) return NextResponse.json({ error: "Gagal mengembalikan stok: " + stokError.message }, { status: 400 });
    stokNow.set(it.product_id, newStok);
    await supabase.from("stock_movements").insert({
      product_id: it.product_id,
      type: "in",
      reason: "koreksi",
      qty: it.qty,
      note: `Pembatalan titip — nota ${consignment.reference}`,
      reference: `VOID-TP-${id}`,
      harga_modal: Number(it.harga_modal) || 0,
      consignment_id: id,
      created_by: admin.id,
    });
  }

  // 3. Tandai void
  const { error: voidError } = await supabase
    .from("consignments")
    .update({ status: "void", void_reason: reason })
    .eq("id", id);
  if (voidError) return NextResponse.json({ error: "Gagal membatalkan nota: " + voidError.message }, { status: 400 });

  const okVoid = await auditMutation({
    supabase, admin, action: "void", entityType: "consignment",
    entityId: id, entityName: consignment.reference,
    before: consignment as unknown as Record<string, unknown>,
    after: { status: "void", void_reason: reason },
    extra: { items: items.length, reverted_retur: (events ?? []).filter((e) => e.type === "retur").length },
  });
  if (!okVoid) return NextResponse.json({ error: "Nota dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
