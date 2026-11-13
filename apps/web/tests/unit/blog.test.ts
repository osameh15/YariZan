import { describe, it, expect } from 'vitest';
import { blogBlocks, blogInline } from '../../shared/blog-model';
import { sitemapXml, pageMetadata, jsonLd } from '../../shared/seo';
describe('safe editorial content and discovery', () => {
  it('renders multiple inline links while preserving prose and rejecting unsafe destinations', () => {
    expect(
      blogInline(
        'Try [game](/special-products/combination-land) and [guide](/blog/shape-and-colour-pattern-games).',
      ),
    ).toEqual([
      { text: 'Try ' },
      { text: 'game', href: '/special-products/combination-land' },
      { text: ' and ' },
      { text: 'guide', href: '/blog/shape-and-colour-pattern-games' },
      { text: '.' },
    ]);
    expect(blogInline('<script> [bad](javascript:alert) [bad](//example.com)')).toEqual([
      { text: '<script> [bad](javascript:alert) [bad](//example.com)' },
    ]);
  });
  it('treats HTML and executable URLs as text while retaining safe sources', () => {
    const blocks = blogBlocks(
      '## A heading\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert)\n\n[source](https://example.com/source)\n\n[local](/products)',
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'link',
      'link',
    ]);
    expect(blocks[1]!.text).toContain('<script>');
    expect(jsonLd({ text: '</script>' })).not.toContain('</script>');
  });
  it('adds only supplied published article paths to the sitemap and handles new metadata', () => {
    const xml = sitemapXml('https://yarizan.oarnova.games', [
      '/blog/approved-post',
      '/account',
      '/blog/<script>',
    ]);
    expect(xml).toContain('/blog/approved-post');
    expect(xml).not.toContain('/account');
    expect(xml).not.toContain('<script>');
    expect(pageMetadata('/blog/a-new-post').title).toContain('وبلاگ');
  });
});
