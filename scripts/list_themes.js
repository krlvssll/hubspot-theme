#!/usr/bin/env node
const API_BASE = "https://api.hubapi.com";
async function main() {
  const token = process.env.HUBSPOT_PAT;
  const res = await fetch(`${API_BASE}/cms/v3/source-code/published/metadata/@hubspot/themes?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  // Fallback: list top-level folders which represent themes
  const res2 = await fetch(`${API_BASE}/cms/v3/design-manager/tree`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res2.ok) {
    const tree = await res2.json();
    console.log("Top-level design manager entries:");
    console.log(JSON.stringify((tree.children || []).map(c => ({ name: c.name, folder: c.folder })), null, 2));
  } else {
    console.log("design-manager/tree failed:", res2.status, await res2.text());
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
