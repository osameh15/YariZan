import { useRuntimeConfig } from '#imports';
import { defineEventHandler, setHeader, setResponseStatus, createError } from 'h3';
import { fetchCapabilities, requiredCapabilities } from '#shared/capabilities';
import { backendBase } from '#shared/proxy-policy';
import { brochureDecision } from '#shared/site-mode';
import { serverSiteMode } from '../utils/site-mode';
import { pinNoStore } from '../utils/no-store';

// Public-only boundary (brochure and storefront). Runs after security.ts (alphabetical order) and before every page,
// server route and API handler, so protected routes fail closed before their own logic runs.
const retryAfterSeconds = 3600;
export default defineEventHandler(async (event) => {
  if (serverSiteMode() === 'full') {
    // Full application: a page whose Backend capability is disabled is unavailable, exactly like
    // the public-only profiles, instead of rendering a form the Backend would refuse.
    const path = (event.node.req.url ?? '').split('?')[0] ?? '';
    const needed = requiredCapabilities(path);
    if (!needed.length || path.startsWith('/api/')) return;
    const enabled = await fetchCapabilities(backendBase(useRuntimeConfig(event).apiBase));
    if (needed.every((id) => enabled.includes(id))) return;
    pinNoStore(event);
    setHeader(event, 'Retry-After', retryAfterSeconds);
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' });
  }
  // Use the raw request target: h3 may already have decoded or normalized event.path.
  const decision = brochureDecision(event.method, event.node.req.url ?? '');
  if (decision === 'page' || decision === 'asset' || decision === 'health') return;
  pinNoStore(event);
  if (decision === 'internal-error') return;
  if (decision === 'api-disabled') {
    setResponseStatus(event, 503, 'Service Unavailable');
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8');
    setHeader(event, 'Retry-After', retryAfterSeconds);
    return JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } });
  }
  if (decision === 'method-not-allowed') {
    setResponseStatus(event, 405, 'Method Not Allowed');
    setHeader(event, 'Allow', 'GET, HEAD');
    setHeader(event, 'Content-Type', 'application/json; charset=utf-8');
    return JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED' } });
  }
  if (decision === 'page-disabled') {
    setHeader(event, 'Retry-After', retryAfterSeconds);
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable' });
  }
  throw createError({ statusCode: 404, statusMessage: 'Not Found' });
});
