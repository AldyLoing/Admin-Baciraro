import { createAdminClient } from "@/utils/supabase/admin";
import LeaderboardClient from "./LeaderboardClient";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  total_points: number;
  created_at: string;
  claim_count: number;
  event_points: number;
  product_points: number;
  last_claim_at: string | null;
};

type CustomerRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  total_points: number | null;
  created_at: string;
};

type TxRow = {
  customer_id: number;
  points: number | null;
  description: string | null;
  created_at: string | null;
};

export default async function LeaderboardPage() {
  const supabase = createAdminClient();

  const [{ data: customers }, { data: txs }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, email, phone, photo_url, total_points, created_at")
      .order("total_points", { ascending: false }),
    supabase
      .from("points_transactions")
      .select("customer_id, points, description, created_at"),
  ]);

  const list = (customers || []).map((c: CustomerRow) => {
    const mine = (txs || []).filter((t: TxRow) => t.customer_id === c.id);
    let eventPoints = 0;
    let productPoints = 0;
    let lastClaim: string | null = null;
    for (const t of mine) {
      const pts = t.points || 0;
      if (typeof t.description === "string" && t.description.startsWith("Klaim QR Event")) {
        eventPoints += pts;
      } else {
        productPoints += pts;
      }
      const d = t.created_at;
      if (d && (!lastClaim || d > lastClaim)) lastClaim = d;
    }
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      photo_url: c.photo_url,
      total_points: c.total_points || 0,
      created_at: c.created_at,
      claim_count: mine.length,
      event_points: eventPoints,
      product_points: productPoints,
      last_claim_at: lastClaim,
    } as Row;
  });

  const stats = {
    totalCustomers: list.length,
    totalDistributed: (txs || []).reduce((s: number, t: TxRow) => s + (t.points || 0), 0),
    totalClaims: (txs || []).length,
  };

  return <LeaderboardClient rows={list} stats={stats} />;
}
