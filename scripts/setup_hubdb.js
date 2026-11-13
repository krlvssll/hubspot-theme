#!/usr/bin/env node
/**
 * One-time (idempotent) HubDB setup script.
 *
 * Creates the `companies`, `products`, and `projects` HubDB tables in a
 * HubSpot portal if they do not already exist, wires up the FOREIGN_ID
 * relations from `projects` to `companies`/`products`, and publishes each
 * newly created table so it is immediately usable from HubL templates.
 *
 * Auth: reads a Private App access token from the HUBSPOT_PAT environment
 * variable. The token value is never logged.
 *
 * Usage:
 *   HUBSPOT_PAT=xxxx node scripts/setup_hubdb.js
 */

const API_BASE = "https://api.hubapi.com";

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

// Fetches all HubDB tables (published), following pagination.
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

async function createTable(token, definition) {
  return hubspotRequest(token, "POST", "/cms/v3/hubdb/tables", definition);
}

// Partially updates a table's draft version (e.g. to flip useForPages on).
// Callers must publish afterwards for the change to take effect live.
async function updateTableDraft(token, tableIdOrName, patch) {
  return hubspotRequest(
    token,
    "PATCH",
    `/cms/v3/hubdb/tables/${tableIdOrName}/draft`,
    patch
  );
}

async function publishTable(token, tableIdOrName) {
  return hubspotRequest(
    token,
    "POST",
    `/cms/v3/hubdb/tables/${tableIdOrName}/draft/push-live`
  );
}

function textColumn(name, label) {
  return { name, label: label || name, type: "TEXT" };
}

// Ensures a table exists, creating + publishing it if necessary. If the
// definition specifies `useForPages: true` but an already-existing table
// doesn't have it set yet, this patches the draft and republishes so the
// setting applies idempotently regardless of whether the table is new or
// pre-existing.
// Returns the (published) table object either way.
async function ensureTable(token, definition) {
  const existing = await findTableByName(token, definition.name);
  if (existing) {
    console.log(`Table "${definition.name}" already exists (id: ${existing.id}). Skipping creation.`);

    if (definition.useForPages && !existing.useForPages) {
      console.log(`Enabling dynamic pages on existing table "${definition.name}"...`);
      await updateTableDraft(token, existing.id, { useForPages: true });
      await publishTable(token, existing.id);
      existing.useForPages = true;
      console.log(`Enabled and published dynamic pages for table "${definition.name}".`);
    }

    return existing;
  }

  console.log(`Creating table "${definition.name}"...`);
  const created = await createTable(token, definition);
  await publishTable(token, created.id);
  console.log(`Created and published table "${definition.name}" (id: ${created.id}).`);
  return created;
}

function findColumnId(table, columnName) {
  const column = (table.columns || []).find((c) => c.name === columnName);
  if (!column) {
    throw new Error(`Could not find column "${columnName}" on table "${table.name}" (id: ${table.id}).`);
  }
  return column.id;
}

async function main() {
  const token = getToken();

  const companiesTable = await ensureTable(token, {
    name: "companies",
    label: "Companies",
    columns: [textColumn("name", "Name"), textColumn("website", "Website")],
  });

  const productsTable = await ensureTable(token, {
    name: "products",
    label: "Products",
    columns: [
      textColumn("name", "Name"),
      textColumn("sku", "SKU"),
      textColumn("description", "Description"),
    ],
  });

  const companiesNameColumnId = findColumnId(companiesTable, "name");
  const productsNameColumnId = findColumnId(productsTable, "name");

  // Note: HubDB's FOREIGN_ID column always stores/returns a list of related
  // rows at the API/HubL level. "Single-select" (company) vs "multi-select"
  // (products) is a UX distinction enforced in the HubDB row editor UI; the
  // template handles both the same way (a nested for-loop), which safely
  // covers either zero, one, or many related rows.
  const projectsTable = await ensureTable(token, {
    name: "projects",
    label: "Projects",
    // Enables HubSpot's native HubDB dynamic pages: the Projects page (see
    // ensureProjectsPage below) renders the listing at its own URL and one
    // detail page per row at "<page-url>/<row's Page path>", using the
    // built-in hs_path/hs_name row fields HubSpot adds once this is on.
    useForPages: true,
    columns: [
      textColumn("project_name", "Project Name"),
      textColumn("location_name", "Location Name"),
      textColumn("city", "City"),
      textColumn("region", "Region"),
      textColumn("country", "Country"),
      {
        name: "status",
        label: "Status",
        type: "SELECT",
        options: [
          { name: "In Progress", type: "option" },
          { name: "Completed", type: "option" },
        ],
      },
      { name: "start_date", label: "Start Date", type: "DATE" },
      { name: "description", label: "Description", type: "RICHTEXT" },
      {
        name: "company",
        label: "Company",
        type: "FOREIGN_ID",
        foreignTableId: companiesTable.id,
        foreignColumnId: companiesNameColumnId,
      },
      {
        name: "products",
        label: "Products",
        type: "FOREIGN_ID",
        foreignTableId: productsTable.id,
        foreignColumnId: productsNameColumnId,
      },
    ],
  });

  console.log("\nHubDB setup complete. Tables:");
  console.log(`  companies -> id ${companiesTable.id}`);
  console.log(`  products  -> id ${productsTable.id}`);
  console.log(`  projects  -> id ${projectsTable.id}`);

  await ensureProjectsPage(token, projectsTable.id);
}

// Finds an existing site page by slug, using the Pages API (requires the
// `content` scope). Returns the page object, or undefined if none is found.
async function findPageBySlug(token, slug) {
  const page = await hubspotRequest(
    token,
    "GET",
    `/cms/v3/pages/site-pages?slug=${encodeURIComponent(slug)}&limit=10`
  );
  return (page.results || []).find((p) => p.slug === slug);
}

// Creates (or reuses) a live "Projects" page built from the projects.html
// template, linked to the `projects` HubDB table as its dynamic page data
// source. HubSpot then renders the listing at this page's own URL and
// generates one detail page per published row at "<page-url>/<row-path>".
// This step needs the `content` scope in addition to `hubdb`; if that scope
// is missing, the failure is logged clearly but does not fail the whole
// script, since the HubDB tables above are the more critical piece.
async function ensureProjectsPage(token, projectsTableId) {
  const slug = "projects";
  try {
    const existing = await findPageBySlug(token, slug);
    if (existing) {
      console.log(`\nPage with slug "${slug}" already exists (id: ${existing.id}, url: ${existing.url}). Skipping creation.`);

      if (existing.dynamicPageHubDbTableId !== projectsTableId) {
        console.log(`Linking existing "Projects" page (id: ${existing.id}) to the projects HubDB table...`);
        await hubspotRequest(token, "PATCH", `/cms/v3/pages/site-pages/${existing.id}`, {
          dynamicPageHubDbTableId: projectsTableId,
        });
        console.log(`Linked "Projects" page (id: ${existing.id}) to HubDB table ${projectsTableId}.`);
      }

      return;
    }

    const created = await hubspotRequest(token, "POST", "/cms/v3/pages/site-pages", {
      name: "Projects",
      slug,
      templatePath: "true-doors-theme/templates/projects.html",
      subcategory: "site_page",
      state: "PUBLISHED",
      dynamicPageHubDbTableId: projectsTableId,
    });
    console.log(`\nCreated and published "Projects" page (id: ${created.id}, url: ${created.url}), linked to HubDB table ${projectsTableId}.`);
  } catch (err) {
    if (err.status === 403) {
      console.error(
        "\nSkipped Projects page creation: the Private App token is missing " +
          "the `content` scope required by the CMS Pages API (403 error). " +
          `Details: ${err.message}`
      );
      return;
    }
    console.error(`\nSkipped Projects page creation due to an error: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
