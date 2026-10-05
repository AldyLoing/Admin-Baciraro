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
  transaction_ref: string | null;
  created_at: string;
  items: SaleItem[];
};

type Props = {
  initialProducts: Product[];
  initialMovements: Movement[];
  initialSales: Sale[];
  isAdmin: boolean;
};

type Tab = "barang" | "mutasi" | "penjualan" | "laporan";

const tabs: { key: Tab; label: string }[] = [
  { key: "barang", label: "Barang" },
  { key: "mutasi", label: "Mutasi Stok" },
  { key: "penjualan", label: "Penjualan" },
  { key: "laporan", label: "Laporan" },
];

const reasonLabel: Record<string, string> = {
  stok_awal: "Stok Awal",
  penyesuaian: "Penyesuaian / Opname",
  terjual: "Terjual",
  gratis: "Gratis / Hadiah",
  rusak: "Rusak",
  hilang: "Hilang",
};

const reasonColor: Record<string, string> = {
  stok_awal: "bg-blue-500/10 text-blue-400",
  penyesuaian: "bg-amber-500/10 text-amber-400",
  terjual: "bg-emerald-500/10 text-emerald-400",
  gratis: "bg-purple-500/10 text-purple-400",
  rusak: "bg-red-500/10 text-red-400",
  hilang: "bg-red-500/10 text-red-400",
};

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
};

const emptyMovementForm = {
  product_id: "",
  type: "in" as "in" | "out",
  reason: "penyesuaian",
  qty: "",
  recipient: "",
  note: "",
};

type SaleFormItem = { product_id: string; qty: string; harga_jual: string };

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

export default function InventoriClient({ initialProducts, initialMovements, initialSales, isAdmin }: Props) {
  const [tab, setTab] = useState<Tab>("barang");
  const [products, setProducts] = useState(initialProducts);
  const [movements] = useState(initialMovements);
  const [sales] = useState(initialSales);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [barangSearch, setBarangSearch] = useState("");
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
    if (!barangSearch) return products;
    const q = barangSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, barangSearch]);

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

  // ---------- Barang ----------
  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
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
                }
              : p
          )
        );
        setSaving(false);
        setShowProductForm(false);
        setSuccess("Barang diperbarui.");
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      await apiCall("/api/admin/inventori/products", "POST", {
        sku: productForm.sku,
        name: productForm.name,
        category: productForm.category,
        unit: productForm.unit,
        harga_modal: Number(productForm.harga_modal) || 0,
        harga_jual: Number(productForm.harga_jual) || 0,
        stok: Number(productForm.stok) || 0,
        stok_min: Number(productForm.stok_min) || 0,
        notes: productForm.notes,
      });
      showSuccess("Barang ditambahkan.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: number) {
    if (!confirm("Hapus barang ini?")) return;
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
    if (!confirm("Hapus mutasi ini? Stok akan dikembalikan seperti semula.")) return;
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
    if (!confirm("Hapus penjualan ini? Stok, kas, dan jurnal akan dikembalikan.")) return;
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kartu), "Valuasi Persediaan");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(menipis), "Stok Menipis");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rekap), "Rekap Penjualan");
    XLSX.writeFile(wb, "inventori-laporan.xlsx");
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Inventori Barang</h1>
          <p className="text-white/50 mt-1">
            Ganci, asbak, coaster, dll. — stok masuk/keluar, penjualan, kas &amp; jurnal otomatis.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tab === "barang" && isAdmin && (
            <button onClick={() => (showProductForm ? setShowProductForm(false) : openCreateProduct())} className={primaryBtn}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showProductForm ? "Tutup" : "Tambah Barang"}
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
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key
                ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
            {t.key === "barang" && lowStock.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px]">{lowStock.length}</span>
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
      {tab === "barang" && (
        <>
          {showProductForm && isAdmin && (
            <form onSubmit={saveProduct} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
              <h2 className="font-semibold text-white">{editingProduct ? "Ubah Barang" : "Tambah Barang"}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className={labelCls}>Nama Barang *</label>
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
                {!editingProduct && (
                  <div>
                    <label className={labelCls}>Stok Awal</label>
                    <input
                      type="number"
                      min={0}
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
                    Barang aktif dijual
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
                  {saving ? "Menyimpan..." : editingProduct ? "Simpan Perubahan" : "Tambah Barang"}
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
                            aria-label="Hapus"
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
                    min={1}
                    value={movementForm.qty}
                    onChange={(e) => setMovementForm({ ...movementForm, qty: e.target.value })}
                    placeholder="mis. 10"
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
                    </td>
                    <td className="px-4 py-3 font-mono text-white/50 text-xs">{m.reference || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && !m.sale_id && (
                        <button
                          onClick={() => removeMovement(m.id)}
                          className="p-1.5 text-white/30 hover:text-red-400 transition"
                          aria-label="Hapus"
                          title="Hapus mutasi (stok dikembalikan)"
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
                <div className="grid grid-cols-12 gap-2 text-xs text-white/50 font-medium">
                  <div className="col-span-5">Barang</div>
                  <div className="col-span-2">Jumlah</div>
                  <div className="col-span-3">Harga Jual</div>
                  <div className="col-span-2 text-right">Subtotal</div>
                </div>
                {saleItems.map((it, idx) => {
                  const p = it.product_id ? productMap.get(Number(it.product_id)) : undefined;
                  const subtotal = (Number(it.qty) || 0) * (Number(it.harga_jual) || 0);
                  const overStock = p ? (Number(it.qty) || 0) > p.stok : false;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select value={it.product_id} onChange={(e) => onSaleProductChange(idx, e.target.value)} className={selectCls}>
                          <option value="">— Pilih barang —</option>
                          {products
                            .filter((x) => x.is_active)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.name} (stok {x.stok})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) => setSaleItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
                          className={`${inputCls} ${overStock ? "border-red-500/60" : ""}`}
                          placeholder="1"
                        />
                      </div>
                      <div className="col-span-3">
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
                        <div className="col-span-12 text-xs text-red-400 -mt-1">
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
              <div className="text-2xl font-bold text-white mt-2">{formatRupiah(sales.reduce((s, x) => s + x.total, 0))}</div>
              <div className="text-xs text-white/40 mt-1">{sales.length} transaksi penjualan tercatat</div>
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
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
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
        </>
      )}

      {/* ================= MODAL RIWAYAT PER BARANG ================= */}
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
