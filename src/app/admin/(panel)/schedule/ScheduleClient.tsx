"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDate, buildGoogleCalendarTemplateUrl } from "@/lib/admin/format";
import { buildCalendarIcs } from "@/lib/admin/ics";
import { createClient } from "@/utils/supabase/client";

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  project_id: string | null;
  assigned_to: number | null;
  project_name: string | null;
  project_status: string | null;
  assigned_name: string | null;
  gcal_event_id: string | null;
};

type Project = { id: string; name: string; status: string };
type Member = { id: number; name: string; role: string; status: string };

type Props = {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  isAdmin: boolean;
  icsConfigured: boolean;
  oauthConfigured: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
  embedUrl?: string;
  calendarEmail?: string;
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-500/10 text-gray-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  high: "bg-red-500/10 text-red-400",
};

const statusColor: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400",
  active: "bg-blue-500/10 text-blue-400",
  completed: "bg-emerald-500/10 text-emerald-400",
};

const emptyForm = {
  title: "",
  description: "",
  due_date: "",
  priority: "medium",
  project_id: "",
  assigned_to: "",
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

export default function ScheduleClient({ tasks, projects, members, isAdmin, icsConfigured, oauthConfigured, googleConnected, googleEmail, embedUrl, calendarEmail }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Auto-sync: tarik event dari Google Calendar (ICS) tiap ~60 dtk.
  // Jeda saat tab tidak aktif untuk hemat resource.
  const refresh = useCallback(() => { router.refresh(); }, [router]);
  const autoSync = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/google/sync");
      if (res.ok) {
        setLastSynced(new Date());
        refresh();
      }
    } catch {
      // silent — jangan spam error kalau network flaky
    }
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") autoSync();
    }, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") autoSync(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [autoSync]);

  // Realtime antar-sesi: setiap perubahan tasks di DB (dari admin lain)
  // langsung refresh data halaman.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-schedule-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  const filtered = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description ?? "",
      due_date: t.due_date ?? "",
      priority: t.priority,
      project_id: t.project_id ?? "",
      assigned_to: t.assigned_to ? String(t.assigned_to) : "",
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) { showError("Judul tugas wajib diisi."); return; }

    setSaving(true);
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId ?? undefined,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
        project_id: form.project_id || null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok || !data.ok) {
      showError(data.error ?? (editingId ? "Gagal memperbarui tugas." : "Gagal membuat tugas."));
      return;
    }

    setShowForm(false);
    const taskId = String(data.id ?? editingId);
    if (googleConnected && form.due_date && !editingId) {
      const synced = await syncToGoogle(taskId, { quiet: true });
      showSuccess(
        synced
          ? "Tugas ditambahkan & masuk Google Calendar."
          : "Tugas ditambahkan, tapi gagal masuk Google Calendar. Coba tombol Sync pada tugas."
      );
    } else {
      showSuccess(editingId ? "Tugas diperbarui." : "Tugas ditambahkan.");
    }
    router.refresh();
  }

  async function syncToGoogle(taskId: string, opts?: { quiet?: boolean }): Promise<boolean> {
    setSyncing(taskId);
    if (!opts?.quiet) setError(null);
    try {
      const res = await fetch("/api/admin/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      setSyncing(null);
      if (!res.ok) {
        if (!opts?.quiet) showError(data.error ?? "Gagal sinkronisasi ke Google Calendar.");
        return false;
      }
      if (!opts?.quiet) {
        showSuccess("Tugas disinkronkan ke Google Calendar.");
        router.refresh();
      }
      return true;
    } catch {
      setSyncing(null);
      if (!opts?.quiet) showError("Gagal sinkronisasi ke Google Calendar.");
      return false;
    }
  }

  async function connectGoogle() {
    setError(null);
    window.location.href = "/api/admin/google/auth";
  }

  async function disconnectGoogle() {
    if (!confirm("Putuskan koneksi Google Calendar? Tugas yang sudah disinkron tetap tersimpan.")) return;
    const res = await fetch("/api/admin/google/disconnect", { method: "POST" });
    if (!res.ok) { showError("Gagal memutuskan koneksi."); return; }
    showSuccess("Koneksi Google Calendar diputuskan.");
    router.refresh();
  }

  async function remove(t: Task) {
    if (!confirm(`Hapus tugas "${t.title}"?`)) return;
    const res = await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal menghapus: " + (data.error ?? "unknown")); return; }
    showSuccess("Tugas dihapus.");
    router.refresh();
  }

  async function setStatus(t: Task, status: string) {
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, status }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { showError("Gagal update status: " + (data.error ?? "unknown")); return; }
    router.refresh();
  }

  async function importFromCalendar() {
    setImporting(true);
    setError(null);
    const res = await fetch("/api/admin/google/sync");
    const data = await res.json();
    setImporting(false);
    if (!res.ok || !data.ok) { showError(data.error ?? "Gagal mengambil event."); return; }
    setLastSynced(new Date());
    showSuccess(`${data.total} event diambil dari Google Calendar (${data.inserted} baru, ${data.updated} diperbarui).`);
    router.refresh();
  }

  function downloadIcs() {
    const ics = buildCalendarIcs(
      tasks
        .filter((t) => t.due_date)
        .map((t) => ({
          title: t.title,
          description: t.description ?? "",
          startAt: t.due_date,
        }))
    );
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "baciraro-schedule.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Jadwal & Tugas</h1>
          <p className="text-white/50 mt-1">Jadwal project dan tugas anggota dengan tenggat waktu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {icsConfigured && (
            <button onClick={importFromCalendar} disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition disabled:opacity-60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              {importing ? "Mengambil..." : "Ambil dari Kalender"}
            </button>
          )}
          {icsConfigured && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/5 bg-white/5 text-xs text-white/40"
              title="Sinkronisasi otomatis dengan Google Calendar tiap 60 detik"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              Auto-sync
              {lastSynced && (
                <span className="hidden sm:inline text-white/30">· {formatDate(lastSynced)} {lastSynced.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </span>
          )}
          {oauthConfigured && isAdmin && (
            googleConnected ? (
              <button onClick={disconnectGoogle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition"
                title={googleEmail ?? undefined}>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Google terhubung
                {googleEmail && <span className="hidden md:inline text-emerald-400/70">({googleEmail})</span>}
              </button>
            ) : (
              <button onClick={connectGoogle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Hubungkan Google Calendar
              </button>
            )
          )}
          {tasks.some((t) => t.due_date) && (
            <button onClick={downloadIcs}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-white/70 text-sm font-medium hover:bg-white/5 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Unduh .ics
            </button>
          )}
          {isAdmin && (
            <button onClick={() => (showForm ? setShowForm(false) : openCreate())}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? "Tutup" : "Tambah Tugas"}
            </button>
          )}
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
          <h2 className="font-semibold text-white">{editingId ? "Ubah Tugas" : "Tambah Tugas"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white/70 mb-1">Judul *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="mis. Revisi desain landing page" className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-white/70 mb-1">Deskripsi</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detail tugas..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Tenggat</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Prioritas</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={selectCls}>
                <option value="low">Rendah</option>
                <option value="medium">Sedang</option>
                <option value="high">Tinggi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Project</label>
              <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className={selectCls}>
                <option value="">Tidak ada</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Penanggung Jawab</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className={selectCls}>
                <option value="">Tidak ada</option>
                {members.filter((m) => m.status === "active").map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
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
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Tugas"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "pending", "active", "completed"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              statusFilter === s
                ? "bg-[#D97A2B] text-white"
                : "border border-white/10 text-white/50 hover:bg-white/5"
            }`}>
            {s === "all" ? "Semua" : s === "pending" ? "Menunggu" : s === "active" ? "Berjalan" : "Selesai"}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-12 text-center text-white/40">
              <p className="text-lg font-medium mb-1">Tidak ada tugas</p>
              <p className="text-sm">Tambahkan tugas baru atau ubah filter status.</p>
            </div>
          ) : (
            filtered.map((t) => {
              const assigned = t.assigned_to ? memberMap.get(t.assigned_to) : null;
              const project = t.project_id ? projectMap.get(t.project_id) : null;
              const templateUrl = buildGoogleCalendarTemplateUrl({
                title: t.title,
                description: t.description ?? "",
                startAt: t.due_date ?? new Date().toISOString().slice(0, 10),
                calendarEmail,
              });
              return (
                <div key={t.id} className="bg-[#151515] rounded-xl border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-0.5">
                      {t.status === "completed" ? (
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <button onClick={() => setStatus(t, "completed")} className="group" aria-label="Tandai selesai">
                          <svg className="w-5 h-5 text-white/25 group-hover:text-emerald-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                      {t.status === "pending" && (
                        <button onClick={() => setStatus(t, "active")} className="group" aria-label="Mulai">
                          <svg className="w-5 h-5 text-white/25 group-hover:text-blue-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${t.status === "completed" ? "text-white/40 line-through" : "text-white"}`}>{t.title}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-white/50">
                        {t.due_date && <span className="inline-flex items-center gap-1">📅 {formatDate(t.due_date)}</span>}
                        {project && <span className="inline-flex items-center gap-1">📁 {project.name}</span>}
                        {assigned && <span className="inline-flex items-center gap-1">👤 {assigned.name}</span>}
                      </div>
                      {t.description && <p className="text-sm text-white/40 mt-1.5">{t.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityColor[t.priority] ?? priorityColor.medium}`}>
                          {t.priority === "high" ? "Tinggi" : t.priority === "low" ? "Rendah" : "Sedang"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor[t.status] ?? statusColor.pending}`}>
                          {t.status === "completed" ? "Selesai" : t.status === "active" ? "Berjalan" : "Menunggu"}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          {googleConnected && t.due_date && !t.gcal_event_id && (
                            <button onClick={() => syncToGoogle(t.id)} disabled={syncing === t.id}
                              className="px-2 py-1 rounded text-[11px] font-medium text-white/50 hover:text-[#E9A64E] border border-white/10 hover:border-[#E9A64E]/40 transition disabled:opacity-50"
                              title="Sinkronkan ke Google Calendar">
                              {syncing === t.id ? "..." : "Sync"}
                            </button>
                          )}
                          {t.gcal_event_id && (
                            <span className="text-emerald-400/80 text-xs" title="Tersinkron ke Google Calendar">✓</span>
                          )}
                          <a href={templateUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Kalender" title="Buka di Google Calendar">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </a>
                          <button onClick={() => openEdit(t)} className="p-1.5 text-white/30 hover:text-[#E9A64E] transition" aria-label="Ubah">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => remove(t)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {embedUrl && (
          <div className="space-y-4">
            <div className="bg-[#151515] rounded-xl border border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <p className="font-medium text-white text-sm">Kalender</p>
                <div className="flex items-center gap-2">
                  {tasks.some((t) => t.due_date) && (
                    <button onClick={downloadIcs}
                      className="text-xs px-2.5 py-1 rounded border border-white/10 text-white/60 hover:bg-white/5 transition">
                      .ics
                    </button>
                  )}
                  {calendarEmail && (
                    <span className="text-xs text-white/40">{calendarEmail}</span>
                  )}
                </div>
              </div>
              <iframe src={embedUrl} className="w-full h-[600px]" title="Google Calendar" loading="lazy" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
