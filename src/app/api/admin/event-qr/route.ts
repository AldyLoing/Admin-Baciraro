import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/utils/admin";
import { createAdminClient } from "@/utils/supabase/admin";

const CLAIM_BASE = process.env.NEXT_PUBLIC_CLAIM_BASE_URL || "https://admin-baciraro-zeta.vercel.app";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const { data: qrs, error } = await supabase
    .from("qr_codes")
    .select("*")
    .eq("is_event", true)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all(
    (qrs || []).map(async (qr: any) => {
      const { count } = await supabase
        .from("points_transactions")
        .select("*", { count: "exact", head: true })
        .eq("qr_code_id", qr.id);

      let claimed_by: any = null;
      if (qr.claimed_at && qr.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("id", qr.customer_id)
          .single();
        claimed_by = cust;
      }

      return {
        id: qr.id,
        code: qr.code,
        event_name: qr.event_name,
        event_points: qr.event_points,
        claimed_at: qr.claimed_at,
        created_at: qr.created_at,
        claim_url: `${CLAIM_BASE}/claim/event/${qr.code}`,
        used: !!qr.claimed_at,
        claim_count: count || 0,
        claimed_by,
      };
    })
  );

  return NextResponse.json({ qrs: enriched });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { points, name } = await req.json();
  const value = Number(points);

  if (!value || isNaN(value) || value <= 0) {
    return NextResponse.json({ error: "Jumlah koin harus berupa angka lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const code = crypto.randomUUID();

  const { data, error } = await supabase
    .from("qr_codes")
    .insert({
      code,
      is_event: true,
      event_name: name?.trim() || null,
      event_points: value,
      product_slug: `event-${code}`,
    })
    .select("id, code, event_name, event_points, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Gagal membuat QR: " + error.message }, { status: 400 });

  return NextResponse.json({
    qr: {
      ...data,
      claim_url: `${CLAIM_BASE}/claim/event/${code}`,
      used: false,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, points } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const value = points !== undefined ? Number(points) : undefined;
  if (value !== undefined && (!value || isNaN(value) || value <= 0)) {
    return NextResponse.json({ error: "Jumlah koin harus berupa angka lebih dari 0." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("qr_codes")
    .select("id, is_event, event_name, event_points")
    .eq("id", id)
    .eq("is_event", true)
    .single();

  if (!existing) return NextResponse.json({ error: "QR tidak ditemukan." }, { status: 404 });

  const code = crypto.randomUUID();
  const { data, error } = await supabase
    .from("qr_codes")
    .insert({
      code,
      is_event: true,
      event_name: existing.event_name,
      event_points: value !== undefined ? value : existing.event_points,
      product_slug: `event-${code}`,
    })
    .select("id, code, event_name, event_points, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Gagal membuat QR baru: " + error.message }, { status: 400 });

  return NextResponse.json({
    qr: {
      ...data,
      claim_url: `${CLAIM_BASE}/claim/event/${data.code}`,
      used: false,
    },
  });
}
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("qr_codes")
    .select("id, claimed_at")
    .eq("id", id)
    .eq("is_event", true)
    .single();

  if (!existing) return NextResponse.json({ error: "QR tidak ditemukan." }, { status: 404 });
  if (existing.claimed_at) {
    return NextResponse.json({ error: "QR yang sudah terpakai tidak bisa dihapus." }, { status: 409 });
  }

  const { error } = await supabase.from("qr_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Gagal menghapus: " + error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
