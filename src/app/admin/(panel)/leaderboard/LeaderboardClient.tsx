"use client";

import { useMemo, useState } from "react";

type Row = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  total_points: number;
  created_at: string;
  claim_count: number;
  event_points: number;
  product_points: number;
  last_claim_at: string | null;
};

type Stats = {
  totalCustomers: number;
  totalDistributed: number;
  totalClaims: number;
};

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const RANK_ICONS = ["👑", "🥈", "🥉"];

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortKey = "poin" | "klaim" | "aktivitas";

export default function LeaderboardClient({
  rows,
  stats,
}: {
  rows: Row[];
  stats: Stats;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("poin");

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "poin") return b.total_points - a.total_points;
      if (sort === "klaim") return b.claim_count - a.claim_count;
      // aktivitas: null di bawah
      const ta = a.last_claim_at ? new Date(a.last_claim_at).getTime() : 0;
      const tb = b.last_claim_at ? new Date(b.last_claim_at).getTime() : 0;
      return tb - ta;
    });
  }, [rows, query, sort]);

  const podium = [...rows].sort((a, b) => b.total_points - a.total_points).slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Leaderboard Koin</h1>
      <p className="text-white/50 mb-6 text-sm">
        Peringkat customer berdasarkan total koin yang dikumpulkan.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Customer" value={stats.totalCustomers} />
        <StatCard label="Koin Terdistribusi" value={stats.totalDistributed} accent />
        <StatCard label="Total Klaim" value={stats.totalClaims} />
      </div>

      {podium.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {podium.map((c, i) => (
            <div
              key={c.id}
              className="bg-[#111111] border border-white/10 rounded-2xl p-5 flex flex-col items-center text-center"
            >
              <div className="text-2xl mb-2">{RANK_ICONS[i]}</div>
              <Avatar row={c} color={RANK_COLORS[i]} />
              <p className="text-white font-semibold mt-3 truncate w-full">
                {c.name || "Customer"}
              </p>
              <p
                className="text-2xl font-bold mt-1"
                style={{ color: RANK_COLORS[i] }}
              >
                {c.total_points.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-white/40">{c.claim_count} klaim</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#111111] border border-white/10 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama / email / no. HP..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#D97A2B] outline-none text-sm"
          />
          <div className="flex gap-2 text-sm">
            {(
              [
                ["poin", "Poin"],
                ["klaim", "Klaim"],
                ["aktivitas", "Aktivitas"],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-3 py-2 rounded-lg transition ${
                  sort === k
                    ? "bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-left border-b border-white/10">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 pr-3 font-medium text-right">Koin</th>
                <th className="py-2 pr-3 font-medium text-right">Klaim</th>
                <th className="py-2 pr-3 font-medium text-right">Event / Produk</th>
                <th className="py-2 font-medium text-right">Klaim Terakhir</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-white/5 hover:bg-white/[0.03]"
                >
                  <td className="py-3 pr-3 text-white/40 tabular-nums">{i + 1}</td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar row={c} size={9} />
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {c.name || "Customer"}
                        </p>
                        <p className="text-white/40 text-xs truncate">
                          {c.email || c.phone || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right font-bold text-[#D97A2B] tabular-nums">
                    {c.total_points.toLocaleString("id-ID")}
                  </td>
                  <td className="py-3 pr-3 text-right text-white/80 tabular-nums">
                    {c.claim_count}
                  </td>
                  <td className="py-3 pr-3 text-right text-white/50 tabular-nums text-xs">
                    {c.event_points} / {c.product_points}
                  </td>
                  <td className="py-3 text-right text-white/50 text-xs whitespace-nowrap">
                    {fmtDate(c.last_claim_at)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/40">
                    Tidak ada customer yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-2xl p-5">
      <p className="text-white/40 text-xs uppercase tracking-wide">{label}</p>
      <p
        className={`text-3xl font-bold mt-1 tabular-nums ${
          accent ? "text-[#D97A2B]" : "text-white"
        }`}
      >
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

function Avatar({ row, color, size = 12 }: { row: Row; color?: string; size?: number }) {
  const dim = `${size * 4}px`;
  if (row.photo_url && row.photo_url.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.photo_url}
        alt=""
        style={{ width: dim, height: dim }}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  if (row.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.photo_url}
        alt=""
        style={{ width: dim, height: dim }}
        className="rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={{
        width: dim,
        height: dim,
        background: color || "#C44A3A",
      }}
      className="rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
    >
      {initials(row.name)}
    </div>
  );
}
