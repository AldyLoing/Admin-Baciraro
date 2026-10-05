import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import InventoriClient from "./InventoriClient";

export const revalidate = 0;

type ProductRow = {
  id: number;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string | null;
  harga_modal: number | string;
  harga_jual: number | string;
  stok: number | string;
  stok_min: number | string;
  is_active: boolean | null;
  notes: string | null;
  created_at: string;
};

type MovementRow = {
  id: number;
  product_id: number;
  type: "in" | "out";
  reason: string;
  qty: number | string;
  recipient: string | null;
  note: string | null;
  reference: string | null;
  harga_modal: number | string;
  sale_id: number | null;
  journal_entry_id: number | null;
  created_at: string;
  products: { name: string; sku: string | null; unit: string | null } | null;
  team_members: { name: string } | null;
};

type SaleItemRow = {
  id: number;
  product_id: number;
  qty: number | string;
  harga_jual: number | string;
  subtotal: number | string;
  products: { name: string } | null;
};

type SaleRow = {
  id: number;
  date: string;
  reference: string | null;
  recipient: string | null;
  total: number | string;
  payment_note: string | null;
  transaction_id: number | null;
  status?: string;
  created_at: string;
  transactions: { reference: string } | null;
  sale_items: SaleItemRow[] | null;
};


export default async function AdminInventoriPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [productsRes, movementsRes, salesRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, sku, name, category, unit, harga_modal, harga_jual, stok, stok_min, is_active, notes, created_at"
      )
      .order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select(
        "id, product_id, type, reason, qty, recipient, note, reference, harga_modal, sale_id, journal_entry_id, created_at, created_by, products:product_id ( name, sku, unit ), team_members:created_by ( name )"
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("sales")
      .select(
        "id, date, reference, recipient, total, payment_note, transaction_id, status, created_at, transactions:transaction_id ( reference ), sale_items ( id, product_id, qty, harga_jual, subtotal, products:product_id ( name ) )"
      )
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  const products = ((productsRes.data ?? []) as unknown as ProductRow[]).map((p) => ({
    id: p.id,
    sku: p.sku ?? null,
    name: p.name,
    category: p.category ?? "",
    unit: p.unit ?? "pcs",
    harga_modal: Number(p.harga_modal) || 0,
    harga_jual: Number(p.harga_jual) || 0,
    stok: Number(p.stok) || 0,
    stok_min: Number(p.stok_min) || 0,
    is_active: p.is_active ?? true,
    notes: p.notes ?? "",
    created_at: p.created_at,
  }));

  const movements = ((movementsRes.data ?? []) as unknown as MovementRow[]).map((m) => ({
    id: m.id,
    product_id: m.product_id,
    type: m.type,
    reason: m.reason,
    qty: Number(m.qty) || 0,
    recipient: m.recipient ?? "",
    note: m.note ?? "",
    reference: m.reference ?? "",
    harga_modal: Number(m.harga_modal) || 0,
    sale_id: m.sale_id ?? null,
    journal_entry_id: m.journal_entry_id ?? null,
    created_at: m.created_at,
    product_name: m.products?.name ?? "-",
    product_sku: m.products?.sku ?? null,
    product_unit: m.products?.unit ?? "pcs",
    created_by_name: m.team_members?.name ?? null,
  }));

  const sales = ((salesRes.data ?? []) as unknown as SaleRow[]).map((s) => ({
    id: s.id,
    date: s.date,
    reference: s.reference ?? "",
    recipient: s.recipient ?? "",
    total: Number(s.total) || 0,
    status: s.status ?? "active",
    payment_note: s.payment_note ?? "",
    transaction_ref: s.transactions?.reference ?? null,
    created_at: s.created_at,
    items: (s.sale_items ?? []).map((i) => ({
      product_id: i.product_id,
      product_name: i.products?.name ?? "-",
      qty: Number(i.qty) || 0,
      harga_jual: Number(i.harga_jual) || 0,
      subtotal: Number(i.subtotal) || 0,
    })),
  }));

  return (
    <InventoriClient
      initialProducts={products}
      initialMovements={movements}
      initialSales={sales}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
