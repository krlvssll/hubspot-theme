#!/usr/bin/env node
/**
 * One-time (idempotent) fix: re-points the live "/press" site page at
 * `true-doors-theme/templates/press.html` via the CMS Pages API.
 *
 * Background: the live page (confirmed via scripts/diag_pages.js) was
 * already correctly configured as a HubDB dynamic page against the
 * `press` table (dynamicPageHubDbTableId / dynamicPageDataSourceType were
 * already set), but its templatePath was still pointing at the BASE
 * theme's "blank-3.html" placeholder template instead of this repo's
 * press.html. That mismatch, not a missing dynamic-page configuration,
 * is why https://www.truedoors.com/press rendered unrelated content and
 * why switching templates via the Design Manager picker UI didn't stick.
 *
 * This script only ever changes `templatePath` on that one page. It does
 * not touch dynamicPageDataSourceType/dynamicPageHubDbTableId, which were
 * already correct, to minimize risk to the live page.
 *
 * Auth: reads a Private App access token from the HUBSPOT_PAT environment
 * variable. The token value is never logged.
 *
 * Usage:
 *   HUBSPOT_PAT=xxxx node scripts/fix_press_page_template.js
 */

const API_BASE = "https://api.hubapi.com";
const TARGET_TEMPLATE_PATH = "true-doors-theme/templates/press.html";

function getToken() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) {
    console.error("Missing HUBSPOT_PAT environment variable.");
    process.exit(1);
  }
  return token;
}

async function hubspotRequest(token, method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message = json && json.message ? json.message : text;
    const err = new Error(`HubSpot API ${method} ${path} failed: ${res.status} ${message}`);
    err.body = json;
    throw err;
  }
  return json;
}

async function findPressPage(token) {
  const result = await hubspotRequest(
    token,
    "GET",
    "/cms/v3/pages/site-pages?slug=press&limit=10"
  );
  const results = result && result.results ? result.results : [];
  return results.find((p) => p.slug === "press") || null;
}

async function main() {
  const token = getToken();

  console.log("Looking up the live /press page...");
  const page = await findPressPage(token);
  if (!page) {
    console.error("No page found with slug 'press'. Nothing to fix.");
    process.exit(1);
  }

  console.log(`Found page id=${page.id}, current templatePath=${page.templatePath}`);
  console.log(
    `  dynamicPageHubDbTableId=${page.dynamicPageHubDbTableId} dynamicPageDataSourceType=${page.dynamicPageDataSourceType}`
  );

  if (page.templatePath === TARGET_TEMPLATE_PATH) {
    console.log("templatePath is already correct. Nothing to do.");
    return;
  }

  console.log(`Updating templatePath to "${TARGET_TEMPLATE_PATH}"...`);
  const updated = await hubspotRequest(
    token,
    "PATCH",
    `/cms/v3/pages/site-pages/${page.id}`,
    { templatePath: TARGET_TEMPLATE_PATH }
  );
  console.log(`Updated. New templatePath=${updated.templatePath}`);

  console.log("Publishing the page so the change goes live...");
  await hubspotRequest(token, "POST", `/cms/v3/pages/site-pages/${page.id}/draft/push-live`, {});
  console.log("Done. https://www.truedoors.com/press should now render press.html.");
}

main().catch((err) => {
  console.error(err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
