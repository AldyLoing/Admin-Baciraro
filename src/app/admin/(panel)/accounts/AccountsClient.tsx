"use client";

import { useState, useMemo } from "react";
import SearchInput from "@/components/ui/SearchInput";
import { formatRupiah, formatDate } from "@/lib/admin/format";

type Account = {
  id: number;
  code: number;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  parent_code: number | null;
  is_active: boolean;
  created_at: string;
};

type Props = {
  accounts: Account[];
  isAdmin: boolean;
};

const typeLabel: Record<string, string> = {
  asset: "Aset",
  liability: "Kewajiban",
  equity: "Ekuitas",
  revenue: "Pendapatan",
  expense: "Beban",
};

const typeColor: Record<string, string> = {
  asset: "bg-blue-500/10 text-blue-400",
  liability: "bg-red-500/10 text-red-400",
  equity: "bg-purple-500/10 text-purple-400",
  revenue: "bg-emerald-500/10 text-emerald-400",
  expense: "bg-amber-500/10 text-amber-400",
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

export default function AccountsClient({ accounts, isAdmin }: Props) {
  const [rows, setRows] = useState(accounts);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset" as string,
    parent_code: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showError(msg: string) {
    setError(msg);
    setSuccess(null);
  }
  function showSuccess(msg: string) {
    setSuccess(msg);
    setError(null);
  }

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        String(a.code).includes(q) ||
        typeLabel[a.type].toLowerCase().includes(q)
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const a of filtered) {
      if (!groups[a.type]) groups[a.type] = [];
      groups[a.type].push(a);
    }
    return groups;
  }, [filtered]);

  function openCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", type: "asset", parent_code: "" });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(a: Account) {
    setEditingId(a.id);
    setForm({
      code: String(a.code),
      name: a.name,
      type: a.type,
      parent_code: a.parent_code ? String(a.parent_code) : "",
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.code || !form.name.trim()) {
      showError("Kode dan nama akun wajib diisi.");
      return;
    }

    setSaving(true);
    const payload = {
      code: Number(form.code),
      name: form.name.trim(),
      type: form.type,
      parent_code: form.parent_code ? Number(form.parent_code) : null,
    };

    if (editingId) {
      const res = await fetch("/api/admin/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.ok) {
        showError("Gagal memperbarui akun: " + (data.error ?? "unknown"));
        return;
      }
      showSuccess("Akun diperbarui.");
      setRows((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? { ...a, name: payload.name, type: payload.type as Account["type"], parent_code: payload.parent_code }
            : a
        )
      );
    } else {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.ok) {
        showError("Gagal menambah akun: " + (data.error ?? "unknown"));
        return;
      }
      showSuccess("Akun ditambahkan.");
      window.location.reload();
    }
    setShowForm(false);
  }

  async function remove(id: number) {
    if (!confirm("Hapus akun ini?")) return;
    const res = await fetch("/api/admin/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showError("Gagal menghapus: " + (data.error ?? "unknown"));
      return;
    }
    setRows((prev) => prev.filter((a) => a.id !== id));
    showSuccess("Akun dihapus.");
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Daftar Akun</h1>
          <p className="text-white/50 mt-1">
            Chart of Accounts — sistem kode akun pembukuan.
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
            {showForm ? "Tutup" : "Tambah Akun"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="mb-6 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{success}</div>
      )}

      {showForm && isAdmin && (
        <form onSubmit={save} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white">{editingId ? "Ubah Akun" : "Tambah Akun"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Kode Akun *</label>
              <input
                type="number"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="mis. 1101"
                className={inputCls}
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nama Akun *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Kas di bank"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Tipe Akun *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={selectCls}>
                <option value="asset">Aset</option>
                <option value="liability">Kewajiban</option>
                <option value="equity">Ekuitas</option>
                <option value="revenue">Pendapatan</option>
                <option value="expense">Beban</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Akun Induk (opsional)</label>
              <select value={form.parent_code} onChange={(e) => setForm({ ...form, parent_code: e.target.value })} className={selectCls}>
                <option value="">Tidak ada</option>
                {rows.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v0a8 8 0 018 8" />
                </svg>
              )}
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Akun"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Cari akun..." className="max-w-sm" />
      </div>

      <div className="space-y-6">
        {(["asset", "liability", "equity", "revenue", "expense"] as const).map((type) => {
          const items = grouped[type];
          if (!items || items.length === 0) return null;
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${typeColor[type]}`}>
                  {typeLabel[type]}
                </span>
                <span className="text-xs text-white/40">{items.length} akun</span>
              </div>
              <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/50 border-b border-white/10">
                      <th className="px-4 py-3 font-medium">Kode</th>
                      <th className="px-4 py-3 font-medium">Nama Akun</th>
                      <th className="px-4 py-3 font-medium">Tipe</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-white/80">{a.code}</td>
                        <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${typeColor[a.type]}`}>
                            {typeLabel[a.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${a.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                            {a.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openEdit(a)} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Ubah">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => remove(a.id)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
            <p className="text-lg font-medium mb-1">Belum ada akun</p>
            <p className="text-sm">Tambahkan akun untuk memulai pembukuan double-entry.</p>
          </div>
        )}
      </div>
    </>
  );
}
