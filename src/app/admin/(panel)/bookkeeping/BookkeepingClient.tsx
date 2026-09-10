"use client";

import { useMemo } from "react";
import { formatRupiah } from "@/lib/admin/format";

type AccountInfo = { code: number; name: string; type: string };

type JournalLine = {
  account_code: number;
  debit: number;
  credit: number;
};

type Entry = {
  date: string;
  description: string;
  reference: string;
  total_debit: number;
  total_credit: number;
  lines: JournalLine[];
};

type Props = {
  entries: Entry[];
  accounts: AccountInfo[];
  isAdmin: boolean;
};

type SummaryRow = {
  category: string;
  items: { date: string; description: string; reference: string; amount: number }[];
  total: number;
};

const CATEGORY_MAP: Record<string, string[]> = {
  "Penjualan": ["4101"],
  "Pembagian Penjualan": ["5101"],
  "Transport": ["5103"],
  "Konsumsi": ["5104"],
  "Lainnya": ["5102", "5105", "5119"],
};

const CATEGORY_COLORS: Record<string, string> = {
  "Penjualan": "from-blue-500 to-blue-600",
  "Pembagian Penjualan": "from-amber-500 to-orange-500",
  "Transport": "from-purple-500 to-purple-600",
  "Konsumsi": "from-emerald-500 to-emerald-600",
  "Lainnya": "from-gray-500 to-gray-600",
};

export default function BookkeepingClient({ entries, accounts, isAdmin }: Props) {
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);

  const summary = useMemo(() => {
    const result: SummaryRow[] = [];

    for (const [category, codes] of Object.entries(CATEGORY_MAP)) {
      const items: SummaryRow["items"] = [];
      let total = 0;

      for (const entry of entries) {
        for (const line of entry.lines) {
          if (codes.includes(String(line.account_code))) {
            const acc = accountMap.get(line.account_code);
            const amount = line.debit > 0 ? line.debit : line.credit;
            if (amount > 0) {
              items.push({
                date: entry.date,
                description: entry.description,
                reference: entry.reference,
                amount,
              });
              total += amount;
            }
          }
        }
      }

      items.sort((a, b) => a.date.localeCompare(b.date));
      result.push({ category, items, total });
    }

    return result;
  }, [entries, accountMap]);

  const grandTotal = summary.reduce((s, c) => s + c.total, 0);

  const balances = useMemo(() => {
    const result: { name: string; type: string; debit: number; credit: number; balance: number }[] = [];
    const accTotals = new Map<number, { debit: number; credit: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const curr = accTotals.get(line.account_code) ?? { debit: 0, credit: 0 };
        curr.debit += line.debit;
        curr.credit += line.credit;
        accTotals.set(line.account_code, curr);
      }
    }

    for (const [code, totals] of accTotals) {
      const acc = accountMap.get(code);
      if (!acc) continue;
      const balance = acc.type === "asset" || acc.type === "expense"
        ? totals.debit - totals.credit
        : totals.credit - totals.debit;
      result.push({
        name: `${code} — ${acc.name}`,
        type: acc.type,
        debit: totals.debit,
        credit: totals.credit,
        balance,
      });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [entries, accountMap]);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Buku Besar</h1>
        <p className="text-white/50 mt-1">
          Ringkasan pembukuan per kategori — sesuai format Bookkeeping.
        </p>
      </div>

      <div className="bg-[#151515] rounded-xl border border-white/10 p-5 mb-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/50">Total Semua Transaksi</p>
          <p className="text-2xl font-bold text-white">{formatRupiah(grandTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {summary.filter((c) => c.total > 0).map((cat) => (
          <div key={cat.category} className="bg-[#151515] rounded-xl border border-white/10 p-5 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${CATEGORY_COLORS[cat.category]}`} />
            <p className="text-sm text-white/50">{cat.category}</p>
            <p className="text-xl font-bold text-white mt-1">{formatRupiah(cat.total)}</p>
            <p className="text-xs text-white/40 mt-1">{cat.items.length} transaksi</p>
          </div>
        ))}
      </div>

      {summary.filter((c) => c.items.length > 0).map((cat) => (
        <div key={cat.category} className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-1 h-5 rounded-full bg-gradient-to-b ${CATEGORY_COLORS[cat.category]}`} />
            <h2 className="text-lg font-semibold text-white">{cat.category}</h2>
            <span className="text-sm text-white/40 ml-auto">{formatRupiah(cat.total)}</span>
          </div>
          <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Tanggal</th>
                  <th className="px-4 py-3 font-medium">Uraian</th>
                  <th className="px-4 py-3 font-medium">REF</th>
                  <th className="px-4 py-3 font-medium text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/60 whitespace-nowrap">
                      {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.date))}
                    </td>
                    <td className="px-4 py-3 text-white">{item.description}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50 whitespace-nowrap">{item.reference || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white whitespace-nowrap">{formatRupiah(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/10">
                  <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-white/70">Total {cat.category}</td>
                  <td className="px-4 py-3 text-right font-bold text-white">{formatRupiah(cat.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-3">Saldo Akun (Neraca)</h2>
        <div className="bg-[#151515] rounded-xl border border-white/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-white/50 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Akun</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium text-right">Debit</th>
                <th className="px-4 py-3 font-medium text-right">Kredit</th>
                <th className="px-4 py-3 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const typeLabel: Record<string, string> = { asset: "Aset", liability: "Kewajiban", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban" };
                const typeColor: Record<string, string> = { asset: "bg-blue-500/10 text-blue-400", liability: "bg-red-500/10 text-red-400", equity: "bg-purple-500/10 text-purple-400", revenue: "bg-emerald-500/10 text-emerald-400", expense: "bg-amber-500/10 text-amber-400" };
                return (
                  <tr key={b.name} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${typeColor[b.type]}`}>
                        {typeLabel[b.type] ?? b.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-blue-400 whitespace-nowrap">{b.debit > 0 ? formatRupiah(b.debit) : "-"}</td>
                    <td className="px-4 py-3 text-right text-purple-400 whitespace-nowrap">{b.credit > 0 ? formatRupiah(b.credit) : "-"}</td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${b.balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatRupiah(b.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-white/70">Total</td>
                <td className="px-4 py-3 text-right font-bold text-blue-400">{formatRupiah(balances.reduce((s, b) => s + b.debit, 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-purple-400">{formatRupiah(balances.reduce((s, b) => s + b.credit, 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-white">{formatRupiah(balances.reduce((s, b) => s + b.balance, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
