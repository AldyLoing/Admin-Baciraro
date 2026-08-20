import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { exchangeCode } from "@/lib/admin/gcal";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_oauth_state")?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/admin/schedule?error=no_code", url.origin));
  }

  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/admin/schedule?error=state_mismatch", url.origin));
  }

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login?error=session", url.origin));
  }

  try {
    const { tokens, email } = await exchangeCode(code);

    const supabase = createAdminClient();
    const { error } = await supabase.from("calendar_tokens").upsert(
      {
        user_id: admin.id,
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? null,
        expiry_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        google_email: email,
        scope: tokens.scope ?? null,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return NextResponse.redirect(new URL("/admin/schedule?error=save_failed", url.origin));
    }

    cookieStore.delete("google_oauth_state");
    return NextResponse.redirect(new URL("/admin/schedule?connected=1", url.origin));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/admin/schedule?error=auth_failed", url.origin));
  }
}