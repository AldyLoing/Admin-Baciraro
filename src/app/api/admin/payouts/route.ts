import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project_id, date, members } = await req.json();
  if (!project_id || !date) {
    return NextResponse.json({ error: "Pilih project dan tanggal payout." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, total_value")
    .eq("id", project_id)
    .single();

  if (!project) return NextResponse.json({ error: "Project tidak ditemukan." }, { status: 404 });

  // Anggota penerima: kiriman dari form (prefill project, bisa diubah). Default dari anggota project.
  let selected = Array.isArray(members) && members.length > 0 ? members : null;

  if (!selected) {
    const { data: projectMembers } = await supabase
      .from("project_members")
      .select("member_id, name, contribution_percent, tugas")
      .eq("project_id", project_id);
    selected = (projectMembers ?? []).map((pm: any) => ({
      member_id: pm.member_id,
      name: pm.name ?? "Anggota",
      contribution_percent: Number(pm.contribution_percent),
      tugas: pm.tugas ?? null,
    }));
  }

  if (selected.length > 0) {
    const totalPercent = selected.reduce((s: number, m: any) => s + (Number(m.contribution_percent) || 0), 0);
    if (Math.round(totalPercent) !== 100) {
      return NextResponse.json(
        { error: `Total kontribusi harus 100% (sekarang ${totalPercent.toFixed(2)}%).` },
        { status: 400 }
      );
    }
  }

  // Nominal menyusul: payout dibuat dengan 0, persen + tugas dikunci dari awal.
  // Setelah barang terjual, admin isi total riil lewat PATCH /payouts/finalize.
  const { data: payout, error: err } = await supabase
    .from("payouts")
    .insert({
      project_id: project.id,
      project_name: project.name,
      date,
      total_amount: 0,
      orders_fee: 0,
      net_amount: 0,
      status: "pending",
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (err || !payout) {
    return NextResponse.json({ error: err?.message ?? "Gagal membuat payout." }, { status: 400 });
  }

  for (const m of selected) {
    const memberId = m.member_id ?? null;
    const name = m.name ?? "";
    const percent = Number(m.contribution_percent) || 0;

    let memberName = name;
    if (memberId && !name) {
      const { data: tm } = await supabase.from("team_members").select("name").eq("id", memberId).single();
      memberName = tm?.name ?? "Anggota";
    }

    const { error: merr } = await supabase.from("payout_members").insert({
      payout_id: payout.id,
      member_id: memberId,
      name: memberName,
      contribution_percent: percent,
      amount: 0,
      tugas: m.tugas === "" || m.tugas == null ? null : String(m.tugas).trim(),
    });
    if (merr) {
      return NextResponse.json(
        { error: "Payout dibuat, tapi gagal menyimpan sebagian rincian: " + merr.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true, id: payout.id, message: `Payout untuk "${project.name}" dibuat.` });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("payouts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
