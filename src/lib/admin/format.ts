export function formatRupiah(value: number | string | null | undefined): string {
    const num = Math.round(Number(value ?? 0) || 0);
    const neg = num < 0;
    const abs = Math.abs(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${neg ? '-' : ''}Rp ${abs}`;
}

export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(date));
}

export function formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(date));
}

export function formatPercent(value: number | string | null | undefined): string {
    return `${Number(value ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

export function formatNumber(value: number | string | null | undefined): string {
    return new Intl.NumberFormat('id-ID').format(Number(value ?? 0));
}

export const KAS_PERCENT = 10;

export function calculateDistribution(totalValue: number, contributions: Array<{ percent: number }>) {
    const total = Number(totalValue) || 0;
    const kasPercent = KAS_PERCENT;
    const kasAmount = (total * kasPercent) / 100;
    const distributable = total - kasAmount;
    const totalPercent = contributions.reduce((sum, c) => sum + (Number(c.percent) || 0), 0);

    const memberShares = contributions.map((c) => ({
        percent: Number(c.percent) || 0,
        amount:
            totalPercent > 0
                ? (distributable * (Number(c.percent) || 0)) / totalPercent
                : 0,
    }));

    return {
        total,
        kasPercent,
        kasAmount,
        distributable,
        totalPercent,
        memberShares,
    };
}

function formatGcalDateTime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Build a "Add to Google Calendar" (TEMPLATE) link so a task can be added to
 * any calendar without OAuth — works with shared/public group calendars too.
 */
export function buildGoogleCalendarTemplateUrl(opts: {
    title: string;
    description?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    calendarEmail?: string | null;
}): string {
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', opts.title);

    if (opts.description) {
        params.set('details', opts.description);
    }

    if (opts.startAt) {
        const start = new Date(opts.startAt);
        if (!isNaN(start.getTime())) {
            const defaultEnd = new Date(start.getTime() + 60 * 60 * 1000);
            const end = opts.endAt ? new Date(opts.endAt) : defaultEnd;
            params.set('dates', `${formatGcalDateTime(start)}/${formatGcalDateTime(isNaN(end.getTime()) ? defaultEnd : end)}`);
        }
    }

    if (opts.calendarEmail) {
        params.set('add', opts.calendarEmail);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
