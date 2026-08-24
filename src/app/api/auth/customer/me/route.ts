import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

function getToken(req: NextRequest) {
  return req.cookies.get("customer_token")?.value;
}

function verifyToken(token: string) {
  return jwt.verify(token, SECRET) as { id: number; email: string; name: string; role: string };
}

export async function GET(req: NextRequest) {
  const token = getToken(req);
  if (!token) {
    return NextResponse.json({ customer: null });
  }

  try {
    const decoded = verifyToken(token);
    const supabase = createAdminClient();
    const { data: customer } = await supabase
      .from("customers")
      .select("id, email, name, phone, photo_url, total_points")
      .eq("id", decoded.id)
      .single();

    if (!customer) {
      return NextResponse.json({ customer: null });
    }
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ customer: null });
  }
}
