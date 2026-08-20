import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/utils/admin";
import { getAuthUrl, isGoogleConfigured } from "@/lib/admin/gcal";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isGoogleConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar belum dikonfigurasi. Isi GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_REDIRECT_URI di .env.local" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = getAuthUrl(state);
  return NextResponse.redirect(url);
}