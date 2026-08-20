import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { fetchIcsEvents } from "@/lib/admin/ics";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const icsUrl = process.env.GOOGLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return NextResponse.json({ error: "GOOGLE_CALENDAR_ICS_URL belum dikonfigurasi." }, { status: 400 });
  }

  let events;
  try {
    events = await fetchIcsEvents(icsUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengambil kalender." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let inserted = 0;
  let updated = 0;

  for (const ev of events) {
    if (!ev.summary || !ev.start) continue;
    const dueDate = ev.start.slice(0, 10);

    const { data: existing } = await supabase
      .from("tasks")
      .select("id, due_date")
      .eq("ics_uid", ev.uid)
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.due_date !== dueDate) {
        const { error } = await supabase
          .from("tasks")
          .update({ due_date: dueDate, description: ev.description ?? null })
          .eq("id", existing.id);
        if (!error) updated++;
      }
      continue;
    }

    const { error } = await supabase.from("tasks").insert({
      title: ev.summary,
      description: ev.description ?? null,
      due_date: dueDate,
      assigned_to: admin.id,
      status: "pending",
      ics_uid: ev.uid,
    });
    if (!error) inserted++;
  }

  return NextResponse.json({ ok: true, total: events.length, inserted, updated });
}
