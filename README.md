# True Doors Theme

This repository holds the **True Doors** HubSpot CMS theme, scaffolded under
[`true-doors-theme/`](./true-doors-theme).

## Structure

```
true-doors-theme/
├── theme.json          # Theme configuration (label, screenshot, settings)
├── templates/
│   ├── home.html         # Home page template
│   └── projects.html      # Projects listing + detail template (HubDB dynamic pages)
├── css/
│   └── main.css          # Theme stylesheet
└── js/
    └── main.js            # Theme JavaScript

scripts/
└── setup_hubdb.js        # One-time, idempotent HubDB table setup script
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
