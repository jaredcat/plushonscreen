# Contributing to PlushOnScreen

Thanks for helping document IKEA plush sightings on screen!

## Ways to contribute

### Submit a sighting (PR)

1. Copy a template from the plush folder:
   - Movie / short / game / other: [`example-movie-2026.md`](src/content/sightings/djungelorm/example-movie-2026.md)
   - TV: [`example-tv-show-s01e01.md`](src/content/sightings/djungelorm/example-tv-show-s01e01.md)
2. **Rename** the file to match the [naming convention](#file-naming) below (`example-*` files are not published).
3. Add your screenshot to that plush folder's `images/` directory (e.g. `src/content/sightings/djungelorm/images/`).
4. Set `plush` in frontmatter to match the folder name and a valid id from [`src/plushes.ts`](src/plushes.ts).
5. Run checks locally (see below), then open a pull request.

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

Every sighting is validated against the Zod schema in [`src/content.config.ts`](src/content.config.ts). Required fields for all entries: `title`, `mediaType`, `plush`.

Complete entries (`confidence: verified`, `likely`, or `disputed`) also require `year` and `sceneDescription`. TV entries require `season` and `episode` (`episodeTitle` is optional). A screenshot is strongly recommended.

**Unverified** entries (`confidence: unverified`) are for work-in-progress sightings. You can omit `year`, `sceneDescription`, season/episode, and screenshot while you gather details. TV filenames can omit the `-s{season}e{episode}` suffix until those are known.

When details are confirmed, fill in the missing fields, update the filename if needed, and change `confidence` to `likely` or `verified`.

### Confidence levels

| Value | Meaning |
|-------|---------|
| `verified` | Definitely the plush — no doubt |
| `likely` | Pretty confident (default) |
| `disputed` | Could be something similar |
| `unverified` | Reported but missing key details — relaxed validation |

### File naming

Sightings live under `src/content/sightings/<plush-id>/`. The **filename must start with the media type** and use lowercase slugs (letters, numbers, hyphens):

| Type | Pattern | Example |
|------|---------|---------|
| Movie | `movie-{title-slug}.md` | `movie-saw-2004.md` |
| TV | `tv-{show-slug}-s{SS}e{EE}.md` | `tv-suite-life-of-zack-and-cody-s02e01.md` |
| TV (unverified, S/E unknown) | `tv-{show-slug}.md` | `tv-all-that.md` |
| Short | `short-{title-slug}.md` | `short-big-buck-bunny.md` |
| Game | `game-{title-slug}.md` | `game-minecraft.md` |
| Other | `other-{title-slug}.md` | `other-viral-tiktok.md` |

Rules enforced by `npm run check`:

- The filename prefix must match `mediaType` in frontmatter.
- TV filenames must include `-s{season}e{episode}` with zero-padded numbers (e.g. `s02e01`) when season/episode are set — or when confidence is not `unverified`.
- `season`, `episode`, and optional `episodeTitle` are only allowed when `mediaType` is `tv`.

Logic lives in [`src/lib/sighting-naming.ts`](src/lib/sighting-naming.ts).

Templates (`example-*.md`) are excluded from the site and may ignore the naming rules until copied and renamed.

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
