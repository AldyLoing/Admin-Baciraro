"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDate, KAS_PERCENT } from "@/lib/admin/format";

type Project = {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  total_value: number;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type Member = {
  pm_id: number;
  member_id: number | null;
  name: string;
  role: string | null;
  avatar_url?: string | null;
  contribution_percent: number;
  amount: number | null;
  tugas: string | null;
};

type AllMember = { id: number; name: string; role: string };

type TxRow = { id: string; date: string; type: string; amount: number; source: string; description: string; reference: string; status?: string };
type PayoutRow = { id: string; date: string; total_amount: number; orders_fee: number; net_amount: number; status: string; kas_optional_amount: number };
type ActivityRow = { id: number; user_name: string; action: string; entity_name: string; details: unknown; created_at: string };
type Attachment = { name: string; url: string; size: number; uploaded_at: string };

type Props = {
  project: Project;
  members: Member[];
  allMembers: AllMember[];
  isAdmin: boolean;
  statusLabel: Record<string, string>;
  statusColor: Record<string, string>;
  transactions: TxRow[];
  payouts: PayoutRow[];
  activities: ActivityRow[];
  totalIncome: number;
  totalExpense: number;
  totalPaidPayout: number;
  pendingPayout: number;
  dist: { total: number; kasAmount: number; distributable: number; totalPercent: number };
};

const inputCls = "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition";
const selectCls = "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition";

type Tab = "ringkasan" | "keuangan" | "anggota" | "dokumen" | "aktivitas";

export default function ProjectDetailClient({
  project: initialProject,
  members: initialMembers,
  allMembers,
  isAdmin,
  statusLabel,
  statusColor,
  transactions: initialTx,
  payouts: initialPayouts,
  activities: initialActivities,
  totalIncome,
  totalExpense,
  totalPaidPayout,
  pendingPayout,
  dist,
}: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [members, setMembers] = useState(initialMembers);
  const [tx] = useState(initialTx);
  const [payouts] = useState(initialPayouts);
  const [activities] = useState(initialActivities);
  const [activeTab, setActiveTab] = useState<Tab>("ringkasan");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: initialProject.name,
    client_name: initialProject.client_name ?? "",
    description: initialProject.description ?? "",
    total_value: String(initialProject.total_value),
    status: initialProject.status,
  });
  const [addingMember, setAddingMember] = useState(false);
  const [addType, setAddType] = useState<"member" | "external">("member");
  const [newMemberId, setNewMemberId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPercent, setNewPercent] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newTugas, setNewTugas] = useState("");
  const [editingTugas, setEditingTugas] = useState<{ pm_id: number; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    try {
      const parsed = JSON.parse((initialProject as Project & { attachments?: string | null }).attachments || "[]");
      return Array.isArray(parsed) ? parsed.filter((a: { removed_at?: string | null }) => !a.removed_at) : [];
    } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  async function saveProject() {
    setLoading(true);
    setError(null);
    const value = form.total_value === "" ? 0 : Number(form.total_value);
    if (!form.name.trim()) { showError("Nama project wajib diisi."); setLoading(false); return; }
    if (isNaN(value) || value < 0) { showError("Nilai project tidak boleh negatif."); setLoading(false); return; }
    const res = await fetch("/api/admin/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: project.id, name: form.name.trim(), client_name: form.client_name.trim() || null, description: form.description.trim() || null, total_value: value, status: form.status }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menyimpan: " + (data.error ?? "unknown")); setLoading(false); return; }
    setProject((p) => ({ ...p, ...form, total_value: value, completed_at: form.status === "active" ? null : (p.completed_at ?? new Date().toISOString()) }));
    setEditing(false);
    showSuccess("Project berhasil diperbarui.");
    setLoading(false);
    router.refresh();
  }

  async function addMemberRow() {
    setError(null);
    const memberId = addType === "member" ? Number(newMemberId) : null;
    const memberName = addType === "external" ? newName.trim() : "";
    if (!memberId && !memberName) { showError(addType === "member" ? "Pilih anggota terlebih dahulu." : "Isi nama kontributor terlebih dahulu."); return; }
    if (!newPercent || Number(newPercent) <= 0) { showError("Persentase kontribusi harus lebih dari 0."); return; }
    const currentTotal = members.reduce((s, m) => s + m.contribution_percent, 0);
    if (currentTotal + Number(newPercent) > 100) { showError(`Total kontribusi melebihi 100% (sekarang ${currentTotal}% + ${newPercent}%).`); return; }
    const res = await fetch("/api/admin/project-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, member_id: memberId, name: addType === "external" ? memberName : undefined, contribution_percent: Number(newPercent), amount: newAmount === "" ? null : Number(newAmount), tugas: newTugas.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menambahkan kontributor: " + (data.error ?? "unknown")); return; }
    const chosen = memberId ? allMembers.find((m) => m.id === memberId) : null;
    setMembers((prev) => [...prev, { pm_id: Date.now(), member_id: memberId, name: chosen?.name ?? memberName, role: chosen?.role ?? null, avatar_url: chosen ? undefined : null, contribution_percent: Number(newPercent), amount: newAmount === "" ? null : Number(newAmount), tugas: newTugas.trim() || null }]);
    setNewMemberId(""); setNewName(""); setNewPercent(""); setNewAmount(""); setNewTugas(""); setAddType("member"); setAddingMember(false);
    showSuccess("Kontributor ditambahkan.");
    router.refresh();
  }

  async function removeMember(pmId: number, memberName: string) {
    if (!confirm(`Keluarkan ${memberName} dari project ini? Anggota bisa ditambahkan kembali nanti.`)) return;
    const res = await fetch("/api/admin/project-members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pmId }) });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    setMembers((prev) => prev.filter((m) => m.pm_id !== pmId));
    showSuccess(`${memberName} dihapus dari project.`);
    router.refresh();
  }

  async function saveTugas(pmId: number) {
    const value = editingTugas?.value.trim() ?? "";
    setError(null);
    const res = await fetch("/api/admin/project-members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pmId, tugas: value || null }) });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menyimpan tugas: " + (data.error ?? "unknown")); return; }
    setMembers((prev) => prev.map((m) => (m.pm_id === pmId ? { ...m, tugas: value || null } : m)));
    setEditingTugas(null);
    showSuccess("Tugas diperbarui.");
    router.refresh();
  }

  async function deleteProject() {
    if (!confirm("Arsipkan project ini? Semua data (transaksi, anggota, lampiran) tetap tersimpan dan tidak dihapus.")) return;
    const res = await fetch("/api/admin/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: project.id }) });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    router.push("/admin/projects");
    router.refresh();
  }

  async function uploadAttachment() {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      const res = await fetch(`/api/admin/projects/${project.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, url: "", size: file.size }),
      });
      const data = await res.json();
      setUploading(false);
      if (!res.ok || !data.ok) { showError("Gagal upload: " + (data.error ?? "unknown")); return; }
      setAttachments(data.attachments ?? []);
      showSuccess("File ditambahkan.");
    };
    input.click();
  }

  async function removeAttachment(index: number) {
    if (!confirm("Hapus file ini dari daftar lampiran? File tetap tersimpan di penyimpanan dan audit tercatat.")) return;
    const res = await fetch(`/api/admin/projects/${project.id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    setAttachments(data.attachments ?? []);
    showSuccess("File dihapus.");
  }

  const availableNewMembers = allMembers.filter((m) => !members.some((mm) => mm.member_id === m.id));

  const remainingFunds = totalIncome - totalExpense - totalPaidPayout;

  const tabs: { key: Tab; label: string }[] = [
    { key: "ringkasan", label: "Ringkasan" },
    { key: "keuangan", label: "Keuangan" },
    { key: "anggota", label: "Anggota" },
    { key: "dokumen", label: "Dokumen" },
    { key: "aktivitas", label: "Aktivitas" },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => router.push("/admin/projects")} className="text-sm text-white/50 hover:text-[#E9A64E] transition flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Semua Project
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold text-white">{project.name}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColor[project.status]}`}>{statusLabel[project.status] ?? project.status}</span>
            </div>
            <p className="text-white/50 mt-1">{project.client_name ? `Klien: ${project.client_name} · ` : ""}Dibuat {formatDate(project.created_at)}</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                {(project.status === "completed" || project.status === "paid") && (
                  <button onClick={() => router.push(`/admin/payouts?project=${project.id}`)} className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">Buat Payout</button>
                )}
                <button onClick={() => { setEditing(!editing); setError(null); }} className="px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition">
                  {editing ? "Tutup Edit" : "Edit"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="mb-4 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">{success}</div>}

      {/* Edit Form */}
      {editing && isAdmin && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-white">Edit Project</h2>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Nama Project</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Klien</label><input type="text" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Deskripsi</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-white/70 mb-1">Nilai Total (Rp)</label><input type="number" min="0" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-white/70 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectCls}>
                <option value="active">Aktif</option><option value="completed">Selesai</option><option value="paid">Dibayar</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={saveProject} disabled={loading} className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan Perubahan"}</button>
            <button onClick={deleteProject} className="px-5 py-2.5 rounded-lg border border-red-500/30 text-red-400 font-medium hover:bg-red-500/10 transition ml-auto">Arsipkan Project</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/10 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === t.key ? "border-[#D97A2B] text-white" : "border-transparent text-white/40 hover:text-white/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Ringkasan */}
      {activeTab === "ringkasan" && (
        <div className="space-y-6">
          <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Tentang Project</h3>
            {project.description ? <p className="text-sm text-white/60 mb-4 whitespace-pre-wrap">{project.description}</p> : <p className="text-sm text-white/30 mb-4 italic">Tidak ada deskripsi</p>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-white/40">Klien</p><p className="text-sm font-medium text-white">{project.client_name || "-"}</p></div>
              <div><p className="text-xs text-white/40">Nilai Total</p><p className="text-sm font-medium text-white">{formatRupiah(project.total_value)}</p></div>
              <div><p className="text-xs text-white/40">Status</p><p className="text-sm font-medium text-white">{statusLabel[project.status]}</p></div>
              <div><p className="text-xs text-white/40">Selesai</p><p className="text-sm font-medium text-white">{project.completed_at ? formatDate(project.completed_at) : "-"}</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <p className="text-xs font-medium text-white/50 uppercase">Total Pendapatan</p>
              <p className="text-xl font-bold text-blue-400 mt-1">{formatRupiah(totalIncome)}</p>
            </div>
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <p className="text-xs font-medium text-white/50 uppercase">Total Pengeluaran</p>
              <p className="text-xl font-bold text-red-400 mt-1">{formatRupiah(totalExpense)}</p>
            </div>
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <p className="text-xs font-medium text-white/50 uppercase">Sudah Dibayar</p>
              <p className="text-xl font-bold text-amber-400 mt-1">{formatRupiah(totalPaidPayout)}</p>
            </div>
            <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
              <p className="text-xs font-medium text-white/50 uppercase">Sisa Dana</p>
              <div className="flex items-center gap-2 mt-1">
                {pendingPayout > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400">Proses</span>
                ) : (
                  <p className={`text-xl font-bold ${remainingFunds >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatRupiah(remainingFunds)}</p>
                )}
              </div>
              {pendingPayout > 0 && <p className="text-[11px] text-white/40 mt-1">Menunggu pencairan payout</p>}
            </div>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Ringkasan Bagi Hasil</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-4"><p className="text-sm text-white/50">Nilai Total</p><p className="text-xl font-bold text-white mt-1">{formatRupiah(dist.total)}</p></div>
              <div className="bg-[#D97A2B]/10 rounded-lg p-4"><p className="text-sm text-[#E9A64E]">Kas Baciraro ({KAS_PERCENT}%)</p><p className="text-xl font-bold text-[#E9A64E] mt-1">{formatRupiah(dist.kasAmount)}</p></div>
              <div className="bg-emerald-500/10 rounded-lg p-4"><p className="text-sm text-emerald-400">Dibagikan ke Anggota</p><p className="text-xl font-bold text-emerald-400 mt-1">{formatRupiah(dist.distributable)}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Keuangan */}
      {activeTab === "keuangan" && (
        <div className="space-y-6">
          {tx.length > 0 && (
            <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70">Transaksi</h3>
                <a href="/admin/transactions" className="text-xs text-[#E9A64E] hover:underline">Lihat semua →</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-white/50 border-b border-white/10">
                    <th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">REF</th><th className="px-3 py-2 font-medium">Jenis</th><th className="px-3 py-2 font-medium">Keterangan</th><th className="px-3 py-2 font-medium text-right">Jumlah</th>
                  </tr></thead>
                  <tbody>{tx.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 text-white/60 whitespace-nowrap">{formatDate(t.date)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-white/50">{t.reference || "-"}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${t.type === "income" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}>{t.type === "income" ? "Masuk" : "Keluar"}</span></td>
                      <td className="px-3 py-2 text-white">
                        {t.source}
                        {t.status === "void" && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">DIBATALKAN</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${t.type === "income" ? "text-blue-400" : "text-red-400"}`}>{t.type === "income" ? "+" : "-"}{formatRupiah(t.amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {payouts.length > 0 && (
            <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/70">Riwayat Payout</h3>
                <a href="/admin/payouts" className="text-xs text-[#E9A64E] hover:underline">Lihat semua →</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-white/50 border-b border-white/10">
                    <th className="px-3 py-2 font-medium">Tanggal</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium text-right">Kas</th><th className="px-3 py-2 font-medium text-right">Net</th>
                  </tr></thead>
                  <tbody>{payouts.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 text-white/60 whitespace-nowrap">{formatDate(p.date)}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${p.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : p.status === "processing" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}>{p.status === "paid" ? "Dibayar" : p.status === "processing" ? "Diproses" : "Menunggu"}</span></td>
                      <td className="px-3 py-2 text-right text-amber-400">{formatRupiah(p.orders_fee)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-white">{formatRupiah(p.net_amount)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
          {tx.length === 0 && payouts.length === 0 && <p className="text-center py-8 text-white/40 text-sm">Belum ada data keuangan.</p>}
        </div>
      )}

      {/* Tab: Anggota */}
      {activeTab === "anggota" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70">Anggota & Kontribusi</h3>
            {isAdmin && (
              <button onClick={() => setAddingMember(!addingMember)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D97A2B]/40 text-[#E9A64E] text-sm font-medium hover:bg-[#D97A2B]/10 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {addingMember ? "Tutup" : "Tambah Anggota"}
              </button>
            )}
          </div>
          {addingMember && isAdmin && (
            <div className="mb-4 p-4 bg-[#D97A2B]/5 rounded-lg">
              <div className="flex gap-2 mb-3">
                <button type="button" onClick={() => setAddType("member")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${addType === "member" ? "bg-[#D97A2B] text-white" : "border border-white/15 text-white/60 hover:bg-white/5"}`}>Anggota</button>
                <button type="button" onClick={() => setAddType("external")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${addType === "external" ? "bg-[#D97A2B] text-white" : "border border-white/15 text-white/60 hover:bg-white/5"}`}>Orang Luar</button>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                {addType === "member" ? (
                  <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} className={selectCls + " flex-1"}>
                    <option value="">Pilih anggota...</option>
                    {availableNewMembers.map((m) => (<option key={m.id} value={m.id}>{m.name} · {m.role}</option>))}
                  </select>
                ) : (
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama kontributor luar..." className={inputCls + " flex-1"} />
                )}
                <div className="flex items-center gap-2"><input type="number" min="0" max="100" value={newPercent} onChange={(e) => setNewPercent(e.target.value)} placeholder="%" className="w-24 px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition" /><span className="text-white/50">%</span></div>
                <input type="number" min="0" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="Nominal (opsional)" className={inputCls + " flex-1"} />
                <input type="text" value={newTugas} onChange={(e) => setNewTugas(e.target.value)} placeholder="Tugas / peran..." className={inputCls + " flex-1"} />
                <button onClick={addMemberRow} className="px-4 py-2.5 rounded-lg bg-[#D97A2B] text-white text-sm font-semibold hover:opacity-90 transition">Tambah</button>
              </div>
            </div>
          )}
          {members.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm border border-dashed border-white/20 rounded-lg">Belum ada kontributor di project ini.</div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => {
                const amount = dist.totalPercent > 0 ? (dist.distributable * m.contribution_percent) / dist.totalPercent : 0;
                return (
                  <div key={m.pm_id} className="flex items-center gap-3">
                    {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt={m.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (<div className="w-10 h-10 rounded-full bg-[#D97A2B]/20 text-[#E9A64E] flex items-center justify-center text-xs font-semibold shrink-0">{m.name.slice(0, 2).toUpperCase()}</div>)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <p className="text-xs text-white/50">{m.member_id ? (m.role ?? "Anggota") : "Kontributor luar"}{m.amount != null && ` · nominal ${formatRupiah(m.amount)}`}</p>
                      {editingTugas?.pm_id === m.pm_id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input type="text" autoFocus value={editingTugas.value} onChange={(e) => setEditingTugas({ pm_id: m.pm_id, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveTugas(m.pm_id); if (e.key === "Escape") setEditingTugas(null); }} placeholder="Tugas / peran di project..." className="w-full max-w-xs px-2 py-1 text-xs rounded border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none" />
                          <button onClick={() => saveTugas(m.pm_id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded" aria-label="Simpan"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                          <button onClick={() => setEditingTugas(null)} className="p-1 text-white/40 hover:bg-white/10 rounded" aria-label="Batal"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      ) : m.tugas && (<p className="text-xs text-[#E9A64E] mt-1 flex items-center gap-1"><svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>{m.tugas}</p>)}
                    </div>
                    <div className="w-32 hidden md:block"><div className="h-2 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] rounded-full" style={{ width: `${m.contribution_percent}%` }} /></div></div>
                    <span className="w-14 text-right text-sm font-medium text-white">{m.contribution_percent}%</span>
                    <span className="w-32 text-right text-sm font-semibold text-white hidden sm:block">{formatRupiah(amount)}</span>
                    {isAdmin && (<>
                      <button onClick={() => setEditingTugas(editingTugas?.pm_id === m.pm_id ? null : { pm_id: m.pm_id, value: m.tugas ?? "" })} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Edit tugas"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                      <button onClick={() => removeMember(m.pm_id, m.name)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Keluarkan dari project"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </>)}
                  </div>
                );
              })}
            </div>
          )}
          {members.length > 0 && (
            <div className={`mt-4 flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${dist.totalPercent === 100 ? "bg-emerald-500/10 text-emerald-400" : "bg-[#D97A2B]/10 text-[#E9A64E]"}`}>
              <span>Total kontribusi</span>
              <span>{dist.totalPercent}% {dist.totalPercent === 100 ? "✓" : `(kurang ${(100 - dist.totalPercent).toFixed(1)}%)`}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Dokumen */}
      {activeTab === "dokumen" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70">Dokumen & Lampiran</h3>
            {isAdmin && (
              <button onClick={uploadAttachment} disabled={uploading} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D97A2B]/40 text-[#E9A64E] text-sm font-medium hover:bg-[#D97A2B]/10 transition disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {uploading ? "Mengupload..." : "Tambah File"}
              </button>
            )}
          </div>
          {attachments.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm border border-dashed border-white/20 rounded-lg">Belum ada dokumen.</div>
          ) : (
            <div className="space-y-2">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition">
                  <svg className="w-5 h-5 text-white/40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{a.name}</p>
                    <p className="text-xs text-white/40">{a.size ? `${(a.size / 1024).toFixed(1)} KB` : ""} {a.uploaded_at ? `· ${formatDate(a.uploaded_at)}` : ""}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => removeAttachment(i)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus lampiran"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Aktivitas */}
      {activeTab === "aktivitas" && (
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <h3 className="text-sm font-semibold text-white/70 mb-4">Aktivitas Terbaru</h3>
          {activities.length === 0 ? (
            <p className="text-center py-8 text-white/40 text-sm">Belum ada aktivitas.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition">
                  <div className="w-2 h-2 rounded-full bg-[#D97A2B] mt-2 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/70">
                      <span className="font-medium text-white">{a.user_name}</span> {a.action} <span className="text-[#E9A64E]">{a.entity_name}</span>
                    </p>
                    <p className="text-xs text-white/30 mt-0.5">{formatDate(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
