import { defineEventHandler, setHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { publishedBlog } from '../utils/blog';
import { canonicalOrigin, sitemapXml } from '#shared/seo';

// Public, content-reviewed pages only; account, checkout, payment and Admin routes never appear.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setHeader(event, 'Cache-Control', 'no-store');
  return sitemapXml(
    canonicalOrigin(useRuntimeConfig().webOrigin),
    (await publishedBlog()).map((p) => '/blog/' + p.slug),
  );
});
