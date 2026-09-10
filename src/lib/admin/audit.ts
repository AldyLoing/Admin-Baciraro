import { SupabaseClient } from "@supabase/supabase-js";

type ActivityParams = {
  supabase: SupabaseClient;
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityName?: string;
  details?: Record<string, unknown>;
};

export async function logActivity({
  supabase,
  userId,
  userName,
  action,
  entityType,
  entityId = null,
  entityName = "",
  details = {},
}: ActivityParams) {
  await supabase.from("activity_log").insert({
    user_id: userId,
    user_name: userName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
  });
}

type NotificationParams = {
  supabase: SupabaseClient;
  userId: number;
  type: string;
  message: string;
  link?: string;
};

export async function createNotification({
  supabase,
  userId,
  type,
  message,
  link,
}: NotificationParams) {
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    message,
    link: link ?? null,
  });
}
