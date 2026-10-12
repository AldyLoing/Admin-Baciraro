"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import SearchInput from "@/components/ui/SearchInput";
import { formatRupiah, formatDateTime, formatNumber } from "@/lib/admin/format";

export type Product = {
  id: number;
  sku: string | null;
  name: string;
  category: string;
  unit: string;
  harga_modal: number;
  harga_jual: number;
  stok: number;
  stok_min: number;
  is_active: boolean;
  is_raw_material: boolean;
  notes: string;
  created_at: string;
};

export type Movement = {
  id: number;
  product_id: number;
  type: "in" | "out";
  reason: string;
  qty: number;
  recipient: string;
  note: string;
  reference: string;
  harga_modal: number;
  sale_id: number | null;
  consignment_id?: number | null;
  journal_entry_id: number | null;
  created_at: string;
  product_name: string;
  product_sku: string | null;
  product_unit: string;
  created_by_name: string | null;
};

export type SaleItem = {
  product_id: number;
  product_name: string;
  qty: number;
  harga_jual: number;
  subtotal: number;
};

export type Sale = {
  id: number;
  date: string;
  reference: string;
  recipient: string;
  total: number;
  payment_note: string;
  status?: string;
  transaction_ref: string | null;
  created_at: string;
  items: SaleItem[];
};

export type Toko = {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
  is_active: boolean;
  created_at: string;
};

export type ConsignmentEvent = {
  id: number;
  type: "terjual" | "retur" | "susut";
  qty: number;
  date: string;
  note: string;
  created_at: string;
};

export type ConsignmentItem = {
  id: number;
  product_id: number;
  product_name: string;
  product_sku: string | null;
  product_unit: string;
  qty: number;
  harga_jual: number;
  harga_modal: number;
  events: ConsignmentEvent[];
};

export type Consignment = {
  id: number;
  reference: string;
  toko_id: number;
  toko_name: string;
  toko_phone: string;
  toko_city: string;
  date: string;
  note: string;
  status: string;
  void_reason: string;
  created_at: string;
  items: ConsignmentItem[];
};

type Props = {
  initialProducts: Product[];
  initialMovements: Movement[];
  initialSales: Sale[];
  initialTokos: Toko[];
  initialConsignments: Consignment[];
  isAdmin: boolean;
};

type Tab = "barang" | "bahan" | "mutasi" | "penjualan" | "titipan" | "laporan";

const tabs: { key: Tab; label: string }[] = [
  { key: "barang", label: "Barang" },
  { key: "bahan", label: "Bahan Baku" },
  { key: "mutasi", label: "Mutasi Stok" },
  { key: "penjualan", label: "Penjualan" },
  { key: "titipan", label: "Titipan" },
  { key: "laporan", label: "Laporan" },
];

const reasonLabel: Record<string, string> = {
  stok_awal: "Stok Awal",
  penyesuaian: "Penyesuaian / Opname",
  terjual: "Terjual",
  gratis: "Gratis / Hadiah",
  rusak: "Rusak",
  hilang: "Hilang",
  titip: "Titip ke Toko",
  retur_titip: "Retur dari Toko",
};

const reasonColor: Record<string, string> = {
  stok_awal: "bg-blue-500/10 text-blue-400",
  penyesuaian: "bg-amber-500/10 text-amber-400",
  terjual: "bg-emerald-500/10 text-emerald-400",
  gratis: "bg-purple-500/10 text-purple-400",
  rusak: "bg-red-500/10 text-red-400",
  hilang: "bg-red-500/10 text-red-400",
  titip: "bg-sky-500/10 text-sky-400",
  retur_titip: "bg-teal-500/10 text-teal-400",
};

const eventTypeLabel: Record<ConsignmentEvent["type"], string> = {
  terjual: "Terjual",
  retur: "Retur",
  susut: "Hilang / Rusak",
};

const eventTypeColor: Record<ConsignmentEvent["type"], string> = {
  terjual: "bg-emerald-500/10 text-emerald-400",
  retur: "bg-teal-500/10 text-teal-400",
  susut: "bg-red-500/10 text-red-400",
};

/** Σ qty per jenis pelaporan + sisa yang masih dititipkan pada satu barang. */
function itemSums(item: ConsignmentItem) {
  let terjual = 0;
  let retur = 0;
  let susut = 0;
  for (const e of item.events) {
    if (e.type === "terjual") terjual += e.qty;
    else if (e.type === "retur") retur += e.qty;
    else susut += e.qty;
  }
  const dipakai = terjual + retur + susut;
  return { terjual, retur, susut, sisa: Math.max(0, item.qty - dipakai) };
}

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";
const primaryBtn =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition";
const ghostBtn =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition";
const labelCls = "block text-sm font-medium text-white/70 mb-1";

const emptyProductForm = {
  sku: "",
  name: "",
  category: "",
  unit: "pcs",
  harga_modal: "",
  harga_jual: "",
  stok: "",
  stok_min: "",
  notes: "",
  is_active: true,
  is_raw_material: false,
};

const emptyMovementForm = {
  product_id: "",
  type: "in" as "in" | "out",
  reason: "penyesuaian",
  qty: "",
  recipient: "",
  note: "",
};

const emptyTokoForm = {
  name: "",
  contact_name: "",
  phone: "",
  address: "",
  city: "",
  notes: "",
  is_active: true,
};

const emptyTitipForm = {
  toko_id: "",
  date: "",
  note: "",
};

type SaleFormItem = { product_id: string; qty: string; harga_jual: string };
type TitipFormItem = SaleFormItem;

type ApiResult = {
  ok?: boolean;
  error?: string;
  reference?: string;
  inv_reference?: string;
  journal?: boolean;
  id?: number;
  total?: number;
  stok_baru?: number;
  [key: string]: unknown;
};

export default function InventoriClient({
  initialProducts,
  initialMovements,
  initialSales,
  initialTokos,
  initialConsignments,
  isAdmin,
}: Props) {
  const [tab, setTab] = useState<Tab>("barang");
  const [products, setProducts] = useState(initialProducts);
  const [movements] = useState(initialMovements);
  const [sales] = useState(initialSales);
  const [tokos, setTokos] = useState(initialTokos);
  const [consignments] = useState(initialConsignments);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [barangSearch, setBarangSearch] = useState("");
  const [bahanSearch, setBahanSearch] = useState("");
  const [mutasiSearch, setMutasiSearch] = useState("");
  const [mutasiType, setMutasiType] = useState("");
  const [mutasiReason, setMutasiReason] = useState("");
  const [penjualanSearch, setPenjualanSearch] = useState("");

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);

  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);

  const [showSaleForm, setShowSaleForm] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [saleRecipient, setSaleRecipient] = useState("");
  const [salePaymentNote, setSalePaymentNote] = useState("");
  const [saleItems, setSaleItems] = useState<SaleFormItem[]>([{ product_id: "", qty: "", harga_jual: "" }]);

  const [titipSub, setTitipSub] = useState<"daftar" | "toko">("daftar");
  const [titipanSearch, setTitipanSearch] = useState("");
  const [titipanTokoFilter, setTitipanTokoFilter] = useState("");
  const [showTitipForm, setShowTitipForm] = useState(false);
  const [titipForm, setTitipForm] = useState({ ...emptyTitipForm, date: new Date().toISOString().slice(0, 10) });
  const [titipItems, setTitipItems] = useState<TitipFormItem[]>([{ product_id: "", qty: "", harga_jual: "" }]);
  const [expandedTitip, setExpandedTitip] = useState<number | null>(null);

  const [eventForm, setEventForm] = useState<{
    item: ConsignmentItem;
    reference: string;
    type: ConsignmentEvent["type"];
    qty: string;
    date: string;
    note: string;
  } | null>(null);

  const [showTokoForm, setShowTokoForm] = useState(false);
  const [editingToko, setEditingToko] = useState<Toko | null>(null);
  const [tokoForm, setTokoForm] = useState(emptyTokoForm);

  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyMovements, setHistoryMovements] = useState<Movement[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  function showError(msg: string) {
    setError(msg);
    setSuccess(null);
  }
  function showSuccess(msg: string) {
    setSuccess(msg);
    setError(null);
    setTimeout(() => window.location.reload(), 700);
  }

  async function apiCall(url: string, method: string, payload: unknown): Promise<ApiResult> {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data: ApiResult = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Terjadi kesalahan.");
    }
    return data;
  }

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const base = products.filter((p) => !p.is_raw_material);
    if (!barangSearch) return base;
    const q = barangSearch.toLowerCase();
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, barangSearch]);

  const filteredBahan = useMemo(() => {
    const base = products.filter((p) => p.is_raw_material);
    if (!bahanSearch) return base;
    const q = bahanSearch.toLowerCase();
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, bahanSearch]);

  const filteredMovements = useMemo(() => {
    const q = mutasiSearch.toLowerCase();
    return movements.filter((m) => {
      if (mutasiType && m.type !== mutasiType) return false;
      if (mutasiReason && m.reason !== mutasiReason) return false;
      if (!q) return true;
      return (
        m.product_name.toLowerCase().includes(q) ||
        (m.product_sku ?? "").toLowerCase().includes(q) ||
        m.recipient.toLowerCase().includes(q) ||
        m.note.toLowerCase().includes(q) ||
        m.reference.toLowerCase().includes(q)
      );
    });
  }, [movements, mutasiSearch, mutasiType, mutasiReason]);

  const filteredSales = useMemo(() => {
    if (!penjualanSearch) return sales;
    const q = penjualanSearch.toLowerCase();
    return sales.filter(
      (s) =>
        s.reference.toLowerCase().includes(q) ||
        s.recipient.toLowerCase().includes(q) ||
        s.items.some((i) => i.product_name.toLowerCase().includes(q))
    );
  }, [sales, penjualanSearch]);

  const lowStock = useMemo(() => products.filter((p) => p.is_active && p.stok <= p.stok_min), [products]);
  const lowStockBarang = useMemo(() => lowStock.filter((p) => !p.is_raw_material), [lowStock]);
  const lowStockBahan = useMemo(() => lowStock.filter((p) => p.is_raw_material), [lowStock]);
  const valuation = useMemo(
    () => products.filter((p) => p.is_active).reduce((sum, p) => sum + p.stok * p.harga_modal, 0),
    [products]
  );
  const soldRecap = useMemo(() => {
    const map = new Map<number, { name: string; terjual: number; omzet: number; modal: number }>();
    for (const s of sales) {
      for (const i of s.items) {
        const prev = map.get(i.product_id) ?? { name: i.product_name, terjual: 0, omzet: 0, modal: 0 };
        const p = productMap.get(i.product_id);
        prev.terjual += i.qty;
        prev.omzet += i.subtotal;
        prev.modal += i.qty * (p?.harga_modal ?? 0);
        map.set(i.product_id, prev);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].terjual - a[1].terjual);
  }, [sales, productMap]);

  // ---------- Titipan: turunan data ----------
  const activeTokos = useMemo(() => tokos.filter((t) => t.is_active), [tokos]);

  const filteredConsignments = useMemo(() => {
    const q = titipanSearch.toLowerCase();
    return consignments.filter((c) => {
      if (titipanTokoFilter && c.toko_id !== Number(titipanTokoFilter)) return false;
      if (!q) return true;
      return (
        c.reference.toLowerCase().includes(q) ||
        c.toko_name.toLowerCase().includes(q) ||
        c.items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    });
  }, [consignments, titipanSearch, titipanTokoFilter]);

  const titipanSummary = useMemo(() => {
    let dititip = 0;
    let terjual = 0;
    let retur = 0;
    let susut = 0;
    let nilaiSisa = 0;
    let notaAktif = 0;
    for (const c of consignments) {
      if (c.status !== "active") continue;
      notaAktif++;
      for (const it of c.items) {
        const s = itemSums(it);
        dititip += it.qty;
        terjual += s.terjual;
        retur += s.retur;
        susut += s.susut;
        nilaiSisa += s.sisa * it.harga_modal;
      }
    }
    return { dititip, terjual, retur, susut, sisa: dititip - terjual - retur - susut, nilaiSisa, notaAktif };
  }, [consignments]);

  /** Rekap per toko — hanya nota aktif, dipakai tab Laporan & export. */
  const tokoRecap = useMemo(() => {
    const map = new Map<
      number,
      { toko_id: number; name: string; dititip: number; terjual: number; retur: number; susut: number; sisa: number; nilaiSisa: number }
    >();
    for (const c of consignments) {
      if (c.status !== "active") continue;
      const prev = map.get(c.toko_id) ?? {
        toko_id: c.toko_id,
        name: c.toko_name,
        dititip: 0,
        terjual: 0,
        retur: 0,
        susut: 0,
        sisa: 0,
        nilaiSisa: 0,
      };
      for (const it of c.items) {
        const s = itemSums(it);
        prev.dititip += it.qty;
        prev.terjual += s.terjual;
        prev.retur += s.retur;
        prev.susut += s.susut;
        prev.sisa += s.sisa;
        prev.nilaiSisa += s.sisa * it.harga_modal;
      }
      map.set(c.toko_id, prev);
    }
    return [...map.values()].sort((a, b) => b.sisa - a.sisa);
  }, [consignments]);

  /** Daftar toko yang masih punya sisa titip (untuk dropdown filter). */
  const tokosWithStock = useMemo(() => {
    const ids = new Set(consignments.filter((c) => c.status === "active").map((c) => c.toko_id));
    return tokos.filter((t) => ids.has(t.id));
  }, [consignments, tokos]);

  // ---------- Titipan: aksi ----------
  function openTitipForm() {
    setTitipForm({ ...emptyTitipForm, date: new Date().toISOString().slice(0, 10) });
    setTitipItems([{ product_id: "", qty: "", harga_jual: "" }]);
    setShowTitipForm(true);
    setExpandedTitip(null);
    setError(null);
    setSuccess(null);
  }

  function onTitipProductChange(index: number, productId: string) {
    const p = productMap.get(Number(productId));
    setTitipItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, product_id: productId, harga_jual: p ? String(p.harga_jual) : it.harga_jual } : it))
    );
  }

  const titipTotal = useMemo(
    () =>
      titipItems.reduce((sum, it) => {
        const qty = Number(it.qty) || 0;
        const price = Number(it.harga_jual) || 0;
        return sum + qty * price;
      }, 0),
    [titipItems]
  );

  async function saveTitip(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!titipForm.toko_id) {
      showError("Toko wajib dipilih.");
      return;
    }
    const items = titipItems
      .filter((it) => it.product_id)
      .map((it) => ({
        product_id: Number(it.product_id),
        qty: Number(it.qty) || 0,
        harga_jual: Number(it.harga_jual) || 0,
      }));
    if (items.length === 0) {
      showError("Pilih minimal satu barang.");
      return;
    }
    const perProduct = new Map<number, number>();
    for (const it of items) {
      if (!it.qty || it.qty <= 0) {
        showError("Jumlah setiap barang harus lebih dari 0.");
        return;
      }
      perProduct.set(it.product_id, (perProduct.get(it.product_id) ?? 0) + it.qty);
    }
    for (const [pid, qty] of perProduct) {
      const p = productMap.get(pid);
      if (p?.is_raw_material) {
        showError(`Bahan baku "${p.name}" tidak bisa dititipkan.`);
        return;
      }
      if (p && qty > p.stok) {
        showError(`Stok ${p.name} tidak cukup (sisa ${p.stok} ${p.unit}, diminta ${qty}).`);
        return;
      }
    }

    setSaving(true);
    try {
      const data = await apiCall("/api/admin/inventori/titipan", "POST", {
        toko_id: Number(titipForm.toko_id),
        date: titipForm.date,
        note: titipForm.note,
        items,
      });
      showSuccess(`Titipan ${data.reference ?? ""} dicatat. Stok berkurang, sisa di toko bisa dilaporkan nanti.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function voidTitip(c: Consignment) {
    const reason = window.prompt(
      `Batalkan nota ${c.reference}?\n\nStok akan dikembalikan dan sisa titip dihitung ulang.\nIsi alasan pembatalan (opsional):`,
      ""
    );
    if (reason === null) return;
    setError(null);
    setSaving(true);
    try {
      await apiCall("/api/admin/inventori/titipan", "PATCH", { id: c.id, action: "void", reason: reason.trim() });
      showSuccess(`Nota ${c.reference} dibatalkan dan stok dikembalikan.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  function openEventForm(item: ConsignmentItem, reference: string, type: ConsignmentEvent["type"]) {
    const s = itemSums(item);
    if (s.sisa <= 0) {
      showError("Sisa titip barang ini sudah habis (terjual / retur / susut semua).");
      return;
    }
    setEventForm({
      item,
      reference,
      type,
      qty: "",
      date: new Date().toISOString().slice(0, 10),
      note: "",
    });
    setError(null);
    setSuccess(null);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!eventForm) return;

    const qty = Number(eventForm.qty);
    if (!qty || qty <= 0) {
      showError("Jumlah harus lebih dari 0.");
      return;
    }
    const sisa = itemSums(eventForm.item).sisa;
    if (qty > sisa) {
      showError(`Sisa titip ${eventForm.item.product_name} hanya ${sisa} ${eventForm.item.product_unit}.`);
      return;
    }

    setSaving(true);
    try {
      await apiCall("/api/admin/inventori/titipan/events", "POST", {
        consignment_item_id: eventForm.item.id,
        type: eventForm.type,
        qty,
        date: eventForm.date,
        note: eventForm.note,
      });
      const label = eventTypeLabel[eventForm.type];
      if (eventForm.type === "retur") {
        showSuccess(`${label} ${qty} dicatat. Stok ${eventForm.item.product_name} bertambah.`);
      } else {
        showSuccess(`${label} ${qty} dicatat. Sisa titip tinggal ${sisa - qty}.`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(ev: ConsignmentEvent, item: ConsignmentItem) {
    const extra = ev.type === "retur" ? "\nStok akan dikurangi lagi (retur dibatalkan)." : "";
    if (!confirm(`Hapus catatan ${eventTypeLabel[ev.type]} ${ev.qty} ${item.product_unit}?${extra}`)) return;
    setError(null);
    try {
      await apiCall(`/api/admin/inventori/titipan/events?id=${ev.id}`, "DELETE", {});
      showSuccess("Catatan peristiwa dihapus.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  // ---------- Master Toko ----------
  function openCreateToko() {
    setEditingToko(null);
    setTokoForm(emptyTokoForm);
    setShowTokoForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEditToko(t: Toko) {
    setEditingToko(t);
    setTokoForm({
      name: t.name,
      contact_name: t.contact_name,
      phone: t.phone,
      address: t.address,
      city: t.city,
      notes: t.notes,
      is_active: t.is_active,
    });
    setShowTokoForm(true);
    setError(null);
    setSuccess(null);
  }

  async function saveToko(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!tokoForm.name.trim()) {
      showError("Nama toko wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      if (editingToko) {
        await apiCall("/api/admin/inventori/toko", "PATCH", {
          id: editingToko.id,
          name: tokoForm.name,
          contact_name: tokoForm.contact_name,
          phone: tokoForm.phone,
          address: tokoForm.address,
          city: tokoForm.city,
          notes: tokoForm.notes,
          is_active: tokoForm.is_active,
        });
        setTokos((prev) =>
          prev.map((t) =>
            t.id === editingToko.id
              ? {
                  ...t,
                  name: tokoForm.name.trim(),
                  contact_name: tokoForm.contact_name,
                  phone: tokoForm.phone,
                  address: tokoForm.address,
                  city: tokoForm.city,
                  notes: tokoForm.notes,
                  is_active: tokoForm.is_active,
                }
              : t
          )
        );
        setSaving(false);
        setShowTokoForm(false);
        setSuccess("Toko diperbarui.");
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      await apiCall("/api/admin/inventori/toko", "POST", {
        name: tokoForm.name,
        contact_name: tokoForm.contact_name,
        phone: tokoForm.phone,
        address: tokoForm.address,
        city: tokoForm.city,
        notes: tokoForm.notes,
      });
      showSuccess("Toko ditambahkan.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeToko(t: Toko) {
    if (!confirm(`Nonaktifkan toko "${t.name}"? Tidak bisa dipilih untuk titipan baru, tapi riwayat lama tetap tersimpan.`)) return;
    setError(null);
    try {
      await apiCall("/api/admin/inventori/toko", "DELETE", { id: t.id });
      setTokos((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_active: false } : x)));
      setSuccess("Toko dinonaktifkan.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  // ---------- Barang / Bahan ----------
  function openCreateProduct(isRaw: boolean) {
    setEditingProduct(null);
    setProductForm({ ...emptyProductForm, is_raw_material: isRaw, category: isRaw ? "Bahan Baku" : "" });
    setShowProductForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEditProduct(p: Product) {
    setEditingProduct(p);
    setProductForm({
      sku: p.sku ?? "",
      name: p.name,
      category: p.category,
      unit: p.unit,
      harga_modal: String(p.harga_modal),
      harga_jual: String(p.harga_jual),
      stok: "",
      stok_min: String(p.stok_min),
      notes: p.notes,
      is_active: p.is_active,
      is_raw_material: p.is_raw_material,
    });
    setShowProductForm(true);
    setError(null);
    setSuccess(null);
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingProduct) {
        await apiCall("/api/admin/inventori/products", "PATCH", {
          id: editingProduct.id,
          sku: productForm.sku,
          name: productForm.name,
          category: productForm.category,
          unit: productForm.unit,
          harga_modal: Number(productForm.harga_modal) || 0,
          harga_jual: Number(productForm.harga_jual) || 0,
          stok_min: Number(productForm.stok_min) || 0,
          notes: productForm.notes,
          is_active: productForm.is_active,
          is_raw_material: productForm.is_raw_material,
        });
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  sku: productForm.sku.trim() || null,
                  name: productForm.name.trim(),
                  category: productForm.category,
                  unit: productForm.unit,
                  harga_modal: Number(productForm.harga_modal) || 0,
                  harga_jual: Number(productForm.harga_jual) || 0,
                  stok_min: Number(productForm.stok_min) || 0,
                  notes: productForm.notes,
                  is_active: productForm.is_active,
                  is_raw_material: productForm.is_raw_material,
                }
              : p
          )
        );
        setSaving(false);
        setShowProductForm(false);
        setSuccess(productForm.is_raw_material ? "Bahan baku diperbarui." : "Barang diperbarui.");
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      await apiCall("/api/admin/inventori/products", "POST", {
        sku: productForm.sku,
        name: productForm.name,
        category: productForm.category,
        unit: productForm.unit,
        harga_modal: Number(productForm.harga_modal) || 0,
        harga_jual: productForm.is_raw_material ? 0 : Number(productForm.harga_jual) || 0,
        stok: Number(productForm.stok) || 0,
        stok_min: Number(productForm.stok_min) || 0,
        notes: productForm.notes,
        is_raw_material: productForm.is_raw_material,
      });
      showSuccess(productForm.is_raw_material ? "Bahan baku ditambahkan." : "Barang ditambahkan.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: number) {
    const target = products.find((p) => p.id === id);
    const kind = target?.is_raw_material ? "bahan ini" : "barang ini";
    if (!confirm(`Nonaktifkan ${kind}? Data tidak dihapus dan tetap bisa dilihat di riwayat.`)) return;
    setError(null);
    try {
      await apiCall("/api/admin/inventori/products", "DELETE", { id });
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setSuccess("Barang dihapus.");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  // ---------- Mutasi ----------
  function openMovementForm(type: "in" | "out") {
    setMovementForm({ ...emptyMovementForm, type, reason: "penyesuaian" });
    setShowMovementForm(true);
    setError(null);
    setSuccess(null);
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!movementForm.product_id) {
      showError("Barang wajib dipilih.");
      return;
    }
    const qty = Number(movementForm.qty);
    if (!qty || qty <= 0) {
      showError("Jumlah harus lebih dari 0.");
      return;
    }
    const p = productMap.get(Number(movementForm.product_id));
    if (p && movementForm.type === "out" && qty > p.stok) {
      showError(`Stok ${p.name} tidak cukup (sisa ${p.stok} ${p.unit}).`);
      return;
    }
    if (movementForm.reason === "gratis" && !movementForm.recipient.trim()) {
      showError("Isi penerima barang gratis.");
      return;
    }
    if (movementForm.reason === "rusak" && !movementForm.note.trim()) {
      showError("Isi catatan kerusakan barang.");
      return;
    }
    if (movementForm.reason === "hilang" && !movementForm.note.trim()) {
      showError("Isi catatan kehilangan barang.");
      return;
    }
    setSaving(true);
    try {
      await apiCall("/api/admin/inventori/movements", "POST", {
        product_id: Number(movementForm.product_id),
        type: movementForm.type,
        reason: movementForm.reason,
        qty,
        recipient: movementForm.recipient,
        note: movementForm.note,
      });
      showSuccess(movementForm.type === "in" ? "Barang masuk dicatat." : "Barang keluar dicatat.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMovement(id: number) {
    if (!confirm("Koreksi mutasi ini? Stok akan dikembalikan seperti semula dan mutasi asli ditandai void.")) return;
    setError(null);
    try {
      await apiCall("/api/admin/inventori/movements", "DELETE", { id });
      showSuccess("Mutasi dihapus, stok dikembalikan.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  }

  async function openHistory(p: Product) {
    setHistoryProduct(p);
    setHistoryMovements(null);
    setHistoryLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inventori/movements?product_id=${p.id}&limit=500`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal memuat riwayat.");
      setHistoryMovements(data.movements ?? []);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setHistoryProduct(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  const historyRows = useMemo(() => {
    if (!historyMovements) return [];
    const asc = [...historyMovements].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let saldo = 0;
    return asc.map((m) => {
      saldo += m.type === "in" ? m.qty : -m.qty;
      return { movement: m, saldo };
    });
  }, [historyMovements]);

  // ---------- Penjualan ----------
  function openSaleForm() {
    setSaleDate(new Date().toISOString().slice(0, 10));
    setSaleRecipient("");
    setSalePaymentNote("");
    setSaleItems([{ product_id: "", qty: "", harga_jual: "" }]);
    setShowSaleForm(true);
    setError(null);
    setSuccess(null);
  }

  function onSaleProductChange(index: number, productId: string) {
    const p = productMap.get(Number(productId));
    setSaleItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, product_id: productId, harga_jual: p ? String(p.harga_jual) : it.harga_jual } : it))
    );
  }

  const saleTotal = useMemo(
    () =>
      saleItems.reduce((sum, it) => {
        const qty = Number(it.qty) || 0;
        const price = Number(it.harga_jual) || 0;
        return sum + qty * price;
      }, 0),
    [saleItems]
  );

  async function saveSale(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = saleItems
      .filter((it) => it.product_id)
      .map((it) => ({
        product_id: Number(it.product_id),
        qty: Number(it.qty) || 0,
        harga_jual: Number(it.harga_jual) || 0,
      }));

    if (items.length === 0) {
      showError("Pilih minimal satu barang.");
      return;
    }
    const perProduct = new Map<number, number>();
    for (const it of items) {
      if (!it.qty || it.qty <= 0) {
        showError("Jumlah setiap barang harus lebih dari 0.");
        return;
      }
      perProduct.set(it.product_id, (perProduct.get(it.product_id) ?? 0) + it.qty);
    }
    for (const [pid, qty] of perProduct) {
      const p = productMap.get(pid);
      if (p?.is_raw_material) {
        showError(`Bahan baku "${p.name}" tidak bisa dijual.`);
        return;
      }
      if (p && qty > p.stok) {
        showError(`Stok ${p.name} tidak cukup (sisa ${p.stok} ${p.unit}, diminta ${qty}).`);
        return;
      }
    }
    if (saleTotal <= 0) {
      showError("Total penjualan harus lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      const data = await apiCall("/api/admin/inventori/sales", "POST", {
        date: saleDate,
        recipient: saleRecipient,
        payment_note: salePaymentNote,
        items,
      });
      showSuccess(
        `Penjualan ${data.reference} tersimpan (kas ${data.inv_reference}${data.journal ? ", jurnal ok" : ""}).`
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeSale(id: number) {
    if (!confirm("Batalkan penjualan ini? Stok, kas, dan jurnal akan dikembalikan (data penjualan tetap tersimpan).")) return;
    setError(null);
    setSaving(true);
    try {
      await apiCall("/api/admin/inventori/sales", "DELETE", { id });
      showSuccess("Penjualan dihapus dan dikembalikan.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Export Excel ----------
  function exportBarang() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["SKU", "Nama", "Kategori", "Satuan", "Harga Modal", "Harga Jual", "Stok", "Stok Min", "Status"],
      ...filteredProducts.map((p) => [
        p.sku ?? "",
        p.name,
        p.category,
        p.unit,
        p.harga_modal,
        p.harga_jual,
        p.stok,
        p.stok_min,
        p.is_active ? "Aktif" : "Nonaktif",
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Barang");
    XLSX.writeFile(wb, "inventori-barang.xlsx");
  }

  function exportMutasi() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tanggal", "Barang", "Jenis", "Alasan", "Qty", "Harga Modal", "Nilai", "Penerima", "Catatan", "Referensi"],
      ...filteredMovements.map((m) => [
        formatDateTime(m.created_at),
        m.product_name,
        m.type === "in" ? "Masuk" : "Keluar",
        reasonLabel[m.reason] ?? m.reason,
        m.qty,
        m.harga_modal,
        m.qty * m.harga_modal,
        m.recipient,
        m.note,
        m.reference,
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutasi Stok");
    XLSX.writeFile(wb, "inventori-mutasi.xlsx");
  }

  function exportPenjualan() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tanggal", "No. Penjualan", "Ref Kas", "Penerima", "Barang", "Total", "Catatan Bayar"],
      ...filteredSales.map((s) => [
        s.date,
        s.reference,
        s.transaction_ref ?? "",
        s.recipient,
        s.items.map((i) => `${i.qty}x ${i.product_name}`).join(", "),
        s.total,
        s.payment_note,
      ]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan");
    XLSX.writeFile(wb, "inventori-penjualan.xlsx");
  }

  function exportLaporan() {
    const kartu = [
      ["SKU", "Barang", "Satuan", "Stok", "Harga Modal", "Nilai Persediaan", "Harga Jual"],
      ...products.map((p) => [p.sku ?? "", p.name, p.unit, p.stok, p.harga_modal, p.stok * p.harga_modal, p.harga_jual]),
    ];
    const menipis = [
      ["SKU", "Barang", "Stok", "Stok Min"],
      ...lowStock.map((p) => [p.sku ?? "", p.name, p.stok, p.stok_min]),
    ];
    const rekap = [
      ["Barang", "Terjual", "Omzet", "HPP", "Laba Kotor"],
      ...soldRecap.map(([, r]) => [r.name, r.terjual, r.omzet, r.modal, r.omzet - r.modal]),
    ];
    const rekapTitipan = [
      ["Toko", "Dititip", "Terjual", "Retur", "Susut", "Sisa di Toko", "Nilai Sisa"],
      ...tokoRecap.map((t) => [t.name, t.dititip, t.terjual, t.retur, t.susut, t.sisa, t.nilaiSisa]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kartu), "Valuasi Persediaan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(menipis), "Stok Menipis");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekap), "Rekap Penjualan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekapTitipan), "Rekap Titipan");
    XLSX.writeFile(wb, "inventori-laporan.xlsx");
  }

  function exportTitipan() {
    const rows: (string | number)[][] = [
      ["Ref", "Tanggal", "Toko", "Status", "Barang", "Qty Dititip", "Terjual", "Retur", "Susut", "Sisa", "Harga Jual", "Harga Modal"],
    ];
    for (const c of filteredConsignments) {
      if (c.items.length === 0) {
        rows.push([c.reference, c.date, c.toko_name, c.status === "void" ? "Dibatalkan" : "Aktif", "", "", "", "", "", "", "", ""]);
        continue;
      }
      for (const it of c.items) {
        const s = itemSums(it);
        rows.push([
          c.reference,
          c.date,
          c.toko_name,
          c.status === "void" ? "Dibatalkan" : "Aktif",
          it.product_name,
          it.qty,
          s.terjual,
          s.retur,
          s.susut,
          s.sisa,
          it.harga_jual,
          it.harga_modal,
        ]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Titipan");
    XLSX.writeFile(wb, "inventori-titipan.xlsx");
  }

  function exportToko() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama", "Kontak", "WhatsApp", "Kota", "Alamat", "Catatan", "Status", "Dititip", "Terjual", "Retur", "Susut", "Sisa", "Nilai Sisa"],
      ...tokos.map((t) => {
        const r = tokoRecap.find((x) => x.toko_id === t.id);
        return [
          t.name,
          t.contact_name,
          t.phone,
          t.city,
          t.address,
          t.notes,
          t.is_active ? "Aktif" : "Nonaktif",
          r?.dititip ?? 0,
          r?.terjual ?? 0,
          r?.retur ?? 0,
          r?.susut ?? 0,
          r?.sisa ?? 0,
          r?.nilaiSisa ?? 0,
        ];
      }),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Toko");
    XLSX.writeFile(wb, "inventori-toko.xlsx");
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Inventori Barang</h1>
          <p className="text-white/50 mt-1">
            Ganci, asbak, coaster, bahan baku, dll. — stok masuk/keluar, penjualan, kas &amp; jurnal otomatis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "barang" && isAdmin && (
            <button onClick={() => (showProductForm ? setShowProductForm(false) : openCreateProduct(false))} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showProductForm ? "Tutup" : "Tambah Barang"}
            </button>
          )}
          {tab === "bahan" && isAdmin && (
            <button onClick={() => (showProductForm ? setShowProductForm(false) : openCreateProduct(true))} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showProductForm ? "Tutup" : "Tambah Bahan"}
            </button>
          )}
          {tab === "mutasi" && isAdmin && (
            <>
              <button onClick={() => openMovementForm("in")} className={ghostBtn}>
                + Barang Masuk
              </button>
              <button onClick={() => openMovementForm("out")} className={primaryBtn}>
                + Barang Keluar
              </button>
            </>
          )}
          {tab === "penjualan" && isAdmin && (
            <button onClick={openSaleForm} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Catat Penjualan
            </button>
          )}
          {tab === "titipan" && isAdmin && titipSub === "daftar" && (
            <button onClick={() => (showTitipForm ? setShowTitipForm(false) : openTitipForm())} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showTitipForm ? "Tutup" : "Titip ke Toko"}
            </button>
          )}
          {tab === "titipan" && isAdmin && titipSub === "toko" && (
            <button onClick={() => (showTokoForm ? setShowTokoForm(false) : openCreateToko())} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showTokoForm ? "Tutup" : "Tambah Toko"}
            </button>
          )}
          {tab === "laporan" && (
            <button onClick={exportLaporan} className={ghostBtn}>
              Export Excel
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 bg-[#151515] border border-white/10 rounded-xl p-1.5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setShowProductForm(false);
              setEditingProduct(null);
              setShowTitipForm(false);
              setShowTokoForm(false);
              setEventForm(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key
                ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
            {t.key === "barang" && lowStockBarang.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px]">{lowStockBarang.length}</span>
            )}
            {t.key === "bahan" && lowStockBahan.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px]">{lowStockBahan.length}</span>
            )}
            {t.key === "titipan" && titipanSummary.notaAktif > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[11px]">{titipanSummary.notaAktif}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="mb-6 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      {/* ================= TAB BARANG ================= */}
      {(tab === "barang" || tab === "bahan") && (
        <>
          {showProductForm && isAdmin && (
            <form onSubmit={saveProduct} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
              <h2 className="font-semibold text-white">
                {editingProduct
                  ? productForm.is_raw_material
                    ? "Ubah Bahan Baku"
                    : "Ubah Barang"
                  : tab === "bahan"
                    ? "Tambah Bahan Baku"
                    : "Tambah Barang"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>{productForm.is_raw_material ? "Nama Bahan *" : "Nama Barang *"}</label>
                  <input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="mis. Ganci Logo Baciraro"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>SKU</label>
                  <input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="opsional"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Kategori</label>
                  <input
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="mis. Merch"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Satuan</label>
                  <input
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="pcs"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Stok Minimum</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={productForm.stok_min}
                    onChange={(e) => setProductForm({ ...productForm, stok_min: e.target.value })}
                    placeholder="mis. 5"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Harga Modal (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.harga_modal}
                    onChange={(e) => setProductForm({ ...productForm, harga_modal: e.target.value })}
                    placeholder="mis. 10000"
                    className={inputCls}
                  />
                </div>
                {!productForm.is_raw_material && (
                  <div>
                    <label className={labelCls}>Harga Jual (Rp)</label>
                    <input
                      type="number"
                      min={0}
                      value={productForm.harga_jual}
                      onChange={(e) => setProductForm({ ...productForm, harga_jual: e.target.value })}
                      placeholder="mis. 25000"
                      className={inputCls}
                    />
                  </div>
                )}
                {!editingProduct && (
                  <div>
                    <label className={labelCls}>Stok Awal</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={productForm.stok}
                      onChange={(e) => setProductForm({ ...productForm, stok: e.target.value })}
                      placeholder="mis. 50"
                      className={inputCls}
                    />
                  </div>
                )}
                <div className="md:col-span-3">
                  <label className={labelCls}>Catatan</label>
                  <input
                    value={productForm.notes}
                    onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                    placeholder="opsional"
                    className={inputCls}
                  />
                </div>
                {editingProduct && (
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={productForm.is_active}
                      onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                      className="accent-[#D97A2B]"
                    />
                    {productForm.is_raw_material ? "Bahan aktif digunakan" : "Barang aktif dijual"}
                  </label>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {saving && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  {saving
                    ? "Menyimpan..."
                    : editingProduct
                      ? "Simpan Perubahan"
                      : productForm.is_raw_material
                        ? "Tambah Bahan"
                        : "Tambah Barang"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductForm(false)}
                  className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {tab === "barang" && (
            <>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <SearchInput value={barangSearch} onChange={setBarangSearch} placeholder="Cari barang / SKU / kategori..." className="max-w-sm" />
                <div className="md:ml-auto">
                  <button onClick={exportBarang} className={ghostBtn}>
                    Export Excel
                  </button>
                </div>
              </div>

              <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Barang</th>
                      <th className="px-4 py-3 font-medium">Kategori</th>
                      <th className="px-4 py-3 font-medium text-right">Harga Modal</th>
                      <th className="px-4 py-3 font-medium text-right">Harga Jual</th>
                      <th className="px-4 py-3 font-medium text-right">Stok</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-white/60">{p.sku ?? "-"}</td>
                        <td className="px-4 py-3 font-medium text-white">
                          {p.name}
                          {p.unit && <span className="text-white/30 font-normal"> / {p.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-white/60">{p.category || "-"}</td>
                        <td className="px-4 py-3 text-right text-white/70">{formatRupiah(p.harga_modal)}</td>
                        <td className="px-4 py-3 text-right text-white/70">{formatRupiah(p.harga_jual)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.is_active && p.stok <= p.stok_min ? "bg-red-500/10 text-red-400" : "bg-white/10 text-white/80"
                            }`}
                          >
                            {formatNumber(p.stok)}
                          </span>
                          {p.is_active && p.stok <= p.stok_min && <span className="ml-1.5 text-[11px] text-red-400">menipis</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              p.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/10 text-white/40"
                            }`}
                          >
                            {p.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setTab("mutasi");
                              openHistory(p);
                            }}
                            className="p-1.5 text-white/30 hover:text-blue-400 transition"
                            aria-label="Riwayat"
                            title="Riwayat barang"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 text-white/30 hover:text-[#E9A64E] transition"
                                aria-label="Ubah"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => removeProduct(p.id)}
                                className="p-1.5 text-white/30 hover:text-red-400 transition"
                                aria-label="Nonaktifkan barang"
                                title="Nonaktifkan barang"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProducts.length === 0 && (
                  <div className="p-16 text-center text-white/40">
                    <p className="text-lg font-medium mb-1">Belum ada barang</p>
                    <p className="text-sm">Tambahkan ganci, asbak, coaster, dan merch lainnya.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === "bahan" && (
            <>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <SearchInput
                  value={bahanSearch}
                  onChange={setBahanSearch}
                  placeholder="Cari bahan / SKU / kategori..."
                  className="max-w-sm"
                />
              </div>

              <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">SKU</th>
                      <th className="px-4 py-3 font-medium">Bahan</th>
                      <th className="px-4 py-3 font-medium">Kategori</th>
                      <th className="px-4 py-3 font-medium text-right">Harga Modal</th>
                      <th className="px-4 py-3 font-medium text-right">Stok</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBahan.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-white/60">{p.sku ?? "-"}</td>
                        <td className="px-4 py-3 font-medium text-white">
                          {p.name}
                          {p.unit && <span className="text-white/30 font-normal"> / {p.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-white/60">{p.category || "-"}</td>
                        <td className="px-4 py-3 text-right text-white/70">{formatRupiah(p.harga_modal)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.is_active && p.stok <= p.stok_min ? "bg-red-500/10 text-red-400" : "bg-white/10 text-white/80"
                            }`}
                          >
                            {formatNumber(p.stok)}
                          </span>
                          {p.is_active && p.stok <= p.stok_min && <span className="ml-1.5 text-[11px] text-red-400">menipis</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              p.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/10 text-white/40"
                            }`}
                          >
                            {p.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setTab("mutasi");
                              openHistory(p);
                            }}
                            className="p-1.5 text-white/30 hover:text-blue-400 transition"
                            aria-label="Riwayat"
                            title="Riwayat bahan"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 text-white/30 hover:text-[#E9A64E] transition"
                                aria-label="Ubah"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => removeProduct(p.id)}
                                className="p-1.5 text-white/30 hover:text-red-400 transition"
                                aria-label="Nonaktifkan bahan"
                                title="Nonaktifkan bahan"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredBahan.length === 0 && (
                  <div className="p-16 text-center text-white/40">
                    <p className="text-lg font-medium mb-1">Belum ada bahan baku</p>
                    <p className="text-sm">Catat bahan seperti lem, tinta, resin, kain, dll.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ================= TAB MUTASI ================= */}
      {tab === "mutasi" && (
        <>
          {showMovementForm && isAdmin && (
            <form onSubmit={saveMovement} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">
                  {movementForm.type === "in" ? "Barang Masuk" : "Barang Keluar"}
                </h2>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    movementForm.type === "in" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {movementForm.type === "in" ? "STOK + (MASUK)" : "STOK − (KELUAR)"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Barang *</label>
                  <select
                    value={movementForm.product_id}
                    onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">— Pilih barang —</option>
                    {products
                      .filter((p) => p.is_active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (stok: {p.stok} {p.unit})
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Alasan *</label>
                  <select
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    className={selectCls}
                  >
                    {movementForm.type === "in" ? (
                      <>
                        <option value="penyesuaian">Penyesuaian / Stok Opname (naik)</option>
                        <option value="stok_awal">Stok Awal</option>
                      </>
                    ) : (
                      <>
                        <option value="penyesuaian">Penyesuaian / Stok Opname (turun)</option>
                        <option value="gratis">Gratis / Hadiah / Dibagikan</option>
                        <option value="rusak">Rusak</option>
                        <option value="hilang">Hilang</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Jumlah *</label>
                  <input
                    type="number"
                    min={0.001}
                    step="any"
                    value={movementForm.qty}
                    onChange={(e) => setMovementForm({ ...movementForm, qty: e.target.value })}
                    placeholder="mis. 10 atau 0.5"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Diberikan ke / Penerima</label>
                  <input
                    value={movementForm.recipient}
                    onChange={(e) => setMovementForm({ ...movementForm, recipient: e.target.value })}
                    placeholder="mis. Budi, Toko Maju, Hadiah undian"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Catatan</label>
                  <input
                    value={movementForm.note}
                    onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
                    placeholder={movementForm.type === "out" ? "mis. patah saat produksi" : "mis. hasil opname gudang"}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "Simpan Mutasi"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMovementForm(false)}
                  className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <SearchInput value={mutasiSearch} onChange={setMutasiSearch} placeholder="Cari barang / penerima / ref..." className="max-w-xs" />
            <select value={mutasiType} onChange={(e) => setMutasiType(e.target.value)} className={`${selectCls} w-auto`}>
              <option value="">Semua jenis</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
            </select>
            <select value={mutasiReason} onChange={(e) => setMutasiReason(e.target.value)} className={`${selectCls} w-auto`}>
              <option value="">Semua alasan</option>
              {Object.entries(reasonLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="md:ml-auto">
              <button onClick={exportMutasi} className={ghostBtn}>
                Export Excel
              </button>
            </div>
          </div>

          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Barang</th>
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium">Alasan</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Nilai</th>
                  <th className="px-4 py-3 font-medium">Penerima / Catatan</th>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      {m.product_name}
                      <span className="text-white/30 font-normal"> ({m.product_sku ?? "-"})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          m.type === "in" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {m.type === "in" ? "MASUK" : "KELUAR"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${reasonColor[m.reason] ?? "bg-white/10 text-white/60"}`}>
                        {reasonLabel[m.reason] ?? m.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {m.type === "in" ? "+" : "−"}
                      {formatNumber(m.qty)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60">{formatRupiah(m.qty * m.harga_modal)}</td>
                    <td className="px-4 py-3 text-white/70">
                      {m.recipient && <span className="text-white">{m.recipient}</span>}
                      {m.recipient && m.note && <span className="text-white/30"> — </span>}
                      {m.note}
                      {!m.recipient && !m.note && <span className="text-white/30">-</span>}
                      {m.sale_id && <span className="ml-1.5 text-[11px] text-white/30">(penjualan)</span>}
                      {m.consignment_id && <span className="ml-1.5 text-[11px] text-white/30">(titipan)</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-white/50 text-xs">{m.reference || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && !m.sale_id && !m.consignment_id && (
                        <button
                          onClick={() => removeMovement(m.id)}
                          className="p-1.5 text-white/30 hover:text-red-400 transition"
                          aria-label="Koreksi mutasi"
                          title="Koreksi mutasi (stok dikembalikan)"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredMovements.length === 0 && (
              <div className="p-16 text-center text-white/40">
                <p className="text-lg font-medium mb-1">Belum ada mutasi stok</p>
                <p className="text-sm">Catat barang masuk (opname) atau barang keluar (terjual / gratis / rusak).</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================= TAB PENJUALAN ================= */}
      {tab === "penjualan" && (
        <>
          {showSaleForm && isAdmin && (
            <form onSubmit={saveSale} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
              <h2 className="font-semibold text-white">Catat Penjualan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Tanggal *</label>
                  <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Diberikan ke / Penerima *</label>
                  <input
                    value={saleRecipient}
                    onChange={(e) => setSaleRecipient(e.target.value)}
                    placeholder="mis. Budi, Toko Oleh-Oleh, Grup WA"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Catatan Bayar</label>
                  <input
                    value={salePaymentNote}
                    onChange={(e) => setSalePaymentNote(e.target.value)}
                    placeholder="mis. transfer BCA / cash"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-white/50 font-medium">
                  <div className="col-span-2 sm:col-span-5">Barang</div>
                  <div className="col-span-1 sm:col-span-2">Jumlah</div>
                  <div className="col-span-1 sm:col-span-3">Harga Jual</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>
                {saleItems.map((it, idx) => {
                  const p = it.product_id ? productMap.get(Number(it.product_id)) : undefined;
                  const subtotal = (Number(it.qty) || 0) * (Number(it.harga_jual) || 0);
                  const overStock = p ? (Number(it.qty) || 0) > p.stok : false;
                  return (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 sm:col-span-5">
                        <select value={it.product_id} onChange={(e) => onSaleProductChange(idx, e.target.value)} className={selectCls}>
                          <option value="">— Pilih barang —</option>
                          {products
                            .filter((x) => x.is_active && !x.is_raw_material)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name} (stok {x.stok})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-1 sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => setSaleItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                          className={`${inputCls} ${overStock ? "border-red-500/60" : ""}`}
                          placeholder="1"
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-3">
                        <input
                          type="number"
                          min={0}
                          value={it.harga_jual}
                          onChange={(e) => setSaleItems((prev) => prev.map((x, i) => (i === idx ? { ...x, harga_jual: e.target.value } : x)))}
                          className={inputCls}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <span className="text-white/80 text-sm">{formatRupiah(subtotal)}</span>
                        <button
                          type="button"
                          onClick={() => setSaleItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                          className="p-1 text-white/30 hover:text-red-400 transition"
                          aria-label="Hapus baris"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {overStock && (
                        <div className="col-span-2 sm:col-span-12 text-xs text-red-400 -mt-1">
                          Stok {p?.name} tidak cukup (sisa {p?.stok} {p?.unit}).
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={() => setSaleItems((prev) => [...prev, { product_id: "", qty: "", harga_jual: "" }])} className="text-sm text-[#E9A64E] hover:underline">
                  + Tambah baris barang
                </button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-white/10 pt-4">
                <div className="text-white/60 text-sm">
                  Total: <span className="text-white text-lg font-bold">{formatRupiah(saleTotal)}</span>
                  <span className="block text-xs text-white/40 mt-0.5">
                    Saat disimpan: stok berkurang + baris kas (INV) + jurnal pendapatan &amp; HPP otomatis.
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {saving && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    )}
                    {saving ? "Menyimpan..." : "Simpan Penjualan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaleForm(false)}
                    className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <SearchInput value={penjualanSearch} onChange={setPenjualanSearch} placeholder="Cari no. penjualan / penerima / barang..." className="max-w-sm" />
            <div className="md:ml-auto">
              <button onClick={exportPenjualan} className={ghostBtn}>
                Export Excel
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredSales.map((s) => (
              <div key={s.id} className="bg-[#151515] rounded-xl border border-white/10 p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-[#E9A64E]">{s.reference}</span>
                      {s.status === "void" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">DIBATALKAN</span>
                      )}
                      <span className="text-white/40 text-xs">{s.date}</span>
                      {s.transaction_ref && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-mono">
                          kas {s.transaction_ref}
                        </span>
                      )}
                      {s.payment_note && <span className="text-white/40 text-xs">· {s.payment_note}</span>}
                    </div>
                    <div className="text-white mt-1 font-medium">
                      Diberikan ke: <span className="text-white/70 font-normal">{s.recipient || "-"}</span>
                    </div>
                    <div className="text-white/50 text-sm mt-0.5">
                      {s.items.map((i) => `${i.qty}× ${i.product_name}`).join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{formatRupiah(s.total)}</div>
                    {isAdmin && (
                      <button
                        onClick={() => removeSale(s.id)}
                        disabled={saving}
                        className="mt-1 text-xs text-white/30 hover:text-red-400 transition disabled:opacity-40"
                      >
                        Hapus &amp; balikkan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredSales.length === 0 && (
              <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
                <p className="text-lg font-medium mb-1">Belum ada penjualan</p>
                <p className="text-sm">Catat penjualan — stok, kas, dan jurnal akan terisi otomatis.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================= TAB TITIPAN ================= */}
      {tab === "titipan" && (
        <>
          <div className="flex gap-1 mb-4 bg-[#151515] border border-white/10 rounded-xl p-1.5 w-fit">
            {(["daftar", "toko"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setTitipSub(s);
                  setShowTitipForm(false);
                  setShowTokoForm(false);
                  setEditingToko(null);
                  setError(null);
                  setSuccess(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  titipSub === s ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {s === "daftar" ? "Daftar Titipan" : "Master Toko"}
              </button>
            ))}
          </div>

          {titipSub === "daftar" && (
            <>
              {showTitipForm && isAdmin && (
                <form onSubmit={saveTitip} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-white">Titip ke Toko</h2>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-400">
                      STOK − (KELUAR GUDANG)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Toko *</label>
                      <select
                        value={titipForm.toko_id}
                        onChange={(e) => setTitipForm({ ...titipForm, toko_id: e.target.value })}
                        className={selectCls}
                      >
                        <option value="">— Pilih toko —</option>
                        {activeTokos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                            {t.city ? ` (${t.city})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Tanggal *</label>
                      <input
                        type="date"
                        value={titipForm.date}
                        onChange={(e) => setTitipForm({ ...titipForm, date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Catatan</label>
                      <input
                        value={titipForm.note}
                        onChange={(e) => setTitipForm({ ...titipForm, note: e.target.value })}
                        placeholder="mis. titip awal, edisi lebaran"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-white/50 font-medium">
                      <div className="col-span-2 sm:col-span-5">Barang</div>
                      <div className="col-span-1 sm:col-span-2">Jumlah</div>
                      <div className="col-span-1 sm:col-span-3">Harga Jual (saat titip)</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>
                    {titipItems.map((it, idx) => {
                      const p = it.product_id ? productMap.get(Number(it.product_id)) : undefined;
                      const subtotal = (Number(it.qty) || 0) * (Number(it.harga_jual) || 0);
                      const overStock = p ? (Number(it.qty) || 0) > p.stok : false;
                      return (
                        <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                          <div className="col-span-2 sm:col-span-5">
                            <select
                              value={it.product_id}
                              onChange={(e) => onTitipProductChange(idx, e.target.value)}
                              className={selectCls}
                            >
                              <option value="">— Pilih barang —</option>
                              {products
                                .filter((x) => x.is_active && !x.is_raw_material)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.name} (stok {x.stok})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="col-span-1 sm:col-span-2">
                            <input
                              type="number"
                              min={0.001}
                              step="any"
                              value={it.qty}
                              onChange={(e) =>
                                setTitipItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                              }
                              className={`${inputCls} ${overStock ? "border-red-500/60" : ""}`}
                              placeholder="1"
                            />
                          </div>
                          <div className="col-span-1 sm:col-span-3">
                            <input
                              type="number"
                              min={0}
                              value={it.harga_jual}
                              onChange={(e) =>
                                setTitipItems((prev) => prev.map((x, i) => (i === idx ? { ...x, harga_jual: e.target.value } : x)))
                              }
                              className={inputCls}
                              placeholder="0"
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-end gap-1">
                            <span className="text-white/80 text-sm">{formatRupiah(subtotal)}</span>
                            <button
                              type="button"
                              onClick={() => setTitipItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                              className="p-1 text-white/30 hover:text-red-400 transition"
                              aria-label="Hapus baris"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {overStock && (
                            <div className="col-span-2 sm:col-span-12 text-xs text-red-400 -mt-1">
                              Stok {p?.name} tidak cukup (sisa {p?.stok} {p?.unit}).
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setTitipItems((prev) => [...prev, { product_id: "", qty: "", harga_jual: "" }])}
                      className="text-sm text-[#E9A64E] hover:underline"
                    >
                      + Tambah baris barang
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="text-white/60 text-sm">
                      Total nilai titip: <span className="text-white text-lg font-bold">{formatRupiah(titipTotal)}</span>
                      <span className="block text-xs text-white/40 mt-0.5">
                        Saat disimpan: stok berkurang. Penjualan &amp; retur dicatat menyusul dari toko.
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {saving && (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                        )}
                        {saving ? "Menyimpan..." : "Simpan Titipan"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTitipForm(false)}
                        className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wide">Dititipkan</div>
                  <div className="text-xl font-bold text-white mt-1">{formatNumber(titipanSummary.dititip)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{titipanSummary.notaAktif} nota aktif</div>
                </div>
                <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wide">Terjual</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{formatNumber(titipanSummary.terjual)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">laporan dari toko</div>
                </div>
                <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wide">Retur</div>
                  <div className="text-xl font-bold text-teal-400 mt-1">{formatNumber(titipanSummary.retur)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">kembali ke gudang</div>
                </div>
                <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wide">Susut</div>
                  <div className={`text-xl font-bold mt-1 ${titipanSummary.susut > 0 ? "text-red-400" : "text-white"}`}>
                    {formatNumber(titipanSummary.susut)}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">hilang / rusak di toko</div>
                </div>
                <div className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wide">Sisa di Toko</div>
                  <div className="text-xl font-bold text-[#E9A64E] mt-1">{formatNumber(titipanSummary.sisa)}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{formatRupiah(titipanSummary.nilaiSisa)} (nilai modal)</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <SearchInput
                  value={titipanSearch}
                  onChange={setTitipanSearch}
                  placeholder="Cari no. titipan / toko / barang..."
                  className="max-w-sm"
                />
                <select
                  value={titipanTokoFilter}
                  onChange={(e) => setTitipanTokoFilter(e.target.value)}
                  className={`${selectCls} w-auto`}
                >
                  <option value="">Semua toko</option>
                  {tokosWithStock.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="md:ml-auto">
                  <button onClick={exportTitipan} className={ghostBtn}>
                    Export Excel
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredConsignments.map((c) => {
                  const totalDititip = c.items.reduce((s, i) => s + i.qty, 0);
                  const totalSisa = c.items.reduce((s, i) => s + itemSums(i).sisa, 0);
                  const isOpen = expandedTitip === c.id;
                  return (
                    <div key={c.id} className="bg-[#151515] rounded-xl border border-white/10 p-4">
                      <button
                        onClick={() => setExpandedTitip(isOpen ? null : c.id)}
                        className="w-full text-left flex flex-col md:flex-row md:items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-[#E9A64E]">{c.reference}</span>
                            {c.status === "void" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">
                                DIBATALKAN
                              </span>
                            )}
                            <span className="text-white/40 text-xs">{c.date}</span>
                            {c.note && <span className="text-white/40 text-xs">· {c.note}</span>}
                          </div>
                          <div className="text-white mt-1 font-medium">
                            Toko: <span className="text-white/70 font-normal">{c.toko_name}</span>
                            {c.toko_city && <span className="text-white/40 text-sm"> ({c.toko_city})</span>}
                          </div>
                          <div className="text-white/50 text-sm mt-0.5">
                            {c.items.map((i) => `${i.qty}× ${i.product_name}`).join(", ")}
                          </div>
                          {c.status === "void" && c.void_reason && (
                            <div className="text-red-400/80 text-xs mt-1">Alasan: {c.void_reason}</div>
                          )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <div className="text-sm text-white/60">
                            Dititip <span className="text-white font-semibold">{formatNumber(totalDititip)}</span>
                          </div>
                          <div className="text-sm text-white/60">
                            Sisa{" "}
                            <span className={`font-semibold ${totalSisa > 0 ? "text-[#E9A64E]" : "text-emerald-400"}`}>
                              {formatNumber(totalSisa)}
                            </span>
                          </div>
                          <div className="text-xs text-white/30 mt-0.5">{isOpen ? "Tutup detail" : "Buka detail"}</div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-4 border-t border-white/10 pt-4 space-y-4">
                          {c.items.map((it) => {
                            const s = itemSums(it);
                            return (
                              <div key={it.id} className="rounded-lg border border-white/10 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-white font-medium">
                                      {it.product_name}
                                      <span className="text-white/30 font-normal"> ({it.product_sku ?? "-"})</span>
                                    </div>
                                    <div className="text-white/50 text-xs mt-0.5">
                                      Dititip {formatNumber(it.qty)} {it.product_unit} · {formatRupiah(it.harga_jual)}/pcs
                                    </div>
                                  </div>
                                  {c.status === "active" && isAdmin && (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        onClick={() => openEventForm(it, c.reference, "terjual")}
                                        disabled={s.sisa <= 0}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        + Terjual
                                      </button>
                                      <button
                                        onClick={() => openEventForm(it, c.reference, "retur")}
                                        disabled={s.sisa <= 0}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        + Retur
                                      </button>
                                      <button
                                        onClick={() => openEventForm(it, c.reference, "susut")}
                                        disabled={s.sisa <= 0}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        + Hilang/Rusak
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 text-center">
                                  <div className="rounded-lg bg-white/5 py-2">
                                    <div className="text-[10px] text-white/40 uppercase">Dititip</div>
                                    <div className="text-white font-semibold">{formatNumber(it.qty)}</div>
                                  </div>
                                  <div className="rounded-lg bg-white/5 py-2">
                                    <div className="text-[10px] text-white/40 uppercase">Terjual</div>
                                    <div className="text-emerald-400 font-semibold">{formatNumber(s.terjual)}</div>
                                  </div>
                                  <div className="rounded-lg bg-white/5 py-2">
                                    <div className="text-[10px] text-white/40 uppercase">Retur</div>
                                    <div className="text-teal-400 font-semibold">{formatNumber(s.retur)}</div>
                                  </div>
                                  <div className="rounded-lg bg-white/5 py-2">
                                    <div className="text-[10px] text-white/40 uppercase">Susut</div>
                                    <div className={`font-semibold ${s.susut > 0 ? "text-red-400" : "text-white/60"}`}>
                                      {formatNumber(s.susut)}
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-[#D97A2B]/10 py-2">
                                    <div className="text-[10px] text-white/40 uppercase">Sisa</div>
                                    <div className={`font-bold ${s.sisa > 0 ? "text-[#E9A64E]" : "text-emerald-400"}`}>
                                      {formatNumber(s.sisa)}
                                    </div>
                                  </div>
                                </div>

                                {it.events.length > 0 && (
                                  <div className="mt-3 space-y-1">
                                    {it.events.map((ev) => (
                                      <div
                                        key={ev.id}
                                        className="flex items-center gap-2 text-xs text-white/60 border-t border-white/5 pt-1.5"
                                      >
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${eventTypeColor[ev.type]}`}>
                                          {eventTypeLabel[ev.type]}
                                        </span>
                                        <span className="text-white/80 font-medium">
                                          {formatNumber(ev.qty)} {it.product_unit}
                                        </span>
                                        <span className="text-white/30">{ev.date}</span>
                                        {ev.note && <span className="truncate">{ev.note}</span>}
                                        <span className="flex-1" />
                                        {c.status === "active" && isAdmin && (
                                          <button
                                            onClick={() => removeEvent(ev, it)}
                                            className="text-white/25 hover:text-red-400 transition"
                                            aria-label="Hapus catatan"
                                            title="Hapus catatan (retur akan mengurangi stok lagi)"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {isAdmin && c.status === "active" && (
                            <div className="flex justify-end border-t border-white/10 pt-3">
                              <button
                                onClick={() => voidTitip(c)}
                                disabled={saving}
                                className="text-xs text-white/30 hover:text-red-400 transition disabled:opacity-40"
                              >
                                Batalkan nota &amp; kembalikan stok
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredConsignments.length === 0 && (
                  <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
                    <p className="text-lg font-medium mb-1">Belum ada titipan</p>
                    <p className="text-sm">
                      Titip barang ke toko — stok berkurang, lalu catat terjual / retur saat toko melapor.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {titipSub === "toko" && (
            <>
              {showTokoForm && isAdmin && (
                <form onSubmit={saveToko} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
                  <h2 className="font-semibold text-white">{editingToko ? "Ubah Toko" : "Tambah Toko"}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Nama Toko *</label>
                      <input
                        value={tokoForm.name}
                        onChange={(e) => setTokoForm({ ...tokoForm, name: e.target.value })}
                        placeholder="mis. Toko Oleh-Oleh Nusantara"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Nama Kontak</label>
                      <input
                        value={tokoForm.contact_name}
                        onChange={(e) => setTokoForm({ ...tokoForm, contact_name: e.target.value })}
                        placeholder="mis. Bu Sari"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>WhatsApp</label>
                      <input
                        value={tokoForm.phone}
                        onChange={(e) => setTokoForm({ ...tokoForm, phone: e.target.value })}
                        placeholder="mis. 0812xxxxxxx"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Kota</label>
                      <input
                        value={tokoForm.city}
                        onChange={(e) => setTokoForm({ ...tokoForm, city: e.target.value })}
                        placeholder="mis. Yogyakarta"
                        className={inputCls}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Alamat</label>
                      <input
                        value={tokoForm.address}
                        onChange={(e) => setTokoForm({ ...tokoForm, address: e.target.value })}
                        placeholder="opsional"
                        className={inputCls}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Catatan</label>
                      <input
                        value={tokoForm.notes}
                        onChange={(e) => setTokoForm({ ...tokoForm, notes: e.target.value })}
                        placeholder="opsional — mis. titip mulai edisi lebaran"
                        className={inputCls}
                      />
                    </div>
                    {editingToko && (
                      <label className="flex items-center gap-2 text-sm text-white/70">
                        <input
                          type="checkbox"
                          checked={tokoForm.is_active}
                          onChange={(e) => setTokoForm({ ...tokoForm, is_active: e.target.checked })}
                          className="accent-[#D97A2B]"
                        />
                        Toko masih aktif menerima titipan
                      </label>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      {saving && (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      )}
                      {saving ? "Menyimpan..." : editingToko ? "Simpan Perubahan" : "Tambah Toko"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTokoForm(false);
                        setEditingToko(null);
                      }}
                      className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}

              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="md:ml-auto">
                  <button onClick={exportToko} className={ghostBtn}>
                    Export Excel
                  </button>
                </div>
              </div>

              <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Nama Toko</th>
                      <th className="px-4 py-3 font-medium">Kontak</th>
                      <th className="px-4 py-3 font-medium">Kota</th>
                      <th className="px-4 py-3 font-medium text-right">Dititip</th>
                      <th className="px-4 py-3 font-medium text-right">Terjual</th>
                      <th className="px-4 py-3 font-medium text-right">Sisa</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokos.map((t) => {
                      const r = tokoRecap.find((x) => x.toko_id === t.id);
                      return (
                        <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3 font-medium text-white">
                            {t.name}
                            {t.notes && <div className="text-white/30 text-xs font-normal">{t.notes}</div>}
                          </td>
                          <td className="px-4 py-3 text-white/60">
                            {t.contact_name || "-"}
                            {t.phone && <div className="text-white/40 text-xs">{t.phone}</div>}
                          </td>
                          <td className="px-4 py-3 text-white/60">{t.city || "-"}</td>
                          <td className="px-4 py-3 text-right text-white/80">{formatNumber(r?.dititip ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(r?.terjual ?? 0)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#E9A64E]">{formatNumber(r?.sisa ?? 0)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                t.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/10 text-white/40"
                              }`}
                            >
                              {t.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => openEditToko(t)}
                                  className="p-1.5 text-white/30 hover:text-[#E9A64E] transition"
                                  aria-label="Ubah toko"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                </button>
                                {t.is_active && (
                                  <button
                                    onClick={() => removeToko(t)}
                                    className="p-1.5 text-white/30 hover:text-red-400 transition"
                                    aria-label="Nonaktifkan toko"
                                    title="Nonaktifkan toko"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {tokos.length === 0 && (
                  <div className="p-16 text-center text-white/40">
                    <p className="text-lg font-medium mb-1">Belum ada toko</p>
                    <p className="text-sm">Tambahkan toko tempat barang dititipkan, lalu catat titipan ke sana.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ================= MODAL CATATAN TITIPAN ================= */}
          {eventForm && (
            <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 md:p-10 overflow-y-auto">
              <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md mt-10">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                  <div>
                    <h2 className="font-semibold text-white">Catat dari Toko</h2>
                    <p className="text-white/50 text-sm mt-0.5">
                      {eventForm.reference} · {eventForm.item.product_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setEventForm(null)}
                    className="p-2 text-white/40 hover:text-white transition"
                    aria-label="Tutup"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={saveEvent} className="p-6 space-y-4">
                  <div>
                    <label className={labelCls}>Jenis *</label>
                    <select
                      value={eventForm.type}
                      onChange={(e) => setEventForm({ ...eventForm, type: e.target.value as ConsignmentEvent["type"] })}
                      className={selectCls}
                    >
                      <option value="terjual">Terjual — stok tidak diubah</option>
                      <option value="retur">Retur — kembali ke gudang (stok +)</option>
                      <option value="susut">Hilang / Rusak — stok tidak diubah</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Jumlah *</label>
                      <input
                        type="number"
                        min={0.001}
                        step="any"
                        value={eventForm.qty}
                        onChange={(e) => setEventForm({ ...eventForm, qty: e.target.value })}
                        placeholder="mis. 3"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Tanggal *</label>
                      <input
                        type="date"
                        value={eventForm.date}
                        onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Catatan</label>
                    <input
                      value={eventForm.note}
                      onChange={(e) => setEventForm({ ...eventForm, note: e.target.value })}
                      placeholder={eventForm.type === "retur" ? "mis. sisa tidak laku" : "opsional"}
                      className={inputCls}
                    />
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">
                    Sisa titip saat ini:{" "}
                    <span className="text-white font-semibold">
                      {formatNumber(itemSums(eventForm.item).sisa)} {eventForm.item.product_unit}
                    </span>
                    {eventForm.type === "retur" && (
                      <span className="block mt-1 text-teal-400/80">
                        Retur menambah stok gudang dan mengurangi sisa di toko.
                      </span>
                    )}
                    {eventForm.type !== "retur" && (
                      <span className="block mt-1">Jenis ini tidak mengubah stok gudang — hanya mencatat laporan toko.</span>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60"
                    >
                      {saving ? "Menyimpan..." : "Simpan Catatan"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventForm(null)}
                      className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ================= TAB LAPORAN ================= */}
      {tab === "laporan" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <div className="text-xs text-white/50 uppercase tracking-wide">Nilai Persediaan</div>
              <div className="text-2xl font-bold text-white mt-2">{formatRupiah(valuation)}</div>
              <div className="text-xs text-white/40 mt-1">Σ stok × harga modal</div>
            </div>
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <div className="text-xs text-white/50 uppercase tracking-wide">Barang Stok Menipis</div>
              <div className={`text-2xl font-bold mt-2 ${lowStock.length > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {lowStock.length}
              </div>
              <div className="text-xs text-white/40 mt-1">barang di bawah / sama dengan stok minimum</div>
            </div>
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <div className="text-xs text-white/50 uppercase tracking-wide">Total Penjualan</div>
              <div className="text-2xl font-bold text-white mt-2">{formatRupiah(sales.filter((x) => x.status !== "void").reduce((s, x) => s + x.total, 0))}</div>
              <div className="text-xs text-white/40 mt-1">{sales.filter((x) => x.status !== "void").length} transaksi penjualan tercatat (dibatalkan tidak dihitung)</div>
            </div>
          </div>

          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto mb-6">
            <div className="px-4 py-3 border-b border-white/10 font-semibold text-white text-sm">
              Kartu Stok / Valuasi Persediaan
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Barang</th>
                  <th className="px-4 py-3 font-medium">Satuan</th>
                  <th className="px-4 py-3 font-medium text-right">Stok</th>
                  <th className="px-4 py-3 font-medium text-right">Harga Modal</th>
                  <th className="px-4 py-3 font-medium text-right">Nilai Persediaan</th>
                  <th className="px-4 py-3 font-medium text-right">Stok Min</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-medium">
                      {p.name}
                      {p.is_raw_material && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium">bahan</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">{p.unit}</td>
                    <td className="px-4 py-3 text-right text-white/80">{formatNumber(p.stok)}</td>
                    <td className="px-4 py-3 text-right text-white/70">{formatRupiah(p.harga_modal)}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">{formatRupiah(p.stok * p.harga_modal)}</td>
                    <td className="px-4 py-3 text-right text-white/50">{formatNumber(p.stok_min)}</td>
                  </tr>
                ))}
                <tr className="bg-white/5">
                  <td colSpan={4} className="px-4 py-3 text-right text-white/60 font-semibold">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right text-[#E9A64E] font-bold">{formatRupiah(valuation)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
              <div className="px-4 py-3 border-b border-white/10 font-semibold text-white text-sm">Stok Menipis</div>
              {lowStock.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-sm">Semua stok aman.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Barang</th>
                      <th className="px-4 py-3 font-medium text-right">Stok</th>
                      <th className="px-4 py-3 font-medium text-right">Minimum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((p) => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">{p.name}</td>
                        <td className="px-4 py-3 text-right text-red-400 font-semibold">{formatNumber(p.stok)}</td>
                        <td className="px-4 py-3 text-right text-white/50">{formatNumber(p.stok_min)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
              <div className="px-4 py-3 border-b border-white/10 font-semibold text-white text-sm">Rekap Penjualan per Barang</div>
              {soldRecap.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-sm">Belum ada penjualan tercatat.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Barang</th>
                      <th className="px-4 py-3 font-medium text-right">Terjual</th>
                      <th className="px-4 py-3 font-medium text-right">Omzet</th>
                      <th className="px-4 py-3 font-medium text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldRecap.map(([pid, r]) => (
                      <tr key={pid} className="border-b border-white/5">
                        <td className="px-4 py-3 text-white">{r.name}</td>
                        <td className="px-4 py-3 text-right text-white/80">{formatNumber(r.terjual)}</td>
                        <td className="px-4 py-3 text-right text-white/70">{formatRupiah(r.omzet)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatRupiah(r.omzet - r.modal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto mt-6">
            <div className="px-4 py-3 border-b border-white/10 font-semibold text-white text-sm">
              Rekap Titipan per Toko
              <span className="ml-2 text-white/40 font-normal text-xs">
                sisa = barang yang masih dititipkan dan belum laku / kembali
              </span>
            </div>
            {tokoRecap.length === 0 ? (
              <div className="p-8 text-center text-white/40 text-sm">Belum ada titipan aktif ke toko mana pun.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-white/50 border-b border-white/10">
                    <th className="px-4 py-3 font-medium">Toko</th>
                    <th className="px-4 py-3 font-medium text-right">Dititip</th>
                    <th className="px-4 py-3 font-medium text-right">Terjual</th>
                    <th className="px-4 py-3 font-medium text-right">Retur</th>
                    <th className="px-4 py-3 font-medium text-right">Susut</th>
                    <th className="px-4 py-3 font-medium text-right">Sisa</th>
                    <th className="px-4 py-3 font-medium text-right">Nilai Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {tokoRecap.map((t) => (
                    <tr key={t.toko_id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white">{t.name}</td>
                      <td className="px-4 py-3 text-right text-white/80">{formatNumber(t.dititip)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(t.terjual)}</td>
                      <td className="px-4 py-3 text-right text-teal-400">{formatNumber(t.retur)}</td>
                      <td className={`px-4 py-3 text-right ${t.susut > 0 ? "text-red-400" : "text-white/40"}`}>
                        {formatNumber(t.susut)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#E9A64E]">{formatNumber(t.sisa)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{formatRupiah(t.nilaiSisa)}</td>
                    </tr>
                  ))}
                  <tr className="bg-white/5">
                    <td className="px-4 py-3 text-right text-white/60 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      {formatNumber(tokoRecap.reduce((s, t) => s + t.dititip, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-semibold">
                      {formatNumber(tokoRecap.reduce((s, t) => s + t.terjual, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-teal-400 font-semibold">
                      {formatNumber(tokoRecap.reduce((s, t) => s + t.retur, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 font-semibold">
                      {formatNumber(tokoRecap.reduce((s, t) => s + t.susut, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-[#E9A64E] font-bold">
                      {formatNumber(tokoRecap.reduce((s, t) => s + t.sisa, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-[#E9A64E] font-bold">
                      {formatRupiah(tokoRecap.reduce((s, t) => s + t.nilaiSisa, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {historyProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 md:p-10 overflow-y-auto">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="font-semibold text-white">
                  Riwayat Barang — {historyProduct.name}
                  {historyProduct.sku && <span className="text-white/40 font-mono text-sm ml-2">{historyProduct.sku}</span>}
                </h2>
                <p className="text-white/50 text-sm mt-0.5">
                  Stok saat ini: <span className="text-white font-semibold">{formatNumber(historyProduct.stok)}</span>{" "}
                  {historyProduct.unit} · Kartu stok (saldo berjalan)
                </p>
              </div>
              <button onClick={() => setHistoryProduct(null)} className="p-2 text-white/40 hover:text-white transition" aria-label="Tutup">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {historyLoading && <div className="text-white/50 text-sm">Memuat riwayat...</div>}
              {!historyLoading && historyRows.length === 0 && (
                <div className="text-white/40 text-sm text-center py-8">Belum ada mutasi untuk barang ini.</div>
              )}
              {!historyLoading && historyRows.length > 0 && (
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-2 py-2 font-medium">Tanggal</th>
                      <th className="px-2 py-2 font-medium">Alasan</th>
                      <th className="px-2 py-2 font-medium text-right">Masuk</th>
                      <th className="px-2 py-2 font-medium text-right">Keluar</th>
                      <th className="px-2 py-2 font-medium text-right">Saldo</th>
                      <th className="px-2 py-2 font-medium">Penerima / Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map(({ movement: m, saldo }) => (
                      <tr key={m.id} className="border-b border-white/5">
                        <td className="px-2 py-2 text-white/60 whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${reasonColor[m.reason] ?? "bg-white/10 text-white/60"}`}>
                            {reasonLabel[m.reason] ?? m.reason}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-emerald-400">{m.type === "in" ? formatNumber(m.qty) : "-"}</td>
                        <td className="px-2 py-2 text-right text-red-400">{m.type === "out" ? formatNumber(m.qty) : "-"}</td>
                        <td className="px-2 py-2 text-right font-semibold text-white">{formatNumber(saldo)}</td>
                        <td className="px-2 py-2 text-white/60">
                          {m.recipient || m.note || "-"}
                          {m.created_by_name && <span className="text-white/30 text-xs"> · {m.created_by_name}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
