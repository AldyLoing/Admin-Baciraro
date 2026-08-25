import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { createAdminClient } from "@/utils/supabase/admin";

const SECRET = process.env.JWT_SECRET || "baciraro-secret-dev";

function getCustomer(req: NextRequest) {
  const token = req.cookies.get("customer_token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET) as { id: number; email: string; name: string; role: string };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("qr_codes")
    .select("id, code, event_name, event_points, claimed_at")
    .eq("code", code)
    .eq("is_event", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "QR event tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    qr: {
      code: data.code,
      event_name: data.event_name,
      event_points: 10,
      used: !!data.claimed_at,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const customer = getCustomer(req);

  if (!customer) {
    return NextResponse.json({ error: "Anda harus login untuk klaim koin." }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select("id, code, event_name, event_points, claimed_at, customer_id")
    .eq("code", code)
    .eq("is_event", true)
    .single();

  if (error || !qr) {
    return NextResponse.json({ error: "QR event tidak ditemukan" }, { status: 404 });
  }

  if (qr.claimed_at) {
    return NextResponse.json({ error: "QR ini sudah terpakai." }, { status: 409 });
  }

  const { error: txError } = await supabase.from("points_transactions").insert({
    customer_id: customer.id,
    qr_code_id: qr.id,
    points: 10,
    description: `Klaim QR Event${qr.event_name ? " " + qr.event_name : ""}`,
  });

  if (txError) {
    return NextResponse.json({ error: "Gagal mencatat koin: " + txError.message }, { status: 500 });
  }

  const { data: cust } = await supabase
    .from("customers")
    .select("total_points")
    .eq("id", customer.id)
    .single();

  const newTotal = (cust?.total_points || 0) + 10;

  await supabase
    .from("customers")
    .update({ total_points: newTotal })
    .eq("id", customer.id);

  await supabase
    .from("qr_codes")
    .update({ claimed_at: new Date().toISOString(), customer_id: customer.id })
    .eq("id", qr.id);

  return NextResponse.json({ ok: true, points: 10, total_points: newTotal });
}
