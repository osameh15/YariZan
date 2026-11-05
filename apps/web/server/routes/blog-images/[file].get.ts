import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3';
import { useRuntimeConfig } from 'nitropack/runtime';
import { backendBase } from '#shared/proxy-policy';
import { parseIndexing } from '#shared/seo';
export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? '';
  if (!/^[0-9a-f-]{36}\.webp$/.test(file)) throw createError({ statusCode: 404 });
  const id = file.slice(0, -5);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw createError({ statusCode: 404 });
  const response = await fetch(
    new URL('blog/images/' + id, backendBase(useRuntimeConfig().apiBase)),
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok)
    throw createError({ statusCode: [400, 404].includes(response.status) ? 404 : 503 });
  if (response.headers.get('content-type')?.split(';')[0] !== 'image/webp')
    throw createError({ statusCode: 503 });
  const image = Buffer.from(await response.arrayBuffer());
  if (image.length > 350000) throw createError({ statusCode: 503 });
  setHeader(event, 'Content-Type', 'image/webp');
  setHeader(event, 'Cache-Control', 'no-store');
  setHeader(
    event,
    'X-Robots-Tag',
    parseIndexing(process.env.YARIZAN_SEO_INDEXING) === 'index'
      ? 'index, follow'
      : 'noindex, nofollow',
  );
  return image;
});
