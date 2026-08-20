import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { ensureIncomeFromProject } from "@/lib/admin/transactions";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !["active", "completed", "paid"].includes(status)) {
    return NextResponse.json({ error: "Parameter status tidak valid." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("id, name, client_name, total_value, completed_at")
    .eq("id", id)
    .single();

  if (!existing) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

  const completed_at = status === "active" ? null : (existing.completed_at ?? new Date().toISOString());

  const { error: err } = await supabase
    .from("projects")
    .update({ status, completed_at })
    .eq("id", id);

  if (err) {
    return NextResponse.json({ error: "Gagal ubah status: " + err.message }, { status: 400 });
  }

  let incomeRecorded = false;
  if (status === "paid") {
    incomeRecorded = await ensureIncomeFromProject(
      supabase,
      {
        id,
        name: existing.name,
        client_name: existing.client_name,
        total_value: Number(existing.total_value),
      },
      admin.id
    );
  }

  return NextResponse.json({ ok: true, incomeRecorded });
}
