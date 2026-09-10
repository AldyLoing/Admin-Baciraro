import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import BookkeepingClient from "./BookkeepingClient";

export const revalidate = 30;

export default async function AdminBookkeepingPage() {
  const admin = await requireAdmin();
  const supabase = createAdminClient();

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("date, description, reference, total_debit, total_credit, journal_entry_lines(account_code, debit, credit)")
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("accounts")
      .select("code, name, type")
      .order("code", { ascending: true }),
  ]);

  return (
    <BookkeepingClient
      entries={(entries ?? []).map((e: any) => ({
        date: e.date,
        description: e.description,
        reference: e.reference ?? "",
        total_debit: Number(e.total_debit),
        total_credit: Number(e.total_credit),
        lines: (e.journal_entry_lines ?? []).map((l: any) => ({
          account_code: l.account_code,
          debit: Number(l.debit),
          credit: Number(l.credit),
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
