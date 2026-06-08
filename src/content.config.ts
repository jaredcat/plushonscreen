import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SOCIAL_PLATFORMS } from './lib/social';

// A "sighting" is one appearance of one plush in one piece of media.
// The schema is the single source of truth for what we track — if a field
// isn't here, it isn't recorded. Keep it small; add fields only when a real
// sighting needs them (YAGNI).
const sightings = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/example-*.md'],
    base: './src/content/sightings',
  }),
  schema: ({ image }) =>
    z.object({
      // --- Required ---
      title: z.string(), // the movie / show title
      year: z.number().int(),
      mediaType: z.enum(['movie', 'tv', 'short', 'game', 'other']),
      plush: z.string(), // plush id, e.g. "djungelorm" — see src/plushes.ts
      sceneDescription: z.string(), // where/when it appears, who has it, how visible

      // --- Strongly recommended ---
      // Screenshot is the heart of the site. Store under each plush folder, e.g.
      // src/content/sightings/djungelorm/images/, so Astro can optimize it.
      // Optional only so a sighting can be logged before someone grabs a still.
      screenshot: image().optional(),
      timestamp: z.string().optional(), // "1:04:32"
      confidence: z.enum(['verified', 'likely', 'disputed']).default('likely'),
      submittedBy: z
        .object({
          platform: z.enum(SOCIAL_PLATFORMS),
          username: z.string(),
        })
        .optional(),

      // --- Nice to have ---
      imdb: z.string().optional(), // imdb id like "tt0126029"
      clipUrl: z.url().optional(),
      tags: z.array(z.string()).default([]),
      notes: z.string().optional(),

      // --- Bookkeeping ---
      addedDate: z.coerce.date().optional(),
    }),
});

export const collections = { sightings };
