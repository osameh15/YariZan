import { defineEventHandler, setHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { canonicalOrigin, sitemapXml } from '#shared/seo';

// Public, content-reviewed pages only; account, checkout, payment and Admin routes never appear.
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'public, max-age=300');
  return sitemapXml(canonicalOrigin(useRuntimeConfig().webOrigin));
});
