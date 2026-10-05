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

type MutationAuditParams = {
  supabase: SupabaseClient;
  admin: { id: number; name: string };
  action: string;
  entityType: string;
  entityId?: number | null;
  entityName?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  extra?: Record<string, unknown>;
};

// Catat mutasi data. return false = GAGAL mencatat (panggil wajib return 500).
// details selalu berisi snapshot before (nilai lama) dan after (nilai baru).
export async function auditMutation({
  supabase,
  admin,
  action,
  entityType,
  entityId = null,
  entityName = "",
  before,
  after,
  extra,
}: MutationAuditParams): Promise<boolean> {
  const details: Record<string, unknown> = { ...(extra ?? {}) };
  if (before) details.before = before;
  if (after) details.after = after;

  const { error } = await supabase.from("activity_log").insert({
    user_id: admin.id,
    user_name: admin.name,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    details,
  });
  if (error) {
    console.error(
      "[audit] GAGAL CATAT —",
      JSON.stringify({ action, entityType, entityId, user: admin.name, error: error.message, details })
    );
    return false;
  }
  return true;
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
