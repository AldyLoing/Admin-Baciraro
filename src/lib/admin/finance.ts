import type { SupabaseClient } from "@supabase/supabase-js";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export type ExpenseTx = {
  type: string;
  amount: number | string | null;
  source?: string | null;
  description?: string | null;
  status?: string | null;
};

export type PayoutFinance = {
  id?: string | number | null;
  status?: string | null;
  total_amount: number | string | null;
  orders_fee: number | string | null;
  kas_optional_amount?: number | string | null;
  net_amount: number | string | null;
};

export function isPayoutExpense(tx: {
  type: string;
  source?: string | null;
  description?: string | null;
}) {
  if (tx.type !== "expense") return false;
  return (
    (tx.source ?? "").startsWith("Payout ") ||
    (tx.description ?? "").startsWith("Pencairan payout ")
  );
}

export function sumOperationalExpense(transactions: ExpenseTx[]) {
  return round2(
    transactions
      .filter((tx) => tx.status !== "void" && tx.type === "expense" && !isPayoutExpense(tx))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0)
  );
}

export function payoutExpenseAmount(payout: PayoutFinance) {
  return round2(
    Math.max(
      0,
      (Number(payout.total_amount) || 0) -
        (Number(payout.orders_fee) || 0) -
        (Number(payout.kas_optional_amount) || 0) -
        (Number(payout.net_amount) || 0)
    )
  );
}

export function sumAllocatedExpense(
  payouts: PayoutFinance[],
  excludePayoutId?: string | number
) {
  const excluded = excludePayoutId == null ? null : String(excludePayoutId);
  return round2(
    payouts
      .filter(
        (payout) =>
          payout.status !== "cancelled" &&
          (excluded === null || String(payout.id) !== excluded)
      )
      .reduce((sum, payout) => sum + payoutExpenseAmount(payout), 0)
  );
}

export async function getProjectExpenseState(
  supabase: SupabaseClient,
  projectId: string | number,
  excludePayoutId?: string | number
) {
  const [{ data: transactions }, { data: payouts }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount, source, description, status")
      .eq("project_id", projectId),
    supabase
      .from("payouts")
      .select("id, status, total_amount, orders_fee, kas_optional_amount, net_amount")
      .eq("project_id", projectId),
  ]);

  const operationalExpense = sumOperationalExpense((transactions ?? []) as ExpenseTx[]);
  const allocatedExpense = sumAllocatedExpense(
    (payouts ?? []) as PayoutFinance[],
    excludePayoutId
  );

  return {
    operationalExpense,
    allocatedExpense,
    unallocatedExpense: round2(Math.max(0, operationalExpense - allocatedExpense)),
  };
}
