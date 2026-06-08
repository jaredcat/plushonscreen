import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONFIDENCE_LEVELS,
  type Confidence,
  isUnverified,
  unverifiedCompletenessWarnings,
} from '../src/lib/sighting-confidence.ts';
import { validateSightingFilename } from '../src/lib/sighting-naming.ts';
import {
  isValidSubmittedBy,
  normalizeUsername,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from '../src/lib/social.ts';
import { plushes } from '../src/plushes.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sightingsDir = join(root, 'src/content/sightings');
const plushIds = new Set(plushes.map((p) => p.id));
const validPlatforms = new Set<string>(SOCIAL_PLATFORMS);
const validConfidence = new Set<string>(CONFIDENCE_LEVELS);

const errors: string[] = [];
const warnings: string[] = [];

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const fieldMatch = line.match(/^([a-zA-Z]+):\s*(.+)$/);
    if (fieldMatch) {
      fields[fieldMatch[1]] = fieldMatch[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return fields;
}

interface ParsedSubmittedBy {
  platform: string;
  username: string;
}

function parseSubmittedBy(content: string): ParsedSubmittedBy | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const lines = match[1].split('\n');
  let platform: string | null = null;
  let username: string | null = null;
  let inSubmittedBy = false;

  for (const line of lines) {
    if (line.match(/^submittedBy:\s*$/)) {
      inSubmittedBy = true;
      continue;
    }

    if (inSubmittedBy) {
      const platformMatch = line.match(/^\s+platform:\s*(.+)$/);
      const usernameMatch = line.match(/^\s+username:\s*(.+)$/);
      if (platformMatch) {
        platform = platformMatch[1].trim().replace(/^['"]|['"]$/g, '');
        continue;
      }
      if (usernameMatch) {
        username = usernameMatch[1].trim().replace(/^['"]|['"]$/g, '');
        continue;
      }
      if (line.match(/^\S/)) {
        break;
      }
    }
  }

  if (!platform && !username) return null;
  if (!platform || !username) {
    return { platform: platform ?? '', username: username ?? '' };
  }

  return { platform, username };
}

function collectMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const markdownFiles = collectMarkdownFiles(sightingsDir).filter(
  (filePath) => !filePath.split('/').pop()?.startsWith('example-'),
);

for (const filePath of markdownFiles) {
  const relativePath = filePath.replace(`${root}/`, '');
  const content = readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);

  const plush = frontmatter.plush;
  if (!plush) {
    errors.push(`${relativePath}: missing required frontmatter field "plush"`);
    continue;
  }

  if (!plushIds.has(plush)) {
    errors.push(
      `${relativePath}: unknown plush id "${plush}" (valid ids: ${[...plushIds].join(', ')})`,
    );
  }

  const sightingsRelative = relativePath.replace(
    /^src\/content\/sightings\//,
    '',
  );
  const folderPlush = sightingsRelative.split('/')[0];
  if (folderPlush !== plush) {
    errors.push(
      `${relativePath}: file is under "${folderPlush}/" but frontmatter plush is "${plush}" — keep them in sync`,
    );
  }

  const confidence = (frontmatter.confidence ?? 'likely') as Confidence;
  if (!validConfidence.has(confidence)) {
    errors.push(
      `${relativePath}: confidence "${frontmatter.confidence}" is invalid (valid: ${CONFIDENCE_LEVELS.join(', ')})`,
    );
  }

  const mediaType = frontmatter.mediaType;
  if (!mediaType) {
    errors.push(
      `${relativePath}: missing required frontmatter field "mediaType"`,
    );
    continue;
  }

  if (!frontmatter.title) {
    errors.push(`${relativePath}: missing required frontmatter field "title"`);
  }

  const season = parseOptionalInt(frontmatter.season);
  const episode = parseOptionalInt(frontmatter.episode);

  for (const warning of unverifiedCompletenessWarnings({
    confidence,
    mediaType,
    year: parseOptionalInt(frontmatter.year),
    sceneDescription: frontmatter.sceneDescription,
    season,
    episode,
  })) {
    warnings.push(`${relativePath}: ${warning}`);
  }

  const screenshot = frontmatter.screenshot;
  if (screenshot) {
    const screenshotPath = resolve(dirname(filePath), screenshot);
    if (!existsSync(screenshotPath)) {
      errors.push(
        `${relativePath}: screenshot "${screenshot}" not found at ${screenshotPath.replace(`${root}/`, '')}`,
      );
    }
  } else if (!isUnverified(confidence)) {
    warnings.push(`${relativePath}: no screenshot (strongly recommended)`);
  }

  const basename = filePath.split('/').pop() ?? '';
  const filenameError = validateSightingFilename(basename, mediaType, {
    confidence,
    season,
    episode,
  });
  if (filenameError) {
    errors.push(`${relativePath}: ${filenameError}`);
  }

  const submittedBy = parseSubmittedBy(content);
  if (submittedBy) {
    if (!validPlatforms.has(submittedBy.platform)) {
      errors.push(
        `${relativePath}: submittedBy.platform "${submittedBy.platform}" is invalid (valid: ${SOCIAL_PLATFORMS.join(', ')})`,
      );
    } else if (!submittedBy.username) {
      errors.push(`${relativePath}: submittedBy.username is required`);
    } else if (
      !isValidSubmittedBy({
        platform: submittedBy.platform as SocialPlatform,
        username: normalizeUsername(submittedBy.username),
      })
    ) {
      errors.push(
        `${relativePath}: submittedBy.username "${submittedBy.username}" is not a valid handle for platform "${submittedBy.platform}"`,
      );
    } else if (submittedBy.username === 'YOUR_USERNAME') {
      warnings.push(
        `${relativePath}: submittedBy.username is still the placeholder YOUR_USERNAME`,
      );
    }
  }
}

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${markdownFiles.length} sighting file(s).`);
