# Contributing to PlushOnScreen

Thanks for helping document IKEA plush sightings on screen!

## Ways to contribute

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

## Local development

```sh
npm install
npm run dev       # http://localhost:4321
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

Git hooks run Biome on staged files before each commit. You can skip hooks in a pinch with `git commit --no-verify`, but CI will still enforce the checks.

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
