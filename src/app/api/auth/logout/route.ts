import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export async function POST() {
  // catat logout best-effort sebelum cookie dibersihkan
  try {
    const { cookies } = await import("next/headers");
    const token = (await cookies()).get("token")?.value;
    if (token) {
      const decoded = jwt.verify(token, SECRET) as { id: number; name: string };
      const supabase = createAdminClient();
      const { data: user } = await supabase
        .from("team_members")
        .select("id, name")
        .eq("id", decoded.id)
        .single();
      if (user) {
        const ok = await auditMutation({
          supabase, admin: { id: user.id, name: user.name },
          action: "logout", entityType: "session", entityId: user.id, entityName: user.name,
        });
        if (!ok) return NextResponse.json({ error: "Audit gagal, logout dibatalkan. Coba lagi." }, { status: 500 });
      }
    }
  } catch {
    // token tidak valid/kedaluwarsa — tetap lanjut logout
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
