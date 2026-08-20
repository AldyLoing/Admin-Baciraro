"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDate, calculateDistribution, KAS_PERCENT } from "@/lib/admin/format";

type Payout = {
  id: string;
  project_id: string | null;
  project_name: string;
  date: string;
  total_amount: number;
  orders_fee: number;
  net_amount: number;
  status: "pending" | "processing" | "paid";
  finalized_at: string | null;
  created_at: string;
};

type PayoutMember = {
  id: string;
  payout_id: string;
  member_id: string | null;
  name: string;
  contribution_percent: number;
  amount: number;
  tugas: string | null;
};

type Project = { id: string; name: string; status: string; total_value: number; client_name: string | null };
type ProjectMember = { id: string; project_id: string; member_id: number | null; contribution_percent: number; member_name: string; tugas: string | null };
type AllMember = { id: number; name: string; role: string; status: string };
type FormMember = { key: string; member_id: number | null; member_name: string; contribution_percent: number; tugas: string };

type Props = {
  payouts: Payout[];
  payoutMembers: PayoutMember[];
  projects: Project[];
  projectMembers: ProjectMember[];
  allMembers: AllMember[];
  isAdmin: boolean;
  preselectProjectId?: string | null;
};

const statusLabel: Record<string, string> = { pending: "Menunggu", processing: "Diproses", paid: "Dibayar" };
const statusColor: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400",
  processing: "bg-blue-500/10 text-blue-400",
  paid: "bg-emerald-500/10 text-emerald-400",
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

export default function PayoutsClient({
  payouts,
  payoutMembers,
  projects,
  projectMembers,
  allMembers,
  isAdmin,
  preselectProjectId,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(payouts);
  const [members, setMembers] = useState(payoutMembers);
  const [filter, setFilter] = useState<"all" | "pending" | "processing" | "paid">("all");
  const [showForm, setShowForm] = useState(Boolean(preselectProjectId));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ project_id: preselectProjectId ?? "", date: new Date().toISOString().slice(0, 10) });
  const [formMembers, setFormMembers] = useState<FormMember[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finalizeDrafts, setFinalizeDrafts] = useState<Record<string, string>>({});
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  const membersByPayout = useMemo(() => {
    const map = new Map<string, PayoutMember[]>();
    for (const m of members) {
      const arr = map.get(m.payout_id) ?? [];
      arr.push(m);
      map.set(m.payout_id, arr);
    }
    return map;
  }, [members]);

  const filtered = rows.filter((p) => filter === "all" || p.status === filter);

  const totalNet = rows.reduce((s, p) => s + p.net_amount, 0);
  const totalPaid = rows.filter((p) => p.status === "paid").reduce((s, p) => s + p.net_amount, 0);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === form.project_id) ?? null,
    [form.project_id, projects]
  );

  function selectProject(projectId: string) {
    setForm({ ...form, project_id: projectId });
    const prefill = projectMembers
      .filter((pm) => pm.project_id === projectId)
      .map((pm) => ({
        key: `pm-${pm.id}`,
        member_id: pm.member_id,
        member_name: pm.member_name,
        contribution_percent: pm.contribution_percent,
        tugas: pm.tugas ?? "",
      }));
    setFormMembers(prefill);
  }

  const availableNewMembers = allMembers.filter(
    (m) => !formMembers.some((fm) => fm.member_id === m.id)
  );

  function addMemberRow() {
    if (!newMemberId) { showError("Pilih anggota terlebih dahulu."); return; }
    const member = allMembers.find((m) => m.id === Number(newMemberId));
    if (!member) return;
    const share = formMembers.length === 0
      ? 100
      : Number((100 / (formMembers.length + 1)).toFixed(2));
    setFormMembers((prev) => [
      ...prev.map((fm) => ({ ...fm, contribution_percent: Number((100 / (prev.length + 1)).toFixed(2)) })),
      { key: `add-${Date.now()}`, member_id: member.id, member_name: member.name, contribution_percent: share, tugas: "" },
    ]);
    setNewMemberId("");
    setError(null);
  }

  function updateMemberPercent(key: string, percent: number) {
    setFormMembers((prev) =>
      prev.map((fm) => (fm.key === key ? { ...fm, contribution_percent: percent } : fm))
    );
  }

  function updateMemberTugas(key: string, tugas: string) {
    setFormMembers((prev) => prev.map((fm) => (fm.key === key ? { ...fm, tugas } : fm)));
  }

  function removeMemberRow(key: string) {
    setFormMembers((prev) => prev.filter((fm) => fm.key !== key));
  }

  const formTotalPercent = formMembers.reduce((s, fm) => s + fm.contribution_percent, 0);

  const preview = useMemo(() => {
    if (!selectedProject) return null;
    const contribs = formMembers.map((fm) => ({ percent: fm.contribution_percent }));
    return calculateDistribution(selectedProject.total_value, contribs);
  }, [selectedProject, formMembers]);

  const eligibleProjects = projects.filter((p) => p.status === "completed" || p.status === "paid");

  async function createPayout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.project_id || !form.date) {
      showError("Pilih project dan tanggal payout.");
      return;
    }
    if (formMembers.length > 0 && Math.round(formTotalPercent) !== 100) {
      showError(`Total kontribusi harus 100% (sekarang ${formTotalPercent.toFixed(2)}%).`);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: form.project_id,
        date: form.date,
        members: formMembers.map((fm) => ({
          member_id: fm.member_id,
          name: fm.member_name,
          contribution_percent: fm.contribution_percent,
          tugas: fm.tugas.trim() || undefined,
        })),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok || !data.ok) {
      showError(data.error ?? "Gagal membuat payout.");
      return;
    }

    setShowForm(false);
    setForm({ project_id: "", date: new Date().toISOString().slice(0, 10) });
    setFormMembers([]);
    showSuccess(data.message ?? `Payout untuk "${selectedProject!.name}" dibuat.`);
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch("/api/admin/payouts/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showError("Gagal update status: " + (data.error ?? "unknown"));
        return;
      }
      setRows((prev) => prev.map((p) => (p.id === id ? { ...p, status: status as Payout["status"] } : p)));
      showSuccess(data.message ?? `Status payout diperbarui menjadi "${statusLabel[status]}".`);
    } catch (err) {
      showError("Gagal update status: " + (err instanceof Error ? err.message : "unknown"));
    }
    router.refresh();
  }

  async function removePayout(id: string) {
    if (!confirm("Hapus payout ini? Rincian per member ikut terhapus.")) return;
    const res = await fetch("/api/admin/payouts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    setRows((prev) => prev.filter((p) => p.id !== id));
    setMembers((prev) => prev.filter((m) => m.payout_id !== id));
    showSuccess("Payout dihapus.");
    router.refresh();
  }

  async function finalizePayout(p: Payout) {
    const actual = Number(finalizeDrafts[p.id]);
    if (finalizeDrafts[p.id] === undefined || finalizeDrafts[p.id] === "" || isNaN(actual) || actual < 0) {
      showError("Isi total riil pendapatan dulu.");
      return;
    }
    setFinalizingId(p.id);
    setError(null);
    const res = await fetch("/api/admin/payouts/finalize", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, actual_total: actual }),
    });
    const data = await res.json();
    setFinalizingId(null);
    if (!res.ok || !data.ok) {
      showError("Gagal menyimpan total riil: " + (data.error ?? "unknown"));
      return;
    }

    const contribs = (membersByPayout.get(p.id) ?? []).map((m) => ({ percent: m.contribution_percent }));
    const dist = calculateDistribution(actual, contribs);
    const memberAmounts = (membersByPayout.get(p.id) ?? []).map((m) => {
      const amount = dist.totalPercent > 0 ? (dist.distributable * m.contribution_percent) / dist.totalPercent : 0;
      return { id: m.id, amount: Number(amount.toFixed(2)) };
    });

    setRows((prev) =>
      prev.map((r) =>
        r.id === p.id
          ? {
              ...r,
              total_amount: Number(dist.total.toFixed(2)),
              orders_fee: Number(dist.kasAmount.toFixed(2)),
              net_amount: Number(dist.distributable.toFixed(2)),
              finalized_at: new Date().toISOString(),
            }
          : r
      )
    );
    setMembers((prev) =>
      prev.map((m) => {
        const upd = memberAmounts.find((ma) => ma.id === m.id);
        return upd ? { ...m, amount: upd.amount } : m;
      })
    );
    setFinalizeDrafts((prev) => ({ ...prev, [p.id]: "" }));
    showSuccess(data.message ?? "Total riil disimpan.");
    router.refresh();
  }

  function exportCsv() {
    const header = ["Tanggal", "Project", "Total (Rp)", "Fee Baciraro (Rp)", "Net (Rp)", "Status", "Rincian Member"];
    const lines = filtered.map((p) => {
      const ms = (membersByPayout.get(p.id) ?? [])
        .map((m) => `${m.name} (${m.contribution_percent}%${m.tugas ? ` - ${m.tugas}` : ""}) ${formatRupiah(m.amount)}`)
        .join("; ");
      return [
        p.date,
        `"${p.project_name.replace(/"/g, '""')}"`,
        p.total_amount,
        p.orders_fee,
        p.net_amount,
        statusLabel[p.status],
        `"${ms.replace(/"/g, '""')}"`,
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-baciraro.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Payouts</h1>
          <p className="text-white/50 mt-1">
            Pencairan dana project ke anggota ({KAS_PERCENT}% fee Baciraro otomatis).
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          {isAdmin && (
            <button
              onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? "Tutup" : "Buat Payout"}
            </button>
          )}
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold text-white">Laporan Payout Baciraro</h1>
        <p className="text-sm text-white/50">Dicetak {new Intl.DateTimeFormat("id-ID").format(new Date())}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 print:hidden">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Payout</p>
          <p className="text-xl font-bold text-white mt-1">{formatRupiah(totalNet)}</p>
          <p className="text-xs text-white/40 mt-1">net setelah fee Baciraro</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Sudah Dibayar</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatRupiah(totalPaid)}</p>
          <p className="text-xs text-white/40 mt-1">payout berstatus Dibayar</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Belum Dibayar</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{formatRupiah(totalNet - totalPaid)}</p>
          <p className="text-xs text-white/40 mt-1">pending + diproses</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 print:hidden">{error}</div>
      )}
      {success && (
        <div className="mb-6 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 print:hidden">{success}</div>
      )}

      {showForm && isAdmin && (
        <form onSubmit={createPayout} className="bg-[#151515] rounded-xl border border-white/10 p-6 mb-6 space-y-4 print:hidden">
          <h2 className="font-semibold text-white">Buat Payout dari Project</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Project *</label>
              <select value={form.project_id} onChange={(e) => selectProject(e.target.value)}
                className={selectCls}>
                <option value="">Pilih project (selesai / dibayar)...</option>
                {eligibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Tanggal Payout *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputCls} />
            </div>
          </div>

          {selectedProject && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white/70">
                  Anggota Penerima <span className="text-white/40">(prefill dari project, bisa diubah)</span>
                </label>
              </div>

              {formMembers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formMembers.map((fm) => (
                    <div key={fm.key} className="flex flex-col gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white">{fm.member_name}</p>
                          <p className="text-xs text-white/40">nominal menyusul (dihitung dari total riil)</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" min="0" max="100" step="0.01" value={fm.contribution_percent}
                            onChange={(e) => updateMemberPercent(fm.key, Number(e.target.value))}
                            className="w-24 px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white text-right focus:border-[#D97A2B] outline-none transition" />
                          <span className="text-white/50 text-sm">%</span>
                        </div>
                        <button type="button" onClick={() => removeMemberRow(fm.key)}
                          className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={fm.tugas}
                        onChange={(e) => updateMemberTugas(fm.key, e.target.value)}
                        placeholder="Tugas / peran (mis. cetak 3D, editing, pemasaran)..."
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium bg-[#D97A2B]/10 text-[#E9A64E]">
                    <span>Total kontribusi</span>
                    <span>{formTotalPercent.toFixed(2)}% {Math.round(formTotalPercent) === 100 ? "✓" : "(harus 100%)"}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} className={selectCls + " flex-1"}>
                  <option value="">Tambah anggota lain...</option>
                  {availableNewMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
                  ))}
                </select>
                <button type="button" onClick={addMemberRow}
                  className="px-4 py-2.5 rounded-lg border border-[#D97A2B]/40 text-[#E9A64E] text-sm font-medium hover:bg-[#D97A2B]/10 transition">
                  Tambah
                </button>
              </div>
            </div>
          )}

          {preview && (
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-sm font-semibold text-white mb-2">Ringkasan (estimasi dari nilai project — nominal riil diisi setelah payout dibuat)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-white/50">Nilai Project</p>
                  <p className="font-semibold text-white">{formatRupiah(preview.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Fee Baciraro ({KAS_PERCENT}%)</p>
                  <p className="font-semibold text-[#E9A64E]">{formatRupiah(preview.kasAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50">Net untuk Member</p>
                  <p className="font-semibold text-emerald-400">{formatRupiah(preview.distributable)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#D97A2B] text-white font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2">
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v0a8 8 0 018 8" />
                </svg>
              )}
              {saving ? "Menyimpan..." : "Simpan Payout"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-6 print:hidden">
        {(["all", "pending", "processing", "paid"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white" : "bg-[#151515] border border-white/10 text-white/60 hover:bg-white/5"}`}>
            {f === "all" ? "Semua" : statusLabel[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40 print:hidden">
          <p className="text-lg font-medium mb-1">Belum ada payout</p>
          <p className="text-sm">Buat payout dari project yang selesai atau dibayar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const ms = membersByPayout.get(p.id) ?? [];
            const isOpen = !!expanded[p.id];
            return (
              <div key={p.id} className="bg-[#151515] rounded-xl border border-white/10">
                <div className="flex items-center gap-4 p-4">
                  <button onClick={() => toggleExpand(p.id)} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition print:hidden" aria-label="Rincian">
                    <svg className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white truncate">{p.project_name}</p>
                    <p className="text-xs text-white/50">{formatDate(p.date)} · {ms.length} member</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-xs text-white/40">Total {formatRupiah(p.total_amount)}</p>
                    <p className="text-xs text-[#E9A64E]">Fee {formatRupiah(p.orders_fee)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-400">{formatRupiah(p.net_amount)}</p>
                    <span className="inline-flex items-center gap-1.5">
                      {!p.finalized_at && p.status !== "paid" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 text-white/40">
                          belum diisi nominal
                        </span>
                      )}
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 print:hidden">
                    {isAdmin && p.status === "pending" && (
                      <button onClick={() => updateStatus(p.id, "processing")}
                        className="px-3 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/10 transition">
                        Diproses
                      </button>
                    )}
                    {isAdmin && p.status === "processing" && (
                      <button onClick={() => updateStatus(p.id, "paid")}
                        className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/10 transition">
                        Tandai Dibayar
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => removePayout(p.id)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-3">
                    {!p.finalized_at && p.status !== "paid" && (
                      <div className="rounded-lg border border-[#D97A2B]/30 bg-[#D97A2B]/5 p-3">
                        <p className="text-sm font-medium text-[#E9A64E] mb-2">Isi Total Riil Pendapatan</p>
                        <p className="text-xs text-white/40 mb-2">
                          Persen sudah dikunci dari awal. Masukkan total pendapatan riil (mis. dari barang terjual),
                          otomatis dibagi ke tiap anggota sesuai persen.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="number"
                            min="0"
                            value={finalizeDrafts[p.id] ?? ""}
                            onChange={(e) => setFinalizeDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="Total riil (Rp)"
                            className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition"
                          />
                          <button
                            onClick={() => finalizePayout(p)}
                            disabled={finalizingId === p.id}
                            className="px-4 py-2 rounded-lg bg-[#D97A2B] text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {finalizingId === p.id ? "Menyimpan..." : "Hitung & Simpan"}
                          </button>
                        </div>
                        {(() => {
                          const raw = finalizeDrafts[p.id];
                          const actual = Number(raw);
                          if (raw === undefined || raw === "" || isNaN(actual) || actual < 0) return null;
                          const dist = calculateDistribution(actual, ms.map((m) => ({ percent: m.contribution_percent })));
                          return (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                              <div>
                                <p className="text-xs text-white/50">Fee Baciraro (10%)</p>
                                <p className="font-semibold text-[#E9A64E]">{formatRupiah(dist.kasAmount)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-white/50">Net untuk Member</p>
                                <p className="font-semibold text-emerald-400">{formatRupiah(dist.distributable)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-white/50">Total Riil</p>
                                <p className="font-semibold text-white">{formatRupiah(dist.total)}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {ms.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-white/50 border-b border-white/10">
                            <th className="py-2 pr-3 font-medium">Anggota</th>
                            <th className="py-2 pr-3 font-medium">Tugas</th>
                            <th className="py-2 pr-3 font-medium text-right">Kontribusi</th>
                            <th className="py-2 font-medium text-right">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ms.map((m) => (
                            <tr key={m.id} className="border-b border-white/5">
                              <td className="py-2 pr-3 font-medium text-white">{m.name}</td>
                              <td className="py-2 pr-3 text-white/40">
                                {m.tugas ? m.tugas : <span className="text-white/25">-</span>}
                              </td>
                              <td className="py-2 pr-3 text-right text-white/50">{m.contribution_percent}%</td>
                              <td className="py-2 text-right font-semibold text-emerald-400">
                                {p.finalized_at ? formatRupiah(m.amount) : <span className="text-white/30 font-normal">belum diisi</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-white/40 text-center py-2">Tidak ada rincian member.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
