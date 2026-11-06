#!/usr/bin/env node
const API_BASE = "https://api.hubapi.com";
async function main() {
  const token = process.env.HUBSPOT_PAT;
  for (const path of [
    "true-doors-theme/templates/press.html",
    "true-doors-theme/templates/projects.html",
    "true-doors-theme/templates/home.html",
  ]) {
    const res = await fetch(`${API_BASE}/cms/v3/source-code/published/metadata/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log(`--- ${path} (status ${res.status}) ---`);
    console.log(text.slice(0, 1500));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
