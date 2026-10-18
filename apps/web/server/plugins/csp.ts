import { randomBytes } from 'node:crypto';
import { defineNitroPlugin } from 'nitropack/runtime';
import { setHeader } from 'h3';
export default defineNitroPlugin((app) => {
  app.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(24).toString('base64');
    setHeader(
      event,
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://trustseal.enamad.ir; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
    );
    for (const field of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const)
      html[field] = html[field].map((part) =>
        part.replace(/<script\b/g, `<script nonce="${nonce}"`),
      );
  });
});
