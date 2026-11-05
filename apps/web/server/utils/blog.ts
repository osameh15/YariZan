import { useRuntimeConfig } from 'nitropack/runtime';
import { backendBase } from '#shared/proxy-policy';
import type { BlogPost } from '#shared/blog-model';
import { serverSiteMode } from './site-mode';
export async function publishedBlog() {
  if (serverSiteMode() !== 'full') return [] as BlogPost[];
  const response = await fetch(new URL('blog', backendBase(useRuntimeConfig().apiBase)), {
    signal: AbortSignal.timeout(5000),
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Published blog unavailable');
  return ((await response.json()) as { posts: BlogPost[] }).posts;
}
