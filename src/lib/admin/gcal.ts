import { google } from "googleapis";
import { createAdminClient } from "@/utils/supabase/admin";

export const GOOGLE_CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar"];

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

export function getCalendarId(): string {
  return (
    process.env.GOOGLE_CALENDAR_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_EMAIL ||
    "primary"
  );
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    state,
  });
}

export async function exchangeCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token!);

  return {
    tokens,
    email: tokenInfo.email ?? null,
  };
}

type StoredToken = {
  access_token: string | null;
  refresh_token: string | null;
  expiry_at: string | null;
};

export async function getStoredToken(adminId: number): Promise<StoredToken | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("calendar_tokens")
    .select("access_token, refresh_token, expiry_at")
    .eq("user_id", adminId)
    .single();

  return data ?? null;
}

export async function getAuthorizedClient(adminId: number) {
  if (!isGoogleConfigured()) return null;

  const stored = await getStoredToken(adminId);
  if (!stored?.refresh_token) return null;

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: stored.access_token ?? undefined,
    refresh_token: stored.refresh_token,
    expiry_date: stored.expiry_at ? new Date(stored.expiry_at).getTime() : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    const supabase = createAdminClient();
    await supabase
      .from("calendar_tokens")
      .update({
        access_token: tokens.access_token ?? null,
        expiry_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", adminId);
  });

  return oauth2Client;
}

const calendar = google.calendar({ version: "v3" });

export type GcalEventInput = {
  title: string;
  description?: string | null;
  startAt?: string | null;
};

function toGcalDateTime(date?: string | null): string | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export async function createGcalEvent(
  auth: ReturnType<typeof getOAuthClient>,
  input: GcalEventInput
): Promise<string> {
  const start = toGcalDateTime(input.startAt) ?? new Date().toISOString();
  const endDate = new Date(new Date(start).getTime() + 60 * 60 * 1000);

  const res = await calendar.events.insert({
    auth,
    calendarId: getCalendarId(),
    requestBody: {
      summary: input.title,
      description: input.description ?? undefined,
      start: { dateTime: start, timeZone: "Asia/Makassar" },
      end: { dateTime: endDate.toISOString(), timeZone: "Asia/Makassar" },
    },
  });

  const id = res.data.id;
  if (!id) throw new Error("Google Calendar tidak mengembalikan event id.");
  return id;
}

export async function updateGcalEvent(
  auth: ReturnType<typeof getOAuthClient>,
  eventId: string,
  input: GcalEventInput
): Promise<void> {
  const start = toGcalDateTime(input.startAt);

  const body: Record<string, unknown> = {
    summary: input.title,
  };
  if (input.description !== undefined) {
    body.description = input.description ?? "";
  }
  if (start) {
    const endDate = new Date(new Date(start).getTime() + 60 * 60 * 1000);
    body.start = { dateTime: start, timeZone: "Asia/Makassar" };
    body.end = { dateTime: endDate.toISOString(), timeZone: "Asia/Makassar" };
  }

  await calendar.events.patch({
    auth,
    calendarId: getCalendarId(),
    eventId,
    requestBody: body,
  });
}

export async function deleteGcalEvent(
  auth: ReturnType<typeof getOAuthClient>,
  eventId: string
): Promise<void> {
  try {
    await calendar.events.delete({ auth, calendarId: getCalendarId(), eventId });
  } catch {
    // event mungkin sudah terhapus
  }
}

export type GcalEvent = {
  id: string;
  summary: string | null;
  description: string | null;
  start: string | null;
  end: string | null;
};

export async function listGcalEvents(
  auth: ReturnType<typeof getOAuthClient>,
  opts: { timeMin?: Date; timeMax?: Date; maxResults?: number } = {}
): Promise<GcalEvent[]> {
  const res = await calendar.events.list({
    auth,
    calendarId: getCalendarId(),
    timeMin: (opts.timeMin ?? new Date()).toISOString(),
    timeMax: opts.timeMax?.toISOString(),
    maxResults: opts.maxResults ?? 250,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({
      id: item.id!,
      summary: item.summary ?? null,
      description: item.description ?? null,
      start: item.start?.dateTime ?? item.start?.date ?? null,
      end: item.end?.dateTime ?? item.end?.date ?? null,
    }));
}