#!/usr/bin/env node
/**
 * One-time (idempotent): creates (or updates) a standalone preview page at
 * "/press-design-mockup" bound to true-doors-theme/templates/press-mockup.html.
 *
 * This is purely for visually reviewing the BASE-theme Press design mockup
 * before any changes are considered for the live "/press" page. It never
 * touches the live /press page's binding.
 *
 * Auth: reads a Private App access token from the HUBSPOT_PAT environment
 * variable. The token value is never logged.
 *
 * Usage:
 *   HUBSPOT_PAT=xxxx node scripts/create_press_mockup_page.js
 */

const API_BASE = "https://api.hubapi.com";
const TARGET_TEMPLATE_PATH = "true-doors-theme/templates/press-mockup.html";
const SLUG = "press-design-mockup";
const NAME = "Press (BASE theme design mockup)";

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

async function findMockupPage(token) {
  const result = await hubspotRequest(
    token,
    "GET",
    `/cms/v3/pages/site-pages?slug=${SLUG}&limit=10`
  );
  const results = result && result.results ? result.results : [];
  return results.find((p) => p.slug === SLUG) || null;
}

async function main() {
  const token = getToken();

  console.log(`Looking up existing "/${SLUG}" page...`);
  let page = await findMockupPage(token);

  if (!page) {
    console.log("Not found. Creating it...");
    page = await hubspotRequest(token, "POST", "/cms/v3/pages/site-pages", {
      name: NAME,
      slug: SLUG,
      templatePath: TARGET_TEMPLATE_PATH,
    });
    console.log(`Created page id=${page.id}`);
  } else {
    console.log(`Found page id=${page.id}, current templatePath=${page.templatePath}`);
    if (page.templatePath !== TARGET_TEMPLATE_PATH) {
      console.log(`Updating templatePath to "${TARGET_TEMPLATE_PATH}"...`);
      page = await hubspotRequest(
        token,
        "PATCH",
        `/cms/v3/pages/site-pages/${page.id}`,
        { templatePath: TARGET_TEMPLATE_PATH }
      );
    }
  }

  console.log("Publishing the page...");
  await hubspotRequest(token, "POST", `/cms/v3/pages/site-pages/${page.id}/draft/push-live`, {});
  console.log(`Done. https://www.truedoors.com/${SLUG} should now render the BASE design mockup.`);
}

main().catch((err) => {
  console.error(err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
