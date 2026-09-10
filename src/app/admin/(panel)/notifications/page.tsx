import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import NotificationsClient from "./NotificationsClient";

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin();
  if (!admin) return null;

  const supabase = createAdminClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", admin.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <NotificationsClient
      notifications={(notifications ?? []).map((n) => ({
        id: n.id,
        type: n.type ?? "info",
        message: n.message,
        link: n.link ?? null,
        is_read: n.is_read,
        created_at: n.created_at,
      }))}
      unreadCount={unreadCount}
      userId={admin.id}
    />
  );
}
