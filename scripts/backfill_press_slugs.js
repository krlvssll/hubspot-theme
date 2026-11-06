#!/usr/bin/env node
/**
 * One-time (idempotent) setup for the `press` HubDB table as a dynamic-page
 * data source.
 *
 * The `press` table (created and populated outside of this repo) holds press
 * mentions, but its rows were imported without a row `path`/`name`, and the
 * table itself was not yet enabled for dynamic pages. This script:
 *
 *   1. Sets `useForPages: true` on the table (if not already set), which
 *      makes it selectable as a dynamic-page data source in HubSpot's
 *      content editor (Content > Pages > Advanced Options). Actually
 *      binding a page to the table and publishing it is a content-editor
 *      step this script does not perform.
 *   2. Assigns a slug (derived from `title`, falling back to
 *      `press-mention-<hs_id>` when the title is blank or would produce a
 *      duplicate slug) to every row missing a `path`, since HubDB requires
 *      a unique path per row to generate per-row detail URLs.
 *   3. Publishes the table if either of the above changed anything.
 *
 * Auth: reads a Private App access token from the HUBSPOT_PAT environment
 * variable (same token used by scripts/setup_hubdb.js). The token value is
 * never logged.
 *
 * Usage:
 *   HUBSPOT_PAT=xxxx node scripts/backfill_press_slugs.js
 */

const API_BASE = "https://api.hubapi.com";
const TABLE_NAME = "press";

function getToken() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) {
    console.error(
      "Missing HUBSPOT_PAT environment variable. Set it to a HubSpot " +
        "Private App access token with the `hubdb` scope before running " +
        "this script."
    );
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
  } catch (err) {
    json = { raw: text };
  }

  if (!res.ok) {
    const message = json && json.message ? json.message : text;
    const category = json && json.category ? ` (category: ${json.category})` : "";
    const err = new Error(
      `HubSpot API ${method} ${path} failed: ${res.status} ${message}${category}`
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json;
}

async function listAllTables(token) {
  const tables = [];
  let after;
  do {
    const query = after ? `?limit=100&after=${encodeURIComponent(after)}` : "?limit=100";
    const page = await hubspotRequest(token, "GET", `/cms/v3/hubdb/tables${query}`);
    tables.push(...(page.results || []));
    after = page.paging && page.paging.next ? page.paging.next.after : undefined;
  } while (after);
  return tables;
}

async function findTableByName(token, name) {
  const tables = await listAllTables(token);
  return tables.find((t) => t.name === name);
}

// Fetches all draft rows for a table, following pagination. Draft rows are
// used (rather than published rows) so that edits made here apply cleanly
// on top of any other in-progress draft changes.
async function listAllDraftRows(token, tableId) {
  const rows = [];
  let after;
  do {
    const query = after ? `?limit=100&after=${encodeURIComponent(after)}` : "?limit=100";
    const page = await hubspotRequest(
      token,
      "GET",
      `/cms/v3/hubdb/tables/${tableId}/rows/draft${query}`
    );
    rows.push(...(page.results || []));
    after = page.paging && page.paging.next ? page.paging.next.after : undefined;
  } while (after);
  return rows;
}

function slugify(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// Builds a slug for a row, guaranteed unique against `usedSlugs`.
function buildUniqueSlug(row, usedSlugs) {
  const title = row.values && row.values.title;
  const base = slugify(title) || `press-mention-${row.id}`;

  let candidate = base;
  let suffix = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function main() {
  const token = getToken();

  const table = await findTableByName(token, TABLE_NAME);
  if (!table) {
    console.error(`Table "${TABLE_NAME}" not found in this portal. Nothing to backfill.`);
    process.exit(1);
  }

  let needsPublish = false;

  // `useForPages` makes the table selectable as a dynamic-page data source
  // in the content editor (Content > Pages > Advanced Options). This is
  // idempotent: it only PATCHes when the flag isn't already set.
  if (!table.useForPages) {
    console.log(`Enabling "useForPages" on "${TABLE_NAME}" (table id: ${table.id})...`);
    await hubspotRequest(token, "PATCH", `/cms/v3/hubdb/tables/${table.id}/draft`, {
      useForPages: true,
    });
    needsPublish = true;
  } else {
    console.log(`"useForPages" is already enabled on "${TABLE_NAME}".`);
  }

  const rows = await listAllDraftRows(token, table.id);
  console.log(`Found ${rows.length} rows in "${TABLE_NAME}" (table id: ${table.id}).`);

  // Seed the used-slug set with every row's existing path so new slugs never
  // collide with rows that already have one.
  const usedSlugs = new Set(
    rows.filter((r) => r.path).map((r) => r.path)
  );

  const rowsNeedingSlugs = rows.filter((r) => !r.path);
  if (rowsNeedingSlugs.length === 0) {
    console.log("Every row already has a path.");
  } else {
    console.log(`Backfilling ${rowsNeedingSlugs.length} row(s) missing a path...`);

    let updated = 0;
    for (const row of rowsNeedingSlugs) {
      const slug = buildUniqueSlug(row, usedSlugs);
      usedSlugs.add(slug);

      const name = (row.values && row.values.title) || slug;

      await hubspotRequest(token, "PATCH", `/cms/v3/hubdb/tables/${table.id}/rows/${row.id}/draft`, {
        path: slug,
        name,
      });
      updated += 1;
    }
    console.log(`Updated ${updated} row(s).`);
    needsPublish = true;
  }

  if (!needsPublish) {
    console.log("Nothing changed. Skipping publish.");
    return;
  }

  console.log("Publishing table...");
  await hubspotRequest(token, "POST", `/cms/v3/hubdb/tables/${table.id}/draft/push-live`);
  console.log(`Published "${TABLE_NAME}" (table id: ${table.id}).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
