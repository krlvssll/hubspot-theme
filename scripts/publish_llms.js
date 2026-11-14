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
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/plain;charset=utf-8" }), "llms.txt");
  form.append("folderPath", "/true-doors-brand");
  form.append("options", JSON.stringify({ access: "PUBLIC_NOT_INDEXABLE", overwrite: true }));
  await request("POST", "/files/v3/files", form);
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
  console.log(`Uploaded and verified ${destination}; root proxy configured for ${SITE}/llms.txt.`);
  console.log("URL redirect propagation may take up to 48 hours. Verify the root response before claiming it is live.");
}

async function main() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) throw new Error("Missing HUBSPOT_PAT with files and content permissions.");
  const content = await readFile(join(__dirname, "../llms.txt"), "utf8");
  await publishLlms(async (method, path, body) => {
    const multipart = body instanceof FormData;
    const response = await fetch(`https://api.hubapi.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(multipart ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HubSpot ${method} ${path} failed (${response.status}). Verify files and content permissions; existing pages were not changed.`);
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
