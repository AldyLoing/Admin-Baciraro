import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, username, password, email, role, division, photo_url, status, is_admin } = await req.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });
  }
  const uname = String(username || email || "").trim().toLowerCase();
  if (!uname || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi untuk anggota baru." }, { status: 400 });
  }

  const hashed = bcrypt.hashSync(password, 10);

  const supabase = createAdminClient();
  const { error } = await supabase.from("team_members").insert({
    name: String(name).trim(),
    username: uname,
    email: email?.trim().toLowerCase() || uname,
    password: hashed,
    role: role?.trim() || "Member",
    division: division?.trim() || "business",
    photo_url: photo_url?.trim() || null,
    status: status || "active",
    is_admin: !!is_admin,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, username, email, password, role, division, photo_url, status, is_admin } = await req.json();
  if (!id || !name || !String(name).trim()) {
    return NextResponse.json({ error: "ID dan nama wajib diisi." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    name: String(name).trim(),
    role: role?.trim() || "Member",
    division: division?.trim() || "business",
    photo_url: photo_url?.trim() || null,
    status: status || "active",
    is_admin: !!is_admin,
  };

  if (email || username) {
    const uname = String(username || email || "").trim().toLowerCase();
    if (uname) {
      updates.username = uname;
      updates.email = email?.trim().toLowerCase() || uname;
    }
  }
  if (password) {
    updates.password = bcrypt.hashSync(password, 10);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("team_members").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  if (Number(id) === admin.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
