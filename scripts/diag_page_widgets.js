#!/usr/bin/env node
/**
 * READ-ONLY diagnostic: dumps the full raw site-page object for the live
 * "/press" page, including widgets/layoutSections, to understand why
 * switching templatePath via API didn't change the rendered body content.
 *
 * Temporary — safe to delete after use. Makes no mutating requests.
 */
const API_BASE = "https://api.hubapi.com";

async function main() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) {
    console.error("Missing HUBSPOT_PAT");
    process.exit(1);
  }
  const res = await fetch(`${API_BASE}/cms/v3/pages/site-pages?slug=press&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  const page = (json.results || []).find((p) => p.slug === "press");
  if (!page) {
    console.log("not found");
    return;
  }
  console.log("Top-level keys:", Object.keys(page).join(", "));
  console.log("\n--- widgets ---");
  console.log(JSON.stringify(page.widgets, null, 2));
  console.log("\n--- layoutSections ---");
  console.log(JSON.stringify(page.layoutSections, null, 2));
  console.log("\n--- widgetContainers ---");
  console.log(JSON.stringify(page.widgetContainers, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
