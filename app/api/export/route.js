import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

function buildWorkbook(data, includeCosts) {
  const rows = (data || []).map(r => {
    const base = {
      "Order Number": r.order_number,
      "Purchase Date": r.purchase_date,
      "Payment Status": r.payment_status,
      "Product Type": r.product_type,
      "Purchased From": r.purchased_from || "",
      "Domain Name": r.domain_name,
      "Cert Purchase Years": r.cert_purchase_years,
      "Cert Start Date": r.cert_start_date,
      "Cert End Date": r.cert_end_date,
      "Order Expiry Date": r.order_expiry_date,
      "Days To Reissue (Cert Expires In)": Math.floor((new Date(r.cert_end_date + "T00:00:00") - new Date(new Date().toISOString().slice(0,10) + "T00:00:00")) / 86400000),
      "Days Remaining In Order": r.days_remaining,
      "Replacement Certificate": r.replacement_years + " Year",
      "Handover Type": r.handover_type,
      "Case Status": r.status === "Completed" ? `${r.handover_type} completed` : r.status,
      "Sent To SSL Indonesia On": r.sent_to_partner_at ? r.sent_to_partner_at.slice(0, 10) : "",
      "Completed On": r.completed_at ? r.completed_at.slice(0, 10) : "",
      "SSL Indonesia Order #": r.replacement_order_number || "",
      "Notes": r.notes || ""
    };
    if (includeCosts) {
      base["Pusat-SSL Cost"] = r.pusat_cost ?? "";
      base["SSL-Indonesia Cost"] = r.ssl_indonesia_cost ?? "";
    }
    return base;
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map(k => ({ wch: Math.max(14, k.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Migration Cases");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function xlsxResponse(buf) {
  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pusat-migration-report-${ts}.xlsx"`
    }
  });
}

export async function POST(req) {
  const sb = getServiceClient();
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  const { data, error } = await sb.from("migration_cases").select("*").in("id", ids).order("purchase_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return xlsxResponse(buildWorkbook(data, Boolean(body.costs)));
}

export async function GET(req) {
  const sb = getServiceClient();
  const { searchParams } = new URL(req.url);
  let q = sb.from("migration_cases").select("*").order("purchase_date", { ascending: true });

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const product = searchParams.get("product");
  const handover = searchParams.get("handover");
  const years = searchParams.get("years");
  const status = searchParams.get("status");
  const includeCosts = searchParams.get("costs") === "1";

  if (from) q = q.gte("purchase_date", from);
  if (to) q = q.lte("purchase_date", to);
  if (product) q = q.eq("product_type", product);
  if (handover) q = q.eq("handover_type", handover);
  if (years) q = q.eq("replacement_years", Number(years));
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return xlsxResponse(buildWorkbook(data, includeCosts));
}
