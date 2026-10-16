import { defineEventHandler, setHeader } from 'h3';

// Independent liveness probe: never calls the API, DB, or third-party services.
export default defineEventHandler((event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  return 'ok';
});
