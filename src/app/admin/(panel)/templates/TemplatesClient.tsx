"use client";

import { useState } from "react";
import { formatDate } from "@/lib/admin/format";

type Member = { id: number; name: string; role: string; status: string };

type DefaultMember = {
  member_id: number | null;
  name: string;
  contribution_percent: number;
};

type DefaultTask = {
  title: string;
  priority: string;
  days_offset: number;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  default_members: DefaultMember[];
  default_tasks: DefaultTask[];
  created_at: string;
};

type Props = {
  templates: Template[];
  members: Member[];
  isAdmin: boolean;
};

const emptyForm = {
  name: "",
  description: "",
  default_members: [] as DefaultMember[],
  default_tasks: [] as DefaultTask[],
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

export default function TemplatesClient({ templates: initial, members, isAdmin }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(t: Template) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      default_members: t.default_members.map((m) => ({ ...m })),
      default_tasks: t.default_tasks.map((task) => ({ ...task })),
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function addMemberRow() {
    setForm((prev) => ({
      ...prev,
      default_members: [
        ...prev.default_members,
        { member_id: null, name: "", contribution_percent: 0 },
      ],
    }));
  }

  function removeMemberRow(index: number) {
    setForm((prev) => ({
      ...prev,
      default_members: prev.default_members.filter((_, i) => i !== index),
    }));
  }

  function updateMemberRow(index: number, field: keyof DefaultMember, value: any) {
    setForm((prev) => ({
      ...prev,
      default_members: prev.default_members.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));
  }

  function addTaskRow() {
    setForm((prev) => ({
      ...prev,
      default_tasks: [
        ...prev.default_tasks,
        { title: "", priority: "medium", days_offset: 0 },
      ],
    }));
  }

  function removeTaskRow(index: number) {
    setForm((prev) => ({
      ...prev,
      default_tasks: prev.default_tasks.filter((_, i) => i !== index),
    }));
  }

  function updateTaskRow(index: number, field: keyof DefaultTask, value: any) {
    setForm((prev) => ({
      ...prev,
      default_tasks: prev.default_tasks.map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      ),
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Nama template wajib diisi.");
      return;
    }

    setSaving(true);
    const url = "/api/admin/project-templates";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId ?? undefined,
        name: form.name.trim(),
        description: form.description.trim() || null,
        default_members: form.default_members,
        default_tasks: form.default_tasks,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok || !data.ok) {
      setError(data.error ?? (editingId ? "Gagal memperbarui template." : "Gagal membuat template."));
      return;
    }

    setShowForm(false);
    setSuccess(editingId ? "Template diperbarui." : "Template dibuat.");
    if (data.data && !editingId) {
      setTemplates((prev) => [data.data, ...prev]);
    } else if (editingId) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                name: form.name.trim(),
                description: form.description.trim() || null,
                default_members: form.default_members,
                default_tasks: form.default_tasks,
              }
            : t
        )
      );
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm("Hapus template ini?")) return;
    const res = await fetch("/api/admin/project-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError("Gagal menghapus: " + (data.error ?? "unknown"));
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setSuccess("Template dihapus.");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Project Templates</h1>
          <p className="text-white/50 mt-1">
            Kelola template project untuk mempercepat pembuatan project baru.
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
            {showForm ? "Tutup" : "Buat Template"}
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
          <h2 className="font-semibold text-white">{editingId ? "Ubah Template" : "Buat Template Baru"}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nama Template *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="mis. Website Development"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Deskripsi</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Template untuk project website..."
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Default Members</label>
              <button
                type="button"
                onClick={addMemberRow}
                className="text-xs text-[#D97A2B] hover:underline font-medium"
              >
                + Tambah Anggota
              </button>
            </div>
            {form.default_members.length === 0 && (
              <p className="text-xs text-white/40 mb-2">Belum ada anggota default.</p>
            )}
            <div className="space-y-2">
              {form.default_members.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                  <select
                    value={m.member_id ?? ""}
                    onChange={(e) => {
                      const memberId = e.target.value ? Number(e.target.value) : null;
                      const member = members.find((mem) => mem.id === memberId);
                      updateMemberRow(i, "member_id", memberId);
                      updateMemberRow(i, "name", member?.name ?? "");
                    }}
                    className={selectCls + " text-sm"}
                  >
                    <option value="">Pilih anggota...</option>
                    {members.map((mem) => (
                      <option key={mem.id} value={mem.id}>
                        {mem.name} · {mem.role}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={m.contribution_percent || ""}
                      onChange={(e) => updateMemberRow(i, "contribution_percent", Number(e.target.value))}
                      placeholder="%"
                      className={inputCls + " text-sm pr-6"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMemberRow(i)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition"
                    aria-label="Hapus"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Default Tasks</label>
              <button
                type="button"
                onClick={addTaskRow}
                className="text-xs text-[#D97A2B] hover:underline font-medium"
              >
                + Tambah Tugas
              </button>
            </div>
            {form.default_tasks.length === 0 && (
              <p className="text-xs text-white/40 mb-2">Belum ada tugas default.</p>
            )}
            <div className="space-y-2">
              {form.default_tasks.map((t, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_90px_32px] gap-2 items-center">
                  <input
                    type="text"
                    value={t.title}
                    onChange={(e) => updateTaskRow(i, "title", e.target.value)}
                    placeholder="Judul tugas..."
                    className={inputCls + " text-sm"}
                  />
                  <select
                    value={t.priority}
                    onChange={(e) => updateTaskRow(i, "priority", e.target.value)}
                    className={selectCls + " text-sm"}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={t.days_offset || ""}
                      onChange={(e) => updateTaskRow(i, "days_offset", Number(e.target.value))}
                      placeholder="Hari"
                      className={inputCls + " text-sm pr-10"}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">hari</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTaskRow(i)}
                    className="p-1.5 text-white/30 hover:text-red-400 transition"
                    aria-label="Hapus"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
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
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Template"}
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

      {templates.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
          <p className="text-lg font-medium mb-1">Belum ada template</p>
          <p className="text-sm">Buat template project untuk mempercepat pembuatan project baru.</p>
        </div>
      ) : (
        <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-white/50 border-b border-white/10">
                  <th className="px-5 py-3 font-medium">Nama</th>
                  <th className="px-5 py-3 font-medium">Deskripsi</th>
                  <th className="px-5 py-3 font-medium text-center">Anggota</th>
                  <th className="px-5 py-3 font-medium text-center">Tugas</th>
                  <th className="px-5 py-3 font-medium">Dibuat</th>
                  {isAdmin && <th className="px-5 py-3 font-medium text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 transition">
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{t.name}</p>
                    </td>
                    <td className="px-5 py-4 text-white/50 max-w-xs truncate">{t.description || "-"}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-[#D97A2B]/10 text-orange-400 text-xs font-medium">
                        {t.default_members.length} anggota
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                        {t.default_tasks.length} tugas
                      </span>
                    </td>
                    <td className="px-5 py-4 text-white/50">{formatDate(t.created_at)}</td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1.5 text-white/30 hover:text-[#E9A64E] transition"
                            aria-label="Ubah"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeTemplate(t.id)}
                            className="p-1.5 text-white/30 hover:text-red-400 transition"
                            aria-label="Hapus"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
