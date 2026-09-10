import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import AccountsClient from "./AccountsClient";

export const revalidate = 60;

export default async function AdminAccountsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, parent_code, is_active, created_at")
    .order("code", { ascending: true });

  return (
    <AccountsClient
      accounts={(accounts ?? []).map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        parent_code: a.parent_code ?? null,
        is_active: a.is_active ?? true,
        created_at: a.created_at,
      }))}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
