import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAuthorizedClient, createGcalEvent, updateGcalEvent, deleteGcalEvent, listGcalEvents } from "@/lib/admin/gcal";
import { fetchIcsEvents } from "@/lib/admin/ics";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getAuthorizedClient(admin.id);
  if (!auth) {
    return NextResponse.json({ error: "Google Calendar belum terhubung" }, { status: 400 });
  }

  const body = await req.json();
  const { taskId } = body as { taskId?: string };

  if (!taskId) {
    return NextResponse.json({ error: "taskId wajib" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, description, due_date, gcal_event_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task tidak ditemukan" }, { status: 404 });
  }

  try {
    if (task.gcal_event_id) {
      await updateGcalEvent(auth, task.gcal_event_id, {
        title: task.title,
        description: task.description,
        startAt: task.due_date,
      });
    } else {
      const eventId = await createGcalEvent(auth, {
        title: task.title,
        description: task.description,
        startAt: task.due_date,
      });
      await supabase.from("tasks").update({ gcal_event_id: eventId }).eq("id", task.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Sync task ke Google Calendar gagal:", err);
    return NextResponse.json({ error: "Gagal sinkronisasi ke Google Calendar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getAuthorizedClient(admin.id);
  if (!auth) {
    return NextResponse.json({ error: "Google Calendar belum terhubung" }, { status: 400 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId wajib" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: task } = await supabase.from("tasks").select("gcal_event_id").eq("id", taskId).single();
  if (task?.gcal_event_id) {
    await deleteGcalEvent(auth, task.gcal_event_id);
    await supabase.from("tasks").update({ gcal_event_id: null }).eq("id", taskId);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auth = await getAuthorizedClient(admin.id);
  if (!auth && !process.env.GOOGLE_CALENDAR_ICS_URL) {
    return NextResponse.json(
      { error: "Google Calendar belum terhubung dan GOOGLE_CALENDAR_ICS_URL belum diisi" },
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();
    let inserted = 0;
    let updated = 0;
    let events: { id: string; summary: string | null; description: string | null; start: string | null; end: string | null }[] = [];
    let source: "oauth" | "ics" = "ics";

    if (auth) {
      source = "oauth";
      events = await listGcalEvents(auth, { maxResults: 250 });
    } else {
      const icsUrl = process.env.GOOGLE_CALENDAR_ICS_URL;
      if (!icsUrl) {
        return NextResponse.json(
          { error: "Google Calendar belum terhubung dan GOOGLE_CALENDAR_ICS_URL belum diisi" },
          { status: 400 }
        );
      }
      const icsEvents = await fetchIcsEvents(icsUrl);
      events = icsEvents.map((e) => ({
        id: e.uid,
        summary: e.summary ?? null,
        description: e.description ?? null,
        start: e.start ?? null,
        end: e.end ?? null,
      }));
    }

    for (const event of events) {
      if (!event.summary || !event.start) continue;
      const dueDate = event.start.slice(0, 10);

      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("gcal_event_id", event.id)
        .maybeSingle();

      const payload = {
        title: event.summary,
        description: event.description,
        due_date: dueDate,
        gcal_event_id: event.id,
      };

      if (existing) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await supabase.from("tasks").insert({
          ...payload,
          assigned_to: admin.id,
          status: "pending",
        });
        if (!error) inserted++;
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      total: events.length,
      source,
    });
  } catch (err) {
    console.error("Pull dari Google Calendar gagal:", err);
    return NextResponse.json({ error: "Gagal mengambil event dari Google Calendar" }, { status: 500 });
  }
}