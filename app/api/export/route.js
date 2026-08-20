import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export const COLUMNS = [
  ["order", "Order Number", r => r.order_number],
  ["purchase_date", "Purchase Date", r => r.purchase_date],
  ["payment", "Payment Status", r => r.payment_status],
  ["product", "Product Type", r => r.product_type],
  ["source", "Purchased From", r => r.purchased_from || ""],
  ["domain", "Domain Name", r => r.domain_name],
  ["years", "Cert Purchase Years", r => r.cert_purchase_years],
  ["cert_start", "Cert Start Date", r => r.cert_start_date],
  ["cert_end", "Cert End Date", r => r.cert_end_date],
  ["order_expiry", "Order Expiry Date", r => r.order_expiry_date],
  ["reissue_days", "Cert Expires In (Days)", r => Math.floor((new Date(r.cert_end_date + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000)],
  ["days_left", "Days Remaining In Order", r => r.days_remaining],
  ["replacement", "Replacement Certificate", r => r.replacement_years + " Year"],
  ["handover", "Handover Type", r => r.handover_type],
  ["status", "Case Status", r => (r.status === "No action taken" && r.cert_end_date < today()) ? "Expired" : r.status === "Completed" ? `${r.handover_type} completed` : r.status],
  ["sent_on", "Sent To SSL Indonesia On", r => r.sent_to_partner_at ? r.sent_to_partner_at.slice(0, 10) : ""],
  ["completed_on", "Completed On", r => r.completed_at ? r.completed_at.slice(0, 10) : ""],
  ["si_order", "SSL Indonesia Order #", r => r.replacement_order_number || ""],
  ["notes", "Notes", r => r.notes || ""],
  ["pusat_cost", "Pusat-SSL Cost", r => r.pusat_cost ?? ""],
  ["si_cost", "SSL-Indonesia Cost", r => r.ssl_indonesia_cost ?? ""]
];

const DEFAULT_KEYS = COLUMNS.map(c => c[0]).filter(k => k !== "pusat_cost" && k !== "si_cost");

function buildWorkbook(data, colKeys) {
  const keys = (colKeys && colKeys.length) ? colKeys : DEFAULT_KEYS;
  const active = COLUMNS.filter(([k]) => keys.includes(k));
  const rows = (data || []).map(r => {
    const o = {};
    for (const [, label, fn] of active) o[label] = fn(r);
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  ws["!cols"] = active.map(([, label]) => ({ wch: Math.max(14, label.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Migration Cases");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function xlsxResponse(buf, suffix = "report") {
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pusat-migration-${suffix}-${today()}.xlsx"`
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
  const cols = Array.isArray(body.columns) ? body.columns : (body.costs ? [...DEFAULT_KEYS, "pusat_cost", "si_cost"] : null);
  return xlsxResponse(buildWorkbook(data, cols), "selected");
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

  if (from) q = q.gte("purchase_date", from);
  if (to) q = q.lte("purchase_date", to);
  if (product) q = q.eq("product_type", product);
  if (handover) q = q.eq("handover_type", handover);
  if (years) q = q.eq("replacement_years", Number(years));

  const t = today();
  if (status === "Expired") q = q.eq("status", "No action taken").lt("cert_end_date", t);
  else if (status === "No action taken") q = q.eq("status", "No action taken").gte("cert_end_date", t);
  else if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let cols = null;
  const colsParam = searchParams.get("cols");
  if (colsParam) cols = colsParam.split(",").filter(Boolean);
  else if (searchParams.get("costs") === "1") cols = [...DEFAULT_KEYS, "pusat_cost", "si_cost"];
  return xlsxResponse(buildWorkbook(data, cols));
}
