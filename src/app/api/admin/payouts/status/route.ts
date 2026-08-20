import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { ensureExpenseFromPayout } from "@/lib/admin/transactions";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !["pending", "processing", "paid"].includes(status)) {
    return NextResponse.json({ error: "Parameter status tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: payout, error: updErr } = await supabase
    .from("payouts")
    .update({ status })
    .eq("id", id)
    .select("id, project_id, project_name, net_amount, finalized_at")
    .single();

  if (updErr || !payout) {
    return NextResponse.json({ error: updErr?.message ?? "Gagal update status." }, { status: 400 });
  }

  if (status === "paid" && !payout.finalized_at) {
    return NextResponse.json(
      { error: "Isi total riil pendapatan dulu sebelum menandai payout dibayar." },
      { status: 400 }
    );
  }

  let expenseRecorded = false;
  if (status === "paid") {
    try {
      expenseRecorded = await ensureExpenseFromPayout(supabase, payout, admin.id);
    } catch (e) {
      return NextResponse.json(
        { error: `Status payout tersimpan, tapi gagal mencatat pengeluaran: ${e instanceof Error ? e.message : "unknown"}` },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    expenseRecorded,
    message:
      status === "paid"
        ? expenseRecorded
          ? "Status payout diperbarui & dicatat sebagai pengeluaran di buku kas."
          : "Status payout diperbarui (transaksi expense sudah tercatat sebelumnya)."
        : `Status payout diperbarui menjadi ${status}.`,
  });
}
