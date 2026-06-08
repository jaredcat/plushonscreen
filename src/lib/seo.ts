import type { Plush } from '../plushes';

const MEDIA_TYPE_LABEL: Record<string, string> = {
  movie: 'movie',
  tv: 'TV show',
  short: 'short film',
  game: 'video game',
  other: 'video',
};

const SCHEMA_MEDIA_TYPE: Record<string, string> = {
  movie: 'Movie',
  tv: 'TVSeries',
  short: 'Movie',
  game: 'VideoGame',
  other: 'CreativeWork',
};

export const SITE_NAME = 'PlushOnScreen';

export const DEFAULT_DESCRIPTION =
  'A community database of IKEA plush toy sightings in movies, TV shows, and music videos. Track the Djungelorm snake and other plushes on screen.';

export function sightingPageTitle(
  title: string,
  year: number,
  plush?: Plush,
): string {
  const plushLabel = plush?.name ?? 'IKEA Plush';
  return `${title} (${year}) — ${plushLabel} Sighting`;
}

export function sightingDescription(
  title: string,
  year: number,
  mediaType: string,
  sceneDescription: string,
  plush?: Plush,
): string {
  const media = MEDIA_TYPE_LABEL[mediaType] ?? mediaType;
  const plushName = plush?.fullName ?? 'IKEA plush';
  const scene = sceneDescription.replace(/\s+/g, ' ').trim();
  const excerpt =
    scene.length > 140 ? `${scene.slice(0, 137).trimEnd()}…` : scene;
  return `The ${plushName} appears in ${title} (${year}), a ${media}. ${excerpt}`;
}

export function sightingJsonLd(input: {
  title: string;
  year: number;
  mediaType: string;
  sceneDescription: string;
  plush?: Plush;
  url: string;
  image?: string;
  datePublished?: string;
  author?: string;
}) {
  const mediaSchema = SCHEMA_MEDIA_TYPE[input.mediaType] ?? 'CreativeWork';

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: sightingPageTitle(input.title, input.year, input.plush),
    description: sightingDescription(
      input.title,
      input.year,
      input.mediaType,
      input.sceneDescription,
      input.plush,
    ),
    url: input.url,
    ...(input.image && { image: input.image }),
    ...(input.datePublished && { datePublished: input.datePublished }),
    ...(input.author && {
      author: { '@type': 'Person', name: input.author },
    }),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: 'https://plushonscreen.com',
    },
    about: {
      '@type': mediaSchema,
      name: input.title,
      datePublished: String(input.year),
    },
    keywords: [
      input.plush?.name,
      input.plush?.fullName,
      'IKEA plush',
      'plush sighting',
      'product placement',
    ]
      .filter(Boolean)
      .join(', '),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: 'https://plushonscreen.com',
  };
}
