const test = require("node:test");
const assert = require("node:assert/strict");
const { publishLlms } = require("./publish_llms");

function fixture({ redirects = [], rootStatus = 404, hostedType = "text/plain", hostedBody = "# True Doors\n" } = {}) {
  const calls = [];
  async function request(method, path, body) {
    calls.push({ method, path, body });
    if (method === "GET") return { results: redirects };
    return { id: "1" };
  }
  async function fetchPublic(url) {
    return url.includes("/hubfs/")
      ? new Response(hostedBody, { headers: { "content-type": hostedType } })
      : new Response("", { status: rootStatus });
  }
  return { calls, request, fetchPublic };
}

test("verifies the uploaded plain-text file before creating an exact, 404-only root proxy", async () => {
  const state = fixture();
  await publishLlms(state.request, state.fetchPublic, "# True Doors\n");
  const proxy = state.calls.find((call) => call.method === "POST" && call.path.includes("url-redirects"));
  assert.equal(proxy.body.redirectStyle, 305);
  assert.equal(proxy.body.isOnlyAfterNotFound, true);
  assert.equal(proxy.body.isPattern, false);
  assert.equal(proxy.body.routePrefix, "https://www.truedoors.com/llms.txt");
});

test("refuses to replace an existing root file", async () => {
  const state = fixture({ rootStatus: 200 });
  await assert.rejects(publishLlms(state.request, state.fetchPublic, "# True Doors\n"), /existing route/);
  assert.ok(state.calls.every((call) => call.method === "GET"));
});

test("refuses conflicting redirect settings", async () => {
  const state = fixture({ redirects: [{ routePrefix: "/llms.txt", destination: "https://example.com", redirectStyle: 301 }] });
  await assert.rejects(publishLlms(state.request, state.fetchPublic, "# True Doors\n"), /different settings/);
  assert.ok(state.calls.every((call) => call.method === "GET"));
});

test("never proxies an HTML error or mismatched content", async () => {
  for (const options of [{ hostedType: "text/html" }, { hostedBody: "# Another file" }]) {
    const state = fixture(options);
    await assert.rejects(publishLlms(state.request, state.fetchPublic, "# True Doors\n"), /could not be verified/);
    assert.ok(!state.calls.some((call) => call.method === "POST" && call.path.includes("url-redirects")));
  }
});

test("reruns verify the file without duplicating its matching proxy", async () => {
  const state = fixture({
    rootStatus: 200,
    redirects: [{
      routePrefix: "https://www.truedoors.com/llms.txt",
      destination: "https://www.truedoors.com/hubfs/true-doors-brand/llms.txt",
      redirectStyle: 305,
    }],
  });
  await publishLlms(state.request, state.fetchPublic, "# True Doors\n");
  assert.equal(state.calls.filter((call) => call.method === "POST").length, 0);
});
