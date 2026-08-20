import { NextResponse } from "next/server";
import { getServiceClient, calcReplacement } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const sb = getServiceClient();
  const body = await req.json();
  const patch = { ...body, updated_at: new Date().toISOString() };
  delete patch.id; delete patch.created_at;

  if (patch.cert_end_date && patch.order_expiry_date) {
    const { diffDays, years } = calcReplacement(patch.cert_end_date, patch.order_expiry_date);
    patch.days_remaining = diffDays;
    patch.replacement_years = years;
  }

  const { data, error } = await sb.from("migration_cases").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(req, { params }) {
  const sb = getServiceClient();
  const { error } = await sb.from("migration_cases").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
