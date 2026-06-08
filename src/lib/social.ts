export const SOCIAL_PLATFORMS = [
  'github',
  'instagram',
  'tiktok',
  'bluesky',
  'youtube',
  'twitch',
  'reddit',
  'threads',
  'pinterest',
  'none',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SubmittedBy {
  platform: SocialPlatform;
  username: string;
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  github: 'GitHub',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  bluesky: 'Bluesky',
  youtube: 'YouTube',
  twitch: 'Twitch',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  threads: 'Threads',
  none: 'Name only',
};

// Linked platforms: alphanumeric handles only — no slashes, dots in paths, or URLs.
const LINKED_USERNAME = /^[a-zA-Z0-9._-]{1,39}$/;
// Name-only credit: display text, but still block URL injection.
const DISPLAY_NAME = /^(?!.*(?:https?:\/\/|www\.))[\w .,'-]{1,50}$/i;

const URL_TEMPLATES: Record<
  Exclude<SocialPlatform, 'none'>,
  (username: string) => string
> = {
  github: (u) => `https://github.com/${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
  instagram: (u) => `https://instagram.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  twitch: (u) => `https://twitch.tv/${u}`,
  reddit: (u) => `https://reddit.com/user/${u}`,
  bluesky: (u) => `https://bsky.app/profile/${u}`,
  threads: (u) => `https://threads.net/@${u}`,
  pinterest: (u) => `https://pinterest.com/${u}`,
};

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, '');
}

export function isValidSubmittedBy(value: SubmittedBy): boolean {
  const username = normalizeUsername(value.username);
  if (!username) return false;
  if (value.platform === 'none') {
    return DISPLAY_NAME.test(username);
  }
  return LINKED_USERNAME.test(username);
}

export function contributorKey(submittedBy: SubmittedBy): string {
  const username = normalizeUsername(submittedBy.username);
  return `${submittedBy.platform}:${username.toLowerCase()}`;
}

export function profileUrl(submittedBy: SubmittedBy): string | null {
  if (submittedBy.platform === 'none') return null;
  const username = normalizeUsername(submittedBy.username);
  return URL_TEMPLATES[submittedBy.platform](username);
}

export function contributorLabel(submittedBy: SubmittedBy): string {
  const username = normalizeUsername(submittedBy.username);
  if (submittedBy.platform === 'none') return username;
  return `@${username}`;
}

export function contributorDisplay(submittedBy: SubmittedBy): {
  label: string;
  url: string | null;
  platform: string;
} {
  return {
    label: contributorLabel(submittedBy),
    url: profileUrl(submittedBy),
    platform: PLATFORM_LABELS[submittedBy.platform],
  };
}
