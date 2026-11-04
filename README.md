# True Doors Theme

This repository holds the **True Doors** HubSpot CMS theme, scaffolded under
[`true-doors-theme/`](./true-doors-theme).

## Structure

```
true-doors-theme/
├── theme.json          # Theme configuration (label, screenshot, settings)
├── templates/
│   └── home.html        # Home page template
├── css/
│   └── main.css          # Theme stylesheet
└── js/
    └── main.js            # Theme JavaScript
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
