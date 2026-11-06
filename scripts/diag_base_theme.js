#!/usr/bin/env node
/**
 * READ-ONLY diagnostic: dumps the templatePath for the live homepage, and
 * the raw deployed source of the BASE theme's header/footer partials and
 * theme.json, so we can replicate BASE's site-wide design (header, footer,
 * required CSS/JS) inside our own press.html.
 *
 * Temporary — safe to delete after use. Makes no mutating requests.
 */
const API_BASE = "https://api.hubapi.com";

async function get(token, path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const token = process.env.HUBSPOT_PAT;
  if (!token) {
    console.error("Missing HUBSPOT_PAT");
    process.exit(1);
  }

  const homeId = "81876552980";
  console.log(`\n=== homepage page object (id=${homeId}) ===`);
  const { status: s1, text: t1 } = await get(token, `/cms/v3/pages/site-pages/${homeId}`);
  console.log("status:", s1);
  try {
    const json = JSON.parse(t1);
    console.log(
      JSON.stringify(
        { templatePath: json.templatePath, domain: json.domain, slug: json.slug },
        null,
        2
      )
    );
  } catch {
    console.log(t1.slice(0, 500));
  }

  const paths = [
    "@marketplace/SmartAcre_Inc_/BASE/theme.json",
    "@marketplace/SmartAcre_Inc_/BASE/templates/partials/header.html",
    "@marketplace/SmartAcre_Inc_/BASE/templates/partials/footer.html",
  ];
  for (const p of paths) {
    console.log(`\n=== ${p} ===`);
    const { status, text } = await get(
      token,
      `/cms/v3/source-code/published/content/${encodeURIComponent(p).replace(/%2F/g, "/")}`
    );
    console.log("status:", status);
    console.log(text.slice(0, 4000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
