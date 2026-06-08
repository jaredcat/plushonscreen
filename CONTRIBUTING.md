# Contributing to PlushOnScreen

Thanks for helping document IKEA plush sightings on screen!

## Ways to contribute

### Submit a sighting (web form)

Use [plushonscreen.com/submit](https://plushonscreen.com/submit) (or `/submit` locally via `npm run dev:worker` after configuring secrets). The form validates your entry, runs a browser proof-of-work check, and opens a pull request on the repo.

### Submit a sighting (PR)

1. Copy [`src/content/sightings/djungelorm/example-movie-2026.md`](src/content/sightings/djungelorm/example-movie-2026.md) into the folder for your plush (e.g. `src/content/sightings/djungelorm/`) and **rename it** (files named `example-*` are templates and are not published).
2. Add your screenshot to that plush folder's `images/` directory (e.g. `src/content/sightings/djungelorm/images/`).
3. Set `plush` in frontmatter to match the folder name and a valid id from [`src/plushes.ts`](src/plushes.ts).
4. Run checks locally (see below), then open a pull request.

### Submit a sighting (issue form)

Use the [sighting issue form](.github/ISSUE_TEMPLATE/sighting.yml). Maintainers convert accepted issues into entries.

### Add a new plush

1. Add an entry to the `plushes` array in [`src/plushes.ts`](src/plushes.ts).
2. Create `src/content/sightings/<plush-id>/` and `src/content/sightings/<plush-id>/images/` for that plush's sightings.
3. Add the new option to [`.github/ISSUE_TEMPLATE/sighting.yml`](.github/ISSUE_TEMPLATE/sighting.yml).

## Submission API setup (maintainers)

The `/submit` page posts to a Cloudflare Worker (`worker/index.ts`) that opens PRs via a GitHub App.

1. Create a GitHub App with **Contents** and **Pull requests** read/write permission. Install it on `jaredcat/plushonscreen`.
2. Note the **App ID** and **Installation ID** (from the installation URL or API).
3. Generate a private key and download the `.pem` file.
4. Set Worker secrets (production):

```sh
npx wrangler secret put POW_SECRET
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_INSTALLATION_ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY
```

Paste the full PEM for `GITHUB_APP_PRIVATE_KEY` (Wrangler accepts multiline secrets). For local dev, copy `.dev.vars.example` to `.dev.vars`.

Optional: adjust `POW_DIFFICULTY` in `wrangler.jsonc` (4 hex leading zeros by default; higher = slower client check).

Test the full stack locally:

```sh
npm run dev:worker
```

Then open `http://localhost:8787/submit`.

## Local development

```sh
npm install
npm run dev       # http://localhost:4321 (static site only; /submit API needs dev:worker)
npm run dev:worker # build + wrangler dev at http://localhost:8787
npm run build     # outputs to dist/
npm run preview   # serve the built site locally
```

## Before opening a PR

Run the full quality gate:

```sh
npm run check
```

This runs:

- **Biome** — lint and format for `.astro`, `.ts`, `.mjs`, `.json`, and CSS
- **`astro check`** — TypeScript diagnostics in Astro components
- **Sighting validator** — plush ids and screenshot paths in content files

Individual commands:

```sh
npm run lint      # check formatting and lint rules
npm run lint:fix  # auto-fix safe issues
npm run format    # format all files
```

Git hooks run Biome on staged files and lightly optimize staged sighting screenshots (resize to a 1920px max edge, high-quality compression) before each commit. JPEG is preferred for photo stills — PNG is fine but compresses less. You can skip hooks in a pinch with `git commit --no-verify`, but CI will still enforce the checks.

To optimize images manually:

```sh
npm run optimize-images -- path/to/image.png
```

## Fixing Biome failures

```sh
npm run lint:fix
```

If Biome reports issues it cannot auto-fix, read the error message and adjust the code manually. See [Biome's rules reference](https://biomejs.dev/linter/rules/) for details.

## Content schema

Every sighting is validated against the Zod schema in [`src/content.config.ts`](src/content.config.ts). Required fields: `title`, `year`, `mediaType`, `plush`, `sceneDescription`. A malformed entry fails `npm run build`.

### Contributor credit (`submittedBy`)

Optional credit for who spotted the plush. Use a platform + username — the site builds profile links from fixed templates (no raw URLs in frontmatter):

```yaml
submittedBy:
  platform: youtube   # github, instagram, tiktok, bluesky, youtube, twitch, reddit, pinterest, threads, or none
  username: your-handle
```

Pick `none` for a display name with no link.

## CI

Pull requests run [`.github/workflows/ci.yml`](.github/workflows/ci.yml): Biome, `astro check`, sighting validation, and production build.
