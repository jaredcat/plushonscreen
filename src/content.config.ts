import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  CONFIDENCE_LEVELS,
  strictFieldIssues,
} from './lib/sighting-confidence';
import { SOCIAL_PLATFORMS } from './lib/social';

const sightingObjectSchema = z.object({
  title: z.string(),
  year: z.number().int().optional(),
  mediaType: z.enum(['movie', 'tv', 'short', 'game', 'other']),
  plush: z.string(),
  sceneDescription: z.string().optional(),
  season: z.number().int().positive().optional(),
  episode: z.number().int().positive().optional(),
  episodeTitle: z.string().optional(),
  timestamp: z.string().optional(),
  confidence: z.enum(CONFIDENCE_LEVELS).default('likely'),
  submittedBy: z
    .object({
      platform: z.enum(SOCIAL_PLATFORMS),
      username: z.string(),
    })
    .optional(),
  imdb: z.string().optional(),
  clipUrl: z.url().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  addedDate: z.coerce.date().optional(),
});

function refineSightingFields(
  data: z.infer<typeof sightingObjectSchema>,
  ctx: z.RefinementCtx,
): void {
  for (const issue of strictFieldIssues(data)) {
    ctx.addIssue({ code: 'custom', ...issue });
  }
}

// Filename convention: src/lib/sighting-naming.ts and CONTRIBUTING.md
const sightings = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/example-*.md'],
    base: './src/content/sightings',
  }),
  schema: ({ image }) =>
    sightingObjectSchema
      .extend({ screenshot: image().optional() })
      .superRefine(refineSightingFields),
});

export const collections = { sightings };
