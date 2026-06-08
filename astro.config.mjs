// @ts-check
import { defineConfig } from 'astro/config';

// Static `dist/` is deployed to Cloudflare Workers via wrangler.jsonc.
// If you later switch to a custom domain, set `site` to it for correct canonical URLs / sitemap.
export default defineConfig({
  site: 'https://plushonscreen.com',
  build: {
    format: 'directory',
  },
});
