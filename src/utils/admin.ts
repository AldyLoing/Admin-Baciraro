import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

export type AdminUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  status: string;
  avatar_url: string | null;
  is_admin: boolean;
};

/**
 * Guard untuk panel admin (server components & API routes).
 * Baca cookie JWT "token", verify, lalu cek team_members.is_admin.
 * Return user admin atau null (tidak login / bukan admin / nonaktif).
 */
export async function requireAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, SECRET) as { id: number };
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("team_members")
      .select("id, username, name, role, status, photo_url, is_admin")
      .eq("id", decoded.id)
      .single();

    if (!data || !data.is_admin || data.status === "inactive") return null;
    return { ...data, avatar_url: data.photo_url } as AdminUser;
  } catch {
    return null;
  }
}
