import { redirect } from "next/navigation";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import InvoicePrint from "@/app/admin/(panel)/payouts/InvoicePrint";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: payout } = await supabase
    .from("payouts")
    .select("*")
    .eq("id", id)
    .single();

  if (!payout) redirect("/admin/payouts");

  const { data: members } = await supabase
    .from("payout_members")
    .select("name, contribution_percent, amount, tugas")
    .eq("payout_id", id)
    .order("contribution_percent", { ascending: false });

  const { data: journalEntry } = await supabase
    .from("journal_entries")
    .select("id, date, description, reference, total_debit, total_credit, journal_entry_lines(account_code, debit, credit)")
    .eq("transaction_id", (await supabase.from("transactions").select("id").like("source", `Payout ${payout.project_name}%`).limit(1)).data?.[0]?.id ?? -1)
    .single();

  return (
    <>
      <div className="no-print flex items-center justify-between mb-6 max-w-2xl mx-auto">
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#C44A3A] to-[#D97A2B] text-white font-semibold text-sm hover:opacity-90 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Cetak / Simpan PDF
        </button>
        <a href="/admin/payouts" className="text-sm text-white/50 hover:text-white transition">
          Kembali
        </a>
      </div>
      <InvoicePrint payout={{ ...payout, members: members ?? [] }} />

      {journalEntry && (
        <div className="no-print max-w-2xl mx-auto mt-8 bg-[#151515] rounded-xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Jurnal Terkait</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <p className="text-white/50">Tanggal</p>
              <p className="text-white">{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(journalEntry.date))}</p>
            </div>
            <div>
              <p className="text-white/50">Deskripsi</p>
              <p className="text-white">{journalEntry.description}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-white/50 border-b border-white/10">
                  <th className="px-3 py-2 font-medium">Akun</th>
                  <th className="px-3 py-2 font-medium text-right">Debit</th>
                  <th className="px-3 py-2 font-medium text-right">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {(journalEntry.journal_entry_lines ?? []).map((line: any, idx: number) => (
                  <tr key={idx} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white">{line.account_code}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{line.debit > 0 ? `Rp ${Number(line.debit).toLocaleString("id-ID")}` : ""}</td>
                    <td className="px-3 py-2 text-right text-purple-400">{line.credit > 0 ? `Rp ${Number(line.credit).toLocaleString("id-ID")}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a href="/admin/journal" className="inline-block mt-3 text-sm text-[#E9A64E] hover:underline">Lihat di Jurnal Umum →</a>
        </div>
      )}
    </>
  );
}
