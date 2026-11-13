# True Doors Theme

This repository holds two separate HubSpot CMS themes:

- [`true-doors-theme/`](./true-doors-theme) — the original, **live** theme.
  It is untouched by the brand redesign below and keeps deploying to its
  own `true-doors-theme` location in HubSpot, running the live site exactly
  as before.
- [`true-doors-brand-theme/`](./true-doors-brand-theme) — a **brand new,
  separate** theme with a True Doors brand-inspired redesign, built on top
  of HubSpot's official open-source
  [CMS theme boilerplate](https://developers.hubspot.com/docs/cms/start-building/building-blocks/themes/hubspot-cms-boilerplate)
  (drag-and-drop sections, reusable modules, `fields.json`-driven theme
  editor styling, full page/module/system-page scaffold) rather than
  hand-rolled HTML/CSS. It deploys to its own `true-doors-brand-theme`
  location in HubSpot under a distinct label, `True Doors — Brand
  Redesign`, so it does **not** overwrite or affect the live
  `true-doors-theme`. You can preview/assign it to pages independently in
  HubSpot's theme picker before deciding to adopt it for the live site.

## Structure

```
true-doors-theme/            # Original, live theme — untouched
├── theme.json          # Theme configuration (label, screenshot, settings)
├── templates/
│   ├── home.html         # Home page template
│   ├── projects.html      # Projects listing + detail template (HubDB dynamic pages)
│   └── press.html         # Press listing + detail dynamic page template (HubDB-backed)
├── css/
│   └── main.css          # Theme stylesheet
└── js/
    └── main.js            # Theme JavaScript

true-doors-brand-theme/      # New, separate brand-redesign theme
│                            # (based on HubSpot's CMS theme boilerplate)
├── theme.json
├── fields.json              # Theme editor fields: brand colors, fonts, spacing
├── templates/
│   ├── layouts/base.html    # Base layout (header/body/footer blocks)
│   ├── partials/            # Global header & footer partials
│   ├── home.html            # Hero, benefits cards, and projects CTA
│   ├── projects.html        # Projects listing page (HubDB-backed)
│   └── ...                  # Full boilerplate page scaffold (about, blog,
│                            #   contact, pricing, system pages, etc.)
├── sections/                # Drag-and-drop reusable sections (hero, CTA, cards, ...)
├── modules/                 # Reusable modules (button, card, menu, ...)
├── css/
│   ├── main.css             # ITCSS-style entry point (generic/objects/elements/components)
│   ├── theme-overrides.css  # Converts fields.json values into CSS
│   └── components/_projects.css  # Projects page/card styling
└── js/
    └── main.js

scripts/
├── setup_hubdb.js              # One-time, idempotent HubDB table setup script
├── backfill_press_slugs.js     # One-time, idempotent `press` row slug backfill script
└── fix_press_page_template.js  # One-time, idempotent fix for the live `/press` page's templatePath
```

## Local development with the HubSpot CLI

1. Install the HubSpot CLI: `npm install -g @hubspot/cli`
2. Authenticate: `hs init` (follow the prompts to connect your HubSpot account)
3. To scaffold additional theme boilerplate: `hs theme generate <name>`
4. To push local changes to your HubSpot portal manually: `hs upload true-doors-theme true-doors-theme`
5. For live-reloading local development: `hs watch true-doors-theme true-doors-theme`

See the [HubSpot CMS CLI documentation](https://developers.hubspot.com/docs/cms/developer-reference/local-development-cli)
for full details.

## CI/CD: automatic deploy on push to `main`

This repo includes two independent GitHub Actions workflows, each deploying
its theme folder to its own, distinct location in HubSpot so the two themes
never overwrite each other:

- [`.github/workflows/hubspot-deploy.yml`](./.github/workflows/hubspot-deploy.yml)
  deploys `true-doors-theme/` → `true-doors-theme` in HubSpot (the live theme).
- [`.github/workflows/hubspot-deploy-brand-theme.yml`](./.github/workflows/hubspot-deploy-brand-theme.yml)
  deploys `true-doors-brand-theme/` → `true-doors-brand-theme` in HubSpot
  (the new brand-redesign theme).

Both use [`HubSpot/hubspot-cms-deploy-action@v2.0.1`](https://github.com/HubSpot/hubspot-cms-deploy-action)
on every push to the `main` branch.

### Required repository configuration

Before the workflows will succeed, configure the following in this repository
(Settings -> Secrets and variables -> Actions):

| Name | Type | Description |
| --- | --- | --- |
| `hubspot_personal_access_key` | Repository **secret** | A HubSpot Personal Access Key / Private App token with CMS access for the target portal. |
| `hubspot_account_id` | Repository **variable** (or `hubspot_portal_id` as a **secret**) | The numeric HubSpot portal/account ID to deploy to. |

Once these are set, every push to `main` will automatically deploy both
`true-doors-theme/` and `true-doors-brand-theme/` to their own locations in
the configured HubSpot portal, without either one affecting the other.

## Community story template (brand theme)

`true-doors-brand-theme/templates/community-story.html` is an individual
community-story page template, not a stories listing or a HubDB dynamic page.
It uses a template-specific quiet header/footer and a reusable
`community-story` module inside a drag-and-drop area.

The layout pairs a large story heading and standfirst with a wide opening
photograph, a narrow reading column, alternating photo/text chapters,
optional first-hand quotes, related-story cards, and a closing invitation.
The visual direction is photography-led, with quiet sans-serif typography,
white space, and restrained teal accents. Styles are scoped to the module
and do not restyle other brand-theme pages.

Template-level CSS also styles standard heading, rich-text and image
modules retained by HubSpot when an existing page switches templates.
It does not migrate or remove content, reveal hidden sections, or change
shared global headers. Edit **Story navigation** to configure this page's
navigation links.

In HubSpot, create a page using **Community story**, then edit **Story
content**. Add community details, a publication date, and photographs with
descriptive alt text and captions/credits. Reorder or duplicate chapters
and choose left, right, or wide photo layouts. Related cards appear only
when both a title and URL are supplied; the closing invitation appears
only after a contact URL is supplied. Configure the stories-listing URL
rather than assuming a particular site route.

Defaults are editorial prompts, not published customer accounts. Replace
them before publishing. Use permissioned photography and quotes, respect
resident privacy, and substantiate any reported outcomes. No stock
boilerplate or generated imagery is presented as community photography.
Missing photos are omitted on published pages; the opening-photo reminder
is shown only in the HubSpot editor.

This addition does not deploy itself, create pages, modify the shared HubDB
tables, or change `true-doors-theme/`.

## HubDB-backed Projects listing + detail pages

The `true-doors-theme/templates/projects.html` template renders both a
listing of all projects and a detail page per project, using HubSpot's
native [HubDB dynamic pages](https://developers.hubspot.com/docs/cms/start-building/features/data-driven-content/hubdb/overview)
feature: one page/template pair serves the listing at its own URL (e.g.
`/projects`) and auto-generates one detail page per published row at
`/projects/<row's Page path>`. In the template, this is done by branching on
the `dynamic_page_hubdb_row` HubL variable — when it's set, the template
renders a single project's full detail view; otherwise it renders the
listing grid, with each card linking to that row's detail URL.

This is set up by [`scripts/setup_hubdb.js`](./scripts/setup_hubdb.js). That
script is idempotent (it checks for an existing table/page before creating
one, and patches existing ones to add any missing configuration) and sets up
three related HubDB tables:

| Table | Purpose | Columns |
| --- | --- | --- |
| `companies` | Companies associated with a project | `name` (TEXT), `website` (TEXT) |
| `products` | Products that can be attached to a project | `name` (TEXT), `sku` (TEXT), `description` (TEXT) |
| `projects` | The projects shown on the Projects page | `project_name` (TEXT), `location_name` (TEXT), `city` (TEXT), `region` (TEXT), `country` (TEXT), `status` (SELECT: "In Progress" / "Completed"), `start_date` (DATE), `description` (RICHTEXT), `company` (FOREIGN_ID -> `companies`), `products` (FOREIGN_ID -> `products`) |

The `projects` table is created (and, for pre-existing tables, patched) with
`useForPages: true`, which enables HubDB dynamic pages for it. Once that's
on, HubSpot automatically adds built-in **Page title** (`hs_name`) and
**Page path** (`hs_path`) fields to every row — set these per project when
adding/editing rows in HubDB so each project gets a sensible URL and title.
The Projects page is created (or, if it already exists, patched) with its
`dynamicPageHubDbTableId` pointed at the `projects` table so this linkage
also works for pages created before this feature existed.

`true-doors-brand-theme/templates/projects.html` renders the same `projects`
HubDB table, with styling from `css/components/_projects.css`.

### Running the HubDB setup

The setup script is wired up as a manual, one-time GitHub Actions workflow at
[`.github/workflows/setup-hubdb.yml`](./.github/workflows/setup-hubdb.yml).
Trigger it from the **Actions** tab (or `gh workflow run setup-hubdb.yml`). It
uses a dedicated repository secret, `hubspot_private_app_token` (a HubSpot
Private App access token with the `hubdb` scope, plus `content` if you also
want to create pages via the API) — this is separate from
`hubspot_personal_access_key`, which remains used only for the CLI theme
deploy workflow. It also reads the portal ID from the same
`hubspot_account_id`/`hubspot_portal_id` variable/secret as the deploy
workflow.

You can also run it locally:

```
HUBSPOT_PAT=your-private-app-token node scripts/setup_hubdb.js
```

## HubDB-backed Press pages (listing + detail)

### Brand-theme Press template

`true-doors-brand-theme/templates/press.html` (**Press - community design**)
uses the quiet community-story header/footer, charcoal typography, teal
controls, and responsive press cards. It reads the existing `press` table
without modifying its data or changing the original theme's `/press` page.
No photography is fabricated: the existing table has no image column.
The introduction is an editable drag-and-drop area, so the template also
supports switching from existing drag-and-drop pages. The HubDB listing
and detail markup remain data-driven rather than manually editable cards.

Create a separate page in **True Doors — Brand Redesign** with this
template. For on-site detail pages, enable HubDB dynamic pages and select
the existing `press` table; rows need their existing `hs_path` values.
The template derives its listing route from the page URL rather than
hardcoding `/press`. Without dynamic-page configuration, listing links
go directly to the external source where one is available.

The listing follows the original table contract: `active=Yes`, newest
first, blank titles excluded, and a maximum of 1,000 loaded active rows.
Coverage/region options come from those rows. Filters use two rows of
text links with underlined active selections, work without JavaScript,
preserve the other filter and HubSpot's preview parameter, and reset pagination.
Pagination shows 12 mentions at a time and clamps out-of-range page
numbers. Detail pages display source metadata and link to the original
coverage rather than copying third-party articles.

The `true-doors-theme/templates/press.html` template is a single HubL
template that serves both a filterable, paginated **listing** page and, when
bound as a HubDB dynamic page, a per-row **detail** page, from an existing
`press` HubDB table (created/populated outside of this repo — it is not
managed by `scripts/setup_hubdb.js`).

Expected `press` table columns:

| Column | Type | Purpose |
| --- | --- | --- |
| `title` | TEXT | Row title. Rows with a blank title are excluded from the listing. |
| `date_published` | DATE | Used to sort newest-first. |
| `country` | TEXT | Shown on the detail page. |
| `continent` | TEXT | Shown on the detail page; also a listing filter facet. |
| `organisation` | TEXT | Publication/outlet name. |
| `rating` | SELECT | Internal quality flag; not shown publicly. |
| `type` | SELECT | Mention type (Article, Video, etc.); a listing filter facet. |
| `notable` | SELECT (Yes/No) | Featured in the "Notable press" strip at the top of the listing. |
| `source` | TEXT (URL) | External link to the original article — there is no on-site body. |
| `active` | SELECT (Yes/No) | Master publish flag; only `active=Yes` rows are listed. |

`active` and `notable` are HubDB **SELECT** columns with `Yes`/`No` options
in this portal (not BOOLEAN) — the template's HubL queries filter on
`active=Yes`/`notable=Yes` accordingly. If your portal uses real BOOLEAN
columns instead, change those query strings to `active=true`/`notable=true`.

### One-time setup

1. **Run the setup script.** It's idempotent and handles two things:
   - Enables `useForPages` on the `press` table (if not already set), so it
     can be selected as a dynamic-page data source in the content editor.
   - Backfills a unique `path`/`name` on any row missing one (existing rows
     were imported without these), slugified from `title` (falling back to
     `press-mention-<hs_id>` for blank/duplicate titles) — required for
     per-row detail URLs.
   - Publishes the table if either of the above changed anything.

   Run it either:
   - From the **Actions** tab: trigger
     [`.github/workflows/backfill-press-slugs.yml`](./.github/workflows/backfill-press-slugs.yml)
     (uses the same `hubspot_private_app_token` secret as the HubDB setup
     workflow — no local setup needed), or
   - Locally:

     ```
     HUBSPOT_PAT=your-private-app-token node scripts/backfill_press_slugs.js
     ```

2. **Bind the live page to the template.** `/press` already exists as a
   HubDB dynamic page bound to the `press` table in this portal — it just
   needs its `templatePath` pointed at `press.html` instead of whatever
   placeholder template it was created from. Run (idempotent; no-ops if
   already correct):
   - From the **Actions** tab: trigger
     [`.github/workflows/fix-press-page-template.yml`](./.github/workflows/fix-press-page-template.yml), or
   - Locally:

     ```
     HUBSPOT_PAT=your-private-app-token node scripts/fix_press_page_template.js
     ```

   If HubSpot's "Select a template" picker in Design Manager doesn't
   surface `press.html` by name (seen in this portal even in the correct
   theme), this script bypasses the picker entirely via the CMS Pages API.
   After running it, allow a minute or two for HubSpot's prerendered-page
   cache to refresh before checking the live URL.

   For a brand-new page instead of rebinding an existing one: **Content >
   Pages > Create > Website Page**, choose the `true-doors-theme/templates/press.html`
   template, enable **"Make this an HubDB dynamic page"** under Advanced
   Options, select the `press` table (selectable since `useForPages` was
   enabled in step 1), and publish at `/press` (or update the template's
   `press_base_path` variable to match a different path).
