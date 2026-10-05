import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { auditMutation } from "@/lib/admin/audit";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: before } = await supabase.from("calendar_tokens").select("google_email, access_token, refresh_token").eq("user_id", admin.id).single();
  const updates = { access_token: null, refresh_token: null, expiry_at: null, scope: null, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("calendar_tokens").update(updates).eq("user_id", admin.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ok = await auditMutation({
    supabase, admin, action: "disconnect", entityType: "calendar",
    entityName: before?.google_email || admin.name,
    before: before ?? null,
    after: { connected: false },
  });
  if (!ok) return NextResponse.json({ error: "Putus koneksi berhasil, tetapi audit gagal. Periksa log server." }, { status: 500 });

  return NextResponse.json({ ok: true });
}