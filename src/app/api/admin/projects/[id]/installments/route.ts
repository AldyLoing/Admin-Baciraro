import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation, createNotification } from "@/lib/admin/audit";
import { generateReference } from "@/lib/admin/transactions";
import { voidTransaction } from "@/lib/admin/void";
import { formatRupiah } from "@/lib/admin/format";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Hitung pembayaran klien yang sudah tercatat (income "Pembayaran klien%"
// termasuk cicilan & pelunasan) — dipakai untuk sisa tagihan.
async function sumPaidClient(supabase: SupabaseClient, projectId: string | number) {
  const { data } = await supabase
    .from("transactions")
    .select("amount, status")
    .eq("project_id", projectId)
    .eq("type", "income")
    .like("source", "Pembayaran klien%");
  return round2(
    ((data ?? []) as Array<{ amount: number; status: string | null }>)
      .filter((t) => t.status !== "void")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("project_installments")
    .select("id, installment_no, amount, date, note, status, transaction_id, payout_id, created_at")
    .eq("project_id", id)
    .order("installment_no", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, installments: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const amount = round2(Number(body.amount));
  const date = String(body.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const note = body.note ? String(body.note).trim().slice(0, 300) : null;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Nominal cicilan harus lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_name, total_value, status, completed_at")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });
  if (project.status === "archived") {
    return NextResponse.json({ error: "Project sudah diarsipkan — tidak bisa menambah cicilan." }, { status: 400 });
  }

  const total = round2(Number(project.total_value) || 0);
  const paid = await sumPaidClient(supabase, id);
  const sisa = round2(total - paid);
  if (sisa <= 0) {
    return NextResponse.json({ error: "Project sudah lunas — tidak ada sisa tagihan." }, { status: 400 });
  }
  if (amount > sisa) {
    return NextResponse.json(
      { error: `Cicilan melebihi sisa tagihan (sisa ${formatRupiah(sisa)}).` },
      { status: 400 }
    );
  }

  // Nomor urut (termasuk yang void agar riwayat tidak bentrok)
  const { data: last } = await supabase
    .from("project_installments")
    .select("installment_no")
    .eq("project_id", id)
    .order("installment_no", { ascending: false })
    .limit(1);
  const no = (Number(last?.[0]?.installment_no) || 0) + 1;

  // 1) Income kas ditulis dulu (write-through) — kalau gagal, tidak ada apa-apa.
  const reference = await generateReference(supabase, "income", new Date().getFullYear());
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      date,
      type: "income",
      amount,
      source: `Pembayaran klien ${project.client_name || project.name} — Cicilan ${no}`,
      description: `Cicilan ${no} project ${project.name}${note ? ` — ${note}` : ""}`,
      reference,
      project_id: id,
      created_by: admin.id,
      status: "active",
    })
    .select("id")
    .single();
  if (txErr || !tx) {
    return NextResponse.json(
      { error: "Gagal mencatat pemasukan kas: " + (txErr?.message ?? "tidak diketahui") },
      { status: 500 }
    );
  }

  // 2) Baris cicilan (transaction_id sudah terisi sejak awal → void nanti selalu utuh)
  const { data: inst, error: instErr } = await supabase
    .from("project_installments")
    .insert({
      project_id: id,
      installment_no: no,
      amount,
      date,
      note,
      transaction_id: tx.id,
      created_by: admin.id,
    })
    .select("id, installment_no, amount, date, note, status, transaction_id, payout_id")
    .single();
  if (instErr || !inst) {
    // Kompensasi POST gagal (rollback create) — income belum boleh tertinggal tanpa cicilan.
    await supabase.from("transactions").delete().eq("id", tx.id);
    return NextResponse.json(
      { error: "Gagal menyimpan cicilan: " + (instErr?.message ?? "tidak diketahui") },
      { status: 500 }
    );
  }

  const sisaBaru = round2(sisa - amount);
  const lunas = sisaBaru <= 0;

  // 3) Auto-lunas: sisa 0 → status 'paid' (riwayat & audit tetap tercatat)
  let autoPaid = false;
  if (lunas && project.status !== "paid") {
    const newCompletedAt = project.completed_at ?? new Date().toISOString();
    const { error: upErr } = await supabase
      .from("projects")
      .update({ status: "paid", completed_at: newCompletedAt })
      .eq("id", id);
    if (upErr) {
      console.error("[installment] auto-paid gagal:", upErr.message);
    } else {
      autoPaid = true;
      const okPaid = await auditMutation({
        supabase, admin, action: "update", entityType: "project", entityId: Number(id),
        entityName: project.name,
        before: { status: project.status },
        after: { status: "paid", completed_at: newCompletedAt },
        extra: { auto_lunas: true, installment_no: no },
      });
      if (!okPaid) {
        return NextResponse.json({ error: "Cicilan tersimpan, tetapi audit status gagal. Periksa log server." }, { status: 500 });
      }
    }
  }

  // 4) Notifikasi in-app ke tim
  const { data: pm } = await supabase
    .from("project_members")
    .select("member_id")
    .eq("project_id", id)
    .is("removed_at", null);
  const info = lunas ? "LUNAS" : `sisa ${formatRupiah(sisaBaru)}`;
  for (const m of pm ?? []) {
    if (m.member_id) {
      await createNotification({
        supabase, userId: m.member_id,
        type: "project_installment",
        message: `Cicilan ${no} senilai ${formatRupiah(amount)} diterima untuk "${project.name}" — ${info}`,
        link: `/admin/projects/${id}`,
      });
    }
  }

  // 5) Audit (wajib sukses)
  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "project_installment",
    entityId: inst.id, entityName: `${project.name} — Cicilan ${no}`,
    after: { ...inst, project_id: Number(id) },
    extra: { project_id: Number(id), sisa_tagihan: sisaBaru, income_recorded: tx.id, auto_paid: autoPaid },
  });
  if (!ok) {
    return NextResponse.json({ error: "Cicilan tersimpan, tetapi audit gagal. Periksa log server." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    installment: inst,
    sisa: sisaBaru,
    lunas,
    message: lunas
      ? `Cicilan ${no} diterima — project LUNAS.`
      : `Cicilan ${no} diterima — sisa tagihan ${formatRupiah(sisaBaru)}.`,
  });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: installmentId } = await req.json();
  if (!installmentId) return NextResponse.json({ error: "ID cicilan wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: inst } = await supabase
    .from("project_installments")
    .select("id, project_id, installment_no, amount, status, transaction_id, payout_id")
    .eq("id", installmentId)
    .single();
  if (!inst) return NextResponse.json({ error: "Cicilan tidak ditemukan." }, { status: 404 });
  if (inst.status === "void") return NextResponse.json({ error: "Cicilan sudah dibatalkan." }, { status: 400 });
  if (inst.payout_id) {
    return NextResponse.json(
      { error: "Cicilan sudah dibagikan ke tim — batalkan payout terkait dulu di modul Bagi Hasil." },
      { status: 400 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, total_value, status, completed_at")
    .eq("id", inst.project_id)
    .single();
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

  // 1) Void income kas (+ jurnal bila ada) lebih dulu — gagal = batal total.
  if (inst.transaction_id) {
    const res = await voidTransaction(supabase, Number(inst.transaction_id), admin.id);
    if (!res.ok) {
      return NextResponse.json({ error: "Gagal membatalkan pemasukan kas: " + res.error }, { status: 500 });
    }
  }

  // 2) Void cicilan (tanpa hapus baris)
  const { error: voidErr } = await supabase
    .from("project_installments")
    .update({ status: "void" })
    .eq("id", inst.id);
  if (voidErr) {
    return NextResponse.json({ error: "Gagal membatalkan cicilan: " + voidErr.message }, { status: 500 });
  }

  // 3) Sisa tagihan kembali; kalau auto-lunas tadi, turunkan status project.
  const paid = await sumPaidClient(supabase, inst.project_id);
  const sisaBaru = round2(Math.max(0, (Number(project.total_value) || 0) - paid));
  let newStatus: string | null = null;
  if (sisaBaru > 0 && project.status === "paid") {
    newStatus = project.completed_at ? "completed" : "active";
    const { error: stErr } = await supabase
      .from("projects")
      .update({ status: newStatus })
      .eq("id", project.id);
    if (stErr) {
      console.error("[installment] revert status gagal:", stErr.message);
      newStatus = null;
    } else {
      const okSt = await auditMutation({
        supabase, admin, action: "update", entityType: "project", entityId: Number(project.id),
        entityName: project.name,
        before: { status: "paid" },
        after: { status: newStatus },
        extra: { revert_lunas: true, installment_no: inst.installment_no },
      });
      if (!okSt) {
        return NextResponse.json({ error: "Cicilan dibatalkan, tetapi audit status gagal. Periksa log server." }, { status: 500 });
      }
    }
  }

  // 4) Audit (wajib sukses)
  const ok = await auditMutation({
    supabase, admin, action: "void", entityType: "project_installment",
    entityId: inst.id, entityName: `${project.name} — Cicilan ${inst.installment_no}`,
    before: { status: "active", amount: inst.amount },
    after: { status: "void", amount: inst.amount },
    extra: { project_id: Number(project.id), sisa_tagihan: sisaBaru },
  });
  if (!ok) {
    return NextResponse.json({ error: "Cicilan dibatalkan, tetapi audit gagal. Periksa log server." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sisa: sisaBaru, status: newStatus, message: "Cicilan dibatalkan (riwayat tetap tersimpan)." });
}
