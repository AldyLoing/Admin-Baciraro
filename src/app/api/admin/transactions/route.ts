import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateReference } from "@/lib/admin/transactions";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, type, amount, source, description, project_id } = await req.json();
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

  const { error } = await supabase.from("transactions").insert({
    date,
    type,
    amount: value,
    source: String(source).trim(),
    description: description?.trim() ?? "",
    reference,
    project_id: project_id || null,
    created_by: admin.id,
  });

  if (error) return NextResponse.json({ error: "Gagal menambah transaksi: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true, reference });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, date, type, amount, source, description, project_id } = await req.json();
  const value = Number(amount);

  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  if (!date || !source || !String(source).trim()) {
    return NextResponse.json({ error: "Tanggal dan sumber wajib diisi." }, { status: 400 });
  }
  if (!value || isNaN(value) || value <= 0) {
    return NextResponse.json({ error: "Jumlah harus berupa angka lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transactions")
    .update({
      date,
      type,
      amount: value,
      source: String(source).trim(),
      description: description?.trim() ?? "",
      project_id: project_id || null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Gagal memperbarui transaksi: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
