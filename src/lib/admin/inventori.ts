import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReference } from "./transactions";

type Supabase = SupabaseClient;

export type JournalLine = {
  account_code: number;
  debit: number;
  credit: number;
  description: string;
};

export type InventoryAccounts = {
  bank: number;
  income: number;
  selisihNaik: number;
  persediaan: number;
  hpp: number;
  promo: number;
  selisihTurun: number;
  expenseLain: number;
};

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Ambil kode akun yang dipakai modul inventori.
 * 1103 Persediaan, 4103 Selisih Opname (naik), 5108 HPP,
 * 5120 Beban Promosi (barang gratis), 5121 Selisih Opname (turun),
 * 5119 Beban Lainnya (rusak/hilang).
 */
export async function resolveInventoryAccounts(supabase: Supabase): Promise<InventoryAccounts> {
  const { data: accounts } = await supabase.from("accounts").select("code, type").order("code");
  const list = accounts ?? [];
  const bank = list.find((a: { code: number; type: string }) => a.type === "asset" && a.code !== 1103)?.code
    ?? list.find((a: { code: number; type: string }) => a.type === "asset")?.code
    ?? 1101;
  return {
    bank,
    income: 4101,
    selisihNaik: 4103,
    persediaan: 1103,
    hpp: 5108,
    promo: 5120,
    selisihTurun: 5121,
    expenseLain: 5119,
  };
}

/**
 * Sisipkan satu jurnal (header + baris). Mengembalikan id entry, atau null
 * jika gagal. Debit dan kredit wajib sama besar.
 */
export async function insertJournalEntry(
  supabase: Supabase,
  params: {
    date: string;
    description: string;
    reference: string;
    lines: JournalLine[];
    createdBy?: number | null;
    transactionId?: number | null;
  }
): Promise<number | null> {
  const lines = params.lines.filter((l) => Number(l.debit) > 0 || Number(l.credit) > 0);
  if (lines.length === 0) return null;

  const totalDebit = round2(lines.reduce((s, l) => s + Number(l.debit), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + Number(l.credit), 0));
  if (totalDebit !== totalCredit || totalDebit <= 0) return null;

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({
      date: params.date,
      description: params.description,
      reference: params.reference,
      total_debit: totalDebit,
      total_credit: totalCredit,
      transaction_id: params.transactionId ?? null,
      created_by: params.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error || !entry) return null;

  const { error: lineError } = await supabase.from("journal_entry_lines").insert(
    lines.map((l) => ({
      journal_entry_id: entry.id,
      account_code: l.account_code,
      debit: round2(l.debit),
      credit: round2(l.credit),
      description: l.description,
    }))
  );
  if (lineError) {
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return null;
  }
  return entry.id as number;
}

/** Nomor penjualan: SL-YYYY-NNN (berbeda dari INV kas). */
export async function generateSaleReference(supabase: Supabase, year: number): Promise<string> {
  const prefix = `SL-${year}-`;
  const { data } = await supabase
    .from("sales")
    .select("reference")
    .like("reference", `${prefix}%`);
  let max = 0;
  for (const s of data ?? []) {
    const n = parseInt(String(s.reference ?? "").slice(prefix.length), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(3, "0");
}

export { generateReference };

/**
 * Jurnal untuk satu mutasi stok manual (bukan bagian penjualan).
 * - masuk (stok awal / penyesuaian naik): Dr Persediaan / Cr Selisih Opname
 * - keluar penyesuaian turun: Dr Selisih Opname / Cr Persediaan
 * - keluar gratis: Dr Beban Promosi / Cr Persediaan
 * - keluar rusak/hilang: Dr Beban Lainnya / Cr Persediaan
 */
export async function journalForMovement(
  supabase: Supabase,
  params: {
    date: string;
    type: "in" | "out";
    reason: string;
    qty: number;
    hargaModal: number;
    productName: string;
    note?: string;
    reference: string;
    createdBy?: number | null;
  }
): Promise<number | null> {
  const value = round2(params.qty * params.hargaModal);
  if (value <= 0) return null;

  const acc = await resolveInventoryAccounts(supabase);
  const desc =
    `${params.type === "in" ? "Barang masuk" : "Barang keluar"} — ${params.productName}` +
    (params.note ? ` (${params.note})` : "");

  let lines: JournalLine[] = [];
  if (params.type === "in") {
    lines = [
      { account_code: acc.persediaan, debit: value, credit: 0, description: desc },
      { account_code: acc.selisihNaik, debit: 0, credit: value, description: desc },
    ];
  } else if (params.reason === "gratis") {
    lines = [
      { account_code: acc.promo, debit: value, credit: 0, description: desc },
      { account_code: acc.persediaan, debit: 0, credit: value, description: desc },
    ];
  } else if (params.reason === "rusak" || params.reason === "hilang") {
    lines = [
      { account_code: acc.expenseLain, debit: value, credit: 0, description: desc },
      { account_code: acc.persediaan, debit: 0, credit: value, description: desc },
    ];
  } else {
    lines = [
      { account_code: acc.selisihTurun, debit: value, credit: 0, description: desc },
      { account_code: acc.persediaan, debit: 0, credit: value, description: desc },
    ];
  }

  return insertJournalEntry(supabase, {
    date: params.date,
    description: desc,
    reference: params.reference,
    lines,
    createdBy: params.createdBy ?? null,
  });
}

/**
 * Jurnal penjualan: kas / pendapatan + HPP / persediaan.
 */
export async function journalForSale(
  supabase: Supabase,
  params: {
    date: string;
    reference: string;
    recipient: string;
    total: number;
    hpp: number;
    createdBy?: number | null;
    transactionId?: number | null;
  }
): Promise<number | null> {
  const acc = await resolveInventoryAccounts(supabase);
  const total = round2(params.total);
  const hpp = round2(params.hpp);
  const desc = `Penjualan ${params.reference}${params.recipient ? ` — ${params.recipient}` : ""}`;

  const lines: JournalLine[] = [
    { account_code: acc.bank, debit: total, credit: 0, description: desc },
    { account_code: acc.income, debit: 0, credit: total, description: desc },
  ];
  if (hpp > 0) {
    lines.push({ account_code: acc.hpp, debit: hpp, credit: 0, description: `HPP ${desc}` });
    lines.push({ account_code: acc.persediaan, debit: 0, credit: hpp, description: `HPP ${desc}` });
  }

  return insertJournalEntry(supabase, {
    date: params.date,
    description: desc,
    reference: params.reference,
    lines,
    createdBy: params.createdBy ?? null,
    transactionId: params.transactionId ?? null,
  });
}
