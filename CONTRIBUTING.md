# Contributing to PlushOnScreen

Thanks for helping document IKEA plush sightings on screen!

## Ways to contribute

### Submit a sighting (PR)

1. Copy [`src/content/sightings/example-movie-2024.md`](src/content/sightings/example-movie-2024.md) as a starting point.
2. Add your screenshot to `src/content/sightings/images/`.
3. Set `plush` to a valid id from [`src/plushes.ts`](src/plushes.ts).
4. Run checks locally (see below), then open a pull request.

### Submit a sighting (issue form)

Use the [sighting issue form](.github/ISSUE_TEMPLATE/sighting.yml). Maintainers convert accepted issues into entries.

### Add a new plush

1. Add an entry to the `plushes` array in [`src/plushes.ts`](src/plushes.ts).
2. Add the new option to [`.github/ISSUE_TEMPLATE/sighting.yml`](.github/ISSUE_TEMPLATE/sighting.yml).

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

## CI

Pull requests run [`.github/workflows/ci.yml`](.github/workflows/ci.yml): Biome, `astro check`, sighting validation, and production build.
