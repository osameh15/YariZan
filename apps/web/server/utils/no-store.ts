import { setHeader, type H3Event } from 'h3';

// Nuxt's error renderer marks 404 responses "no-cache", which still lets a cache store them.
// Responses that must never be stored keep "no-store" even when an error page is rendered later.
export function pinNoStore(event: H3Event) {
  const response = event.node.res,
    setHeaderOriginal = response.setHeader.bind(response);
  response.setHeader = (name, value) =>
    setHeaderOriginal(name, name.toLowerCase() === 'cache-control' ? 'no-store' : value);
  setHeader(event, 'Cache-Control', 'no-store');
}
