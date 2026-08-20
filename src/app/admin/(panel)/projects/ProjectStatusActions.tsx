"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  currentStatus: string;
  isAdmin: boolean;
};

export default function ProjectStatusActions({ projectId, currentStatus, isAdmin }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  async function changeStatus(nextStatus: string) {
    setUpdating(true);
    setError(null);
    const res = await fetch("/api/admin/projects/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: projectId, status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError("Gagal ubah status: " + (data.error ?? "unknown"));
      setUpdating(false);
      return;
    }
    setUpdating(false);
    router.refresh();
  }

  const btnBase =
    "px-2.5 py-1 rounded-lg text-xs font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <div className="inline-flex gap-1.5">
        {currentStatus === "active" && (
          <>
            <button
              onClick={() => changeStatus("completed")}
              disabled={updating}
              className={`${btnBase} border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10`}
            >
              Tandai Selesai
            </button>
            <button
              onClick={() => changeStatus("paid")}
              disabled={updating}
              className={`${btnBase} border-green-500/40 text-green-400 hover:bg-green-500/10`}
            >
              Tandai Dibayar
            </button>
          </>
        )}
        {currentStatus === "completed" && (
          <>
            <button
              onClick={() => changeStatus("paid")}
              disabled={updating}
              className={`${btnBase} border-green-500/40 text-green-400 hover:bg-green-500/10`}
            >
              Tandai Dibayar
            </button>
            <button
              onClick={() => changeStatus("active")}
              disabled={updating}
              className={`${btnBase} border-white/10 text-white/50 hover:bg-white/5`}
            >
              Aktifkan
            </button>
          </>
        )}
        {currentStatus === "paid" && (
          <button
            onClick={() => changeStatus("active")}
            disabled={updating}
            className={`${btnBase} border-white/10 text-white/50 hover:bg-white/5`}
          >
            Aktifkan
          </button>
        )}
      </div>
      {updating && <span className="text-xs text-white/40">Menyimpan...</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
