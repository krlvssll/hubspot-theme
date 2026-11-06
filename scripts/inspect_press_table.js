#!/usr/bin/env node
const API_BASE = "https://api.hubapi.com";
async function main() {
  const token = process.env.HUBSPOT_PAT;
  const res = await fetch(`${API_BASE}/cms/v3/hubdb/tables/press`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  console.log("useForPages:", json.useForPages);
  console.log(JSON.stringify(json.columns.map(c => ({
    name: c.name, label: c.label, type: c.type,
    options: c.options ? c.options.map(o => o.name || o) : undefined,
  })), null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
