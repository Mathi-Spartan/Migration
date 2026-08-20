import { NextResponse } from "next/server";
import { getServiceClient, calcReplacement } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const sb = getServiceClient();
  const body = await req.json();

  if (body.assign_handover_no) {
    const { data: row } = await sb.from("migration_cases").select("handover_no").eq("id", params.id).single();
    if (row && row.handover_no) return NextResponse.json({ data: { handover_no: row.handover_no } });
    const { data: top } = await sb.from("migration_cases").select("handover_no").not("handover_no", "is", null).order("handover_no", { ascending: false }).limit(1);
    const next = ((top && top[0] && top[0].handover_no) || 0) + 1;
    const { data, error } = await sb.from("migration_cases").update({ handover_no: next, updated_at: new Date().toISOString() }).eq("id", params.id).select("handover_no").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  const patch = { ...body, updated_at: new Date().toISOString() };
  delete patch.id; delete patch.created_at;

  if (patch.status === "Sent to SSL Indonesia") {
    patch.sent_to_partner_at = patch.sent_to_partner_at || new Date().toISOString();
  }
  if (patch.status === "Completed") {
    patch.completed_at = patch.completed_at || new Date().toISOString();
  }

  if (patch.cert_end_date && patch.order_expiry_date) {
    const { diffDays, years } = calcReplacement(patch.cert_end_date, patch.order_expiry_date);
    patch.days_remaining = diffDays;
    patch.replacement_years = years;
    if (diffDays <= 30) patch.handover_type = "Renewal";
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
