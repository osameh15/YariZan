export type BlogPost = {
  cover_image?: string | null;
  cover_alt?: string;
  cover_width?: number | null;
  cover_height?: number | null;
  id?: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  body: string;
  seo_title: string;
  seo_description: string;
  state?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  revision?: number;
  published_at: string | null;
  updated_at: string;
};
// Small text format: headings, paragraphs, list items and standalone links. HTML is always text.
export function blogBlocks(body: string) {
  return body
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((text, index) => {
      const link = /^\[([^\]\n]+)\]\(([^\s)]+)\)$/.exec(text.trim());
      const href = link?.[2] ?? '';
      const safeLink = /^https:\/\//.test(href) || /^\/(?!\/)[a-z0-9/-]+$/.test(href);
      return {
        id: `section-${index}`,
        type: text.startsWith('## ')
          ? 'heading'
          : text.startsWith('- ')
            ? 'list'
            : link && safeLink
              ? 'link'
              : 'paragraph',
        text: text.startsWith('## ') ? text.slice(3) : link && safeLink ? link[1]! : text,
        items: text.split('\n').map((line) => line.replace(/^- /, '')),
        href: safeLink ? href : '',
      };
    });
}
export function blogDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(value),
  );
}

export type BlogSummary = Omit<BlogPost, 'body'>;
