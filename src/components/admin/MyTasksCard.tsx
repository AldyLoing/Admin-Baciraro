"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { confirmDialog, toast } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export type MyTaskStatus = "pending" | "active" | "completed";
export type MyTask = { id: number; title: string; status: MyTaskStatus; dueDate: string | null };
export type MyTaskGroup = { projectId: number; projectName: string; tasks: MyTask[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MAX_ROWS = 8;

function isoLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1] ?? ""}`;
}

type Tone = "late" | "today" | "soon" | "normal";

function dueInfo(due: string | null, today: string | null, tomorrow: string | null): { text: string; tone: Tone } | null {
  if (!due) return null;
  const d = due.slice(0, 10);
  if (today && d < today) {
    const days = Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    return { text: `Lewat ${days} hari`, tone: "late" };
  }
  if (today && d === today) return { text: "Hari ini", tone: "today" };
  if (tomorrow && d === tomorrow) return { text: "Besok", tone: "soon" };
  return { text: formatDate(d), tone: "normal" };
}

const dueClass: Record<Tone, string> = {
  late: "text-bad",
  today: "bg-[#2b220c] text-warn px-2 py-0.5 rounded-full",
  soon: "text-ink-2",
  normal: "text-ink-3",
};

export default function MyTasksCard({ groups }: { groups: MyTaskGroup[] }) {
  const router = useRouter();

  // Status terkini per tugas (optimistis) + status "belum selesai" asal, untuk dikembalikan saat dibatalkan.
  const [statusById, setStatusById] = useState<Record<number, MyTaskStatus>>(() => {
    const o: Record<number, MyTaskStatus> = {};
    for (const g of groups) for (const t of g.tasks) o[t.id] = t.status;
    return o;
  });
  const openStatus = useMemo(() => {
    const o: Record<number, "pending" | "active"> = {};
    for (const g of groups) for (const t of g.tasks) o[t.id] = t.status === "pending" ? "pending" : "active";
    return o;
  }, [groups]);

  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<{ id: number; title: string; projectId: number } | null>(null);

  // Tanggal "hari ini" dihitung setelah mount agar tidak beda antara server (UTC) dan browser.
  const [today, setToday] = useState<string | null>(null);
  const [tomorrow, setTomorrow] = useState<string | null>(null);
  useEffect(() => {
    const now = new Date();
    // Sengaja di effect: tanggal browser baru diketahui setelah mount (hindari hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(isoLocal(now));
    setTomorrow(isoLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)));
  }, []);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 1500);
  }

  async function change(task: MyTask, projectId: number, checked: boolean) {
    if (busy.has(task.id)) return;
    const prev = statusById[task.id];
    const next: MyTaskStatus = checked ? "completed" : openStatus[task.id] ?? "active";
    setStatusById((s) => ({ ...s, [task.id]: next }));
    setBusy((b) => new Set(b).add(task.id));
    try {
      const res = await fetch("/api/admin/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Gagal memperbarui tugas.");
      setLast(checked ? { id: task.id, title: task.title, projectId } : null);
      scheduleRefresh();
    } catch (e) {
      setStatusById((s) => ({ ...s, [task.id]: prev }));
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui tugas.");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(task.id);
        return n;
      });
    }
  }

  const view = groups.map((g) => {
    const done = g.tasks.filter((t) => statusById[t.id] === "completed").length;
    const open = g.tasks.filter((t) => statusById[t.id] !== "completed");
    const closed = g.tasks.filter((t) => statusById[t.id] === "completed");
    const ordered = [...open, ...closed];
    return { g, done, total: g.tasks.length, shown: ordered.slice(0, MAX_ROWS), hidden: Math.max(0, ordered.length - MAX_ROWS) };
  });

  const total = view.reduce((s, v) => s + v.total, 0);
  const done = view.reduce((s, v) => s + v.done, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const lateTasks = today
    ? groups.flatMap((g) =>
        g.tasks.filter((t) => statusById[t.id] !== "completed" && t.dueDate && t.dueDate.slice(0, 10) < today)
      )
    : [];
  const lateCount = lateTasks.length;
  const [bulkBusy, setBulkBusy] = useState(false);

  async function completeAllLate() {
    if (bulkBusy || lateTasks.length === 0) return;
    const ok = await confirmDialog({
      title: `Tandai ${lateTasks.length} tugas selesai?`,
      message: `${lateTasks.length} tugas yang sudah lewat tenggat akan ditandai selesai. Gunakan ini jika tugas-tugas tersebut sebenarnya sudah dikerjakan tetapi lupa dicentang.`,
      confirmLabel: "Tandai selesai",
    });
    if (!ok) return;
    setBulkBusy(true);
    const ids = lateTasks.map((t) => t.id);
    setBusy((b) => new Set([...b, ...ids]));
    let failed = 0;
    let firstError = "";
    for (const id of ids) {
      try {
        const res = await fetch("/api/admin/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: "completed" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Gagal memperbarui tugas.");
        setStatusById((st) => ({ ...st, [id]: "completed" }));
      } catch (e) {
        failed++;
        if (!firstError) firstError = e instanceof Error ? e.message : "Gagal memperbarui tugas.";
      }
    }
    setBusy((b) => {
      const n = new Set(b);
      ids.forEach((id) => n.delete(id));
      return n;
    });
    setBulkBusy(false);
    setLast(null);
    if (failed === 0) toast.success(`${ids.length} tugas ditandai selesai.`);
    else toast.error(`${ids.length - failed} berhasil, ${failed} gagal: ${firstError}`);
    scheduleRefresh();
  }
  const lastGroup = last ? view.find((v) => v.g.projectId === last.projectId) : null;
  const lastAllDone = !!lastGroup && lastGroup.done === lastGroup.total;
  const lastTask = last ? groups.flatMap((g) => g.tasks).find((t) => t.id === last.id) : null;

  return (
    <Card aria-labelledby="mytasks-title" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <h2 id="mytasks-title" className="text-base font-bold text-ink">
            Tugas saya di project berjalan
          </h2>
          <p className="text-[13px] text-ink-3">Centang tugas yang sudah selesai — progres project ikut berubah.</p>
        </div>
        {lateCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge tone="red">{lateCount} terlambat</Badge>
            <Button variant="secondary" size="sm" onClick={completeAllLate} disabled={bulkBusy}>
              {bulkBusy ? "Memproses…" : "Tandai semua selesai"}
            </Button>
          </div>
        )}
        {total > 0 && (
          <div className="ml-auto flex min-w-[220px] flex-1 items-center gap-3 sm:max-w-xs sm:flex-none">
            <span className="whitespace-nowrap text-sm font-bold text-brand-ink">
              {done} dari {total} selesai
            </span>
            <div
              role="progressbar"
              aria-label="Progres tugas saya"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]"
            >
              <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <Link href="/admin/schedule" className="whitespace-nowrap text-[13px] font-semibold text-brand-ink hover:underline">
          Buka Jadwal &amp; Tugas
        </Link>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-line-2 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">Tidak ada tugas untuk Anda di project berjalan.</p>
          <p className="mt-1 text-[13px] text-ink-3">Tugas yang ditugaskan kepada Anda akan muncul di sini.</p>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
          {view.map(({ g, done: gd, total: gt, shown, hidden }) => {
            const all = gd === gt;
            return (
              <div key={g.projectId} className="rounded-xl border border-line bg-[#17171a] px-2.5 pb-2 pt-3">
                <div className="flex items-center gap-2.5 px-2">
                  <Link
                    href={`/admin/projects/${g.projectId}`}
                    className="min-w-0 flex-1 truncate text-sm font-bold text-ink hover:text-brand-ink"
                  >
                    {g.projectName}
                  </Link>
                  {all && <Badge tone="green">Semua selesai</Badge>}
                  <span className="text-xs font-semibold text-ink-2">
                    {gd} / {gt}
                  </span>
                </div>
                <div className="mx-2 mb-1 mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", all ? "bg-ok" : "bg-brand")}
                    style={{ width: `${gt ? (gd / gt) * 100 : 0}%` }}
                  />
                </div>
                <ul>
                  {shown.map((t) => {
                    const checked = statusById[t.id] === "completed";
                    const info = checked ? null : dueInfo(t.dueDate, today, tomorrow);
                    return (
                      <li key={t.id}>
                        <label
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/[0.04]",
                            busy.has(t.id) && "opacity-60"
                          )}
                        >
                          <span className="relative flex h-5 w-5 shrink-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy.has(t.id)}
                              onChange={(e) => change(t, g.projectId, e.target.checked)}
                              className="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-[#52525b] bg-field transition checked:border-brand checked:bg-brand hover:border-brand-ink"
                            />
                            <Icon
                              name="check"
                              strokeWidth={3}
                              className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-on-brand opacity-0 peer-checked:opacity-100"
                            />
                          </span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-sm",
                              checked ? "text-ink-3 line-through" : "font-medium text-ink"
                            )}
                          >
                            {t.title}
                          </span>
                          {info && (
                            <span className={cn("shrink-0 whitespace-nowrap text-xs font-semibold", dueClass[info.tone])}>
                              {info.text}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {hidden > 0 && (
                  <Link
                    href="/admin/schedule"
                    className="mt-1 block px-2 py-1.5 text-xs font-semibold text-brand-ink hover:underline"
                  >
                    +{hidden} tugas lainnya
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {last && lastTask && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[10px] border border-[#1c4a2e] bg-[#0f2a1a] px-3.5 py-2.5 text-sm"
        >
          <span className="flex text-ok">
            <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <span className="flex-1 text-ink">
            Selesai: {last.title}
            {lastAllDone ? " — semua tugas Anda di project ini sudah selesai." : ""}
          </span>
          <Button variant="secondary" size="sm" onClick={() => change(lastTask, last.projectId, false)}>
            Urungkan
          </Button>
        </div>
      )}
    </Card>
  );
}
