import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";
import { voidJournalEntry } from "@/lib/admin/void";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const accountCode = url.searchParams.get("account");
  const search = url.searchParams.get("search");

  const supabase = createAdminClient();

  let query = supabase
    .from("journal_entries")
    .select("*, journal_entry_lines(*)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month && month !== "all") {
    const [year, mon] = month.split("-");
    const startDate = `${year}-${mon}-01`;
    const endDate = mon === "12" ? `${Number(year) + 1}-01-01` : `${year}-${String(Number(mon) + 1).padStart(2, "0")}-01`;
    query = query.gte("date", startDate).lt("date", endDate);
  }

  if (search) {
    query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`);
  }

  const { data: entries, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let filtered = entries ?? [];
  if (accountCode && accountCode !== "all") {
    filtered = filtered.filter((e: any) =>
      e.journal_entry_lines?.some((l: any) => l.account_code === Number(accountCode))
    );
  }

  return NextResponse.json({ ok: true, entries: filtered });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, description, reference, lines, transaction_id } = await req.json();

  if (!date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
    return NextResponse.json({ error: "Tanggal, deskripsi, dan minimal 2 baris jurnal wajib diisi." }, { status: 400 });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    totalDebit += Number(line.debit) || 0;
    totalCredit += Number(line.credit) || 0;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({ error: "Total debit harus sama dengan total kredit." }, { status: 400 });
  }

  if (totalDebit <= 0) {
    return NextResponse.json({ error: "Total debit harus lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      date,
      description: String(description).trim(),
      reference: reference?.trim() ?? "",
      total_debit: totalDebit,
      total_credit: totalCredit,
      transaction_id: transaction_id ?? null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (entryError) return NextResponse.json({ error: entryError.message }, { status: 400 });

  const lineRows = lines.map((l: any) => ({
    journal_entry_id: entry.id,
    account_code: Number(l.account_code),
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    description: l.description?.trim() ?? "",
  }));

  const { error: lineError } = await supabase.from("journal_entry_lines").insert(lineRows);
  if (lineError) return NextResponse.json({ error: lineError.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "journal_entry", entityId: entry.id,
    entityName: String(reference || description).trim(),
    after: { date, description: String(description).trim(), reference: reference?.trim() ?? "", total_debit: totalDebit, total_credit: totalCredit, lines: lineRows },
  });
  if (!ok) return NextResponse.json({ error: "Jurnal dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, id: entry.id });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("journal_entries")
    .select("*, journal_entry_lines(*)")
    .eq("id", id)
    .single();
  if (!before) return NextResponse.json({ error: "Jurnal tidak ditemukan." }, { status: 404 });
  if (before.status === "void") return NextResponse.json({ error: "Jurnal sudah dibatalkan." }, { status: 400 });

  const res = await voidJournalEntry(supabase, Number(id), admin.id);
  if (!res.ok) return NextResponse.json({ error: "Gagal membatalkan: " + res.error }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "void", entityType: "journal_entry", entityId: Number(id),
    entityName: before ? (String(before.reference || before.description) || String(id)) : String(id),
    before,
    after: { ...before, status: "void", reversal_entry_id: res.reversalId },
  });
  if (!ok) return NextResponse.json({ error: "Jurnal dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
