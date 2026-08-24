import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST(req: NextRequest) {
  const { email, password, name, phone, photo_url } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: "Email, password, dan nama harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  const hashed = bcrypt.hashSync(password, 10);

  const { data, error } = await supabase
    .from("customers")
    .insert({ email, password: hashed, name, phone: phone || "", photo_url: photo_url || "" })
    .select("id, email, name, phone, photo_url, total_points")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const token = jwt.sign(
    { id: data.id, email: data.email, name: data.name, role: "customer" },
    SECRET,
    { expiresIn: "30d" }
  );

  const res = NextResponse.json({ customer: data });
  res.cookies.set("customer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return res;
}
