import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import ActivityLogClient from "./ActivityLogClient";

export default async function AdminActivityPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: activities } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <ActivityLogClient
      activities={(activities ?? []).map((a) => ({
        id: a.id,
        user_name: a.user_name ?? a.user_id ?? "-",
        action: a.action,
        entity_type: a.entity_type,
        entity_name: a.entity_name ?? "-",
        details: a.details ?? null,
        created_at: a.created_at,
      }))}
    />
  );
}
