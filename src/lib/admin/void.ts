import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient;

type JournalLineRow = {
  account_code: number;
  debit: number;
  credit: number;
  description: string;
};

const today = (): string => new Date().toISOString().slice(0, 10);

export type VoidResult = { ok: boolean; error?: string; reversalId?: number | null };

/**
 * Batalkan satu entry jurnal TANPA menghapus apa pun:
 * 1. buat entry pembalikan (baris debit<->credit terbalik, reference VOID-<id>) berstatus 'void'
 * 2. tandai entry asli status='void'
 * Keduanya 'void' sehingga laporan aktif bersih, dan andai ada query yang lupa
 * memfilter status pun efeknya netral (asli + pembalikan saling menetralkan).
 */
export async function voidJournalEntry(
  supabase: Supabase,
  entryId: number,
  createdBy: number | null
): Promise<VoidResult> {
  const { data: entry, error } = await supabase
    .from("journal_entries")
    .select("id, date, description, reference, transaction_id, total_debit, total_credit, status")
    .eq("id", entryId)
    .single();
  if (error || !entry) return { ok: false, error: "Jurnal tidak ditemukan." };
  if (entry.status === "void") return { ok: true, reversalId: null };

  const { data: lines, error: lineErr } = await supabase
    .from("journal_entry_lines")
    .select("account_code, debit, credit, description")
    .eq("journal_entry_id", entryId);
  if (lineErr) return { ok: false, error: lineErr.message };

  const total = Number(entry.total_debit) || 0;
  const { data: rev, error: revErr } = await supabase
    .from("journal_entries")
    .insert({
      date: today(),
      description: `Pembatalan: ${entry.description}`,
      reference: `VOID-${entry.id}`,
      transaction_id: entry.transaction_id ?? null,
      total_debit: total,
      total_credit: total,
      created_by: createdBy,
      status: "void",
    })
    .select("id")
    .single();
  if (revErr || !rev) return { ok: false, error: revErr?.message ?? "Gagal membuat jurnal pembalikan." };

  const reversalLines: JournalLineRow[] = (lines ?? []).map((l) => ({
    account_code: l.account_code,
    debit: Number(l.credit) || 0,
    credit: Number(l.debit) || 0,
    description: l.description,
  }));
  if (reversalLines.length > 0) {
    const { error: insertLinesErr } = await supabase.from("journal_entry_lines").insert(
      reversalLines.map((l) => ({ ...l, journal_entry_id: rev.id }))
    );
    if (insertLinesErr) return { ok: false, error: insertLinesErr.message };
  }

  const { error: updErr } = await supabase.from("journal_entries").update({ status: "void" }).eq("id", entryId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, reversalId: rev.id as number };
}

/**
 * Batalkan semua jurnal milik satu transaksi kas + tandai transaksi 'void'.
 * Tidak ada baris yang dihapus.
 */
export async function voidTransaction(
  supabase: Supabase,
  txId: number,
  createdBy: number | null
): Promise<VoidResult> {
  const { data: tx, error } = await supabase
    .from("transactions")
    .select("id, reference, status")
    .eq("id", txId)
    .single();
  if (error || !tx) return { ok: false, error: "Transaksi tidak ditemukan." };
  if (tx.status === "void") return { ok: true };

  const { data: entries, error: entriesErr } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("transaction_id", txId);
  if (entriesErr) return { ok: false, error: entriesErr.message };

  for (const e of entries ?? []) {
    const res = await voidJournalEntry(supabase, e.id as number, createdBy);
    if (!res.ok) return res;
  }

  const { error: updErr } = await supabase.from("transactions").update({ status: "void" }).eq("id", txId);
  if (updErr) return { ok: false, error: updErr.message };
  return { ok: true };
}
