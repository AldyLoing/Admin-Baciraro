"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: number;
  name: string;
  role: string;
};

type ContributionRow = {
  type: "member" | "external";
  member_id: string;
  name: string;
  percent: string;
  amount: string;
  tugas: string;
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] focus:ring-2 focus:ring-[#D97A2B]/20 outline-none transition";

export default function ProjectForm({ members }: { members: Member[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [description, setDescription] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [status, setStatus] = useState("active");
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addRow() {
    setRows((prev) => [...prev, { type: "member", member_id: "", name: "", percent: "", amount: "", tugas: "" }]);
  }

  function addExternalRow() {
    setRows((prev) => [...prev, { type: "external", member_id: "", name: "", percent: "", amount: "", tugas: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof ContributionRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  const totalPercent = rows.reduce((sum, r) => sum + (Number(r.percent) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama project wajib diisi.");
      return;
    }
    const value = totalValue === "" ? 0 : Number(totalValue);
    if (isNaN(value) || value < 0) {
      setError("Nilai project tidak boleh negatif.");
      return;
    }
    if (rows.length > 0) {
      for (const r of rows) {
        if (r.type === "member" && !r.member_id) {
          setError("Setiap baris anggota wajib dipilih dari daftar anggota.");
          return;
        }
        if (r.type === "external" && !r.name.trim()) {
          setError("Setiap kontributor eksternal wajib diisi namanya.");
          return;
        }
        if (!r.percent || Number(r.percent) <= 0) {
          setError("Persentase kontribusi wajib diisi lebih dari 0 untuk setiap baris.");
          return;
        }
      }
      if (Math.round(totalPercent) !== 100) {
        setError(`Total kontribusi harus 100% (sekarang: ${totalPercent}%).`);
        return;
      }
    }

    setLoading(true);
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        client_name: clientName.trim() || null,
        description: description.trim() || null,
        total_value: value,
        status,
        members: rows.map((r) => ({
          member_id: r.type === "member" ? Number(r.member_id) : null,
          name: r.type === "external" ? r.name.trim() : undefined,
          contribution_percent: Number(r.percent),
          amount: r.amount === "" ? null : Number(r.amount),
          tugas: r.tugas === "" ? null : r.tugas.trim(),
        })),
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error ?? "Gagal menyimpan project.");
      setLoading(false);
      return;
    }

    router.push(`/admin/projects/${data.id}`);
    router.refresh();
  }

  const availableMembers = (currentRowId?: string) =>
    members.filter((m) => {
      const selectedInOtherRow = rows.some(
        (r) => r.type === "member" && r.member_id === String(m.id) && r.member_id !== currentRowId
      );
      return !selectedInOtherRow;
    });

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => router.push("/admin/projects")}
          className="text-sm text-white/50 hover:text-[#E9A64E] transition flex items-center gap-1 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-white">Tambah Project Baru</h1>
        <p className="text-white/50 mt-1">Tentukan nilai project dan persentase kontribusi kontributor.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-6 space-y-4">
          <h2 className="font-semibold text-white">Informasi Project</h2>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Nama Project *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Program Recycle Resin"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Nama Klien</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="mis. PT Maju Jaya"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Deskripsi singkat project..."
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nilai Total (Rp) <span className="text-white/40">· opsional</span></label>
              <input
                type="number"
                min="0"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                placeholder="10000000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectCls}
              >
                <option value="active">Aktif</option>
                <option value="completed">Selesai</option>
                <option value="paid">Dibayar</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-[#151515] rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-white">Kontribusi Bagi Hasil</h2>
              <p className="text-xs text-white/50 mt-0.5">
                Kontributor boleh dari anggota maupun orang luar (isikan nama). Persen wajib dari awal dan totalnya{" "}
                <span className="font-semibold text-[#E9A64E]">100%</span>. Nominal opsional — bisa diisi belakangan;
                pembagian tetap berdasar persen. Kas Baciraro otomatis 10%.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D97A2B]/40 text-[#E9A64E] text-sm font-medium hover:bg-[#D97A2B]/10 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Anggota
              </button>
              <button
                type="button"
                onClick={addExternalRow}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/20 text-white/70 text-sm font-medium hover:bg-white/5 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Orang Luar
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-8 text-white/40 border border-dashed border-white/20 rounded-lg text-sm">
              Belum ada kontributor. Project boleh berjalan tanpa kontributor; klik &quot;Anggota&quot; untuk memilih
              dari tim atau &quot;Orang Luar&quot; untuk kontributor di luar anggota.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div key={index} className="flex flex-col gap-2 bg-white/[0.03] border border-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      {row.type === "member" ? (
                        <select
                          value={row.member_id}
                          onChange={(e) => updateRow(index, "member_id", e.target.value)}
                          className={selectCls}
                        >
                          <option value="">Pilih anggota...</option>
                          {availableMembers(row.member_id).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} · {m.role}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateRow(index, "name", e.target.value)}
                          placeholder="Nama kontributor luar..."
                          className={inputCls}
                        />
                      )}
                    </div>
                    <div className="w-32">
                      <div className="flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={row.percent}
                          onChange={(e) => updateRow(index, "percent", e.target.value)}
                          placeholder="%"
                          className={inputCls}
                        />
                        <span className="ml-2 text-white/50 text-sm">%</span>
                      </div>
                    </div>
                    <div className="w-40">
                      <input
                        type="number"
                        min="0"
                        value={row.amount}
                        onChange={(e) => updateRow(index, "amount", e.target.value)}
                        placeholder="Nominal (opsional)"
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="p-2 text-white/40 hover:text-red-400 transition"
                      aria-label="Hapus"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={row.tugas}
                    onChange={(e) => updateRow(index, "tugas", e.target.value)}
                    placeholder="Tugas / peran di project ini (mis. cetak 3D, editing, pemasaran)..."
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <div
              className={`mt-4 flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                totalPercent === 100 ? "bg-emerald-500/10 text-emerald-400" : "bg-[#D97A2B]/10 text-[#E9A64E]"
              }`}
            >
              <span>Total kontribusi</span>
              <span>{totalPercent}% {totalPercent === 100 ? "✓" : `(kurang ${(100 - totalPercent).toFixed(1)}%)`}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Project"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/projects")}
            className="px-6 py-3 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}