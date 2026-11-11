#!/usr/bin/env node
/**
 * Temporary diagnostic: prints the `press` HubDB table's column definitions
 * so we can tell which columns are SELECT-type (object-valued at render
 * time) vs TEXT (plain string). Safe to delete once no longer needed.
 */
const API_BASE = "https://api.hubapi.com";
const token = process.env.HUBSPOT_PAT;
if (!token) {
  console.error("Missing HUBSPOT_PAT");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${API_BASE}/cms/v3/hubdb/tables/press`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const cols = (json.columns || []).map((c) => ({ name: c.name, label: c.label, type: c.type }));
  console.log(JSON.stringify(cols, null, 2));
}

main();
