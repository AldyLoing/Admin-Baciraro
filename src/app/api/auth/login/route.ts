import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const u = String(username || "").trim().toLowerCase();
    const supabase = createAdminClient();

    let { data: user } = await supabase
    .from("team_members")
    .select("id, username, password, name, is_admin")
    .or(`username.eq.${u},email.eq.${u}`)
    .single();

  if (!user && u === "baciraro@gmail.com") {
    const hashed = bcrypt.hashSync(password, 10);
    const { data: newUser, error } = await supabase
      .from("team_members")
      .insert({
        name: "Admin",
        role: "Founder",
        division: "founder",
        username: u,
        email: u,
        password: hashed,
        is_admin: true,
        status: "active",
      })
      .select()
      .single();
    if (!error && newUser) user = newUser;
  }

  if (
    !user ||
    !user.password ||
    !user.password.startsWith("$2") ||
    !bcrypt.compareSync(password, user.password)
  ) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET, { expiresIn: "7d" });

  const res = NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, is_admin: user.is_admin } });
  res.cookies.set("token", token, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });

  return res;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
