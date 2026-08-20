import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { ensureIncomeFromProject } from "@/lib/admin/transactions";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, client_name, description, total_value, status, members } = body ?? {};

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama project wajib diisi." }, { status: 400 });
  }
  const value = total_value === "" || total_value == null ? 0 : Number(total_value);
  if (isNaN(value) || value < 0) {
    return NextResponse.json({ error: "Nilai project tidak boleh negatif." }, { status: 400 });
  }

  const membersList: any[] = Array.isArray(members) ? members : [];
  if (membersList.length > 0) {
    for (const m of membersList) {
      const memberId = m.member_id || null;
      const memberName = String(m.name ?? "").trim();
      if (!memberId && !memberName) {
        return NextResponse.json(
          { error: "Setiap kontributor wajib dipilih dari anggota atau diisi namanya." },
          { status: 400 }
        );
      }
      const percent = Number(m.contribution_percent);
      if (!percent || percent <= 0) {
        return NextResponse.json(
          { error: `Persentase kontributor ${memberName || "tersebut"} harus lebih dari 0.` },
          { status: 400 }
        );
      }
    }
    const totalPercent = membersList.reduce((sum: number, m: any) => sum + (Number(m.contribution_percent) || 0), 0);
    if (Math.round(totalPercent) !== 100) {
      return NextResponse.json({ error: `Total kontribusi harus 100% (sekarang: ${totalPercent}%).` }, { status: 400 });
    }
  }

  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: String(name).trim(),
      client_name: client_name?.trim() || null,
      description: description?.trim() || null,
      total_value: value,
      status: status || "active",
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message ?? "Gagal menyimpan project." }, { status: 400 });
  }

  if (membersList.length > 0) {
    const rows = [];
    for (const m of membersList) {
      const memberId = m.member_id || null;
      let memberName = String(m.name ?? "").trim();
      if (memberId && !memberName) {
        const { data: tm } = await supabase.from("team_members").select("name").eq("id", memberId).single();
        memberName = tm?.name ?? "";
      }
      rows.push({
        project_id: project.id,
        member_id: memberId,
        name: memberName || null,
        contribution_percent: Number(m.contribution_percent),
        amount: m.amount === "" || m.amount == null ? null : Number(m.amount),
        tugas: m.tugas === "" || m.tugas == null ? null : String(m.tugas).trim(),
      });
    }
    const { error: membersError } = await supabase.from("project_members").insert(rows);

    if (membersError) {
      return NextResponse.json(
        { error: "Project tersimpan tapi gagal menyimpan anggota: " + membersError.message },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true, id: project.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, name, client_name, description, total_value, status } = body ?? {};

  if (!id) return NextResponse.json({ error: "ID project wajib diisi." }, { status: 400 });
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama project wajib diisi." }, { status: 400 });
  }
  const value = total_value === "" || total_value == null ? 0 : Number(total_value);
  if (isNaN(value) || value < 0) {
    return NextResponse.json({ error: "Nilai project tidak boleh negatif." }, { status: 400 });
  }
  if (!["active", "completed", "paid"].includes(status)) {
    return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
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
    .update({
      name: String(name).trim(),
      client_name: client_name?.trim() || null,
      description: description?.trim() || null,
      total_value: value,
      status,
      completed_at,
    })
    .eq("id", id);

  if (err) {
    return NextResponse.json({ error: "Gagal menyimpan: " + err.message }, { status: 400 });
  }

  let incomeRecorded = false;
  if (status === "paid") {
    incomeRecorded = await ensureIncomeFromProject(
      supabase,
      { id, name: String(name).trim(), client_name: client_name?.trim() || null, total_value: value },
      admin.id
    );
  }

  return NextResponse.json({ ok: true, incomeRecorded });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
