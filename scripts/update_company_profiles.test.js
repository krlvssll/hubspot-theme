const test = require("node:test");
const assert = require("node:assert/strict");
const { migrate, updatedColumns, PROFILE_COLUMNS } = require("./update_company_profiles");

function fixture({ pending = false, concurrent = false, complete = false } = {}) {
  const table = {
    id: "483210623",
    name: "companies",
    label: "Companies",
    allowPublicApiAccess: false,
    useForPages: false,
    columns: [
      { id: "1", name: "name", label: "Name", type: "TEXT" },
      { id: "2", name: "website", label: "Website", type: "TEXT" },
      ...(complete ? PROFILE_COLUMNS.map((column, index) => ({ ...column, id: String(index + 3) })) : []),
    ],
  };
  let published = structuredClone(table);
  let draft = structuredClone(table);
  let publishedRows = [{ id: "10", values: { name: "Example organization", website: "https://example.com" } }];
  let draftRows = structuredClone(publishedRows);
  if (pending) draftRows[0].values.name = "Unpublished change";
  const calls = [];
  async function request(method, path, body) {
    calls.push({ method, path, body: structuredClone(body) });
    const isDraft = path.includes("/draft");
    if (method === "GET" && path.includes("/rows")) {
      return { results: structuredClone(isDraft ? draftRows : publishedRows) };
    }
    if (method === "GET") return structuredClone(isDraft ? draft : published);
    if (method === "PATCH") {
      draft.columns = body.columns.map((column, index) => ({ ...column, id: column.id || String(index + 1) }));
      if (concurrent) draftRows[0].values.name = "Concurrent editor change";
      return structuredClone(draft);
    }
    if (method === "POST" && path.endsWith("/draft/publish")) {
      published = structuredClone(draft);
      publishedRows = structuredClone(draftRows);
      return structuredClone(published);
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  }
  return { table, request, calls };
}

test("adds only missing columns and preserves existing IDs and configuration", () => {
  const { table } = fixture();
  table.columns.push({ ...PROFILE_COLUMNS[0], id: "7" });
  const columns = updatedColumns(table);
  assert.deepEqual(columns.slice(0, 3), table.columns);
  assert.equal(columns.filter((column) => column.name === "address").length, 1);
  assert.equal(columns.length, 8);
  assert.equal(table.columns.length, 3);
});

test("refuses another table or incompatible existing profile fields", () => {
  const { table } = fixture();
  assert.throws(() => updatedColumns({ ...table, id: "123" }), /Expected the existing companies table/);
  table.columns.push({ name: "logo", type: "TEXT" });
  assert.throws(() => updatedColumns(table), /incompatible type/);
});

test("publishes additive schema while retaining private access and row values", async () => {
  const state = fixture();
  await migrate(state.request);
  const patch = state.calls.find((call) => call.method === "PATCH");
  assert.equal(patch.body.columns.length, 8);
  assert.equal(patch.body.columns[0].id, "1");
  assert.equal(patch.body.name, "companies");
  assert.equal(patch.body.label, "Companies");
  assert.equal(patch.body.allowPublicApiAccess, false);
  assert.equal(patch.body.useForPages, false);
  assert.equal(state.calls.filter((call) => call.method === "POST").length, 1);
  assert.ok(state.calls.some((call) => call.path.includes("/rows/draft?")));
});

test("adds columns to draft without publishing or changing existing editorial data", async () => {
  const state = fixture({ pending: true });
  await migrate(state.request);
  assert.equal(state.calls.filter((call) => call.method === "PATCH").length, 1);
  assert.ok(!state.calls.some((call) => call.method === "POST"));
});

test("stops before publication if an editor changes row data during migration", async () => {
  const state = fixture({ concurrent: true });
  await assert.rejects(migrate(state.request), /changed during migration/);
  assert.ok(!state.calls.some((call) => call.method === "POST"));
});

test("rerunning a completed migration is read-only", async () => {
  const state = fixture({ complete: true });
  await migrate(state.request);
  assert.ok(state.calls.every((call) => call.method === "GET"));
});
