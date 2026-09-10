"use client";

import { formatDate, formatRupiah, calculateDistribution } from "@/lib/admin/format";

type PayoutMember = {
  name: string;
  contribution_percent: number;
  amount: number;
  tugas: string | null;
};

type Payout = {
  id: string;
  project_name: string;
  date: string;
  total_amount: number;
  orders_fee: number;
  kas_optional_amount: number;
  kas_optional_percent: number;
  net_amount: number;
  status: string;
  finalized_at: string | null;
  members: PayoutMember[];
};

export default function InvoicePrint({ payout }: { payout: Payout }) {
  const dist = calculateDistribution(
    payout.total_amount || payout.net_amount / 0.9,
    payout.members.map((m) => ({ percent: m.contribution_percent })),
    payout.kas_optional_percent || 0
  );

  return (
    <div className="max-w-2xl mx-auto bg-white text-black p-8 print:p-0" id="invoice-content">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible; }
          #invoice-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-8 border-b-2 border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#C44A3A]">BACIRARO</h1>
          <p className="text-sm text-gray-500">Invoice Pembagian Hasil</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">No. {payout.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-sm">{formatDate(payout.date)}</p>
          {payout.finalized_at && (
            <p className="text-xs text-gray-400 mt-1">Finalisasi: {formatDate(payout.finalized_at)}</p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-lg mb-2">Project</h2>
        <p className="text-gray-700">{payout.project_name}</p>
      </div>

      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 font-semibold">Keterangan</th>
            <th className="text-right py-2 font-semibold">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-2">Total Pendapatan</td>
            <td className="py-2 text-right font-mono">{formatRupiah(payout.total_amount || dist.total)}</td>
          </tr>
          <tr className="border-b border-gray-100">
            <td className="py-2">Fee Baciraro (10%)</td>
            <td className="py-2 text-right font-mono text-red-600">-{formatRupiah(dist.kasAmount)}</td>
          </tr>
          {payout.kas_optional_percent > 0 && (
            <tr className="border-b border-gray-100">
              <td className="py-2">Kas Tambahan ({payout.kas_optional_percent}%)</td>
              <td className="py-2 text-right font-mono text-red-600">-{formatRupiah(dist.kasOptionalAmount)}</td>
            </tr>
          )}
          <tr className="border-b border-gray-200 font-bold">
            <td className="py-2">Net untuk Member</td>
            <td className="py-2 text-right font-mono">{formatRupiah(dist.distributable)}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="font-semibold text-lg mb-3">Rincian per Anggota</h2>
      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 font-semibold">Nama</th>
            <th className="text-center py-2 font-semibold">%</th>
            <th className="text-right py-2 font-semibold">Bagian</th>
          </tr>
        </thead>
        <tbody>
          {payout.members.map((m, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">
                {m.name}
                {m.tugas && <span className="text-xs text-gray-400 ml-1">({m.tugas})</span>}
              </td>
              <td className="py-2 text-center">{m.contribution_percent}%</td>
              <td className="py-2 text-right font-mono">{formatRupiah(m.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 text-center">
        <p>Dicetak pada {new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}</p>
      </div>
    </div>
  );
}
