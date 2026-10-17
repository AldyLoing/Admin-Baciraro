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
  is_raw_material?: boolean | null;
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
  consignment_id?: number | null;
  journal_entry_id: number | null;
  created_at: string;
  products: { name: string; sku: string | null; unit: string | null } | null;
  team_members: { name: string } | null;
};

type TokoRow = {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string;
};

type ConsignmentEventRow = {
  id: number;
  type: string;
  qty: number | string;
  date: string;
  note: string | null;
  created_at: string;
};

type ConsignmentItemRow = {
  id: number;
  product_id: number;
  qty: number | string;
  harga_jual: number | string;
  harga_modal: number | string;
  products: { name: string; sku: string | null; unit: string | null } | null;
  consignment_events: ConsignmentEventRow[] | null;
};

type ConsignmentRow = {
  id: number;
  reference: string;
  toko_id: number;
  date: string;
  note: string | null;
  status: string | null;
  void_reason: string | null;
  created_at: string;
  toko: { id: number; name: string; phone: string | null; city: string | null } | null;
  consignment_items: ConsignmentItemRow[] | null;
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
  payouts: { id: number; status: string; net_amount: number | string }[] | null;
};

type TeamMemberRow = {
  id: number;
  name: string;
  role: string | null;
  status: string | null;
};


export default async function AdminInventoriPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [productsRes, movementsRes, salesRes, tokosRes, consignmentsRes, membersRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, sku, name, category, unit, harga_modal, harga_jual, stok, stok_min, is_active, is_raw_material, notes, created_at"
      )
      .order("name", { ascending: true }),
    supabase
      .from("stock_movements")
      .select(
        "id, product_id, type, reason, qty, recipient, note, reference, harga_modal, sale_id, consignment_id, journal_entry_id, created_at, created_by, products:product_id ( name, sku, unit ), team_members:created_by ( name )"
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("sales")
      .select(
        "id, date, reference, recipient, total, payment_note, transaction_id, status, created_at, transactions:transaction_id ( reference ), sale_items ( id, product_id, qty, harga_jual, subtotal, products:product_id ( name ) ), payouts:sale_id ( id, status, net_amount )"
      )
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("tokos")
      .select("id, name, contact_name, phone, address, city, notes, is_active, created_at")
      .order("name", { ascending: true }),
    supabase
      .from("consignments")
      .select(
        "id, reference, toko_id, date, note, status, void_reason, created_at, toko:toko_id ( id, name, phone, city ), consignment_items ( id, product_id, qty, harga_jual, harga_modal, products:product_id ( name, sku, unit ), consignment_events ( id, type, qty, date, note, created_at ) )"
      )
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("team_members")
      .select("id, name, role, status")
      .eq("status", "active")
      .order("name"),
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
    is_raw_material: p.is_raw_material ?? false,
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
    consignment_id: m.consignment_id ?? null,
    journal_entry_id: m.journal_entry_id ?? null,
    created_at: m.created_at,
    product_name: m.products?.name ?? "-",
    product_sku: m.products?.sku ?? null,
    product_unit: m.products?.unit ?? "pcs",
    created_by_name: m.team_members?.name ?? null,
  }));

  const sales = ((salesRes.data ?? []) as unknown as SaleRow[]).map((s) => {
    const activePayout = (s.payouts ?? []).find((p) => p.status !== "cancelled") ?? null;
    return {
      id: s.id,
      date: s.date,
      reference: s.reference ?? "",
      recipient: s.recipient ?? "",
      total: Number(s.total) || 0,
      status: s.status ?? "active",
      payment_note: s.payment_note ?? "",
      transaction_ref: s.transactions?.reference ?? null,
      created_at: s.created_at,
      payout: activePayout
        ? { id: activePayout.id, status: activePayout.status, net_amount: Number(activePayout.net_amount) || 0 }
        : null,
      items: (s.sale_items ?? []).map((i) => ({
        product_id: i.product_id,
        product_name: i.products?.name ?? "-",
        qty: Number(i.qty) || 0,
        harga_jual: Number(i.harga_jual) || 0,
        subtotal: Number(i.subtotal) || 0,
      })),
    };
  });

  const teamMembers = ((membersRes.data ?? []) as unknown as TeamMemberRow[]).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role ?? "",
  }));

  const tokos = ((tokosRes.data ?? []) as unknown as TokoRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    contact_name: t.contact_name ?? "",
    phone: t.phone ?? "",
    address: t.address ?? "",
    city: t.city ?? "",
    notes: t.notes ?? "",
    is_active: t.is_active ?? true,
    created_at: t.created_at,
  }));

  const consignments = ((consignmentsRes.data ?? []) as unknown as ConsignmentRow[]).map((c) => ({
    id: c.id,
    reference: c.reference,
    toko_id: c.toko_id,
    toko_name: c.toko?.name ?? "-",
    toko_phone: c.toko?.phone ?? "",
    toko_city: c.toko?.city ?? "",
    date: c.date,
    note: c.note ?? "",
    status: c.status ?? "active",
    void_reason: c.void_reason ?? "",
    created_at: c.created_at,
    items: (c.consignment_items ?? []).map((i) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.products?.name ?? "-",
      product_sku: i.products?.sku ?? null,
      product_unit: i.products?.unit ?? "pcs",
      qty: Number(i.qty) || 0,
      harga_jual: Number(i.harga_jual) || 0,
      harga_modal: Number(i.harga_modal) || 0,
      events: (i.consignment_events ?? []).map((e) => ({
        id: e.id,
        type: e.type as "terjual" | "retur" | "susut",
        qty: Number(e.qty) || 0,
        date: e.date,
        note: e.note ?? "",
        created_at: e.created_at,
      })),
    })),
  }));

  return (
    <InventoriClient
      initialProducts={products}
      initialMovements={movements}
      initialSales={sales}
      initialTokos={tokos}
      initialConsignments={consignments}
      teamMembers={teamMembers}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
