"use client";

import { useMemo, useState } from "react";
import { formatRupiah, formatDate } from "@/lib/admin/format";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";

type AccountInfo = { code: number; name: string; type: string };

type JournalLine = {
  id?: number;
  account_code: number;
  debit: number;
  credit: number;
  description: string;
};

type JournalEntry = {
  id: number;
  date: string;
  description: string;
  reference: string;
  total_debit: number;
  total_credit: number;
  transaction_id: number | null;
  created_at: string;
  lines: JournalLine[];
};

type Props = {
  entries: JournalEntry[];
  accounts: AccountInfo[];
  isAdmin: boolean;
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white placeholder:text-white/25 focus:border-[#D97A2B] outline-none transition";
const selectCls =
  "w-full px-4 py-2.5 rounded-lg border border-white/10 bg-[#0d0d0d] text-white focus:border-[#D97A2B] outline-none transition";

const PER_PAGE = 15;

export default function JournalClient({ entries, accounts, isAdmin }: Props) {
  const [rows, setRows] = useState(entries);
  const [filter, setFilter] = useState<"all" | string>("all");
  const [month, setMonth] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
  });
  const [formLines, setFormLines] = useState<JournalLine[]>([
    { account_code: accounts[0]?.code ?? 1101, debit: 0, credit: 0, description: "" },
    { account_code: accounts[0]?.code ?? 1101, debit: 0, credit: 0, description: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function showError(msg: string) { setError(msg); setSuccess(null); }
  function showSuccess(msg: string) { setSuccess(msg); setError(null); }

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const e of rows) set.add(e.date.slice(0, 7));
    return Array.from(set).sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((e) => {
      if (month !== "all" && e.date.slice(0, 7) !== month) return false;
      if (filter !== "all") {
        const accountCode = Number(filter);
        if (!e.lines.some((l) => l.account_code === accountCode)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          e.reference.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, filter, month, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  const totalDebit = filtered.reduce((s, e) => s + e.total_debit, 0);
  const totalCredit = filtered.reduce((s, e) => s + e.total_credit, 0);

  function addLine() {
    setFormLines((prev) => [
      ...prev,
      { account_code: accounts[0]?.code ?? 1101, debit: 0, credit: 0, description: "" },
    ]);
  }

  function removeLine(idx: number) {
    if (formLines.length <= 2) return;
    setFormLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: keyof JournalLine, value: string | number) {
    setFormLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.description.trim()) {
      showError("Deskripsi wajib diisi.");
      return;
    }

    const validLines = formLines.filter((l) => l.debit > 0 || l.credit > 0);
    if (validLines.length < 2) {
      showError("Minimal 2 baris jurnal dengan debit/kredit.");
      return;
    }

    const totalD = validLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalC = validLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalD - totalC) > 0.01) {
      showError(`Total debit (${formatRupiah(totalD)}) harus sama dengan total kredit (${formatRupiah(totalC)}).`);
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        description: form.description.trim(),
        reference: form.reference.trim(),
        lines: validLines,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok || !data.ok) {
      showError("Gagal menyimpan jurnal: " + (data.error ?? "unknown"));
      return;
    }

    showSuccess("Jurnal berhasil disimpan.");
    setShowForm(false);
    window.location.reload();
  }

  async function remove(id: number) {
    if (!confirm("Hapus jurnal ini?")) return;
    const res = await fetch("/api/admin/journal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showError("Gagal menghapus: " + (data.error ?? "unknown"));
      return;
    }
    setRows((prev) => prev.filter((e) => e.id !== id));
    showSuccess("Jurnal dihapus.");
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Jurnal Umum</h1>
          <p className="text-white/50 mt-1">
            Pencatatan transaksi double-entry (debit & kredit).
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white text-sm font-semibold shadow-lg shadow-orange-500/20 hover:opacity-90 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? "Tutup" : "Tambah Jurnal"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Debit</p>
          <p className="text-xl font-bold text-blue-400 mt-1">{formatRupiah(totalDebit)}</p>
          <p className="text-xs text-white/40 mt-1">{filtered.length} jurnal</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Total Kredit</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{formatRupiah(totalCredit)}</p>
          <p className="text-xs text-white/40 mt-1">harus seimbang</p>
        </div>
        <div className="bg-[#151515] rounded-xl border border-white/10 p-5">
          <p className="text-sm text-white/50">Selisih</p>
          <p className={`text-xl font-bold mt-1 ${Math.abs(totalDebit - totalCredit) < 0.01 ? "text-emerald-400" : "text-red-400"}`}>
            {formatRupiah(totalDebit - totalCredit)}
          </p>
          <p className="text-xs text-white/40 mt-1">{Math.abs(totalDebit - totalCredit) < 0.01 ? "seimbang" : "tidak seimbang!"}</p>
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
          <h2 className="font-semibold text-white">Tambah Jurnal Baru</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Tanggal *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Deskripsi *</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi transaksi..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Referensi</label>
              <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="INV-2026-XXX" className={inputCls} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white/70">Baris Jurnal *</label>
              <button type="button" onClick={addLine} className="text-xs text-[#E9A64E] hover:underline">+ Tambah Baris</button>
            </div>
            <div className="space-y-2">
              {formLines.map((line, idx) => {
                const totalD = formLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                const totalC = formLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      {idx === 0 && <label className="block text-[11px] text-white/40 mb-1">Akun</label>}
                      <select value={line.account_code} onChange={(e) => updateLine(idx, "account_code", Number(e.target.value))} className={selectCls + " text-sm"}>
                        {accounts.map((a) => (
                          <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <label className="block text-[11px] text-white/40 mb-1">Debit</label>}
                      <input type="number" min="0" step="100" value={line.debit || ""} onChange={(e) => updateLine(idx, "debit", Number(e.target.value))} placeholder="0" className={inputCls + " text-sm"} />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <label className="block text-[11px] text-white/40 mb-1">Kredit</label>}
                      <input type="number" min="0" step="100" value={line.credit || ""} onChange={(e) => updateLine(idx, "credit", Number(e.target.value))} placeholder="0" className={inputCls + " text-sm"} />
                    </div>
                    <div className="col-span-2 flex items-end">
                      {formLines.length > 2 && (
                        <button type="button" onClick={() => removeLine(idx)} className="p-2 text-white/30 hover:text-red-400 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span className="text-white/50">Total Debit: <span className="font-semibold text-blue-400">{formatRupiah(formLines.reduce((s, l) => s + (Number(l.debit) || 0), 0))}</span></span>
              <span className="text-white/50">Total Kredit: <span className="font-semibold text-purple-400">{formatRupiah(formLines.reduce((s, l) => s + (Number(l.credit) || 0), 0))}</span></span>
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
              {saving ? "Menyimpan..." : "Simpan Jurnal"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium hover:bg-white/5 transition">
              Batal
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        <select value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#151515] border border-white/10 text-white/60 focus:border-[#D97A2B] outline-none transition">
          <option value="all">Semua bulan</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))}
            </option>
          ))}
        </select>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[#151515] border border-white/10 text-white/60 focus:border-[#D97A2B] outline-none transition">
          <option value="all">Semua akun</option>
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
          ))}
        </select>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Cari jurnal..." className="sm:flex-1 min-w-[200px]" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#151515] rounded-xl border border-dashed border-white/20 p-16 text-center text-white/40">
          <p className="text-lg font-medium mb-1">Belum ada jurnal</p>
          <p className="text-sm">Catat transaksi double-entry di sini.</p>
        </div>
      ) : (
        <>
          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Deskripsi</th>
                  <th className="px-4 py-3 font-medium">REF</th>
                  <th className="px-4 py-3 font-medium text-right">Debit</th>
                  <th className="px-4 py-3 font-medium text-right">Kredit</th>
                  {isAdmin && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {paginated.map((e) => (
                  <>
                    <tr key={e.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setExpanded((prev) => ({ ...prev, [e.id]: !prev[e.id] }))}>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-4 py-3 font-medium text-white">{e.description}</td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50 whitespace-nowrap">{e.reference || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-400 whitespace-nowrap">{formatRupiah(e.total_debit)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-purple-400 whitespace-nowrap">{formatRupiah(e.total_credit)}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                          <button onClick={() => remove(e.id)} className="p-1.5 text-white/30 hover:text-red-400 transition" aria-label="Hapus">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                    {expanded[e.id] && (
                      <tr key={`${e.id}-detail`} className="border-b border-white/5 bg-white/[0.02]">
                        <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3">
                          <div className="ml-4 space-y-1">
                            {e.lines.map((line, li) => {
                              const acc = accountMap.get(line.account_code);
                              return (
                                <div key={li} className="grid grid-cols-12 gap-2 text-xs">
                                  <div className="col-span-5 text-white/60">
                                    <span className="font-mono text-white/40 mr-2">{line.account_code}</span>
                                    {acc?.name ?? "Unknown"}
                                  </div>
                                  <div className="col-span-3 text-right text-blue-400">
                                    {line.debit > 0 ? formatRupiah(line.debit) : ""}
                                  </div>
                                  <div className="col-span-3 text-right text-purple-400">
                                    {line.credit > 0 ? formatRupiah(line.credit) : ""}
                                  </div>
                                  <div className="col-span-1" />
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalItems={filtered.length} perPage={PER_PAGE} onPageChange={setPage} />
        </>
      )}
    </>
  );
}
