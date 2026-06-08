// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

// Cloudflare Pages serves the static `dist/` output directly.
// If you later switch to a custom domain, set `site` to it for correct canonical URLs / sitemap.
export default defineConfig({
  site: 'https://plushonscreen.com',

  build: {
    format: 'directory',
  },

  adapter: cloudflare(),
});