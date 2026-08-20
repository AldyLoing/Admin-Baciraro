export type IcsEvent = {
    uid: string;
    summary: string | null;
    description: string | null;
    start: string | null;
    end: string | null;
};

/**
 * Parse iCal (ICS) text into simple events.
 * Handles both DATE (all-day) and DATE-TIME values.
 */
export function parseIcs(text: string): IcsEvent[] {
    const events: IcsEvent[] = [];

    // Normalize line folding: ICS lines can be folded with CRLF + space/tab
    const unfolded = text.replace(/\r?\n[ \t]/g, '');

    const lines = unfolded.split(/\r?\n/);
    let current: Record<string, string> | null = null;

    for (const raw of lines) {
        const line = raw.trim();
        if (line.length === 0) continue;

        if (line === 'BEGIN:VEVENT') {
            current = {};
            continue;
        }
        if (line === 'END:VEVENT') {
            if (current) {
                events.push({
                    uid: current['UID'] ?? `${current['SUMMARY'] ?? 'event'}-${current['DTSTART'] ?? Date.now()}`,
                    summary: current['SUMMARY'] ?? null,
                    description: current['DESCRIPTION'] ?? null,
                    start: parseIcsDate(current['DTSTART']),
                    end: parseIcsDate(current['DTEND'] ?? current['DTSTART']),
                });
            }
            current = null;
            continue;
        }
        if (!current) continue;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        let key = line.slice(0, colonIndex);
        const value = line.slice(colonIndex + 1);

        // Strip parameters like DTSTART;TZID=Asia/Makassar -> DTSTART
        const keyParts = key.split(';');
        key = keyParts[0];

        // Unescape common ICS escapes
        let cleanValue = value
            .replace(/\\n/g, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\');

        // Keep last occurrence (some feeds repeat keys)
        if (current[key] !== undefined) {
            current[key] = current[key] + '\n' + cleanValue;
        } else {
            current[key] = cleanValue;
        }
    }

    return events;
}

function parseIcsDate(value?: string): string | null {
    if (!value) return null;

    const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!match) return null;

    const [, y, m, d, hh = '00', mm = '00', ss = '00', zulu] = match;
    // Build ISO. For non-Z times we don't know the timezone, so emit without offset
    // (the browser will interpret it as local time, which is acceptable for a calendar feed).
    if (zulu) {
        return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
    }
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export async function fetchIcsEvents(icsUrl: string): Promise<IcsEvent[]> {
    const res = await fetch(icsUrl, {
        headers: {
            Accept: 'text/calendar',
            'User-Agent': 'Baciraro-Admin/1.0',
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Gagal mengambil kalender (HTTP ${res.status})`);
    }

    const text = await res.text();
    return parseIcs(text);
}

function escapeIcsText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

function formatIcsUtc(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export type IcsBuildOptions = {
    title: string;
    description?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    organizerEmail?: string | null;
};

/**
 * Build a downloadable .ics (iCalendar) file for a task.
 * Importable to Google Calendar regardless of browser sign-in state.
 */
export function buildIcs({ title, description, startAt, endAt, organizerEmail }: IcsBuildOptions): string {
    const now = new Date();
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@baciraro.id`;
    const start = startAt ? new Date(startAt) : now;
    const end = endAt ? new Date(endAt) : new Date(start.getTime() + 60 * 60 * 1000);

    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Baciraro//Admin Panel//ID',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatIcsUtc(now)}`,
        `DTSTART:${formatIcsUtc(start)}`,
        `DTEND:${formatIcsUtc(isNaN(end.getTime()) ? new Date(start.getTime() + 60 * 60 * 1000) : end)}`,
        `SUMMARY:${escapeIcsText(title)}`,
    ];

    if (description) {
        lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    if (organizerEmail) {
        lines.push(`ORGANIZER;CN=Baciraro:mailto:${organizerEmail}`);
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.join('\r\n');
}

/**
 * Build a downloadable .ics file containing multiple events
 * (e.g. all tasks with a due date).
 */
export function buildCalendarIcs(events: IcsBuildOptions[]): string {
    const now = new Date();
    const lines: string[] = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Baciraro//Admin Panel//ID',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
    ];

    events.forEach((event, index) => {
        const start = event.startAt ? new Date(event.startAt) : now;
        const end = event.endAt
            ? new Date(event.endAt)
            : new Date(start.getTime() + 60 * 60 * 1000);
        const uid = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}@baciraro.id`;

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${formatIcsUtc(now)}`);
        lines.push(`DTSTART:${formatIcsUtc(start)}`);
        lines.push(`DTEND:${formatIcsUtc(isNaN(end.getTime()) ? new Date(start.getTime() + 60 * 60 * 1000) : end)}`);
        lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
        if (event.description) {
            lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
        }
        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}
