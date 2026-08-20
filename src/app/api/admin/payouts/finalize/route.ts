import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { calculateDistribution } from "@/lib/admin/format";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, actual_total } = await req.json();
  if (!id) return NextResponse.json({ error: "ID payout wajib diisi." }, { status: 400 });

  const actual = Number(actual_total);
  if (actual_total === undefined || actual_total === null || actual_total === "" || isNaN(actual) || actual < 0) {
    return NextResponse.json({ error: "Total riil pendapatan wajib diisi (angka lebih dari atau sama dengan 0)." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: payout } = await supabase
    .from("payouts")
    .select("id, status")
    .eq("id", id)
    .single();
  if (!payout) return NextResponse.json({ error: "Payout tidak ditemukan." }, { status: 404 });
  if (payout.status === "paid") {
    return NextResponse.json({ error: "Payout sudah dibayar; total riil tidak bisa diubah." }, { status: 400 });
  }

  const { data: members } = await supabase
    .from("payout_members")
    .select("id, contribution_percent")
    .eq("payout_id", id);

  const contribs = (members ?? []).map((m: { contribution_percent: number | string }) => ({ percent: Number(m.contribution_percent) }));
  const dist = calculateDistribution(actual, contribs);

  const { error: err } = await supabase
    .from("payouts")
    .update({
      total_amount: Number(dist.total.toFixed(2)),
      orders_fee: Number(dist.kasAmount.toFixed(2)),
      net_amount: Number(dist.distributable.toFixed(2)),
      finalized_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (err) {
    return NextResponse.json({ error: "Gagal menyimpan total riil: " + err.message }, { status: 400 });
  }

  for (const m of members ?? []) {
    const percent = Number(m.contribution_percent) || 0;
    const amount = dist.totalPercent > 0 ? (dist.distributable * percent) / dist.totalPercent : 0;
    const { error: merr } = await supabase
      .from("payout_members")
      .update({ amount: Number(amount.toFixed(2)) })
      .eq("id", m.id);
    if (merr) {
      return NextResponse.json(
        { error: "Total riil tersimpan, tapi gagal memperbarui sebagian rincian: " + merr.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    message: `Total riil disimpan. Net untuk member ${dist.distributable.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}.`,
  });
}