#!/usr/bin/env node
/**
 * Temporary diagnostic: prints full details of the press-design-mockup page
 * so we can see why it 404s after creation (domain binding, state, etc).
 * Safe to delete once no longer needed.
 */
const API_BASE = "https://api.hubapi.com";
const token = process.env.HUBSPOT_PAT;
if (!token) {
  console.error("Missing HUBSPOT_PAT");
  process.exit(1);
}

async function req(method, path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(`${method} ${path} -> ${res.status}`, JSON.stringify(json, null, 2));
    return null;
  }
  return json;
}

async function main() {
  const result = await req("GET", "/cms/v3/pages/site-pages?slug=press-design-mockup&limit=10");
  console.log(JSON.stringify(result, null, 2));

  // Also print the live /press page for comparison.
  const pressResult = await req("GET", "/cms/v3/pages/site-pages?slug=press&limit=10");
  console.log("--- /press for comparison ---");
  console.log(JSON.stringify(pressResult, null, 2));
}

main();
