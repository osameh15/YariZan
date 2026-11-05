import type { BlogSummary } from '#shared/blog-model';
export function useBlogPosts() {
  const { live } = useSiteMode();
  const request = useRequestFetch();
  return useAsyncData('published-blog-feed', () =>
    live.value
      ? request<{ posts: BlogSummary[] }>('/api/v2/blog')
      : Promise.resolve({ posts: [] as BlogSummary[] }),
  );
}
