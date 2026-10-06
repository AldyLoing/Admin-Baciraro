export async function generateReference(
    supabase: any,
    type: 'income' | 'expense',
    year: number
): Promise<string> {
    const prefix = (type === 'income' ? 'INV' : 'EXP') + '-' + year + '-';
    const { data } = await supabase
        .from('transactions')
        .select('reference')
        .eq('type', type)
        .like('reference', `${prefix}%`);
    let max = 0;
    for (const t of data ?? []) {
        const n = parseInt((t.reference ?? '').slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
    }
    return prefix + String(max + 1).padStart(3, '0');
}

/**
 * Catat pembayaran klien (pelunasan) sebagai transaksi income saat project
 * berstatus paid. Menghitung sisa = total_value − Σ income "Pembayaran klien%"
 * yang sudah tercatat (termasuk cicilan) → hanya menyisipkan SELISIHnya.
 * Idempoten: begitu Σ = total_value, tidak membuat duplikat apa pun.
 */
export async function ensureIncomeFromProject(
    supabase: any,
    project: { id: string; name: string; client_name: string | null; total_value: number },
    createdBy?: number | null
): Promise<boolean> {
    const value = Number(project.total_value) || 0;
    if (value <= 0) return false;

    const { data: paidRows } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('project_id', project.id)
        .eq('type', 'income')
        .like('source', 'Pembayaran klien%');
    const paid = ((paidRows ?? []) as Array<{ amount: number; status: string | null }>)
        .filter((t) => t.status !== 'void')
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const remaining = Math.round((value - paid) * 100) / 100;
    if (remaining <= 0) return false; // sudah lunas (penuh atau lewat cicilan)

    const reference = await generateReference(supabase, 'income', new Date().getFullYear());
    const { error } = await supabase.from('transactions').insert({
        date: new Date().toISOString().slice(0, 10),
        type: 'income',
        amount: remaining,
        source: `Pembayaran klien ${project.client_name || project.name} — Pelunasan`,
        description: `Pelunasan project ${project.name}`,
        reference,
        project_id: project.id,
        created_by: createdBy ?? null,
        status: 'active',
    });
    return !error;
}

/**
 * Catat pencairan payout sebagai transaksi expense saat payout berstatus paid.
 * Idempoten per payout (marker di description pakai id payout).
 */
export async function ensureExpenseFromPayout(
    supabase: any,
    payout: { id: string; project_id: string | null; project_name: string; net_amount: number },
    createdBy?: number | null
): Promise<boolean> {
    const value = Number(payout.net_amount) || 0;
    if (value <= 0) return false;

    const marker = `Pencairan payout ${String(payout.id).slice(0, 8)}`;
    const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('type', 'expense')
        .like('description', `${marker}%`)
        .limit(1);
    if (existing && existing.length > 0) return false;

    const reference = await generateReference(supabase, 'expense', new Date().getFullYear());
    const { error } = await supabase.from('transactions').insert({
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        amount: value,
        source: `Payout ${payout.project_name}`,
        description: marker,
        reference,
        project_id: payout.project_id,
        created_by: createdBy ?? null,
    });
    return !error;
}
