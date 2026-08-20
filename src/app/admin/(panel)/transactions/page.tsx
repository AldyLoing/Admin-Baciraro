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
        created_at: t.created_at,
      }))}
      projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
