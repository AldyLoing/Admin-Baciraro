import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateReference } from "@/lib/admin/transactions";
import { auditMutation } from "@/lib/admin/audit";
import { voidTransaction } from "@/lib/admin/void";

async function createJournalEntry(
  supabase: any,
  tx: { id: number; date: string; description: string; reference: string; type: string; amount: number; account_code?: number | null },
  createdBy: number | null
) {
  const { data: accounts } = await supabase.from("accounts").select("code, type").order("code");
  if (!accounts || accounts.length === 0) return;

  const bankAccount = accounts.find((a: any) => a.type === "asset")?.code ?? 1101;
  const incomeAccount = 4101;

  let expenseAccount = 5119;
  if (tx.account_code) {
    const found = accounts.find((a: any) => a.code === tx.account_code && a.type === "expense");
    if (found) expenseAccount = found.code;
  }

  const desc = `${tx.type === "income" ? "Pemasukan" : "Pengeluaran"} — ${tx.description || tx.reference}`;
  let lines: { account_code: number; debit: number; credit: number; description: string }[] = [];

  if (tx.type === "income") {
    lines = [
      { account_code: bankAccount, debit: tx.amount, credit: 0, description: desc },
      { account_code: incomeAccount, debit: 0, credit: tx.amount, description: desc },
    ];
  } else {
    lines = [
      { account_code: expenseAccount, debit: tx.amount, credit: 0, description: desc },
      { account_code: bankAccount, debit: 0, credit: tx.amount, description: desc },
    ];
  }

  const { data: entry } = await supabase
    .from("journal_entries")
    .insert({
      date: tx.date,
      description: desc,
      reference: tx.reference,
      total_debit: tx.amount,
      total_credit: tx.amount,
      transaction_id: tx.id,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (entry) {
    await supabase.from("journal_entry_lines").insert(
      lines.map((l) => ({ ...l, journal_entry_id: entry.id }))
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, type, amount, source, description, project_id, account_code } = await req.json();
  const value = Number(amount);

  if (!date || !source || !String(source).trim()) {
    return NextResponse.json({ error: "Tanggal dan sumber wajib diisi." }, { status: 400 });
  }
  if (!value || isNaN(value) || value <= 0) {
    return NextResponse.json({ error: "Jumlah harus berupa angka lebih dari 0." }, { status: 400 });
  }
  if (!["income", "expense"].includes(type)) {
    return NextResponse.json({ error: "Jenis transaksi tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const reference = await generateReference(supabase, type, Number(date.slice(0, 4)));

  const defaultAccountCode = type === "income" ? 4101 : (account_code || 5119);

  const { data: tx, error } = await supabase
    .from("transactions")
    .insert({
      date,
      type,
      amount: value,
      source: String(source).trim(),
      description: description?.trim() ?? "",
      reference,
      project_id: project_id || null,
      account_code: defaultAccountCode,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Gagal menambah transaksi: " + error.message }, { status: 400 });

  try {
    await createJournalEntry(supabase, {
      id: tx.id,
      date,
      description: description?.trim() ?? "",
      reference,
      type,
      amount: value,
      account_code: defaultAccountCode,
    }, admin.id);
  } catch {
    // journal entry is optional, transaction already saved
  }

  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "transaction", entityId: tx.id, entityName: reference,
    after: { date, type, amount: value, source: String(source).trim(), description: description?.trim() ?? "", project_id: project_id || null, account_code: defaultAccountCode },
  });
  if (!ok) return NextResponse.json({ error: "Transaksi dicatat, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true, reference });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, date, type, amount, source, description, project_id, account_code } = await req.json();
  const value = Number(amount);

  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  if (!date || !source || !String(source).trim()) {
    return NextResponse.json({ error: "Tanggal dan sumber wajib diisi." }, { status: 400 });
  }
  if (!value || isNaN(value) || value <= 0) {
    return NextResponse.json({ error: "Jumlah harus berupa angka lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("transactions").select("*").eq("id", id).single();
  const updates = {
    date,
    type,
    amount: value,
    source: String(source).trim(),
    description: description?.trim() ?? "",
    project_id: project_id || null,
    account_code: account_code || (type === "income" ? 4101 : 5119),
  };
  const { error } = await supabase.from("transactions").update(updates).eq("id", id);

  if (error) return NextResponse.json({ error: "Gagal memperbarui transaksi: " + error.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "update", entityType: "transaction", entityId: Number(id),
    entityName: before?.reference || String(id), before, after: updates,
  });
  if (!ok) return NextResponse.json({ error: "Transaksi diperbarui, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  if (before.status === "void") return NextResponse.json({ error: "Transaksi sudah dibatalkan." }, { status: 400 });

  const res = await voidTransaction(supabase, Number(id), admin.id);
  if (!res.ok) return NextResponse.json({ error: "Gagal membatalkan: " + res.error }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "void", entityType: "transaction", entityId: Number(id),
    entityName: before?.reference || String(id), before,
    after: { ...before, status: "void" },
  });
  if (!ok) return NextResponse.json({ error: "Transaksi dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
