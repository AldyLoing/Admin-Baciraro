import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const supabase = createAdminClient();

  let { data: user } = await supabase
    .from("team_members")
    .select("id, username, password, name, is_admin")
    .eq("username", username)
    .single();

  if (!user && username === "baciraro@gmail.com") {
    const hashed = bcrypt.hashSync(password, 10);
    const { data: newUser, error } = await supabase
      .from("team_members")
      .insert({
        name: "Admin",
        role: "Founder",
        division: "founder",
        username,
        email: username,
        password: hashed,
        is_admin: true,
        status: "active",
      })
      .select()
      .single();
    if (!error && newUser) user = newUser;
  }

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = jwt.sign({ id: user.id, username: user.username, name: user.name }, SECRET, { expiresIn: "7d" });

  const res = NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, is_admin: user.is_admin } });
  res.cookies.set("token", token, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });

  return res;
}
