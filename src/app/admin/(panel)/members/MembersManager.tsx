"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: number;
  name: string;
  role: string;
  division: string;
  photo_url: string | null;
  email: string;
  username: string;
  is_admin: boolean;
  status: string;
};

type Props = {
  members: Member[];
  isAdmin: boolean;
};

const emptyForm = {
  id: 0,
  name: "",
  email: "",
  username: "",
  password: "",
  role: "Member",
  division: "business",
  photo_url: "",
  status: "active",
  is_admin: false,
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

const divisionOptions = ["business", "technology", "operations", "technical"];

export default function MembersManager({ members, isAdmin }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  if (!isAdmin) return null;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      id: m.id,
      name: m.name,
      email: m.email ?? "",
      username: m.username ?? m.email ?? "",
      password: "",
      role: m.role,
      division: m.division || "business",
      photo_url: m.photo_url ?? "",
      status: m.status || "active",
      is_admin: m.is_admin,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { showError("Nama wajib diisi."); return; }
    const username = form.username.trim() || form.email.trim();
    if (!editing && (!username || !form.password)) {
      showError("Email dan password wajib diisi untuk anggota baru.");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || "Member",
      division: form.division || "business",
      photo_url: form.photo_url.trim() || null,
      email: form.email.trim() || username,
      username,
      is_admin: form.is_admin,
      status: form.status,
    };

    const body = editing
      ? { id: editing.id, ...payload, ...(form.password ? { password: form.password } : {}) }
      : { ...payload, password: form.password };

    const res = await fetch("/api/admin/members", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) { showError(data.error ?? "Gagal menyimpan anggota."); return; }

    setShowForm(false);
    showSuccess(editing ? "Anggota diperbarui." : "Anggota ditambahkan.");
    router.refresh();
  }

  async function remove(m: Member) {
    if (!confirm(`Hapus anggota "${m.name}"? Data terkait (project, tugas) akan terhapus.`)) return;
    const res = await fetch("/api/admin/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError(data.error ?? "Gagal menghapus anggota."); return; }
    showSuccess("Anggota dihapus.");
    router.refresh();
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Kelola Anggota</h2>
          <p className="text-sm text-white/50 mt-0.5">
            Tambah, ubah, atau nonaktifkan anggota tim. Perubahan juga tampil di halaman publik /leadership.
          </p>
        </div>
        <button
          onClick={() => (showForm ? setShowForm(false) : openCreate())}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {showForm ? "Tutup" : "Tambah Anggota"}
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="mt-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{success}</div>
      )}

      {showForm && (
        <form onSubmit={save} className="mt-4 bg-[#151515] rounded-xl border border-white/10 p-6 space-y-4">
          <h3 className="font-semibold text-white">{editing ? `Ubah: ${editing.name}` : "Tambah Anggota Baru"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nama *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Budi Santoso" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Role</label>
              <input type="text" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="mis. Desainer" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Divisi</label>
              <select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} className={selectCls}>
                {divisionOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Foto (URL)</label>
              <input type="url" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://.../foto.png" className={inputCls} />
            </div>
            {!editing && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Email (login) *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, username: e.target.value })}
                    placeholder="mis. budi@baciraro.id" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Password *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Kata sandi awal anggota" className={inputCls} />
                </div>
              </>
            )}
            {editing && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Email (login)</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, username: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Password Baru</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Kosongkan jika tidak diubah" className={inputCls} />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectCls}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
              className="w-4 h-4 accent-[#D97A2B]" />
            Beri akses admin
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v0a8 8 0 018 8" />
                </svg>
              )}
              {saving ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Anggota"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {members.map((m) => (
          <div key={m.id} className="bg-[#151515] rounded-xl border border-white/10 px-4 py-3 flex items-center gap-3">
            {m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo_url} alt={m.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#D97A2B]/20 text-[#E9A64E] flex items-center justify-center text-xs font-semibold shrink-0">
                {m.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {m.name}
                {m.status === "inactive" && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-medium">NONAKTIF</span>
                )}
              </p>
              <p className="text-xs text-white/50 truncate">
                {m.role}{m.division ? ` · ${m.division}` : ""}{m.is_admin ? " · Admin" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => openEdit(m)} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Ubah">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={() => remove(m)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
