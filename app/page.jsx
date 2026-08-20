"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

const PRODUCTS = ["DV SSL","OV SSL","EV SSL","DV Wildcard","OV Wildcard","EV Wildcard","Multi-Domain SAN","Code Signing","S/MIME","Other"];
const CASE_STATUS = ["Pending to send","Sent to SSL Indonesia","On hold","Completed","Cancelled"];
function statusLabel(st, handover) {
  return st === "Completed" ? `${handover} completed` : st;
}
function statusStyle(st) {
  if (st === "Completed") return { bg: "var(--green-dim)", fg: "var(--green)" };
  if (st === "Sent to SSL Indonesia") return { bg: "var(--cyan-dim)", fg: "var(--cyan-deep)" };
  if (st === "On hold") return { bg: "var(--amber-dim)", fg: "var(--amber)" };
  if (st === "Cancelled") return { bg: "var(--red-dim)", fg: "var(--red)" };
  return { bg: "var(--ink-1)", fg: "var(--txt-mid)" };
}
function daysAgo(iso) {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

const S = {
  page: { maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px", overflowX: "hidden" },
  label: { fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--txt-low)" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function tierColor(y) {
  return y === 1 ? "var(--green)" : y === 2 ? "var(--amber)" : "var(--violet)";
}
function tierDim(y) {
  return y === 1 ? "var(--green-dim)" : y === 2 ? "var(--amber-dim)" : "var(--violet-dim)";
}

/* ---------- Timeline bar: the visual signature ---------- */
function ValidityBar({ certStart, certEnd, orderExpiry }) {
  const s = new Date(certStart + "T00:00:00").getTime();
  const e = new Date(certEnd + "T00:00:00").getTime();
  const x = new Date(orderExpiry + "T00:00:00").getTime();
  const now = Date.now();
  const min = Math.min(s, now);
  const max = Math.max(x, e);
  const span = max - min || 1;
  const pct = v => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  const certLeft = pct(s), certRight = pct(e), expiryPos = pct(x), nowPos = pct(now);
  const gapDays = Math.floor((x - e) / 86400000);
  const gapColor = gapDays <= 365 ? "var(--green)" : gapDays <= 730 ? "var(--amber)" : "var(--violet)";

  return (
    <div style={{ position: "relative", height: 34, marginTop: 6 }}>
      <div style={{ position: "absolute", top: 14, left: 0, right: 0, height: 6, background: "var(--ink-3)", borderRadius: 3 }} />
      <div style={{ position: "absolute", top: 14, left: certLeft + "%", width: Math.max(1.5, certRight - certLeft) + "%", height: 6, background: "var(--cyan)", borderRadius: 3 }} title="Current certificate validity" />
      <div style={{ position: "absolute", top: 14, left: certRight + "%", width: Math.max(0, expiryPos - certRight) + "%", height: 6, background: `repeating-linear-gradient(90deg, ${gapColor}, ${gapColor} 4px, transparent 4px, transparent 8px)`, borderRadius: 3, opacity: 0.85 }} title="Remaining order coverage" />
      <div style={{ position: "absolute", top: 9, left: `calc(${expiryPos}% - 1px)`, width: 2, height: 16, background: "var(--red)" }} title="Order expiry" />
      {nowPos > 0 && nowPos < 100 && (
        <div style={{ position: "absolute", top: 7, left: `calc(${nowPos}% - 1px)`, width: 2, height: 20, background: "var(--txt-hi)", opacity: 0.7 }} title="Today" />
      )}
      <div className="mono" style={{ position: "absolute", top: 24, left: 0, fontSize: 10, color: "var(--cyan)" }}>{fmtDate(certStart)}</div>
      <div className="mono" style={{ position: "absolute", top: 24, right: 0, fontSize: 10, color: "var(--red)" }}>order ends {fmtDate(orderExpiry)}</div>
    </div>
  );
}

/* ---------- Stat block ---------- */
function Stat({ label, value, accent, sub, onClick, active }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "var(--cyan-dim)" : "var(--ink-1)", boxShadow: "var(--shadow)",
      border: `1px solid ${active ? accent || "var(--line-strong)" : "var(--line)"}`,
      borderRadius: 10, padding: "14px 16px", textAlign: "left",
      display: "flex", flexDirection: "column", gap: 2, minWidth: 0
    }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--txt-low)" }}>{label}</span>
      <span style={{ fontSize: 27, fontWeight: 600, color: accent || "var(--txt-hi)", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--txt-low)" }}>{sub}</span>}
    </button>
  );
}

function Pill({ children, color, dim }) {
  return <span style={{ fontSize: 12, fontWeight: 500, color, background: dim, padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap" }}>{children}</span>;
}

/* ---------- Form modal ---------- */

const fieldLabel = { fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--txt-low)", display: "block", marginBottom: 5 };

function TextField({ label, value, onChange, error, type = "text", placeholder, options, span }) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <label style={fieldLabel}>{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ borderColor: error ? "var(--red)" : undefined }}>
          {options.includes(value) ? null : <option value="">Select…</option>}
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ borderColor: error ? "var(--red)" : undefined }} />
      )}
      {error && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>{error}</div>}
    </div>
  );
}

function isoToDisplay(iso) {
  if (!iso || iso.length !== 10) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function DateField({ label, value, onChange, error, span }) {
  const [txt, setTxt] = useState(isoToDisplay(value));
  useEffect(() => { setTxt(isoToDisplay(value)); }, [value]);

  const handle = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = digits.slice(0, 2) + "-" + digits.slice(2, 4) + "-" + digits.slice(4);
    else if (digits.length > 2) out = digits.slice(0, 2) + "-" + digits.slice(2);
    setTxt(out);
    if (digits.length === 8) {
      const d = +digits.slice(0, 2), m = +digits.slice(2, 4), y = +digits.slice(4);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
        onChange(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
        return;
      }
    }
    if (value) onChange("");
  };

  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <label style={fieldLabel}>{label}</label>
      <input inputMode="numeric" value={txt} placeholder="DD-MM-YYYY" maxLength={10}
        onChange={e => handle(e.target.value)}
        style={{ fontFamily: "var(--mono)", letterSpacing: "0.04em", borderColor: error ? "var(--red)" : undefined }} />
      {error && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>{error}</div>}
    </div>
  );
}


const emptyForm = {
  order_number: "", purchase_date: "", payment_status: "Paid", product_type: "", purchased_from: "GoGetSSL",
  domain_name: "", cert_purchase_years: "", cert_start_date: "", cert_end_date: "",
  order_expiry_date: "", handover_type: "Reissue", pusat_cost: "", ssl_indonesia_cost: "", notes: "", replacement_order_number: ""
};

function CaseForm({ initial, onClose, onSaved, products }) {
  const [f, setF] = useState(initial || emptyForm);
  const [err, setErr] = useState({});
  const [apiErr, setApiErr] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  const set = (k) => (v) => { setF(p => ({ ...p, [k]: v })); setErr(p => ({ ...p, [k]: "" })); setApiErr(""); };

  const preview = useMemo(() => {
    if (!f.cert_end_date || !f.order_expiry_date) return null;
    const diff = Math.floor((new Date(f.order_expiry_date) - new Date(f.cert_end_date)) / 86400000);
    const years = diff > 730 ? 3 : diff > 365 ? 2 : 1;
    return { diff, years, renewalOnly: diff <= 30 };
  }, [f.cert_end_date, f.order_expiry_date]);

  useEffect(() => {
    if (preview?.renewalOnly && f.handover_type !== "Renewal") {
      setF(p => ({ ...p, handover_type: "Renewal" }));
    }
  }, [preview?.renewalOnly]);

  const submit = async () => {
    const e = {};
    ["order_number","purchase_date","product_type","purchased_from","domain_name","cert_purchase_years","cert_start_date","cert_end_date","order_expiry_date"].forEach(k => {
      if (!String(f[k] ?? "").trim()) e[k] = "Required";
    });
    if (f.cert_end_date && f.order_expiry_date && f.order_expiry_date < f.cert_end_date)
      e.order_expiry_date = "Order expiry is before cert end — check dates";
    if (Object.keys(e).length) { setErr(e); return; }

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/cases/${initial.id}` : "/api/cases", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f)
      });
      const j = await res.json();
      if (!res.ok) { setApiErr(j.error || "Save failed"); setSaving(false); return; }
      onSaved(j.data);
    } catch {
      setApiErr("Network error — try again");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,23,38,0.55)", backdropFilter: "blur(3px)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px" }}>
      <div className="fade-up" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, width: "100%", maxWidth: 700, padding: "26px 28px", boxShadow: "0 20px 60px rgba(13,17,22,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--txt-low)" }}>{editing ? "Edit case" : "New migration case"}</div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Pusat SSL <span style={{ color: "var(--txt-low)" }}>→</span> <span style={{ color: "var(--cyan)" }}>SSL Indonesia</span></div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "transparent", color: "var(--txt-mid)", fontSize: 22, padding: "4px 10px" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
          <TextField label="Order number" value={f.order_number} onChange={set("order_number")} error={err.order_number} placeholder="ORD-2024-0815" />
          <DateField label="Purchase date" value={f.purchase_date} onChange={set("purchase_date")} error={err.purchase_date} />
          <TextField label="Payment status" value={f.payment_status} onChange={set("payment_status")} options={["Paid","Unpaid"]} />
          <TextField label="Hand over type" value={f.handover_type} onChange={set("handover_type")} options={preview?.renewalOnly ? ["Renewal"] : ["Reissue","Renewal"]} />
          <TextField label="Purchased from" value={f.purchased_from} onChange={set("purchased_from")} error={err.purchased_from} options={["GoGetSSL","CertCentral"]} />
          <TextField label="Product type" value={f.product_type} onChange={set("product_type")} error={err.product_type} options={products} />
          <TextField label="Domain name" value={f.domain_name} onChange={set("domain_name")} error={err.domain_name} placeholder="example.co.id" />
          <TextField label="Certificate purchase years" value={f.cert_purchase_years} onChange={set("cert_purchase_years")} error={err.cert_purchase_years} type="number" placeholder="1 – 6" />
          <DateField label="Current cert — start date" value={f.cert_start_date} onChange={set("cert_start_date")} error={err.cert_start_date} />
          <DateField label="Current cert — end date" value={f.cert_end_date} onChange={set("cert_end_date")} error={err.cert_end_date} />
          <DateField label="Order expiration date (final validity)" value={f.order_expiry_date} onChange={set("order_expiry_date")} error={err.order_expiry_date} span />
        </div>

        {preview && (
          <div style={{ marginTop: 16, padding: "13px 16px", borderRadius: 8, background: tierDim(preview.years), border: `1px solid ${tierColor(preview.years)}`, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: tierColor(preview.years) }}>{preview.diff}d</span>
            <span style={{ fontSize: 13.5 }}>
              remaining in order → offer a <strong style={{ color: tierColor(preview.years) }}>{preview.years}-year replacement</strong> via SSL Indonesia{preview.renewalOnly && <span> · gap ≤ 30 days, qualifies as <strong>Renewal only</strong></span>}
            </span>
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--txt-low)", marginBottom: 12 }}>Optional — internal cost record</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
            <TextField label="Pusat-SSL cost (USD)" value={f.pusat_cost} onChange={set("pusat_cost")} type="number" placeholder="0.00" />
            <TextField label="SSL-Indonesia cost (USD)" value={f.ssl_indonesia_cost} onChange={set("ssl_indonesia_cost")} type="number" placeholder="0.00" />
            <TextField label="SSL Indonesia order number" value={f.replacement_order_number} onChange={set("replacement_order_number")} placeholder="New order ref once issued" />
            <TextField label="Notes" value={f.notes} onChange={set("notes")} placeholder="Customer contact, ticket ref…" />
          </div>
        </div>

        {apiErr && <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 6, background: "var(--red-dim)", color: "var(--red)", fontSize: 13 }}>{apiErr}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--txt-mid)", padding: "10px 20px" }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ background: "var(--cyan)", color: "#fff", padding: "10px 24px", fontWeight: 600 }}>
            {saving ? "Saving…" : editing ? "Save changes" : "Log case"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Case table ---------- */
const COLS = "minmax(200px,1.6fr) 100px 88px 96px 110px 88px 168px 36px";

function ListHeader() {
  const h = { fontSize: 11.5, fontWeight: 600, color: "var(--txt-low)", textTransform: "uppercase", letterSpacing: "0.06em" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "10px 18px", borderBottom: "1px solid var(--line)", background: "var(--ink-2)", borderRadius: "12px 12px 0 0" }}>
      <span style={h}>Certificate</span>
      <span style={h}>Source</span>
      <span style={h}>Payment</span>
      <span style={h}>Handover</span>
      <span style={h}>Replacement</span>
      <span style={{ ...h, textAlign: "right" }}>Order left</span>
      <span style={h}>Case status</span>
      <span />
    </div>
  );
}

function CaseRow({ r, last, onEdit, onDelete, onStatus }) {
  const [open, setOpen] = useState(false);
  const urgent = r.days_remaining < 90;
  return (
    <div style={{ borderBottom: last && !open ? "none" : "1px solid var(--line)" }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center", padding: "13px 18px", cursor: "pointer", background: open ? "var(--ink-2)" : "transparent" }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: tierColor(r.replacement_years), flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.domain_name}</div>
            <div style={{ fontSize: 12, color: "var(--txt-low)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.order_number} · {r.product_type}</div>
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--txt-mid)" }}>{r.purchased_from || "—"}</span>
        <Pill color={r.payment_status === "Paid" ? "var(--green)" : "var(--red)"} dim={r.payment_status === "Paid" ? "var(--green-dim)" : "var(--red-dim)"}>{r.payment_status}</Pill>
        <span style={{ fontSize: 13, color: "var(--txt-mid)" }}>{r.handover_type}</span>
        <Pill color={tierColor(r.replacement_years)} dim={tierDim(r.replacement_years)}>{r.replacement_years}-year</Pill>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: urgent ? "var(--red)" : "var(--txt-hi)" }}>{r.days_remaining}d</span>
        </div>
        <div>
          <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => onStatus(r, e.target.value)}
            style={{ padding: "6px 8px", fontSize: 12.5, borderRadius: 6, background: statusStyle(r.status).bg, color: statusStyle(r.status).fg, border: "1px solid var(--line)", fontWeight: 500 }}>
            {CASE_STATUS.map(st => <option key={st} value={st}>{statusLabel(st, r.handover_type)}</option>)}
          </select>
          {r.status === "Sent to SSL Indonesia" && r.sent_to_partner_at && (
            <div style={{ fontSize: 11, color: "var(--txt-low)", marginTop: 3 }}>sent {daysAgo(r.sent_to_partner_at)}d ago</div>
          )}
          {r.status === "Completed" && r.completed_at && (
            <div style={{ fontSize: 11, color: "var(--green)", marginTop: 3 }}>{fmtDate(r.completed_at.slice(0,10))}</div>
          )}
        </div>
        <span style={{ color: "var(--txt-low)", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s", textAlign: "center" }}>▾</span>
      </div>

      {open && (
        <div style={{ padding: "6px 18px 20px", background: "var(--ink-2)", borderBottom: last ? "none" : "1px solid var(--line)" }}>
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 10, padding: "16px 20px" }}>
            <ValidityBar certStart={r.cert_start_date} certEnd={r.cert_end_date} orderExpiry={r.order_expiry_date} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 22 }}>
              {[
                ["Purchased", fmtDate(r.purchase_date)],
                ["Purchased from", r.purchased_from || "—"],
                ["Cert validity", `${fmtDate(r.cert_start_date)} → ${fmtDate(r.cert_end_date)}`],
                ["Order expiry", fmtDate(r.order_expiry_date)],
                ["Bought years", r.cert_purchase_years + "y"],
                r.replacement_order_number ? ["SSL Indonesia order #", r.replacement_order_number] : null,
                r.sent_to_partner_at ? ["Sent to SSL Indonesia", fmtDate(r.sent_to_partner_at.slice(0,10))] : null,
                r.completed_at ? ["Completed on", fmtDate(r.completed_at.slice(0,10))] : null,
                r.pusat_cost != null ? ["Pusat-SSL cost", "$" + r.pusat_cost] : null,
                r.ssl_indonesia_cost != null ? ["SSL-Indonesia cost", "$" + r.ssl_indonesia_cost] : null,
              ].filter(Boolean).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--txt-low)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                </div>
              ))}
            </div>
            {r.notes && <div style={{ marginTop: 14, fontSize: 13, color: "var(--txt-mid)", background: "var(--ink-2)", padding: "10px 14px", borderRadius: 8 }}>{r.notes}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => onEdit(r)} style={{ background: "var(--ink-2)", border: "1px solid var(--line-strong)", color: "var(--txt-hi)", padding: "8px 18px", fontSize: 13 }}>Edit</button>
              <button onClick={() => onDelete(r)} style={{ background: "transparent", border: "1px solid var(--red)", color: "var(--red)", padding: "8px 18px", fontSize: 13 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Page ---------- */
export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState(PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [flt, setFlt] = useState({ search: "", from: "", to: "", product: "", handover: "", years: "", status: "" });
  const [includeCosts, setIncludeCosts] = useState(false);
  const [preset, setPreset] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setLoadErr("");
    try {
      const res = await fetch("/api/cases");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setRecords(j.data || []);
    } catch (e) {
      setLoadErr(String(e.message || e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/products").then(r => r.json()).then(j => {
      if (Array.isArray(j.products) && j.products.length) setProducts(j.products);
    }).catch(() => {});
  }, []);

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    if (p === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); setFlt(f => ({ ...f, from: iso(d), to: iso(now) })); }
    else if (p === "month") { setFlt(f => ({ ...f, from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) })); }
    else if (p === "year") { setFlt(f => ({ ...f, from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) })); }
    else { setFlt(f => ({ ...f, from: "", to: "" })); }
  };

  const baseFiltered = useMemo(() => records.filter(r => {
    if (flt.product && r.product_type !== flt.product) return false;
    if (flt.years && String(r.replacement_years) !== flt.years) return false;
    if (flt.status && r.status !== flt.status) return false;
    if (flt.from && r.purchase_date < flt.from) return false;
    if (flt.to && r.purchase_date > flt.to) return false;
    if (flt.search) {
      const q = flt.search.toLowerCase();
      if (!r.order_number.toLowerCase().includes(q) && !r.domain_name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [records, flt.product, flt.years, flt.status, flt.from, flt.to, flt.search]);

  const filtered = useMemo(() => records.filter(r => {
    if (flt.product && r.product_type !== flt.product) return false;
    if (flt.handover && r.handover_type !== flt.handover) return false;
    if (flt.years && String(r.replacement_years) !== flt.years) return false;
    if (flt.status && r.status !== flt.status) return false;
    if (flt.from && r.purchase_date < flt.from) return false;
    if (flt.to && r.purchase_date > flt.to) return false;
    if (flt.search) {
      const q = flt.search.toLowerCase();
      if (!r.order_number.toLowerCase().includes(q) && !r.domain_name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [records, flt]);

  const stats = useMemo(() => ({
    total: records.length,
    pending: records.filter(r => r.status === "Pending to send").length,
    sent: records.filter(r => r.status === "Sent to SSL Indonesia").length,
    done: records.filter(r => r.status === "Completed").length,
    urgent: records.filter(r => r.days_remaining < 90).length,
    y1: records.filter(r => r.replacement_years === 1).length,
    y2: records.filter(r => r.replacement_years === 2).length,
    y3: records.filter(r => r.replacement_years === 3).length,
  }), [records]);

  const exportExcel = () => {
    const p = new URLSearchParams();
    if (flt.from) p.set("from", flt.from);
    if (flt.to) p.set("to", flt.to);
    if (flt.product) p.set("product", flt.product);
    if (flt.handover) p.set("handover", flt.handover);
    if (flt.years) p.set("years", flt.years);
    if (flt.status) p.set("status", flt.status);
    if (includeCosts) p.set("costs", "1");
    window.location.href = "/api/export?" + p.toString();
  };

  const onSaved = () => { setShowForm(false); setEditing(null); load(); };
  const onStatus = async (r, status) => {
    setRecords(prev => prev.map(x => x.id === r.id ? { ...x, status } : x));
    await fetch(`/api/cases/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  };
  const doDelete = async () => {
    const r = confirmDel; setConfirmDel(null);
    await fetch(`/api/cases/${r.id}`, { method: "DELETE" });
    load();
  };

  return (
    <main style={S.page}>
      <header className="hero-band" style={{ margin: "0 -24px", padding: "34px 24px 30px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 1132, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "var(--sky)", textTransform: "uppercase", marginBottom: 8 }}>Migration control</div>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              Pusat SSL <span style={{ opacity: 0.55, fontWeight: 400 }}>→</span> SSL Indonesia
            </h1>
            <p style={{ fontSize: 13.5, marginTop: 8, opacity: 0.92 }}>
              Free replacement handover · <span style={{ background: "rgba(255,255,255,0.16)", padding: "2px 9px", borderRadius: 100 }}>Pusat SSL banned</span> <span style={{ background: "rgba(255,255,255,0.16)", padding: "2px 9px", borderRadius: 100 }}>SSL Indonesia approved</span>
            </p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: "#ffffff", color: "var(--cyan-deep)", padding: "12px 26px", fontWeight: 600, fontSize: 14.5, boxShadow: "0 2px 10px rgba(13,17,22,0.18)" }}>
            + Log case
          </button>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10, margin: "22px 0" }}>
        <Stat label="Total cases" value={stats.total} onClick={() => setFlt(f => ({ ...f, years: "", status: "" }))} />
        <Stat label="Pending to send" value={stats.pending} accent="var(--amber)" active={flt.status === "Pending to send"} onClick={() => setFlt(f => ({ ...f, status: f.status === "Pending to send" ? "" : "Pending to send" }))} />
        <Stat label="Sent to SSL Indonesia" value={stats.sent} accent="var(--cyan)" active={flt.status === "Sent to SSL Indonesia"} onClick={() => setFlt(f => ({ ...f, status: f.status === "Sent to SSL Indonesia" ? "" : "Sent to SSL Indonesia" }))} />
        <Stat label="Completed" value={stats.done} accent="var(--green)" active={flt.status === "Completed"} onClick={() => setFlt(f => ({ ...f, status: f.status === "Completed" ? "" : "Completed" }))} />
        <Stat label="Under 90 days" value={stats.urgent} accent="var(--red)" sub="urgent" />
        <Stat label="1-year tier" value={stats.y1} accent="var(--green)" sub="≤ 365d left" active={flt.years === "1"} onClick={() => setFlt(f => ({ ...f, years: f.years === "1" ? "" : "1" }))} />
        <Stat label="2-year tier" value={stats.y2} accent="var(--amber)" sub="366–730d" active={flt.years === "2"} onClick={() => setFlt(f => ({ ...f, years: f.years === "2" ? "" : "2" }))} />
        <Stat label="3-year tier" value={stats.y3} accent="var(--violet)" sub="> 730d" active={flt.years === "3"} onClick={() => setFlt(f => ({ ...f, years: f.years === "3" ? "" : "3" }))} />
      </section>

      <section className="card" style={{ padding: "16px 18px", marginBottom: 18, borderRadius: 12 }}>
        <div style={{ display: "inline-flex", border: "1px solid var(--line-strong)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
          {[["", "All time"], ["week", "Last 7 days"], ["month", "This month"], ["year", "This year"]].map(([v, l], i) => (
            <button key={v} onClick={() => applyPreset(v)} style={{
              padding: "7px 16px", fontSize: 13, borderRadius: 0,
              borderLeft: i === 0 ? "none" : "1px solid var(--line)",
              background: preset === v ? "var(--cyan)" : "#fff",
              color: preset === v ? "#fff" : "var(--txt-mid)", fontWeight: preset === v ? 600 : 400
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <input placeholder="Search order / domain…" value={flt.search} onChange={e => setFlt(f => ({ ...f, search: e.target.value }))} />
          <input type="date" value={flt.from} onChange={e => { setPreset(""); setFlt(f => ({ ...f, from: e.target.value })); }} />
          <input type="date" value={flt.to} onChange={e => { setPreset(""); setFlt(f => ({ ...f, to: e.target.value })); }} />
          <select value={flt.product} onChange={e => setFlt(f => ({ ...f, product: e.target.value }))}>
            <option value="">All products</option>
            {products.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={flt.status} onChange={e => setFlt(f => ({ ...f, status: e.target.value }))}>
            <option value="">Any status</option>
            {CASE_STATUS.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--txt-low)" }}>Showing {filtered.length} of {records.length} cases</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--txt-mid)", cursor: "pointer" }}>
              <input type="checkbox" checked={includeCosts} onChange={e => setIncludeCosts(e.target.checked)} style={{ width: "auto" }} />
              Include cost columns
            </label>
            <button onClick={exportExcel} disabled={filtered.length === 0} style={{ background: "#fff", color: "var(--cyan-deep)", padding: "9px 20px", fontSize: 13.5, fontWeight: 600, border: "1px solid var(--cyan)" }}>
              Export Excel
            </button>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["", "All orders"], ["Reissue", "Reissue orders"], ["Renewal", "Renewal orders"]].map(([v, l]) => {
          const count = v === "" ? baseFiltered.length : baseFiltered.filter(r => r.handover_type === v).length;
          const active = flt.handover === v;
          return (
            <button key={v} onClick={() => setFlt(f => ({ ...f, handover: v }))} style={{
              padding: "9px 18px", fontSize: 13.5, fontWeight: active ? 600 : 400,
              background: active ? "#fff" : "transparent",
              border: active ? "1px solid var(--line-strong)" : "1px solid transparent",
              borderBottom: active ? "1px solid #fff" : "1px solid transparent",
              borderRadius: "8px 8px 0 0", color: active ? "var(--cyan-deep)" : "var(--txt-mid)",
              marginBottom: -1, position: "relative", zIndex: 1
            }}>
              {l} <span style={{ fontSize: 12, fontWeight: 600, background: active ? "var(--cyan-dim)" : "var(--ink-3)", color: active ? "var(--cyan-deep)" : "var(--txt-mid)", padding: "1px 8px", borderRadius: 100, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loadErr && (
        <div style={{ padding: "14px 18px", background: "var(--red-dim)", border: "1px solid var(--red)", borderRadius: 8, color: "var(--red)", fontSize: 13.5, marginBottom: 16 }}>
          Couldn't load cases: {loadErr}. Check that the migration_cases table exists in Supabase.
        </div>
      )}

      {loading ? (
        <div className="pulse" style={{ textAlign: "center", padding: "60px 0", color: "var(--txt-low)", fontSize: 14 }}>Loading cases…</div>
      ) : filtered.length === 0 && !loadErr ? (
        <div style={{ textAlign: "center", padding: "70px 20px", border: "1px dashed var(--line-strong)", borderRadius: 12 }}>
          <div style={{ fontSize: 14, color: "var(--txt-mid)", marginBottom: 10 }}>{records.length === 0 ? "No cases logged yet" : "No cases match the current filters"}</div>
          {records.length === 0 && <button onClick={() => setShowForm(true)} style={{ background: "var(--cyan)", color: "#fff", padding: "10px 22px", fontWeight: 600 }}>Log the first case</button>}
        </div>
      ) : (
        <div className="card" style={{ borderRadius: 12, overflow: "hidden" }}>
          <ListHeader />
          {filtered.map((r, i) => (
            <CaseRow key={r.id} r={r} last={i === filtered.length - 1}
              onEdit={x => { setEditing(x); setShowForm(true); }}
              onDelete={x => setConfirmDel(x)}
              onStatus={onStatus} />
          ))}
        </div>
      )}

      {showForm && <CaseForm initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={onSaved} products={products} />}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,23,38,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "24px 28px", maxWidth: 420, boxShadow: "0 20px 60px rgba(13,17,22,0.25)" }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Delete this case?</div>
            <p style={{ fontSize: 13.5, color: "var(--txt-mid)", marginBottom: 18 }}>
              <span className="mono">{confirmDel.order_number}</span> · {confirmDel.domain_name} will be permanently removed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)} style={{ background: "transparent", border: "1px solid var(--line-strong)", color: "var(--txt-mid)", padding: "9px 18px" }}>Cancel</button>
              <button onClick={doDelete} style={{ background: "var(--red)", color: "#fff", padding: "9px 20px", fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <footer style={{ marginTop: 50, paddingTop: 18, borderTop: "1px solid var(--line)", textAlign: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--txt-low)" }}>Created by Mathivanan K for internal tracking purpose</span>
      </footer>
    </main>
  );
}
