import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const u = String(username || "").trim().toLowerCase();
    const supabase = createAdminClient();

    const { data: user } = await supabase
    .from("team_members")
    .select("id, username, password, name, is_admin, status")
    .or(`username.eq.${u},email.eq.${u}`)
    .single();

  if (
    !user ||
    !user.password ||
    !user.password.startsWith("$2") ||
    !bcrypt.compareSync(password, user.password)
  ) {
    // percobaan gagal dicatat best-effort (tidak mengubah respons auth)
    const { error: logErr } = await supabase.from("activity_log").insert({
      user_id: user?.id ?? null,
      user_name: user?.name || u,
      action: "login_failed",
      entity_type: "session",
      entity_id: null,
      entity_name: u,
      details: { reason: user ? "password_salah" : "akun_tidak_ditemukan" },
    });
    if (logErr) console.error("[audit] gagal catat login_failed:", logErr.message);
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  if (user.status === "inactive") {
    const { error: logErr } = await supabase.from("activity_log").insert({
      user_id: user.id,
      user_name: user.name || u,
      action: "login_failed",
      entity_type: "session",
      entity_id: null,
      entity_name: u,
      details: { reason: "akun_nonaktif" },
    });
    if (logErr) console.error("[audit] gagal catat login_failed:", logErr.message);
    return NextResponse.json({ error: "Akun Anda tidak aktif. Hubungi admin." }, { status: 403 });
  }

  const ok = await auditMutation({
    supabase, admin: { id: user.id, name: user.name },
    action: "login", entityType: "session", entityId: user.id, entityName: user.name,
    after: { username: user.username, is_admin: user.is_admin },
  });
  if (!ok) return NextResponse.json({ error: "Login berhasil dicatat, tetapi audit gagal. Coba lagi." }, { status: 500 });

  const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET, { expiresIn: "7d" });

  const res = NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, is_admin: user.is_admin } });
  res.cookies.set("token", token, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });

  return res;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
