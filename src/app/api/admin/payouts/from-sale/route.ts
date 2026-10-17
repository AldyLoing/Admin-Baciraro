import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateDistribution, formatRupiah } from "@/lib/admin/format";
import { auditMutation, createNotification } from "@/lib/admin/audit";

// Bagi hasil satu penjualan (SL-) ke tim: buat payout finalized senilai
// omzet penjualan dengan aturan yang sama seperti payout project
// (fee Kas Baciraro 10% dipotong dulu, sisanya dibagi per persen anggota).
// 1 penjualan : 1 payout aktif (dibatalkan boleh dibuat ulang).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const saleId = Number(body.sale_id);
  const date: string = String(body.date ?? "").trim();
  const members: unknown[] = Array.isArray(body.members) ? body.members : [];

  if (!saleId) return NextResponse.json({ error: "Penjualan wajib dipilih." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }
  if (members.length === 0) {
    return NextResponse.json({ error: "Tambahkan minimal satu anggota penerima." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: sale } = await supabase
    .from("sales")
    .select("id, reference, recipient, total, status")
    .eq("id", saleId)
    .single();
  if (!sale) return NextResponse.json({ error: "Penjualan tidak ditemukan." }, { status: 404 });
  if (sale.status !== "active") {
    return NextResponse.json({ error: "Penjualan sudah dibatalkan." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("payouts")
    .select("id, status")
    .eq("sale_id", saleId)
    .neq("status", "cancelled")
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Penjualan ini sudah dibagi hasilkan." }, { status: 400 });
  }

  const selected = members.map((raw) => {
    const m = raw as {
      member_id?: number | string | null;
      name?: string | null;
      contribution_percent?: number | string | null;
      tugas?: string | null;
    };
    return {
      member_id: m?.member_id ? Number(m.member_id) : null,
      name: String(m?.name ?? "").trim(),
      contribution_percent: Number(m?.contribution_percent) || 0,
      tugas: m?.tugas == null ? null : String(m.tugas).trim() || null,
    };
  });

  for (const m of selected) {
    if (!m.member_id && !m.name) {
      return NextResponse.json({ error: "Setiap penerima wajib memilih anggota." }, { status: 400 });
    }
    if (m.contribution_percent <= 0) {
      return NextResponse.json({ error: "Setiap penerima harus punya persen lebih dari 0." }, { status: 400 });
    }
  }

  const totalPercent = selected.reduce((s, m) => s + m.contribution_percent, 0);
  if (Math.round(totalPercent) !== 100) {
    return NextResponse.json(
      { error: `Total kontribusi harus 100% (sekarang ${totalPercent.toFixed(2)}%).` },
      { status: 400 }
    );
  }

  const nominal = Math.round((Number(sale.total) || 0) * 100) / 100;
  if (nominal <= 0) {
    return NextResponse.json({ error: "Total penjualan harus lebih dari 0." }, { status: 400 });
  }

  for (const m of selected) {
    if (m.member_id && !m.name) {
      const { data: tm } = await supabase.from("team_members").select("name").eq("id", m.member_id).single();
      m.name = tm?.name ?? "Anggota";
    }
  }

  const dist = calculateDistribution(nominal, selected.map((m) => ({ percent: m.contribution_percent })));
  const payoutLabel = `Penjualan ${sale.reference}${sale.recipient ? ` — ${sale.recipient}` : ""}`;

  const insertData: Record<string, unknown> = {
    sale_id: sale.id,
    source_type: "penjualan",
    project_id: null,
    project_name: payoutLabel,
    date,
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
    if (pErr?.code === "23505") {
      return NextResponse.json({ error: "Penjualan ini sudah dibagi hasilkan." }, { status: 400 });
    }
    return NextResponse.json({ error: pErr?.message ?? "Gagal membuat payout." }, { status: 400 });
  }

  for (let i = 0; i < selected.length; i++) {
    const m = selected[i];
    const { error: mErr } = await supabase.from("payout_members").insert({
      payout_id: payout.id,
      member_id: m.member_id,
      name: m.name || "Anggota",
      contribution_percent: m.contribution_percent,
      amount: Number((dist.memberShares[i]?.amount ?? 0).toFixed(2)),
      tugas: m.tugas,
    });
    if (mErr) {
      await supabase.from("payouts").update({ status: "cancelled" }).eq("id", payout.id);
      return NextResponse.json(
        { error: "Payout dibuat, tetapi gagal menyimpan sebagian rincian: " + mErr.message },
        { status: 400 }
      );
    }
  }

  const ok = await auditMutation({
    supabase, admin, action: "create", entityType: "payout", entityId: payout.id,
    entityName: `${payoutLabel} — ${date}`,
    after: { ...insertData, member_count: selected.length },
  });
  if (!ok) {
    return NextResponse.json({ error: "Payout dibuat, tetapi audit gagal. Periksa log server." }, { status: 500 });
  }

  for (let i = 0; i < selected.length; i++) {
    const m = selected[i];
    if (!m.member_id) continue;
    await createNotification({
      supabase, userId: m.member_id,
      type: "payout",
      message: `Penjualan ${sale.reference} dibagi hasil — hak Anda ${formatRupiah(dist.memberShares[i]?.amount ?? 0)}`,
      link: "/admin/payouts",
    });
  }

  return NextResponse.json({
    ok: true,
    payout_id: payout.id,
    message: `Bagi hasil ${sale.reference} dibuat — payout ${formatRupiah(dist.total)} (net ${formatRupiah(dist.distributable)}) menunggu diproses.`,
  });
}
