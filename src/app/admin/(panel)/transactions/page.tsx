import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import TransactionsClient from "./TransactionsClient";

export default async function AdminTransactionsPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .order("name");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("code, name, type")
    .order("code", { ascending: true });

  return (
    <TransactionsClient
      transactions={(transactions ?? []).map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        amount: Number(t.amount),
        source: t.source,
        description: t.description,
        reference: t.reference,
        project_id: t.project_id,
        account_code: t.account_code ?? null,
        created_at: t.created_at,
      }))}
      projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      accounts={(accounts ?? []).map((a) => ({ code: a.code, name: a.name, type: a.type }))}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
