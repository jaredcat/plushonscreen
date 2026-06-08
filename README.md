# 🐍 PlushOnScreen

A community-curated database tracking appearances of IKEA plush toys in movies, TV, and beyond. Built with [Astro](https://astro.build), deployed to Cloudflare Pages.

## How it works

Every sighting is a Markdown file under `src/content/sightings/<plush-id>/`, with screenshots in that folder's `images/` subfolder. The schema in `src/content.config.ts` is the single source of truth for what's tracked — Astro validates every entry against it at build time, so a malformed entry fails the build rather than shipping broken.

## Adding a sighting

**As a PR:** add a `.md` file under `src/content/sightings/<plush-id>/` and its screenshot in that folder's `images/` directory. Copy `djungelorm/example-movie-2026.md` as a starting point. Open a PR.

**As a form:** non-technical contributors use the [sighting issue form](../../issues/new?template=sighting.yml). Maintainers convert accepted issues into entries.

## Adding a new plush

Add an entry to the `plushes` array in `src/plushes.ts`, then add the new option to `.github/ISSUE_TEMPLATE/sighting.yml`.

## Local development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
npm run preview  # serve the built site locally
npm run check    # lint, typecheck, and validate content (run before opening a PR)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full contributor guidelines.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and deploys to Cloudflare Pages.

Before the first deploy:

1. Create a Cloudflare Pages project named `plushonscreen` (or change the name in the workflow).
2. Create an API token at [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) with **Custom token** permissions:
   - **Account → Cloudflare Pages → Edit**
   - **Account → Account Settings → Read**
   - Scope the token to your account (not the "Edit Cloudflare Workers" template — that lacks Pages permissions).
3. Add repo secrets under **Settings → Secrets and variables → Actions**:
   - `CLOUDFLARE_API_TOKEN` — the token value from step 2
   - `CLOUDFLARE_ACCOUNT_ID` — from the Cloudflare dashboard sidebar (Workers & Pages → Overview → right column)

## Find & replace before going live

Search the repo for `YOUR_USERNAME` and replace with your GitHub username (appears in the layout footer, about page, issue config, and example entry).

---

Fan project. Not affiliated with IKEA.
