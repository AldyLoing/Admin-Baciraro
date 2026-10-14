import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = String(body.current_password ?? "");
  const next = String(body.new_password ?? "");
  const confirm = String(body.confirm_password ?? "");

  if (!current) return NextResponse.json({ error: "Password lama wajib diisi." }, { status: 400 });
  if (next.length < 6) {
    return NextResponse.json({ error: "Password baru minimal 6 karakter." }, { status: 400 });
  }
  if (next !== confirm) {
    return NextResponse.json({ error: "Konfirmasi password baru tidak cocok." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user, error: userErr } = await supabase
    .from("team_members")
    .select("id, name, password")
    .eq("id", admin.id)
    .single();
  if (userErr || !user) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }
  if (!user.password || !user.password.startsWith("$2") || !bcrypt.compareSync(current, user.password)) {
    return NextResponse.json({ error: "Password lama salah." }, { status: 400 });
  }

  const { error: updErr } = await supabase
    .from("team_members")
    .update({ password: bcrypt.hashSync(next, 10) })
    .eq("id", admin.id);
  if (updErr) return NextResponse.json({ error: "Gagal menyimpan: " + updErr.message }, { status: 400 });

  const ok = await auditMutation({
    supabase, admin, action: "update_password", entityType: "member",
    entityId: admin.id, entityName: admin.name,
    extra: { self_service: true, password_changed: true },
  });
  if (!ok) return NextResponse.json({ error: "Password berhasil diubah, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
