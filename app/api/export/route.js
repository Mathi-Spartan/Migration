import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

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

  const rows = (data || []).map(r => {
    const base = {
      "Order Number": r.order_number,
      "Purchase Date": r.purchase_date,
      "Payment Status": r.payment_status,
      "Product Type": r.product_type,
      "Domain Name": r.domain_name,
      "Cert Purchase Years": r.cert_purchase_years,
      "Cert Start Date": r.cert_start_date,
      "Cert End Date": r.cert_end_date,
      "Order Expiry Date": r.order_expiry_date,
      "Days Remaining In Order": r.days_remaining,
      "Replacement Certificate": r.replacement_years + " Year",
      "Handover Type": r.handover_type,
      "Case Status": r.status,
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
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const ts = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pusat-migration-report-${ts}.xlsx"`
    }
  });
}
