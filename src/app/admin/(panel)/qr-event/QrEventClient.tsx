"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type EventQr = {
  id: number;
  code: string;
  event_name: string | null;
  event_points: number;
  claimed_at: string | null;
  created_at: string;
  claim_url: string;
  used: boolean;
  claimed_by: { name: string; phone: string } | null;
};

function QrImage({ value }: { value: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: 320, margin: 2, color: { dark: "#0b0b0b", light: "#ffffff" } })
      .then((u) => { if (active) setSrc(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [value]);
  if (!src) return <div className="w-[320px] h-[320px] bg-white/10 animate-pulse rounded-lg" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR Code" className="w-[320px] h-[320px] rounded-lg" />;
}

export default function QrEventClient() {
  const [qrs, setQrs] = useState<EventQr[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [points, setPoints] = useState("50");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshPoints, setRefreshPoints] = useState("");
  const [preview, setPreview] = useState<EventQr | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/event-qr");
    const data = await res.json();
    setQrs(data.qrs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const res = await fetch("/api/admin/event-qr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, points: Number(points) }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { setCreateError(data.error || "Gagal membuat QR."); return; }
    setName("");
    setPreview(data.qr);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus QR yang belum terpakai ini?")) return;
    const res = await fetch("/api/admin/event-qr", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) await load();
  };

  const handleRefresh = async (id: number) => {
    const newPoints = refreshPoints.trim() ? Number(refreshPoints) : undefined;
    if (!confirm("Buat QR baru dengan nama & poin yang sama? QR lama tetap tersimpan di riwayat.")) return;
    setRefreshingId(id);
    const res = await fetch("/api/admin/event-qr", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, points: newPoints }),
    });
    const data = await res.json();
    setRefreshingId(null);
    if (!res.ok) { alert(data.error || "Gagal membuat QR baru."); return; }
    setRefreshPoints("");
    setPreview(data.qr);
    await load();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">QR Koin Event</h1>
      <p className="text-white/50 mb-6 text-sm">
        Tentukan jumlah koin, lalu generate QR sekali pakai. Customer wajib login untuk klaim.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Generate QR Baru</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Nama Event (opsional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Lokawaya 2026"
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D97A2B] outline-none text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Jumlah Koin</label>
              <input
                type="number" min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#D97A2B] outline-none text-white"
                required
              />
            </div>
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
            <button
              type="submit" disabled={creating}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Membuat..." : "Generate QR"}
            </button>
          </form>
        </div>

        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px]">
          {preview ? (
            <>
              <QrImage value={preview.claim_url} />
              <p className="text-white font-semibold mt-4">{preview.event_name || "Baciraro Event"}</p>
              <p className="text-[#D97A2B] text-2xl font-bold">+{preview.event_points} koin</p>
              <p className={`text-xs mt-1 ${preview.used ? "text-red-400" : "text-emerald-400"}`}>
                {preview.used
                  ? `Terpakai${preview.claimed_by ? ` oleh ${preview.claimed_by.name}` : ""}`
                  : "Belum terpakai"}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center items-center">
                <QrDownload value={preview.claim_url} code={preview.code} />
                <a href={preview.claim_url} target="_blank"
                  className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/20">
                  Buka
                </a>
                <input
                  type="number" min={1}
                  value={refreshPoints}
                  onChange={(e) => setRefreshPoints(e.target.value)}
                  placeholder="Poin baru?"
                  className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:border-[#D97A2B] outline-none"
                />
                <button
                  onClick={() => handleRefresh(preview.id)}
                  disabled={refreshingId === preview.id}
                  className="px-3 py-2 rounded-lg bg-blue-500/15 text-sm text-blue-400 hover:bg-blue-500/25 disabled:opacity-50">
                  {refreshingId === preview.id ? "..." : "Refresh"}
                </button>
              </div>
              <p className="text-white/40 text-xs mt-3 text-center break-all">{preview.claim_url}</p>
            </>
          ) : (
            <p className="text-white/40 text-sm text-center">
              QR yang baru dibuat akan tampil di sini untuk diprint &amp; dipajang.
            </p>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="font-semibold text-white mb-4">Riwayat QR Event</h2>
        {loading ? (
          <p className="text-white/40 text-sm">Memuat...</p>
        ) : qrs.length === 0 ? (
          <p className="text-white/40 text-sm">Belum ada QR event.</p>
        ) : (
          <div className="grid gap-3">
            {qrs.map((qr) => (
              <div key={qr.id} className="bg-[#111111] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{qr.event_name || "Baciraro Event"}</p>
                  <p className="text-[#D97A2B] font-bold">+{qr.event_points} koin</p>
                  <p className="text-xs text-white/40 mt-1">
                    {qr.used ? (
                      <span className="text-red-400">Terpakai{qr.claimed_by ? ` oleh ${qr.claimed_by.name}` : ""}</span>
                    ) : (
                      <span className="text-emerald-400">Belum terpakai</span>
                    )}
                    {" · "}{new Date(qr.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPreview(qr)}
                    className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/20">
                    Lihat
                  </button>
                  {!qr.used && (
                    <button onClick={() => handleDelete(qr.id)}
                      className="px-3 py-2 rounded-lg bg-red-500/15 text-sm text-red-400 hover:bg-red-500/25">
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QrDownload({ value, code }: { value: string; code: string }) {
  const [href, setHref] = useState<string>("#");
  useEffect(() => {
    QRCode.toDataURL(value, { width: 360, margin: 2, color: { dark: "#0b0b0b", light: "#ffffff" } })
      .then(setHref).catch(() => {});
  }, [value]);
  return (
    <a href={href} download={`qr-${code}.png`}
      className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/20">
      Download
    </a>
  );
}
