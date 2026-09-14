import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function formatAmount(n: unknown): string {
  return Number(n || 0).toLocaleString("id-ID");
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  if (q.length > 50) return NextResponse.json({ results: [] });

  const supabase = createAdminClient();
  const LIKE = `%${escapeLike(q)}%`;

  const [
    projectsRes,
    membersRes,
    transactionsDescRes,
    transactionsSourceRes,
    tasksRes,
    meetingsRes,
    payoutsRes,
  ] = await Promise.all([
    supabase.from("projects").select("id, name, client_name, status").ilike("name", LIKE).limit(5),
    supabase.from("team_members").select("id, name, role").ilike("name", LIKE).limit(5),
    supabase.from("transactions").select("id, description, source, type, amount").ilike("description", LIKE).limit(5),
    supabase.from("transactions").select("id, description, source, type, amount").ilike("source", LIKE).limit(5),
    supabase.from("tasks").select("id, title, status").ilike("title", LIKE).limit(5),
    supabase.from("meeting_notes").select("id, title, date").ilike("title", LIKE).limit(5),
    supabase.from("payouts").select("id, project_name, status").ilike("project_name", LIKE).limit(5),
  ]);

  const txErrors = [transactionsDescRes.error, transactionsSourceRes.error].filter(Boolean);
  if (txErrors.length) console.error("[search] transaction errors:", txErrors);

  const txById = new Map<number, any>();
  for (const t of [...(transactionsDescRes.data ?? []), ...(transactionsSourceRes.data ?? [])]) {
    txById.set(t.id, t);
  }

  const typeLabel = (t: string | null) => {
    if (t === "income") return "Pemasukan";
    if (t === "expense") return "Pengeluaran";
    return t || "Lainnya";
  };

  return NextResponse.json({
    results: [
      ...(projectsRes.data ?? []).map((p: any) => ({ type: "project", id: p.id, label: p.name, sub: p.client_name || p.status, href: `/admin/projects/${p.id}` })),
      ...(membersRes.data ?? []).map((m: any) => ({ type: "member", id: m.id, label: m.name, sub: m.role, href: "/admin/members" })),
      ...Array.from(txById.values()).slice(0, 5).map((t: any) => ({ type: "transaction", id: t.id, label: t.description || t.source || "Transaksi", sub: `${typeLabel(t.type)} — ${formatAmount(t.amount)}`, href: "/admin/transactions" })),
      ...(tasksRes.data ?? []).map((t: any) => ({ type: "task", id: t.id, label: t.title || "Tugas", sub: t.status, href: "/admin/schedule" })),
      ...(meetingsRes.data ?? []).map((m: any) => ({ type: "meeting", id: m.id, label: m.title || "Rapat", sub: m.date, href: "/admin/meetings" })),
      ...(payoutsRes.data ?? []).map((p: any) => ({ type: "payout", id: p.id, label: p.project_name || "Payout", sub: p.status, href: `/admin/payouts/${p.id}` })),
    ],
  });
}
