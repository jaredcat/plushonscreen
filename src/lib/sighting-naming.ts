import { type Confidence, isUnverified } from './sighting-confidence.ts';

export const SIGHTING_MEDIA_TYPES = [
  'movie',
  'tv',
  'short',
  'game',
  'other',
] as const;

export type SightingMediaType = (typeof SIGHTING_MEDIA_TYPES)[number];

const WORK_SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const TV_SUFFIX = '-s(?<season>\\d+)e(?<episode>\\d+)';

/** Non-TV: `{mediaType}-{work-slug}.md` */
const NON_TV_FILENAME = new RegExp(
  `^(?<mediaType>movie|short|game|other)-(?<workSlug>${WORK_SLUG})\\.md$`,
);

/** TV with episode suffix: `tv-{work-slug}-s{season}e{episode}.md` */
const TV_FILENAME_WITH_SUFFIX = new RegExp(
  `^tv-(?<workSlug>${WORK_SLUG})${TV_SUFFIX}\\.md$`,
);

/** TV without episode suffix (unverified / S&E unknown): `tv-{work-slug}.md` */
const TV_FILENAME_LOOSE = new RegExp(`^tv-(?<workSlug>${WORK_SLUG})\\.md$`);

export interface ParsedSightingFilename {
  mediaType: SightingMediaType;
  workSlug: string;
  season?: number;
  episode?: number;
}

export function formatTvEpisodeSuffix(season: number, episode: number): string {
  return `-s${String(season).padStart(2, '0')}e${String(episode).padStart(2, '0')}`;
}

export function formatSightingFilename(
  mediaType: SightingMediaType,
  workSlug: string,
  options?: {
    confidence?: Confidence;
    season?: number;
    episode?: number;
  },
): string {
  if (mediaType === 'tv') {
    const loose = isUnverified(options?.confidence);
    if (!loose && (options?.season == null || options?.episode == null)) {
      throw new Error(
        'TV sightings require season and episode for the filename unless confidence is unverified',
      );
    }
    const suffix =
      options?.season != null && options?.episode != null
        ? formatTvEpisodeSuffix(options.season, options.episode)
        : '';
    return `tv-${workSlug}${suffix}.md`;
  }

  return `${mediaType}-${workSlug}.md`;
}

export function parseSightingFilename(
  basename: string,
): ParsedSightingFilename | null {
  const tvWithSuffix = basename.match(TV_FILENAME_WITH_SUFFIX);
  if (tvWithSuffix?.groups) {
    return {
      mediaType: 'tv',
      workSlug: tvWithSuffix.groups.workSlug,
      season: Number(tvWithSuffix.groups.season),
      episode: Number(tvWithSuffix.groups.episode),
    };
  }

  const tvLoose = basename.match(TV_FILENAME_LOOSE);
  if (tvLoose?.groups) {
    return {
      mediaType: 'tv',
      workSlug: tvLoose.groups.workSlug,
    };
  }

  const match = basename.match(NON_TV_FILENAME);
  if (match?.groups) {
    return {
      mediaType: match.groups.mediaType as SightingMediaType,
      workSlug: match.groups.workSlug,
    };
  }

  return null;
}

export function validateSightingFilename(
  basename: string,
  mediaType: string,
  options?: {
    confidence?: Confidence;
    season?: number;
    episode?: number;
  },
): string | null {
  const loose = isUnverified(options?.confidence);
  const parsed = parseSightingFilename(basename);

  if (!parsed) {
    return (
      `filename "${basename}" must match ` +
      `{mediaType}-{work-slug}.md (e.g. movie-saw-2004.md) or ` +
      `tv-{work-slug}.md / tv-{work-slug}-s{season}e{episode}.md — ` +
      'lowercase letters, numbers, and hyphens only'
    );
  }

  if (parsed.mediaType !== mediaType) {
    return `filename prefix "${parsed.mediaType}" does not match mediaType "${mediaType}" in frontmatter`;
  }

  if (mediaType === 'tv') {
    if (!loose && (options?.season == null || options?.episode == null)) {
      return 'TV sightings require season and episode in frontmatter unless confidence is unverified';
    }

    if (!loose && (parsed.season == null || parsed.episode == null)) {
      return (
        `filename "${basename}" must include -s{season}e{episode} ` +
        '(e.g. tv-show-name-s02e01.md) unless confidence is unverified'
      );
    }

    if (
      parsed.season != null &&
      parsed.episode != null &&
      options?.season != null &&
      options?.episode != null &&
      (parsed.season !== options.season || parsed.episode !== options.episode)
    ) {
      return (
        `filename has s${String(parsed.season).padStart(2, '0')}e${String(parsed.episode).padStart(2, '0')} ` +
        `but frontmatter has season ${options.season}, episode ${options.episode} — keep them in sync`
      );
    }
  } else if (options?.season != null || options?.episode != null) {
    return 'season and episode are only allowed when mediaType is tv';
  }

  return null;
}

export function formatTvEpisodeLabel(season: number, episode: number): string {
  return `S${season}E${episode}`;
}
