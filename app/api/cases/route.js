import { NextResponse } from "next/server";
import { getServiceClient, calcReplacement } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const sb = getServiceClient();
  const { searchParams } = new URL(req.url);
  let q = sb.from("migration_cases").select("*").order("created_at", { ascending: false });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const product = searchParams.get("product");
  const handover = searchParams.get("handover");
  const years = searchParams.get("years");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  if (from) q = q.gte("purchase_date", from);
  if (to) q = q.lte("purchase_date", to);
  if (product) q = q.eq("product_type", product);
  if (handover) q = q.eq("handover_type", handover);
  if (years) q = q.eq("replacement_years", Number(years));
  if (status) q = q.eq("status", status);
  if (search) q = q.or(`order_number.ilike.%${search}%,domain_name.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req) {
  const sb = getServiceClient();
  const body = await req.json();

  const required = ["order_number","purchase_date","payment_status","product_type","domain_name","cert_purchase_years","cert_start_date","cert_end_date","order_expiry_date","handover_type","purchased_from"];
  for (const f of required) {
    if (!body[f] && body[f] !== 0) return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
  }

  const { diffDays, years } = calcReplacement(body.cert_end_date, body.order_expiry_date);
  const handover = diffDays <= 30 ? "Renewal" : body.handover_type;

  const { data, error } = await sb.from("migration_cases").insert({
    order_number: body.order_number.trim(),
    purchase_date: body.purchase_date,
    payment_status: body.payment_status,
    product_type: body.product_type,
    purchased_from: body.purchased_from,
    domain_name: body.domain_name.trim().toLowerCase(),
    cert_purchase_years: Number(body.cert_purchase_years),
    cert_start_date: body.cert_start_date,
    cert_end_date: body.cert_end_date,
    order_expiry_date: body.order_expiry_date,
    days_remaining: diffDays,
    replacement_years: years,
    handover_type: handover,
    pusat_cost: body.pusat_cost === "" || body.pusat_cost == null ? null : Number(body.pusat_cost),
    ssl_indonesia_cost: body.ssl_indonesia_cost === "" || body.ssl_indonesia_cost == null ? null : Number(body.ssl_indonesia_cost),
    notes: body.notes || null,
    status: body.status || "No action taken",
    replacement_order_number: body.replacement_order_number || null
  }).select().single();

  if (error) {
    const msg = error.code === "23505" ? "An entry with this order number already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ data });
}
