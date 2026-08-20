"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDate } from "@/lib/admin/format";

type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  source: string;
  description: string;
  reference: string;
  project_id: string | null;
  created_at: string;
};

type Project = { id: string; name: string; status: string };

type Props = {
  transactions: Transaction[];
  projects: Project[];
  isAdmin: boolean;
};

const typeLabel: Record<string, string> = { income: "Pemasukan", expense: "Pengeluaran" };

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

export default function TransactionsClient({ transactions, projects, isAdmin }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(transactions);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [month, setMonth] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "income" as "income" | "expense",
    amount: "",
    source: "",
    description: "",
    project_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of rows) set.add(t.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [rows]);

  const withBalance = useMemo(() => {
    const sorted = [...rows].sort((a, b) =>
      a.date === b.date
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : a.date.localeCompare(b.date)
    );
    let balance = 0;
    const out = sorted.map((t) => {
      balance += t.type === "income" ? t.amount : -t.amount;
      return { ...t, balance };
    });
    return out;
  }, [rows]);

  const filtered = withBalance.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (month !== "all" && t.date.slice(0, 7) !== month) return false;
    return true;
  }).slice().reverse();

  const totalIncome = withBalance.reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0);
  const totalExpense = withBalance.reduce((s, t) => s + (t.type === "expense" ? t.amount : 0), 0);
  const balance = totalIncome - totalExpense;

  function openCreate() {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      type: "income",
      amount: "",
      source: "",
      description: "",
      project_id: "",
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(t: Transaction) {
    setEditingId(t.id);
    setForm({
      date: t.date,
      type: t.type,
      amount: String(t.amount),
      source: t.source,
      description: t.description,
      project_id: t.project_id ?? "",
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = Number(form.amount);
    if (!form.date || !form.source.trim()) {
      showError("Tanggal dan sumber wajib diisi.");
      return;
    }
    if (!form.amount || isNaN(amount) || amount <= 0) {
      showError("Jumlah harus berupa angka lebih dari 0.");
      return;
    }

    setSaving(true);
    const payload = {
      date: form.date,
      type: form.type,
      amount,
      source: form.source.trim(),
      description: form.description.trim(),
      project_id: form.project_id || null,
    };

    if (editingId) {
      const res = await fetch("/api/admin/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.ok) { showError("Gagal memperbarui transaksi: " + (data.error ?? "unknown")); return; }
      showSuccess("Transaksi diperbarui.");
    } else {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.ok) { showError("Gagal menambah transaksi: " + (data.error ?? "unknown")); return; }
      showSuccess(`Transaksi ditambahkan (${data.reference}).`);
    }

    setShowForm(false);
    setRows((prev) =>
      editingId
        ? prev.map((t) =>
            t.id === editingId
              ? { ...t, date: form.date, type: form.type, amount, source: form.source.trim(), description: form.description.trim(), project_id: form.project_id || null }
              : t
          )
        : prev
    );
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Hapus transaksi ini?")) return;
    const res = await fetch("/api/admin/transactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    setRows((prev) => prev.filter((t) => t.id !== id));
    showSuccess("Transaksi dihapus.");
    router.refresh();
  }

  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Kas & Transaksi</h1>
          <p className="text-white/50 mt-1">
            Pencatatan pemasukan dan pengeluaran dengan saldo berjalan.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => (showForm ? setShowForm(false) : openCreate())}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? "Tutup" : "Tambah Transaksi"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Saldo</p>
          <p className={`text-xl font-bold mt-1 ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(balance)}</p>
          <p className="text-xs text-white/40 mt-1">saldo berjalan</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Pemasukan</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{formatRupiah(totalIncome)}</p>
          <p className="text-xs text-white/40 mt-1">{withBalance.filter((t) => t.type === "income").length} transaksi</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Pengeluaran</p>
          <p className="text-xl font-bold text-red-400 mt-1">{formatRupiah(totalExpense)}</p>
          <p className="text-xs text-white/40 mt-1">{withBalance.filter((t) => t.type === "expense").length} transaksi</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="mb-6 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{success}</div>
      )}

      {showForm && isAdmin && (
        <form onSubmit={save} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white">{editingId ? "Ubah Transaksi" : "Tambah Transaksi"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Jenis *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })} className={selectCls}>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Tanggal *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Jumlah (Rp) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="mis. 1500000" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Sumber / Penerima *</label>
              <input type="text" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="mis. Klien X, Transfer, Membeli hosting" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Project Terkait</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={selectCls}>
                <option value="">Tidak ada</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Deskripsi</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Catatan singkat..." className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v0a8 8 0 018 8" />
                </svg>
              )}
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Transaksi"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "income", "expense"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white" : "bg-[#151515] border border-white/10 text-white/60 hover:bg-white/5"}`}>
            {f === "all" ? "Semua" : typeLabel[f]}
          </button>
        ))}
        <select value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#151515] border border-white/10 text-white/60 focus:border-[#D97A2B] outline-none transition">
          <option value="all">Semua bulan</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
          <p className="text-lg font-medium mb-1">Belum ada transaksi</p>
          <p className="text-sm">Catat pemasukan dan pengeluaran kas Baciraro.</p>
        </div>
      ) : (
        <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/50 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Tanggal</th>
                <th className="px-4 py-3 font-medium">Referensi</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 font-medium text-right">Jumlah</th>
                <th className="px-4 py-3 font-medium text-right">Saldo</th>
                {isAdmin && <th className="px-4 py-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const project = t.project_id ? projectMap.get(t.project_id) : null;
                return (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50 whitespace-nowrap">{t.reference || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${t.type === "income" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>
                        {typeLabel[t.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <p className="font-medium text-white">{t.source}</p>
                      <p className="text-xs text-white/40 truncate">
                        {t.description || "-"}
                        {project ? ` · ${project.name}` : ""}
                      </p>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${t.type === "income" ? "text-blue-400" : "text-red-400"}`}>
                      {t.type === "income" ? "+" : "-"}{formatRupiah(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-white/60 whitespace-nowrap">{formatRupiah(t.balance)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Ubah">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => remove(t.id)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
