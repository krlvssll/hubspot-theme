#!/usr/bin/env node

const { readFile } = require("node:fs/promises");
const { join } = require("node:path");

const SITE = "https://www.truedoors.com";
const FILE_PATH = "/true-doors-brand/llms.txt";

async function publishLlms(request, fetchPublic, content) {
  const redirects = [];
  let after;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (after) query.set("after", after);
    const page = await request("GET", `/cms/v3/url-redirects/?${query}`);
    redirects.push(...page.results);
    after = page.paging?.next?.after;
  } while (after);
  const destination = `${SITE}/hubfs${FILE_PATH}`;
  const existing = redirects.filter((redirect) =>
    ["/llms.txt", `${SITE}/llms.txt`, "http://www.truedoors.com/llms.txt"].includes(redirect.routePrefix)
  );
  if (existing.some((redirect) => redirect.destination !== destination || redirect.redirectStyle !== 305)) {
    throw new Error("An existing llms.txt redirect has different settings. Review it in HubSpot; nothing was overwritten.");
  }
  const root = await fetchPublic(`${SITE}/llms.txt`);
  if (root.status !== 404 && !existing.length) {
    throw new Error(`The llms.txt URL returned ${root.status}, not 404. Review the existing route before replacing it.`);
  }
  const hosted = await fetchPublic(destination);
  if (!hosted.ok || !(hosted.headers.get("content-type") || "").startsWith("text/plain") ||
      (await hosted.text()).trim() !== content.trim()) {
    throw new Error(`Uploaded file could not be verified at ${destination}. No redirect was created.`);
  }
  if (!existing.length) {
    await request("POST", "/cms/v3/url-redirects/", {
      routePrefix: `${SITE}/llms.txt`,
      destination,
      redirectStyle: 305,
      isPattern: false,
      isMatchFullUrl: true,
      isMatchQueryString: false,
      isProtocolAgnostic: true,
      isTrailingSlashOptional: false,
      isOnlyAfterNotFound: true,
    });
  }
  console.log(`Verified ${destination}; root proxy configured for ${SITE}/llms.txt.`);
  console.log("URL redirect propagation may take up to 48 hours. Verify the root response before claiming it is live.");
}

async function main() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) throw new Error("Missing HUBSPOT_PAT with content permissions.");
  const content = await readFile(join(__dirname, "../llms.txt"), "utf8");
  await publishLlms(async (method, path, body) => {
    const response = await fetch(`https://api.hubapi.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HubSpot ${method} ${path} failed (${response.status}). Verify content permissions; existing pages were not changed.`);
    }
    return response.json();
  }, fetch, content);
}

module.exports = { publishLlms };
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
