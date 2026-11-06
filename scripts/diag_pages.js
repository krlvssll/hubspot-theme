#!/usr/bin/env node
/**
 * READ-ONLY diagnostic: dumps the full site-page object for the live
 * "/press" page (and, for comparison, "/projects") so we can see their
 * actual templatePath / dynamicPageDataSourceType / dynamicPageHubDbTableId
 * values before attempting any write via the Pages API.
 *
 * Temporary — safe to delete after use. Makes no mutating requests.
 *
 * Usage:
 *   HUBSPOT_PAT=xxxx node scripts/diag_pages.js
 */

const API_BASE = "https://api.hubapi.com";

function getToken() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) {
    console.error("Missing HUBSPOT_PAT environment variable.");
    process.exit(1);
  }
  return token;
}

async function get(token, path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function main() {
  const token = getToken();

  for (const slug of ["press", "projects"]) {
    console.log(`\n=== slug=${slug} ===`);
    const { status, json } = await get(
      token,
      `/cms/v3/pages/site-pages?slug=${slug}&limit=10`
    );
    console.log("status:", status);
    const results = json && json.results ? json.results : [];
    if (results.length === 0) {
      console.log("No pages found for this slug.");
      console.log(JSON.stringify(json).slice(0, 500));
      continue;
    }
    for (const page of results) {
      console.log(
        JSON.stringify(
          {
            id: page.id,
            name: page.name,
            slug: page.slug,
            state: page.state,
            templatePath: page.templatePath,
            dynamicPageDataSourceId: page.dynamicPageDataSourceId,
            dynamicPageDataSourceType: page.dynamicPageDataSourceType,
            dynamicPageHubDbTableId: page.dynamicPageHubDbTableId,
            currentlyPublished: page.currentlyPublished,
            domain: page.domain,
            url: page.url,
          },
          null,
          2
        )
      );
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
