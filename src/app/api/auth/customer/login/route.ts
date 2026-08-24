import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password harus diisi" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, email, password, name, phone, photo_url, total_points")
    .eq("email", email)
    .single();

  if (!customer || !bcrypt.compareSync(password, customer.password)) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const token = jwt.sign(
    { id: customer.id, email: customer.email, name: customer.name, role: "customer" },
    SECRET,
    { expiresIn: "30d" }
  );

  const res = NextResponse.json({
    customer: {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      photo_url: customer.photo_url,
      total_points: customer.total_points,
    },
  });
  res.cookies.set("customer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return res;
}
