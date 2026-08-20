import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    return NextResponse.json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, SECRET) as { id: number; username: string; name: string };
    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from("team_members")
      .select("id, username, name")
      .eq("id", decoded.id)
      .single();

    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
