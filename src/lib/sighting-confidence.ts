export const CONFIDENCE_LEVELS = [
  'verified',
  'likely',
  'disputed',
  'unverified',
] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export function isUnverified(confidence: Confidence | undefined): boolean {
  return confidence === 'unverified';
}

export interface SightingValidationFields {
  confidence?: Confidence;
  mediaType: string;
  year?: number;
  sceneDescription?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

/** Fields required when confidence is not unverified. Used by schema + validate script. */
export function strictFieldIssues(
  data: SightingValidationFields,
): Array<{ path: (string | number)[]; message: string }> {
  if (isUnverified(data.confidence)) {
    return [];
  }

  const issues: Array<{ path: (string | number)[]; message: string }> = [];

  if (data.year == null) {
    issues.push({
      path: ['year'],
      message: 'year is required unless confidence is unverified',
    });
  }

  if (!data.sceneDescription?.trim()) {
    issues.push({
      path: ['sceneDescription'],
      message: 'sceneDescription is required unless confidence is unverified',
    });
  }

  if (data.mediaType === 'tv') {
    if (data.season == null) {
      issues.push({
        path: ['season'],
        message:
          'season is required when mediaType is tv unless confidence is unverified',
      });
    }
    if (data.episode == null) {
      issues.push({
        path: ['episode'],
        message:
          'episode is required when mediaType is tv unless confidence is unverified',
      });
    }
  } else if (
    data.season != null ||
    data.episode != null ||
    data.episodeTitle != null
  ) {
    issues.push({
      path: ['mediaType'],
      message:
        'season, episode, and episodeTitle are only allowed when mediaType is tv',
    });
  }

  return issues;
}

/** Warnings for incomplete unverified entries (never blocking). */
export function unverifiedCompletenessWarnings(
  data: SightingValidationFields,
): string[] {
  if (!isUnverified(data.confidence)) {
    return [];
  }

  const warnings: string[] = [];

  if (data.year == null) {
    warnings.push('year is not set yet');
  }
  if (!data.sceneDescription?.trim()) {
    warnings.push('sceneDescription is not set yet');
  }
  if (data.mediaType === 'tv') {
    if (data.season == null || data.episode == null) {
      warnings.push('season/episode not set yet');
    }
  }

  return warnings;
}
