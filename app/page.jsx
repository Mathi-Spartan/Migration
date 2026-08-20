"use client";
import { useState, useEffect, useMemo, useCallback } from "react";

const PRODUCTS = ["DV SSL","OV SSL","EV SSL","DV Wildcard","OV Wildcard","EV Wildcard","Multi-Domain SAN","Code Signing","S/MIME","Other"];
const CASE_STATUS = ["Pending","In Progress","Completed"];

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
      <span style={S.label}>{label}</span>
      <span className="mono" style={{ fontSize: 28, fontWeight: 600, color: accent || "var(--txt-hi)", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--txt-low)" }}>{sub}</span>}
    </button>
  );
}

function Pill({ children, color, dim }) {
  return <span className="mono" style={{ fontSize: 11, fontWeight: 500, color, background: dim, padding: "3px 9px", borderRadius: 4, whiteSpace: "nowrap", letterSpacing: "0.03em" }}>{children}</span>;
}

/* ---------- Form modal ---------- */
const emptyForm = {
  order_number: "", purchase_date: "", payment_status: "Paid", product_type: "",
  domain_name: "", cert_purchase_years: "", cert_start_date: "", cert_end_date: "",
  order_expiry_date: "", handover_type: "Reissue", pusat_cost: "", ssl_indonesia_cost: "", notes: ""
};

function CaseForm({ initial, onClose, onSaved, products }) {
  const [f, setF] = useState(initial || emptyForm);
  const [err, setErr] = useState({});
  const [apiErr, setApiErr] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);

  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(p => ({ ...p, [k]: "" })); setApiErr(""); };

  const preview = useMemo(() => {
    if (!f.cert_end_date || !f.order_expiry_date) return null;
    const diff = Math.floor((new Date(f.order_expiry_date) - new Date(f.cert_end_date)) / 86400000);
    const years = diff > 730 ? 3 : diff > 365 ? 2 : 1;
    return { diff, years };
  }, [f.cert_end_date, f.order_expiry_date]);

  const submit = async () => {
    const e = {};
    ["order_number","purchase_date","product_type","domain_name","cert_purchase_years","cert_start_date","cert_end_date","order_expiry_date"].forEach(k => {
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

  const Field = ({ k, label, type = "text", options, placeholder, span }) => (
    <div style={{ gridColumn: span ? "1 / -1" : undefined }}>
      <label style={{ ...S.label, display: "block", marginBottom: 5 }}>{label}</label>
      {options ? (
        <select value={f[k]} onChange={e => set(k, e.target.value)} style={{ borderColor: err[k] ? "var(--red)" : undefined }}>
          {!["payment_status","handover_type"].includes(k) && <option value="">Select…</option>}
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={f[k] ?? ""} placeholder={placeholder} onChange={e => set(k, e.target.value)} style={{ borderColor: err[k] ? "var(--red)" : undefined }} />
      )}
      {err[k] && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>{err[k]}</div>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,23,38,0.55)", backdropFilter: "blur(3px)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "40px 16px" }} onClick={onClose}>
      <div className="fade-up" onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, width: "100%", maxWidth: 700, padding: "26px 28px", boxShadow: "0 20px 60px rgba(13,17,22,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={S.label}>{editing ? "Edit case" : "New migration case"}</div>
            <div style={{ fontSize: 19, fontWeight: 600 }}>Pusat SSL <span style={{ color: "var(--txt-low)" }}>→</span> <span style={{ color: "var(--cyan)" }}>SSL Indonesia</span></div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--txt-mid)", fontSize: 22, padding: "4px 10px" }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
          <Field k="order_number" label="Order number" placeholder="ORD-2024-0815" />
          <Field k="purchase_date" label="Purchase date" type="date" />
          <Field k="payment_status" label="Payment status" options={["Paid","Unpaid"]} />
          <Field k="handover_type" label="Hand over type" options={["Reissue","Renewal"]} />
          <Field k="product_type" label="Product type" options={products} />
          <Field k="domain_name" label="Domain name" placeholder="example.co.id" />
          <Field k="cert_purchase_years" label="Certificate purchase years" type="number" placeholder="1 – 6" />
          <div />
          <Field k="cert_start_date" label="Current cert — start date" type="date" />
          <Field k="cert_end_date" label="Current cert — end date" type="date" />
          <Field k="order_expiry_date" label="Order expiration date (final validity)" type="date" span />
        </div>

        {preview && (
          <div style={{ marginTop: 16, padding: "13px 16px", borderRadius: 8, background: tierDim(preview.years), border: `1px solid ${tierColor(preview.years)}`, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600, color: tierColor(preview.years) }}>{preview.diff}d</span>
            <span style={{ fontSize: 13.5 }}>
              remaining in order → offer a <strong style={{ color: tierColor(preview.years) }}>{preview.years}-year replacement</strong> via SSL Indonesia
            </span>
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div style={{ ...S.label, marginBottom: 12 }}>Optional — internal cost record</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
            <Field k="pusat_cost" label="Pusat-SSL cost (USD)" type="number" placeholder="0.00" />
            <Field k="ssl_indonesia_cost" label="SSL-Indonesia cost (USD)" type="number" placeholder="0.00" />
            <Field k="notes" label="Notes" placeholder="Customer contact, ticket ref…" span />
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

/* ---------- Case ticket ---------- */
function CaseTicket({ r, onEdit, onDelete, onStatus }) {
  const [open, setOpen] = useState(false);
  const urgent = r.days_remaining < 90;
  return (
    <div className="fade-up card" style={{ borderLeft: `3px solid ${tierColor(r.replacement_years)}`, borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow)" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "14px 18px", cursor: "pointer", display: "grid", gridTemplateColumns: "minmax(160px,1.4fr) auto auto auto 90px", gap: 14, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.domain_name}</div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--txt-low)", marginTop: 1 }}>{r.order_number} · {r.product_type}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Pill color={r.payment_status === "Paid" ? "var(--green)" : "var(--red)"} dim={r.payment_status === "Paid" ? "var(--green-dim)" : "var(--red-dim)"}>{r.payment_status}</Pill>
          <Pill color="var(--txt-mid)" dim="var(--ink-3)">{r.handover_type}</Pill>
          <Pill color={tierColor(r.replacement_years)} dim={tierDim(r.replacement_years)}>{r.replacement_years}Y replacement</Pill>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={"mono" + (urgent ? " pulse" : "")} style={{ fontSize: 17, fontWeight: 600, color: urgent ? "var(--red)" : "var(--txt-hi)", fontVariantNumeric: "tabular-nums" }}>{r.days_remaining}d</div>
          <div style={{ fontSize: 10.5, color: "var(--txt-low)" }}>order left</div>
        </div>
        <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => onStatus(r, e.target.value)}
          style={{ width: 130, padding: "6px 8px", fontSize: 12.5, background: r.status === "Completed" ? "var(--green-dim)" : r.status === "In Progress" ? "var(--amber-dim)" : "var(--ink-2)", color: r.status === "Completed" ? "var(--green)" : r.status === "In Progress" ? "var(--amber)" : "var(--txt-mid)", border: "1px solid var(--line)" }}>
          {CASE_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="mono" style={{ fontSize: 11, color: "var(--txt-low)", textAlign: "right" }}>{open ? "▲ close" : "▼ detail"}</div>
      </div>

      {open && (
        <div style={{ padding: "4px 18px 18px", borderTop: "1px solid var(--line)" }}>
          <ValidityBar certStart={r.cert_start_date} certEnd={r.cert_end_date} orderExpiry={r.order_expiry_date} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 20 }}>
            {[
              ["Purchased", fmtDate(r.purchase_date)],
              ["Cert validity", `${fmtDate(r.cert_start_date)} → ${fmtDate(r.cert_end_date)}`],
              ["Order expiry", fmtDate(r.order_expiry_date)],
              ["Bought years", r.cert_purchase_years + "y"],
              r.pusat_cost != null ? ["Pusat cost", "$" + r.pusat_cost] : null,
              r.ssl_indonesia_cost != null ? ["SSL-Indonesia cost", "$" + r.ssl_indonesia_cost] : null,
            ].filter(Boolean).map(([k, v]) => (
              <div key={k}>
                <div style={S.label}>{k}</div>
                <div className="mono" style={{ fontSize: 13, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          {r.notes && <div style={{ marginTop: 14, fontSize: 13, color: "var(--txt-mid)", background: "var(--ink-2)", padding: "10px 14px", borderRadius: 6 }}>{r.notes}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => onEdit(r)} style={{ background: "var(--ink-3)", color: "var(--txt-hi)", padding: "8px 18px", fontSize: 13 }}>Edit</button>
            <button onClick={() => onDelete(r)} style={{ background: "transparent", border: "1px solid var(--red)", color: "var(--red)", padding: "8px 18px", fontSize: 13 }}>Delete</button>
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
    pending: records.filter(r => r.status === "Pending").length,
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
        <Stat label="Pending" value={stats.pending} accent="var(--txt-mid)" active={flt.status === "Pending"} onClick={() => setFlt(f => ({ ...f, status: f.status === "Pending" ? "" : "Pending" }))} />
        <Stat label="Completed" value={stats.done} accent="var(--green)" active={flt.status === "Completed"} onClick={() => setFlt(f => ({ ...f, status: f.status === "Completed" ? "" : "Completed" }))} />
        <Stat label="Under 90 days" value={stats.urgent} accent="var(--red)" sub="urgent" />
        <Stat label="1-year tier" value={stats.y1} accent="var(--green)" sub="≤ 365d left" active={flt.years === "1"} onClick={() => setFlt(f => ({ ...f, years: f.years === "1" ? "" : "1" }))} />
        <Stat label="2-year tier" value={stats.y2} accent="var(--amber)" sub="366–730d" active={flt.years === "2"} onClick={() => setFlt(f => ({ ...f, years: f.years === "2" ? "" : "2" }))} />
        <Stat label="3-year tier" value={stats.y3} accent="var(--violet)" sub="> 730d" active={flt.years === "3"} onClick={() => setFlt(f => ({ ...f, years: f.years === "3" ? "" : "3" }))} />
      </section>

      <section className="card" style={{ padding: "16px 18px", marginBottom: 18, borderRadius: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[["", "All time"], ["week", "Last 7 days"], ["month", "This month"], ["year", "This year"]].map(([v, l]) => (
            <button key={v} onClick={() => applyPreset(v)} className="mono" style={{
              padding: "6px 14px", fontSize: 11.5, letterSpacing: "0.05em",
              background: preset === v ? "var(--cyan-dim)" : "transparent",
              border: `1px solid ${preset === v ? "var(--cyan)" : "var(--line)"}`,
              color: preset === v ? "var(--cyan)" : "var(--txt-mid)"
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
          <select value={flt.handover} onChange={e => setFlt(f => ({ ...f, handover: e.target.value }))}>
            <option value="">Reissue + Renewal</option>
            <option>Reissue</option><option>Renewal</option>
          </select>
          <select value={flt.status} onChange={e => setFlt(f => ({ ...f, status: e.target.value }))}>
            <option value="">Any status</option>
            {CASE_STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--txt-low)" }}>{filtered.length} / {records.length} cases</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--txt-mid)", cursor: "pointer" }}>
              <input type="checkbox" checked={includeCosts} onChange={e => setIncludeCosts(e.target.checked)} style={{ width: "auto" }} />
              Include cost columns
            </label>
            <button onClick={exportExcel} disabled={filtered.length === 0} style={{ background: "var(--ink-3)", color: "var(--txt-hi)", padding: "9px 20px", fontSize: 13.5, border: "1px solid var(--line-strong)" }}>
              ⬇ Export Excel
            </button>
          </div>
        </div>
      </section>

      {loadErr && (
        <div style={{ padding: "14px 18px", background: "var(--red-dim)", border: "1px solid var(--red)", borderRadius: 8, color: "var(--red)", fontSize: 13.5, marginBottom: 16 }}>
          Couldn't load cases: {loadErr}. Check that the migration_cases table exists in Supabase.
        </div>
      )}

      {loading ? (
        <div className="mono pulse" style={{ textAlign: "center", padding: "60px 0", color: "var(--txt-low)", fontSize: 13 }}>loading cases…</div>
      ) : filtered.length === 0 && !loadErr ? (
        <div style={{ textAlign: "center", padding: "70px 20px", border: "1px dashed var(--line-strong)", borderRadius: 12 }}>
          <div className="mono" style={{ fontSize: 13, color: "var(--txt-low)", marginBottom: 8 }}>{records.length === 0 ? "no cases logged yet" : "no cases match filters"}</div>
          {records.length === 0 && <button onClick={() => setShowForm(true)} style={{ background: "var(--cyan)", color: "#fff", padding: "10px 22px", fontWeight: 600 }}>Log the first case</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(r => (
            <CaseTicket key={r.id} r={r}
              onEdit={x => { setEditing(x); setShowForm(true); }}
              onDelete={x => setConfirmDel(x)}
              onStatus={onStatus} />
          ))}
        </div>
      )}

      {showForm && <CaseForm initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={onSaved} products={products} />}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(13,23,38,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setConfirmDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "24px 28px", maxWidth: 420, boxShadow: "0 20px 60px rgba(13,17,22,0.25)" }}>
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

      <footer style={{ marginTop: 50, paddingTop: 18, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--txt-low)" }}>Replacement tiers · ≤365d → 1Y · 366–730d → 2Y · &gt;730d → 3Y</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--txt-low)" }}>Renewals handled by SSL Indonesia</span>
      </footer>
    </main>
  );
}
