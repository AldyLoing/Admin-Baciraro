import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import JournalClient from "./JournalClient";

export const revalidate = 15;

export default async function AdminJournalPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, date, description, reference, total_debit, total_credit, transaction_id, created_at, journal_entry_lines(id, account_code, debit, credit, description)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("code, name, type")
      .order("code", { ascending: true }),
  ]);

  return (
    <JournalClient
      entries={(entries ?? []).map((e: any) => ({
        id: e.id,
        date: e.date,
        description: e.description,
        reference: e.reference ?? "",
        total_debit: Number(e.total_debit),
        total_credit: Number(e.total_credit),
        transaction_id: e.transaction_id ?? null,
        created_at: e.created_at,
        lines: (e.journal_entry_lines ?? []).map((l: any) => ({
          id: l.id,
          account_code: l.account_code,
          debit: Number(l.debit),
          credit: Number(l.credit),
          description: l.description ?? "",
        })),
      }))}
      accounts={(accounts ?? []).map((a: any) => ({
        code: a.code,
        name: a.name,
        type: a.type,
      }))}
      isAdmin={admin?.is_admin ?? false}
    />
  );
}
