import { useRuntimeConfig } from 'nitropack/runtime';
import { backendBase } from '#shared/proxy-policy';
import type { BlogSummary } from '#shared/blog-model';
import { serverSiteMode } from './site-mode';
export async function publishedBlog() {
  if (serverSiteMode() !== 'full') return [] as BlogSummary[];
  const response = await fetch(new URL('blog', backendBase(useRuntimeConfig().apiBase)), {
    signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Published blog unavailable');
  return ((await response.json()) as { posts: BlogSummary[] }).posts;
}
