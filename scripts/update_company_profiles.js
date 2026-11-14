#!/usr/bin/env node

const { isDeepStrictEqual } = require("node:util");

const TABLE_ID = "483210623";
const PROFILE_COLUMNS = [
  { name: "address", label: "Address", type: "TEXT" },
  { name: "featured_image", label: "Featured image", type: "IMAGE" },
  { name: "featured_image_alt", label: "Featured image description", type: "TEXT" },
  { name: "logo", label: "Logo", type: "IMAGE" },
  { name: "description", label: "Short description", type: "TEXT" },
  { name: "company_type", label: "Company type", type: "TEXT" },
];

function updatedColumns(table) {
  if (String(table.id) !== TABLE_ID || table.name !== "companies") {
    throw new Error("Expected the existing companies table 483210623. No changes made.");
  }
  for (const expected of [
    { name: "name", type: "TEXT" },
    { name: "website", type: "TEXT" },
    ...PROFILE_COLUMNS,
  ]) {
    const existing = table.columns.find((column) => column.name === expected.name);
    if (existing && existing.type !== expected.type) {
      throw new Error(`Column "${expected.name}" has an incompatible type. No changes made.`);
    }
    if (!existing && ["name", "website"].includes(expected.name)) {
      throw new Error(`Required column "${expected.name}" is missing. No changes made.`);
    }
  }
  return [
    ...table.columns,
    ...PROFILE_COLUMNS.filter((expected) => !table.columns.some((column) => column.name === expected.name)),
  ];
}

function tableSettings(table) {
  return {
    name: table.name,
    label: table.label,
    columns: table.columns.map((column) => Object.fromEntries(
      Object.entries(column).filter(([key]) =>
        !["createdAt", "updatedAt", "createdBy", "updatedBy", "createdByUserId", "updatedByUserId"].includes(key)
      )
    )),
    useForPages: table.useForPages,
    allowPublicApiAccess: table.allowPublicApiAccess,
    allowChildTables: table.allowChildTables,
    enableChildTablePages: table.enableChildTablePages,
    dynamicMetaTags: table.dynamicMetaTags,
    isOrderedManually: table.isOrderedManually,
  };
}

function rowSnapshot(rows, addedNames = []) {
  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    path: row.path,
    childTableId: row.childTableId,
    values: Object.fromEntries(Object.entries(row.values).filter(([key, value]) =>
      !addedNames.includes(key) || (value !== null && value !== "" && value !== undefined)
    )),
  })).sort((a, b) => a.id.localeCompare(b.id));
}

async function migrate(request) {
  const base = `/cms/v3/hubdb/tables/${TABLE_ID}`;
  async function allRows(draft) {
    const rows = [];
    let after;
    do {
      const query = new URLSearchParams({ limit: "1000" });
      if (after) query.set("after", after);
      const page = await request("GET", `${base}/rows${draft ? "/draft" : ""}?${query}`);
      rows.push(...page.results);
      after = page.paging?.next?.after;
    } while (after);
    return rows;
  }
  const [published, draft, publishedRows, draftRows] = await Promise.all([
    request("GET", base),
    request("GET", `${base}/draft`),
    allRows(false),
    allRows(true),
  ]);
  const publishedColumns = updatedColumns(published);
  if (publishedColumns.length === published.columns.length) {
    console.log("All company profile columns are already published. No changes made.");
    return;
  }
  const columns = updatedColumns(draft);
  const addedNames = columns.filter((column) => !draft.columns.some((old) => old.name === column.name))
    .map((column) => column.name);
  if (!addedNames.length) {
    console.log("All company profile columns are already in draft. Publish the table in HubSpot when its editorial edits are ready.");
    return;
  }
  const hasEditorialDraft = !isDeepStrictEqual(tableSettings(published), tableSettings(draft)) ||
    !isDeepStrictEqual(rowSnapshot(publishedRows), rowSnapshot(draftRows));
  const publishedBaseline = rowSnapshot(publishedRows);
  const draftBaseline = rowSnapshot(draftRows);
  const updated = await request("PATCH", `${base}/draft`, {
    name: draft.name,
    label: draft.label,
    useForPages: draft.useForPages,
    allowPublicApiAccess: draft.allowPublicApiAccess,
    allowChildTables: draft.allowChildTables,
    enableChildTablePages: draft.enableChildTablePages,
    dynamicMetaTags: draft.dynamicMetaTags,
    columns: columns.map((column) => ({
      id: column.id === undefined ? undefined : Number(column.id),
      name: column.name,
      label: column.label,
      type: column.type,
      options: column.options || [],
      foreignTableId: column.foreignTableId,
      foreignColumnId: column.foreignColumnId,
      maxNumberOfCharacters: column.maxNumberOfCharacters,
      maxNumberOfOptions: column.maxNumberOfOptions,
    })),
  });
  if (updatedColumns(updated).length !== updated.columns.length ||
      !isDeepStrictEqual(tableSettings(draft), tableSettings({
        ...updated,
        columns: updated.columns.filter((column) => !addedNames.includes(column.name)),
      }))) {
    throw new Error("Draft schema verification failed. Nothing was published; review the companies table in HubSpot.");
  }
  const [currentPublished, currentDraft, currentPublishedRows, currentDraftRows] = await Promise.all([
    request("GET", base),
    request("GET", `${base}/draft`),
    allRows(false),
    allRows(true),
  ]);
  if (!isDeepStrictEqual(tableSettings(published), tableSettings(currentPublished)) ||
      !isDeepStrictEqual(tableSettings(updated), tableSettings(currentDraft)) ||
      !isDeepStrictEqual(publishedBaseline, rowSnapshot(currentPublishedRows)) ||
      !isDeepStrictEqual(draftBaseline, rowSnapshot(currentDraftRows, addedNames))) {
    throw new Error("Companies changed during migration. Added columns remain in draft; nothing was published. Review in HubSpot.");
  }
  if (hasEditorialDraft) {
    console.log(`Added company profile columns to draft: ${addedNames.join(", ")}.`);
    console.log("Verified existing published and draft rows are unchanged. Unrelated unpublished edits were preserved, not published.");
    console.log("Publish the companies table in HubSpot when its editorial edits and profile details are ready.");
    return;
  }
  await request("POST", `${base}/draft/publish`);
  const [verified, verifiedRows] = await Promise.all([request("GET", base), allRows(false)]);
  if (updatedColumns(verified).length !== verified.columns.length ||
      !isDeepStrictEqual(tableSettings(updated), tableSettings(verified)) ||
      !isDeepStrictEqual(publishedBaseline, rowSnapshot(verifiedRows, addedNames))) {
    throw new Error("Post-publication verification failed. Review the companies table in HubSpot.");
  }
  console.log(`Published company profile columns: ${addedNames.join(", ")}.`);
  console.log("Verified existing rows, column IDs, and table settings are unchanged. No company details were populated.");
}

async function main() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) throw new Error("Missing HUBSPOT_PAT with the hubdb scope.");
  await migrate(async (method, path, body) => {
    const response = await fetch(`https://api.hubapi.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HubSpot API ${method} ${path} failed (${response.status}): ${text.replaceAll(token, "[redacted]")}`);
    }
    return response.status === 204 ? {} : response.json();
  });
}

module.exports = { migrate, updatedColumns, rowSnapshot, PROFILE_COLUMNS };
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
