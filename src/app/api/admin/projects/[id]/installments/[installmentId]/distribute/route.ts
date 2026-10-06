import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation, createNotification } from "@/lib/admin/audit";
import { calculateDistribution, formatRupiah } from "@/lib/admin/format";

// Bagikan satu cicilan ke tim: buat payout pending senilai nominal cicilan,
// rincian per anggota pakai aturan yang sama dengan payout biasa
// (fee Kas Baciraro 10% + persen kontribusi). 1 cicilan : 1 payout.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, installmentId } = await params;
  const supabase = createAdminClient();

  const { data: inst } = await supabase
    .from("project_installments")
    .select("id, project_id, installment_no, amount, date, status, payout_id")
    .eq("id", installmentId)
    .eq("project_id", id)
    .single();
  if (!inst) return NextResponse.json({ error: "Cicilan tidak ditemukan." }, { status: 404 });
  if (inst.status !== "active") return NextResponse.json({ error: "Cicilan sudah dibatalkan." }, { status: 400 });
  if (inst.payout_id) return NextResponse.json({ error: "Cicilan ini sudah dibagikan ke tim." }, { status: 400 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .single();
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

  const { data: projectMembers } = await supabase
    .from("project_members")
    .select("member_id, name, contribution_percent, tugas")
    .eq("project_id", id)
    .is("removed_at", null);
  const selected = (projectMembers ?? []).map((pm: {
    member_id: number | null; name: string | null;
    contribution_percent: number | string; tugas: string | null;
  }) => ({
    member_id: pm.member_id,
    name: pm.name ?? "Anggota",
    contribution_percent: Number(pm.contribution_percent) || 0,
    tugas: pm.tugas ?? null,
  }));

  if (selected.length > 0) {
    const totalPercent = selected.reduce((s, m) => s + m.contribution_percent, 0);
    if (Math.round(totalPercent) !== 100) {
      return NextResponse.json(
        { error: `Total kontribusi anggota harus 100% (sekarang ${totalPercent.toFixed(2)}%).` },
        { status: 400 }
      );
    }
  }

  const nominal = Math.round((Number(inst.amount) || 0) * 100) / 100;
  const contribs = selected.map((m) => ({ percent: m.contribution_percent }));
  const dist = calculateDistribution(nominal, contribs);

  // 1) Payout pending (finalized_at terisi → tinggal proses/bayar seperti biasa)
  const insertData: Record<string, unknown> = {
    project_id: project.id,
    project_name: project.name,
    date: inst.date,
    total_amount: Number(dist.total.toFixed(2)),
    orders_fee: Number(dist.kasAmount.toFixed(2)),
    net_amount: Number(dist.distributable.toFixed(2)),
    kas_optional_percent: 0,
    kas_optional_amount: 0,
    status: "pending",
    finalized_at: new Date().toISOString(),
    created_by: admin.id,
  };
  const { data: payout, error: pErr } = await supabase
    .from("payouts")
    .insert(insertData)
    .select("id")
    .single();
  if (pErr || !payout) {
    return NextResponse.json({ error: pErr?.message ?? "Gagal membuat payout." }, { status: 500 });
  }

  // 2) Tandai cicilan SEBELUM rincian — race condition (klik dobel) gagal di sini.
  const { data: claimed } = await supabase
    .from("project_installments")
    .update({ payout_id: payout.id })
    .eq("id", inst.id)
    .is("payout_id", null)
    .select("id");
  if (!claimed || claimed.length === 0) {
    await supabase.from("payouts").update({ status: "cancelled" }).eq("id", payout.id);
    return NextResponse.json({ error: "Cicilan sudah dibagikan oleh admin lain." }, { status: 400 });
  }

  // 3) Rincian per anggota (mengikuti pola POST /api/admin/payouts)
  for (let i = 0; i < selected.length; i++) {
    const m = selected[i];
    let memberName = m.name;
    if (m.member_id && !m.name) {
      const { data: tm } = await supabase.from("team_members").select("name").eq("id", m.member_id).single();
      memberName = tm?.name ?? "Anggota";
    }
    const memberAmount = Number(dist.memberShares[i]?.amount ?? 0);
    const { error: mErr } = await supabase.from("payout_members").insert({
      payout_id: payout.id,
      member_id: m.member_id,
      name: memberName,
      contribution_percent: m.contribution_percent,
      amount: Number(memberAmount.toFixed(2)),
      tugas: m.tugas == null ? null : String(m.tugas).trim() || null,
    });
    if (mErr) {
      return NextResponse.json(
        { error: "Payout dibuat, tetapi gagal menyimpan sebagian rincian: " + mErr.message },
        { status: 400 }
      );
    }
  }

  // 4) Audit payout + audit distribusi cicilan (wajib sukses)
  const okP = await auditMutation({
    supabase, admin, action: "create", entityType: "payout", entityId: payout.id,
    entityName: `${project.name} — ${inst.date} (Cicilan ${inst.installment_no})`,
    after: { ...insertData, member_count: selected.length, installment_id: inst.id },
  });
  if (!okP) {
    return NextResponse.json({ error: "Payout dibuat, tetapi audit gagal. Periksa log server." }, { status: 500 });
  }
  const okI = await auditMutation({
    supabase, admin, action: "distribute", entityType: "project_installment",
    entityId: inst.id, entityName: `${project.name} — Cicilan ${inst.installment_no}`,
    before: { payout_id: null },
    after: { payout_id: payout.id },
    extra: { project_id: Number(id), payout_id: payout.id, nominal },
  });
  if (!okI) {
    return NextResponse.json({ error: "Payout dibuat, tetapi audit cicilan gagal. Periksa log server." }, { status: 500 });
  }

  // 5) Notifikasi in-app: hak masing-masing anggota
  for (let i = 0; i < selected.length; i++) {
    const m = selected[i];
    if (!m.member_id) continue;
    await createNotification({
      supabase, userId: m.member_id,
      type: "project_installment",
      message: `Cicilan ${inst.installment_no} "${project.name}" dibagikan — hak Anda ${formatRupiah(dist.memberShares[i]?.amount ?? 0)}`,
      link: "/admin/payouts",
    });
  }

  return NextResponse.json({
    ok: true,
    payout_id: payout.id,
    message: `Cicilan ${inst.installment_no} dibagikan — payout ${formatRupiah(dist.total)} menunggu diproses.`,
  });
}
