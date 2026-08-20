import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { isGoogleConfigured, getStoredToken } from "@/lib/admin/gcal";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = isGoogleConfigured();
  const token = await getStoredToken(admin.id);
  const connected = Boolean(token?.refresh_token);

  let google_email: string | null = null;
  if (connected) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("calendar_tokens")
      .select("google_email")
      .eq("user_id", admin.id)
      .single();
    google_email = data?.google_email ?? null;
  }

  return NextResponse.json({ configured, connected, google_email });
}