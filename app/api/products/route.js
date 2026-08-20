import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK = ["DV SSL","OV SSL","EV SSL","DV Wildcard","OV Wildcard","EV Wildcard","Multi-Domain SAN","Code Signing","S/MIME","Other"];

let cache = { at: 0, products: null };
const TTL = 12 * 60 * 60 * 1000;

export async function GET() {
  if (cache.products && Date.now() - cache.at < TTL) {
    return NextResponse.json({ source: "gogetssl-cached", products: cache.products });
  }

  const user = process.env.GOGETSSL_USER;
  const pass = process.env.GOGETSSL_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json({ source: "fallback", products: FALLBACK });
  }

  try {
    const authRes = await fetch("https://my.gogetssl.com/api/auth/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ user, pass }),
      cache: "no-store"
    });
    const auth = await authRes.json();
    if (!auth.key) throw new Error(auth.description || "GoGetSSL auth failed");

    const prodRes = await fetch(`https://my.gogetssl.com/api/products/all/?auth_key=${encodeURIComponent(auth.key)}`, { cache: "no-store" });
    const prod = await prodRes.json();
    const list = (prod.products || [])
      .map(p => (p.product || p.name || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (!list.length) throw new Error("Empty product list");
    cache = { at: Date.now(), products: list };
    return NextResponse.json({ source: "gogetssl", products: list });
  } catch (e) {
    return NextResponse.json({ source: "fallback", error: String(e.message || e), products: FALLBACK });
  }
}
