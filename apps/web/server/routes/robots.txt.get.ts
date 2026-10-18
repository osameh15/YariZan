import { defineEventHandler, setHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { canonicalOrigin, parseIndexing, robotsTxt } from '#shared/seo';

// noindex by default: the whole site is disallowed until indexing is explicitly accepted.
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=300');
  return robotsTxt(
    parseIndexing(process.env.YARIZAN_SEO_INDEXING),
    canonicalOrigin(useRuntimeConfig().webOrigin),
  );
});
