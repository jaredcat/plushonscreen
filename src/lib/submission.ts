import { plushes } from '../plushes';
import {
  isValidSubmittedBy,
  normalizeUsername,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from './social';

export const MEDIA_TYPES = ['movie', 'tv', 'short', 'game', 'other'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const CONFIDENCE_LEVELS = ['verified', 'likely', 'disputed'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export interface SightingSubmission {
  title: string;
  year: number;
  mediaType: MediaType;
  plush: string;
  sceneDescription: string;
  timestamp?: string;
  clipUrl?: string;
  confidence: Confidence;
  submittedBy?: {
    platform: SocialPlatform;
    username: string;
  };
}

const plushIds = new Set(plushes.map((p) => p.id));
const validPlatforms = new Set<string>(SOCIAL_PLATFORMS);

const MAX_TITLE_LENGTH = 120;
const MAX_SCENE_LENGTH = 4000;
const MAX_TIMESTAMP_LENGTH = 32;
const MAX_CLIP_URL_LENGTH = 2048;

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function sightingSlug(title: string, year: number): string {
  const base = slugifyTitle(title);
  return base ? `${base}-${year}` : `sighting-${year}`;
}

export function uniqueSlug(baseSlug: string, taken: Set<string>): string {
  if (!taken.has(`${baseSlug}.md`)) {
    return baseSlug;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseSlug}-${index}`;
    if (!taken.has(`${candidate}.md`)) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export function imageExtension(
  mimeType: string,
): 'jpg' | 'png' | 'webp' | null {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

export function validateImageBytes(
  bytes: Uint8Array,
  mimeType: string,
): string | null {
  const maxBytes = 8 * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    return 'Screenshot must be 8MB or smaller.';
  }
  if (bytes.byteLength === 0) {
    return 'Screenshot file is empty.';
  }

  const ext = imageExtension(mimeType);
  if (!ext) {
    return 'Screenshot must be JPEG, PNG, or WebP.';
  }

  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp =
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (mimeType === 'image/jpeg' && !isJpeg) {
    return 'Screenshot does not look like a valid JPEG.';
  }
  if (mimeType === 'image/png' && !isPng) {
    return 'Screenshot does not look like a valid PNG.';
  }
  if (mimeType === 'image/webp' && !isWebp) {
    return 'Screenshot does not look like a valid WebP.';
  }

  return null;
}

function parseYear(value: string): number | null {
  const year = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(year) || year < 1888 || year > 2100) {
    return null;
  }
  return year;
}

function parseOptionalUrl(value: string | null): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function parseSubmissionForm(form: FormData): {
  data?: SightingSubmission;
  screenshot?: File;
  errors: string[];
} {
  const errors: string[] = [];

  const title = String(form.get('title') ?? '').trim();
  const yearRaw = String(form.get('year') ?? '').trim();
  const mediaType = String(form.get('mediaType') ?? '').trim();
  const plush = String(form.get('plush') ?? '').trim();
  const sceneDescription = String(form.get('sceneDescription') ?? '').trim();
  const timestamp = String(form.get('timestamp') ?? '').trim();
  const clipUrlRaw = String(form.get('clipUrl') ?? '').trim();
  const confidence = String(form.get('confidence') ?? '').trim();
  const creditPlatform = String(form.get('creditPlatform') ?? '').trim();
  const creditUsername = String(form.get('creditUsername') ?? '').trim();
  const screenshot = form.get('screenshot');

  if (!title) {
    errors.push('Title is required.');
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
  }

  const year = parseYear(yearRaw);
  if (year === null) {
    errors.push('Year must be a whole number between 1888 and 2100.');
  }

  if (!MEDIA_TYPES.includes(mediaType as MediaType)) {
    errors.push('Pick a valid media type.');
  }

  if (!plushIds.has(plush)) {
    errors.push('Pick a valid plush.');
  }

  if (!sceneDescription) {
    errors.push('Scene description is required.');
  } else if (sceneDescription.length > MAX_SCENE_LENGTH) {
    errors.push(
      `Scene description must be ${MAX_SCENE_LENGTH} characters or fewer.`,
    );
  }

  if (timestamp && timestamp.length > MAX_TIMESTAMP_LENGTH) {
    errors.push(
      `Timestamp must be ${MAX_TIMESTAMP_LENGTH} characters or fewer.`,
    );
  }

  if (!CONFIDENCE_LEVELS.includes(confidence as Confidence)) {
    errors.push('Pick a confidence level.');
  }

  if (clipUrlRaw.length > MAX_CLIP_URL_LENGTH) {
    errors.push('Clip URL is too long.');
  }

  const clipUrl = parseOptionalUrl(clipUrlRaw || null);
  if (clipUrlRaw && !clipUrl) {
    errors.push('Clip URL must be a valid http(s) link.');
  }

  let submittedBy: SightingSubmission['submittedBy'];
  if (creditPlatform || creditUsername) {
    if (!validPlatforms.has(creditPlatform)) {
      errors.push('Pick a valid credit platform.');
    } else if (!creditUsername.trim()) {
      errors.push('Credit username is required when a platform is selected.');
    } else {
      submittedBy = {
        platform: creditPlatform as SocialPlatform,
        username: normalizeUsername(creditUsername),
      };
      if (!isValidSubmittedBy(submittedBy)) {
        errors.push('Credit username is not valid for that platform.');
      }
    }
  }

  if (!(screenshot instanceof File) || screenshot.size === 0) {
    errors.push('Screenshot is required.');
  }

  if (errors.length > 0 || year === null) {
    return { errors };
  }

  return {
    data: {
      title,
      year,
      mediaType: mediaType as MediaType,
      plush,
      sceneDescription,
      timestamp: timestamp || undefined,
      clipUrl,
      confidence: confidence as Confidence,
      submittedBy,
    },
    screenshot: screenshot instanceof File ? screenshot : undefined,
    errors,
  };
}

function yamlString(value: string): string {
  if (/[:#{}[\],&*!|>'"%@`]|^\s|\s$/.test(value)) {
    return `'${value.replace(/'/g, "''")}'`;
  }
  return value;
}

function yamlBlock(value: string): string {
  return `>\n  ${value.replace(/\n+/g, '\n  ')}`;
}

export function buildSightingMarkdown(
  submission: SightingSubmission,
  slug: string,
  imageExt: 'jpg' | 'png' | 'webp',
): string {
  const lines: string[] = ['---'];

  lines.push(`title: ${yamlString(submission.title)}`);
  lines.push(`year: ${submission.year}`);
  lines.push(`mediaType: ${submission.mediaType}`);
  lines.push(`plush: ${submission.plush}`);

  if (submission.timestamp) {
    lines.push(`timestamp: ${yamlString(submission.timestamp)}`);
  }

  lines.push(`confidence: ${submission.confidence}`);
  lines.push(`sceneDescription: ${yamlBlock(submission.sceneDescription)}`);

  if (submission.submittedBy) {
    lines.push('submittedBy:');
    lines.push(`  platform: ${submission.submittedBy.platform}`);
    lines.push(`  username: ${yamlString(submission.submittedBy.username)}`);
  }

  if (submission.clipUrl) {
    lines.push(`clipUrl: ${yamlString(submission.clipUrl)}`);
  }

  lines.push(`screenshot: ./images/${slug}.${imageExt}`);
  lines.push(`addedDate: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('---');
  lines.push('');
  lines.push(
    'Submitted via the PlushOnScreen web form. Feel free to expand this entry below.',
  );

  return `${lines.join('\n')}\n`;
}

export function buildPullRequestBody(
  submission: SightingSubmission,
  slug: string,
): string {
  const plushName =
    plushes.find((plush) => plush.id === submission.plush)?.name ??
    submission.plush;

  return [
    '## Summary',
    '',
    `Adds a community sighting: **${submission.title}** (${submission.year}).`,
    '',
    '## Checklist',
    '',
    '- [x] Sighting `.md` is under `src/content/sightings/<plush-id>/` and matches the `plush` frontmatter field',
    "- [x] Screenshot added under that folder's `images/` directory",
    '- [x] `plush` id matches an entry in `src/plushes.ts`',
    '- [ ] CI checks pass',
    '',
    '## Sighting details',
    '',
    `- **Title:** ${submission.title}`,
    `- **Plush:** ${plushName}`,
    `- **Media type:** ${submission.mediaType}`,
    `- **Slug:** \`${slug}\``,
    `- **Confidence:** ${submission.confidence}`,
    submission.timestamp ? `- **Timestamp:** ${submission.timestamp}` : null,
    submission.clipUrl ? `- **Clip:** ${submission.clipUrl}` : null,
    submission.submittedBy
      ? `- **Submitted by:** ${submission.submittedBy.platform}:${submission.submittedBy.username}`
      : null,
    '',
    '---',
    '',
    '_Opened automatically from [plushonscreen.com/submit](https://plushonscreen.com/submit)._',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function branchName(slug: string): string {
  return `sighting/${slug}`;
}
