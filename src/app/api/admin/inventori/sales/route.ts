import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  generateReference,
  generateSaleReference,
  journalForSale,
  round2,
} from "@/lib/admin/inventori";
import { auditMutation } from "@/lib/admin/audit";
import { voidJournalEntry, voidTransaction } from "@/lib/admin/void";

const SALE_SELECT = `
  id, date, reference, recipient, total, payment_note, transaction_id, status, created_by, created_at,
  transactions:transaction_id ( reference ),
  sale_items ( id, product_id, qty, harga_jual, harga_modal, subtotal, products:product_id ( name, sku, unit ) )
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
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit")) || 100, 300);

  let query = supabase
    .from("sales")
    .select(SALE_SELECT)
    .order("date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const recipient = sp.get("recipient");
  if (recipient) query = query.ilike("recipient", `%${recipient}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Gagal memuat penjualan: " + error.message }, { status: 400 });
  return NextResponse.json({ sales: data ?? [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const date: string = String(body.date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const recipient = String(body.recipient ?? "").trim();
  const paymentNote = String(body.payment_note ?? "").trim();
  const items: ClientItem[] = Array.isArray(body.items) ? body.items : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }
  if (items.length === 0) return NextResponse.json({ error: "Tambahkan minimal satu barang." }, { status: 400 });

  const normalized: { product_id: number; qty: number; harga_jual: number }[] = [];
  for (const it of items) {
    const pid = Number(it?.product_id);
    const qty = Math.trunc(Number(it?.qty));
    if (!pid || !qty || qty <= 0) {
      return NextResponse.json({ error: "Setiap barang wajib punya jumlah lebih dari 0." }, { status: 400 });
    }
    normalized.push({ product_id: pid, qty, harga_jual: Number(it?.harga_jual) || 0 });
  }

  const supabase = createAdminClient();

  const productIds = [...new Set(normalized.map((i) => i.product_id))];
  const { data: products, error: productError } = await supabase
    .from("inventory_items")
    .select("id, name, sku, unit, stok, harga_modal, harga_jual, is_active")
    .in("id", productIds);

  if (productError) return NextResponse.json({ error: "Gagal memuat barang: " + productError.message }, { status: 400 });

  const productMap = new Map<number, ProductRow>();
  for (const p of products ?? []) productMap.set(p.id, p);

  // Validasi stok & harga sebelum menyimpan apa pun
  const needed = new Map<number, number>();
  for (const it of normalized) {
    const p = productMap.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Ada barang yang tidak ditemukan." }, { status: 400 });
    if (!p.is_active) return NextResponse.json({ error: `Barang "${p.name}" nonaktif.` }, { status: 400 });
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

  let total = 0;
  let hppTotal = 0;
  const itemRows: {
    product_id: number;
    qty: number;
    harga_jual: number;
    harga_modal: number;
    subtotal: number;
    product_name: string;
    unit: string;
  }[] = [];
  for (const it of normalized) {
    const p = productMap.get(it.product_id);
    if (!p) return NextResponse.json({ error: "Ada barang yang tidak ditemukan." }, { status: 400 });
    const hargaJual = it.harga_jual > 0 ? round2(it.harga_jual) : round2(p.harga_jual);
    const hargaModal = round2(p.harga_modal);
    const subtotal = round2(hargaJual * it.qty);
    total = round2(total + subtotal);
    hppTotal = round2(hppTotal + hargaModal * it.qty);
    itemRows.push({
      product_id: it.product_id,
      qty: it.qty,
      harga_jual: hargaJual,
      harga_modal: hargaModal,
      subtotal,
      product_name: p.name,
      unit: p.unit,
    });
  }

  if (total <= 0) {
    return NextResponse.json({ error: "Total penjualan harus lebih dari 0." }, { status: 400 });
  }

  const invReference = await generateReference(supabase, "income", Number(date.slice(0, 4)));
  const saleReference = await generateSaleReference(supabase, Number(date.slice(0, 4)));
  const itemSummary = itemRows
    .map((i) => `${i.qty} ${i.unit} ${i.product_name}`)
    .join(", ");

  // 1. Baris kas di tabel transactions
  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      date,
      type: "income",
      amount: total,
      source: `Penjualan ${saleReference}${recipient ? ` — ${recipient}` : ""}`,
      description: itemSummary,
      reference: invReference,
      account_code: 4101,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (txError) {
    return NextResponse.json({ error: "Gagal mencatat kas: " + txError.message }, { status: 400 });
  }

  // 2. Header penjualan
  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .insert({
      date,
      reference: saleReference,
      recipient,
      total,
      payment_note: paymentNote,
      transaction_id: tx.id,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (saleError) {
    await supabase.from("transactions").delete().eq("id", tx.id);
    return NextResponse.json({ error: "Gagal menyimpan penjualan: " + saleError.message }, { status: 400 });
  }

  // 3. Item penjualan
  const { error: itemsError } = await supabase.from("sale_items").insert(
    itemRows.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id,
      qty: i.qty,
      harga_jual: i.harga_jual,
      harga_modal: i.harga_modal,
      subtotal: i.subtotal,
    }))
  );

  if (itemsError) {
    await supabase.from("sales").delete().eq("id", sale.id);
    await supabase.from("transactions").delete().eq("id", tx.id);
    return NextResponse.json({ error: "Gagal menyimpan item: " + itemsError.message }, { status: 400 });
  }

  // 4. Mutasi keluar per barang (stok belum diubah — aman jika gagal di tengah)
  for (const i of itemRows) {
    const { error: mvError } = await supabase.from("stock_movements").insert({
      product_id: i.product_id,
      type: "out",
      reason: "terjual",
      qty: i.qty,
      recipient,
      note: itemSummary,
      reference: saleReference,
      harga_modal: i.harga_modal,
      sale_id: sale.id,
      transaction_id: tx.id,
      created_by: admin.id,
    });
    if (mvError) {
      await rollbackSale(supabase, sale.id, tx.id, []);
      return NextResponse.json({ error: "Gagal mencatat mutasi stok: " + mvError.message }, { status: 400 });
    }
  }

  // 5. Pengurangan stok per barang
  const applied: { pid: number; qty: number }[] = [];
  for (const [pid, qty] of needed) {
    const p = productMap.get(pid);
    if (!p) {
      await rollbackSale(supabase, sale.id, tx.id, applied);
      return NextResponse.json({ error: "Barang tidak ditemukan." }, { status: 400 });
    }
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: p.stok - qty, updated_at: new Date().toISOString() })
      .eq("id", pid);
    if (stokError) {
      await rollbackSale(supabase, sale.id, tx.id, applied);
      return NextResponse.json({ error: "Gagal memperbarui stok: " + stokError.message }, { status: 400 });
    }
    applied.push({ pid, qty });
  }

  // 6. Jurnal double-entry (pendapatan + HPP)
  let journalOk = false;
  try {
    const journalId = await journalForSale(supabase, {
      date,
      reference: saleReference,
      recipient,
      total,
      hpp: hppTotal,
      createdBy: admin.id,
      transactionId: tx.id,
    });
    if (journalId) {
      await supabase.from("sales").update({ journal_entry_id: journalId }).eq("id", sale.id);
      await supabase
        .from("stock_movements")
        .update({ journal_entry_id: journalId })
        .eq("sale_id", sale.id);
      journalOk = true;
    }
  } catch {
    // jurnal pelengkap — penjualan tetap tersimpan
  }

  const okCreate = await auditMutation({
    supabase, admin, action: "create", entityType: "sale",
    entityId: sale.id,
    entityName: `${saleReference} — ${recipient || "Tanpa penerima"}`,
    after: { date, reference: saleReference, recipient, total, items: itemRows.length, inv_reference: invReference, hpp: hppTotal, journal_ok: journalOk },
  });
  if (!okCreate) return NextResponse.json({ error: "Penjualan dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id: sale.id,
    reference: saleReference,
    inv_reference: invReference,
    total,
    journal: journalOk,
  });
}

async function rollbackSale(
  supabase: SupabaseClient,
  saleId: number,
  txId: number,
  applied: { pid: number; qty: number }[]
) {
  for (const a of applied) {
    const { data: p } = await supabase.from("inventory_items").select("stok").eq("id", a.pid).single();
    if (p) {
      await supabase.from("inventory_items").update({ stok: p.stok + a.qty }).eq("id", a.pid);
    }
  }
  await supabase.from("stock_movements").delete().eq("sale_id", saleId);
  await supabase.from("sales").delete().eq("id", saleId);
  await supabase.from("transactions").delete().eq("id", txId);
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: sale, error } = await supabase
    .from("sales")
    .select("id, reference, transaction_id, journal_entry_id, status")
    .eq("id", id)
    .single();

  if (error || !sale) return NextResponse.json({ error: "Penjualan tidak ditemukan." }, { status: 404 });
  if (sale.status === "void") return NextResponse.json({ error: "Penjualan sudah dibatalkan." }, { status: 400 });

  // 1. Kembalikan stok + catat mutasi koreksi (mutasi asli TIDAK dihapus)
  const { data: items } = await supabase
    .from("sale_items")
    .select("product_id, qty, products:product_id ( stok, unit, name )")
    .eq("sale_id", id);

  for (const it of items ?? []) {
    const p = it.products as unknown as { stok: number };
    const { error: stokError } = await supabase
      .from("inventory_items")
      .update({ stok: p.stok + it.qty, updated_at: new Date().toISOString() })
      .eq("id", it.product_id);
    if (stokError) {
      return NextResponse.json({ error: "Gagal mengembalikan stok: " + stokError.message }, { status: 400 });
    }
    const { error: mvError } = await supabase.from("stock_movements").insert({
      product_id: it.product_id,
      type: "in",
      reason: "koreksi",
      qty: it.qty,
      note: `Koreksi pembatalan penjualan ${sale.reference}`,
      reference: `VOID-SALE-${id}`,
      created_by: admin.id,
    });
    if (mvError) return NextResponse.json({ error: "Gagal mencatat koreksi stok: " + mvError.message }, { status: 400 });
  }

  // 2. Batalkan jurnal penjualan & jurnal kas transaksi (tanpa menghapus)
  if (sale.journal_entry_id) {
    const j = await voidJournalEntry(supabase, sale.journal_entry_id, admin.id);
    if (!j.ok) return NextResponse.json({ error: "Gagal membatalkan jurnal penjualan: " + j.error }, { status: 400 });
  }
  if (sale.transaction_id) {
    const t = await voidTransaction(supabase, sale.transaction_id, admin.id);
    if (!t.ok) return NextResponse.json({ error: "Gagal membatalkan kas penjualan: " + t.error }, { status: 400 });
  }

  // 3. Tandai penjualan void
  const { error: voidError } = await supabase.from("sales").update({ status: "void" }).eq("id", id);
  if (voidError) return NextResponse.json({ error: "Gagal membatalkan penjualan: " + voidError.message }, { status: 400 });

  const okDelete = await auditMutation({
    supabase, admin, action: "void", entityType: "sale",
    entityId: id, entityName: sale.reference,
    before: sale as unknown as Record<string, unknown>,
    after: { ...sale, status: "void" },
    extra: { corrected_stock_items: (items ?? []).length },
  });
  if (!okDelete) return NextResponse.json({ error: "Penjualan dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
