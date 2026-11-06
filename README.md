# True Doors Theme

This repository holds the **True Doors** HubSpot CMS theme, scaffolded under
[`true-doors-theme/`](./true-doors-theme).

## Structure

```
true-doors-theme/
├── theme.json          # Theme configuration (label, screenshot, settings)
├── templates/
│   ├── home.html         # Home page template
│   ├── projects.html      # Projects listing page template (HubDB-backed)
│   └── press.html         # Press listing + detail dynamic page template (HubDB-backed)
├── css/
│   └── main.css          # Theme stylesheet
└── js/
    └── main.js            # Theme JavaScript

scripts/
├── setup_hubdb.js             # One-time, idempotent HubDB table setup script
└── backfill_press_slugs.js    # One-time, idempotent `press` row slug backfill script
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

This repo includes a GitHub Actions workflow at
[`.github/workflows/hubspot-deploy.yml`](./.github/workflows/hubspot-deploy.yml)
that automatically deploys the `true-doors-theme/` folder to HubSpot CMS
using [`HubSpot/hubspot-cms-deploy-action@v2.0.1`](https://github.com/HubSpot/hubspot-cms-deploy-action)
on every push to the `main` branch.

### Required repository configuration

Before the workflow will succeed, configure the following in this repository
(Settings -> Secrets and variables -> Actions):

| Name | Type | Description |
| --- | --- | --- |
| `hubspot_personal_access_key` | Repository **secret** | A HubSpot Personal Access Key / Private App token with CMS access for the target portal. |
| `hubspot_account_id` | Repository **variable** (or `hubspot_portal_id` as a **secret**) | The numeric HubSpot portal/account ID to deploy to. |

Once these are set, every push to `main` will automatically deploy
`true-doors-theme/` to the configured HubSpot portal.

## HubDB-backed Projects page

The `true-doors-theme/templates/projects.html` template renders a list of
projects from a HubDB table named `projects`, which is set up by
[`scripts/setup_hubdb.js`](./scripts/setup_hubdb.js). That script is
idempotent (it checks for an existing table by name before creating one) and
sets up three related HubDB tables:

| Table | Purpose | Columns |
| --- | --- | --- |
| `companies` | Companies associated with a project | `name` (TEXT), `website` (TEXT) |
| `products` | Products that can be attached to a project | `name` (TEXT), `sku` (TEXT), `description` (TEXT) |
| `projects` | The projects shown on the Projects page | `project_name` (TEXT), `location_name` (TEXT), `city` (TEXT), `region` (TEXT), `country` (TEXT), `status` (SELECT: "In Progress" / "Completed"), `start_date` (DATE), `description` (RICHTEXT), `company` (FOREIGN_ID -> `companies`), `products` (FOREIGN_ID -> `products`) |

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
| `notable` | BOOLEAN | Featured in the "Notable press" strip at the top of the listing. |
| `source` | TEXT (URL) | External link to the original article — there is no on-site body. |
| `active` | BOOLEAN | Master publish flag; only `active=true` rows are listed. |

`active` and `notable` must be real HubDB **BOOLEAN** columns for the
template's `active=true`/`notable=true` HubL queries to work.

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

2. **Create and bind the page.** Requires Content Hub Professional or
   Enterprise, and is a content-editor action, not something expressible in
   the theme files or automatable via the API:
   - In HubSpot: **Content > Pages > Create > Website Page**, choose the
     `true-doors-theme/templates/press.html` template.
   - Under the page's **Advanced Options**, enable **"Make this an HubDB
     dynamic page"** and select the `press` table (now selectable, since
     `useForPages` was enabled in step 1).
   - Publish the page at the path `/press` (the template assumes this path
     via its `press_base_path` variable — update that variable if you
     publish it elsewhere).
